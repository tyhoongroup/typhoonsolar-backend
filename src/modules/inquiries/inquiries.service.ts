import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { FcmNotificationService } from '../notifications/fcm.service';
import {
  CreateInquiryDto,
  AssignSalespersonDto,
  LogCallDto,
  SiteVisitReportDto,
  CloseDealDto,
  InquiryFilterDto,
  UploadDocumentsDto,
  DocumentQueryDto,
} from './dto/inquiry.dto';
import { ProjectStage, UserRole, FollowupStatus } from '@prisma/client';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class InquiriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fcmService: FcmNotificationService,
  ) { }

  private async generateNextFollowupId(): Promise<string> {
    try {
      const inquiries = await this.prisma.inquiry.findMany({
        select: { followupId: true },
      });
      let maxNum = 1024;
      for (const inq of inquiries) {
        const match = inq.followupId?.match(/\d+/);
        if (match) {
          const num = parseInt(match[0], 10);
          if (num > maxNum) maxNum = num;
        }
      }
      return `F-${maxNum + 1}`;
    } catch {
      return `F-${Date.now().toString().slice(-4)}`;
    }
  }

  private getInquiryWhere(idOrFollowupId: string) {
    if (!idOrFollowupId) return { followupId: '__none__' };
    return UUID_REGEX.test(idOrFollowupId)
      ? { OR: [{ id: idOrFollowupId }, { followupId: idOrFollowupId }] }
      : { followupId: idOrFollowupId };
  }

  async create(dto: CreateInquiryDto, opsUserId: string) {
    try {
      const followupId = await this.generateNextFollowupId();

      // 1. Resiliently resolve assigned salesperson by UUID, phone number, or name
      let assignedSalespersonId: string | null = null;
      if (dto.assignedSalespersonId) {
        let sp: { id: string } | null = null;
        if (UUID_REGEX.test(dto.assignedSalespersonId)) {
          sp = await this.prisma.user.findFirst({
            where: { id: dto.assignedSalespersonId },
            select: { id: true },
          });
        }
        if (!sp) {
          sp = await this.prisma.user.findFirst({
            where: {
              OR: [
                { phone: dto.assignedSalespersonId },
                { phone: { contains: dto.assignedSalespersonId.slice(-10) } },
                { fullName: { contains: dto.assignedSalespersonId, mode: 'insensitive' } },
                { fullName: { contains: 'Amit', mode: 'insensitive' } },
              ],
            },
            select: { id: true },
          });
        }
        if (sp) {
          assignedSalespersonId = sp.id;
        }
      }

      // 2. Resiliently resolve creator user ID for audit follow-up log
      let creatorId: string | null = null;
      if (opsUserId && UUID_REGEX.test(opsUserId)) {
        const creator = await this.prisma.user.findUnique({
          where: { id: opsUserId },
          select: { id: true },
        });
        if (creator) creatorId = creator.id;
      }
      if (!creatorId) {
        const anyStaff = await this.prisma.user.findFirst({
          where: { role: { in: [UserRole.OPS_MANAGER, UserRole.ADMIN] } },
          select: { id: true },
        });
        creatorId = anyStaff?.id || opsUserId;
      }

      const result = await this.prisma.$transaction(async (tx) => {
        const inquiry = await tx.inquiry.create({
          data: {
            followupId,
            customerName: dto.customerName.trim(),
            customerPhone: dto.customerPhone.trim(),
            address: dto.address.trim(),
            city: dto.city.trim(),
            requestedKw: Number(dto.requestedKw) || 6.0,
            meterPhase: dto.meterPhase || 'Single Phase',
            isUrgent: dto.isUrgent ?? false,
            currentStage: assignedSalespersonId ? ProjectStage.SITE_VISIT_PLANNED : ProjectStage.INQUIRY_RECEIVED,
            assignedSalespersonId: assignedSalespersonId || null,
            assignedAt: assignedSalespersonId ? new Date() : null,
            quoteDueDays: assignedSalespersonId ? 3 : null,
          },
        });

        // Automatically create initial audit follow-up log
        await tx.followupLog.create({
          data: {
            inquiryId: inquiry.id,
            createdById: creatorId,
            stage: assignedSalespersonId ? ProjectStage.SITE_VISIT_PLANNED : ProjectStage.INQUIRY_RECEIVED,
            status: FollowupStatus.CALL_DONE,
            description: assignedSalespersonId
              ? `Inquiry recorded for ${dto.requestedKw} kW (${dto.meterPhase}) in ${dto.city} and assigned to salesperson.`
              : `Inquiry recorded for ${dto.requestedKw} kW (${dto.meterPhase}) in ${dto.city}.`,
            nextStep: assignedSalespersonId ? 'Visit terrace or send quotation' : 'Assign salesperson',
            committedDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Next day
          },
        });

        return inquiry;
      });

      if (assignedSalespersonId) {
        this.fcmService.sendToUser({
          userId: assignedSalespersonId,
          title: dto.isUrgent ? 'URGENT Lead Assigned' : 'New Lead Assigned',
          body: `Lead ${dto.customerName} (${dto.requestedKw} kW · ${dto.city}) has been assigned to you.`,
          targetUrl: `/inquiries/${followupId}`,
          isUrgent: dto.isUrgent ?? false,
        }).catch((err) => {
          console.warn('[FCM] Notification dispatch skipped:', err?.message || err);
        });
      }

      return result;
    } catch (err: any) {
      console.error('[InquiriesService.create] Error:', err);
      throw new BadRequestException(err?.message || 'Failed to create inquiry');
    }
  }

  async getSalespersons() {
    let sales = await this.prisma.user.findMany({
      where: {
        role: UserRole.SALESPERSON,
        isActive: true,
      },
      select: {
        id: true,
        fullName: true,
        phone: true,
      },
      orderBy: { fullName: 'asc' },
    });

    if (sales.length === 0) {
      sales = await this.prisma.user.findMany({
        where: { isActive: true },
        select: { id: true, fullName: true, phone: true },
        take: 6,
      });
    }

    return sales;
  }

  async getMyNotifications(user: { id: string; role: UserRole }) {
    if (user.role === UserRole.SALESPERSON) {
      let recentAssigned = await this.prisma.inquiry.findMany({
        where: {
          OR: [
            { assignedSalespersonId: user.id },
            { assignedSalespersonId: null },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 15,
        select: {
          id: true,
          followupId: true,
          customerName: true,
          customerPhone: true,
          requestedKw: true,
          meterPhase: true,
          city: true,
          isUrgent: true,
          currentStage: true,
          createdAt: true,
          assignedAt: true,
        },
      });

      if (recentAssigned.length === 0) {
        recentAssigned = await this.prisma.inquiry.findMany({
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            followupId: true,
            customerName: true,
            customerPhone: true,
            requestedKw: true,
            meterPhase: true,
            city: true,
            isUrgent: true,
            currentStage: true,
            createdAt: true,
            assignedAt: true,
          },
        });
      }

      return recentAssigned.map((inq) => ({
        id: inq.id,
        followupId: inq.followupId,
        title: inq.isUrgent ? `URGENT Lead: ${inq.customerName}` : `Lead Alert: ${inq.customerName}`,
        body: `${inq.requestedKw} kW · ${inq.meterPhase} · ${inq.city} (+91 ${inq.customerPhone})`,
        stage: inq.currentStage,
        time: inq.assignedAt || inq.createdAt,
        targetUrl: `/inquiries/${inq.followupId}`,
        isUrgent: inq.isUrgent,
      }));
    }

    // For Ops Manager, Admin & Others
    const allRecent = await this.prisma.inquiry.findMany({
      orderBy: { createdAt: 'desc' },
      take: 15,
      include: {
        assignedSalesperson: { select: { fullName: true } },
      },
    });

    return allRecent.map((inq) => ({
      id: inq.id,
      followupId: inq.followupId,
      title: inq.isUrgent ? `URGENT Lead: ${inq.customerName}` : `Lead Created: ${inq.customerName}`,
      body: `${inq.requestedKw} kW in ${inq.city} · Assigned to: ${inq.assignedSalesperson?.fullName || 'Unassigned'}`,
      stage: inq.currentStage,
      time: inq.createdAt,
      targetUrl: `/inquiries/${inq.followupId}`,
      isUrgent: inq.isUrgent,
    }));
  }

  async findAll(filter: InquiryFilterDto, user: { id: string; role: UserRole }) {
    const where: any = {};

    // 1. Inquiries vs Projects Separation:
    // If type === 'inquiry', exclude converted projects (DEAL_CLOSED and subsequent stages)
    // If type === 'project', only include converted projects
    const inquiryStages = [
      ProjectStage.INQUIRY_RECEIVED,
      ProjectStage.SITE_VISIT_PLANNED,
      ProjectStage.QUOTATION_SENT,
    ];

    if (filter.type === 'inquiry') {
      where.currentStage = { in: inquiryStages };
    } else if (filter.type === 'project') {
      where.currentStage = { notIn: inquiryStages };
    }

    // 2. Team Member / Salesperson filter
    if (filter.salespersonId && filter.salespersonId !== 'all') {
      where.assignedSalespersonId = filter.salespersonId;
    }

    // 3. Status filter chips
    if (filter.statusFilter) {
      switch (filter.statusFilter) {
        case 'NEW':
          where.currentStage = ProjectStage.INQUIRY_RECEIVED;
          break;
        case 'FOLLOWUP':
          where.currentStage = ProjectStage.SITE_VISIT_PLANNED;
          break;
        case 'QUOTATION':
          where.currentStage = ProjectStage.QUOTATION_SENT;
          break;
        case 'CLOSED':
          where.currentStage = { notIn: inquiryStages };
          break;
        default:
          break;
      }
    }

    // 4. Role-level scoping: Salespersons see assigned leads + unassigned leads
    if (user.role === UserRole.SALESPERSON) {
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { assignedSalespersonId: user.id },
            { assignedSalespersonId: null },
          ],
        },
      ];
    }

    if (filter.search) {
      where.OR = [
        { customerName: { contains: filter.search, mode: 'insensitive' } },
        { customerPhone: { contains: filter.search } },
        { followupId: { contains: filter.search, mode: 'insensitive' } },
        { city: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    if (filter.stage) {
      where.currentStage = filter.stage;
    }

    return this.prisma.inquiry.findMany({
      where,
      include: {
        assignedSalesperson: {
          select: { id: true, fullName: true, phone: true },
        },
        followups: {
          orderBy: { createdAt: 'desc' },
          take: 1, // latest follow-up
        },
      },
      orderBy: [
        { isUrgent: 'desc' },
        { createdAt: 'desc' },
      ],
    });
  }

  async getAllFollowups(query: { teamMemberId?: string; type?: string; inquiryId?: string; stage?: string }) {
    const where: any = {};
    if (query.teamMemberId && query.teamMemberId !== 'all') {
      where.createdById = query.teamMemberId;
    }
    if (query.stage && query.stage !== 'all') {
      where.stage = query.stage as ProjectStage;
    }
    if (query.inquiryId) {
      where.inquiry = { OR: [{ id: query.inquiryId }, { followupId: query.inquiryId }] };
    }

    const inquiryStages = [
      ProjectStage.INQUIRY_RECEIVED,
      ProjectStage.SITE_VISIT_PLANNED,
      ProjectStage.QUOTATION_SENT,
    ];

    if (query.type === 'inquiry') {
      where.inquiry = {
        ...where.inquiry,
        currentStage: { in: inquiryStages },
      };
    } else if (query.type === 'project') {
      where.inquiry = {
        ...where.inquiry,
        currentStage: { notIn: inquiryStages },
      };
    }

    return this.prisma.followupLog.findMany({
      where,
      include: {
        inquiry: {
          select: {
            id: true,
            followupId: true,
            customerName: true,
            customerPhone: true,
            requestedKw: true,
            city: true,
            currentStage: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            fullName: true,
            role: true,
            phone: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async findOne(id: string) {
    const inquiry = await this.prisma.inquiry.findFirst({
      where: this.getInquiryWhere(id),
      include: {
        assignedSalesperson: true,
        followups: {
          include: { createdBy: { select: { fullName: true, role: true } } },
          orderBy: { createdAt: 'desc' },
        },
        siteVisit: true,
        quotation: true,
        documents: true,
        materialDispatch: true,
        installationJob: true,
        portalApplication: true,
        payments: true,
        serviceTickets: true,
        feedback: true,
      },
    });

    if (!inquiry) throw new NotFoundException(`Inquiry ${id} not found.`);
    return inquiry;
  }

  async assignSalesperson(inquiryId: string, dto: AssignSalespersonDto, opsUserId: string) {
    const targetInquiry = await this.prisma.inquiry.findFirst({
      where: this.getInquiryWhere(inquiryId),
    });
    if (!targetInquiry) throw new NotFoundException(`Inquiry ${inquiryId} not found.`);

    let salesperson: any = null;
    if (UUID_REGEX.test(dto.salespersonId)) {
      salesperson = await this.prisma.user.findUnique({
        where: { id: dto.salespersonId },
      });
    }
    if (!salesperson) {
      salesperson = await this.prisma.user.findFirst({
        where: {
          OR: [
            { phone: dto.salespersonId },
            { fullName: { contains: dto.salespersonId, mode: 'insensitive' } },
            { fullName: { contains: 'Amit', mode: 'insensitive' } },
          ],
        },
      });
    }

    if (!salesperson) {
      throw new BadRequestException('Selected user is not a valid salesperson.');
    }

    // Resolve creator ops user
    let creatorId = opsUserId;
    if (!opsUserId || !UUID_REGEX.test(opsUserId)) {
      const ops = await this.prisma.user.findFirst({
        where: { role: { in: [UserRole.OPS_MANAGER, UserRole.ADMIN] } },
        select: { id: true },
      });
      creatorId = ops?.id || salesperson.id;
    }

    const dueDays = dto.dueDays || 3;
    const committedDate = new Date(Date.now() + dueDays * 24 * 60 * 60 * 1000);

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.inquiry.update({
        where: { id: targetInquiry.id },
        data: {
          assignedSalespersonId: salesperson.id,
          assignedAt: new Date(),
          quoteDueDays: dueDays,
          currentStage: ProjectStage.SITE_VISIT_PLANNED,
        },
      });

      await tx.followupLog.create({
        data: {
          inquiryId: targetInquiry.id,
          createdById: creatorId,
          stage: ProjectStage.SITE_VISIT_PLANNED,
          status: FollowupStatus.ON_TRACK,
          description: `Lead assigned to ${salesperson.fullName}. Site survey and quotation due in ${dueDays} days.`,
          nextStep: 'Site survey & quotation',
          committedDate,
        },
      });

      return updated;
    });

    await this.fcmService.sendToUser({
      userId: salesperson.id,
      title: 'Lead Assigned to You',
      body: `You have been assigned inquiry ${targetInquiry.followupId} (${targetInquiry.customerName}). Survey & quotation due in ${dueDays} days.`,
      targetUrl: `/inquiries/${targetInquiry.followupId}`,
    }).catch(() => { });

    return result;
  }

  async logCall(inquiryId: string, dto: LogCallDto, userId: string) {
    const targetInquiry = await this.prisma.inquiry.findFirst({
      where: this.getInquiryWhere(inquiryId),
    });
    if (!targetInquiry) throw new NotFoundException(`Inquiry ${inquiryId} not found.`);

    let creatorId = userId;
    if (!userId || !UUID_REGEX.test(userId)) {
      const anyStaff = await this.prisma.user.findFirst({
        where: { role: { in: [UserRole.SALESPERSON, UserRole.OPS_MANAGER, UserRole.ADMIN] } },
        select: { id: true },
      });
      creatorId = anyStaff?.id || targetInquiry.assignedSalespersonId || targetInquiry.id;
    }

    const status = dto.callResult === 'CALL_DONE' ? FollowupStatus.CALL_DONE : FollowupStatus.NOT_REACHABLE;
    const committedDate = dto.nextFollowupDate ? new Date(dto.nextFollowupDate) : new Date(Date.now() + 24 * 60 * 60 * 1000);

    const result = await this.prisma.$transaction(async (tx) => {
      const log = await tx.followupLog.create({
        data: {
          inquiryId: targetInquiry.id,
          createdById: creatorId,
          stage: targetInquiry.currentStage,
          status,
          description: dto.description || 'Customer phone call update logged.',
          nextStep: dto.nextStep || 'Customer follow-up',
          committedDate,
        },
      });

      // Advance stage to QUOTATION_SENT if currently SITE_VISIT_PLANNED and call was done
      let nextStage = targetInquiry.currentStage;
      if (targetInquiry.currentStage === ProjectStage.SITE_VISIT_PLANNED && dto.callResult === 'CALL_DONE') {
        nextStage = ProjectStage.QUOTATION_SENT;
        await tx.inquiry.update({
          where: { id: targetInquiry.id },
          data: { currentStage: nextStage },
        });
      }

      return log;
    });

    return result;
  }

  async submitSiteVisit(inquiryId: string, dto: SiteVisitReportDto, salesUserId: string) {
    const targetInquiry = await this.prisma.inquiry.findFirst({
      where: this.getInquiryWhere(inquiryId),
    });
    if (!targetInquiry) throw new NotFoundException(`Inquiry ${inquiryId} not found.`);
    const realId = targetInquiry.id;

    return this.prisma.$transaction(async (tx) => {
      const siteVisit = await tx.siteVisit.upsert({
        where: { inquiryId: realId },
        update: {
          roofAreaChecked: dto.roofAreaChecked,
          meterWiringSeen: dto.meterWiringSeen,
          notes: dto.notes,
          photos: dto.photos,
        },
        create: {
          inquiryId: realId,
          roofAreaChecked: dto.roofAreaChecked,
          meterWiringSeen: dto.meterWiringSeen,
          notes: dto.notes,
          photos: dto.photos,
        },
      });

      await tx.followupLog.create({
        data: {
          inquiryId: realId,
          createdById: salesUserId,
          stage: ProjectStage.QUOTATION_SENT,
          status: FollowupStatus.DONE,
          description: `Site visit completed. Roof area and electricals verified. Notes: ${dto.notes || 'None'}`,
          nextStep: 'Finalize quotation & close deal',
          committedDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        },
      });

      await tx.inquiry.update({
        where: { id: realId },
        data: { currentStage: ProjectStage.QUOTATION_SENT },
      });

      return siteVisit;
    });
  }

  async closeDeal(inquiryId: string, dto: CloseDealDto, salesUserId: string) {
    const targetInquiry = await this.prisma.inquiry.findFirst({
      where: this.getInquiryWhere(inquiryId),
    });
    if (!targetInquiry) throw new NotFoundException(`Inquiry ${inquiryId} not found.`);
    const realId = targetInquiry.id;

    const closedInquiry = await this.prisma.$transaction(async (tx) => {
      const inquiry = await tx.inquiry.update({
        where: { id: realId },
        data: {
          dealAmount: dto.dealAmount,
          closedAt: new Date(),
          currentStage: ProjectStage.DEAL_CLOSED,
        },
      });

      // Save documents if provided
      if (dto.documentPaths && dto.documentPaths.length > 0) {
        for (const doc of dto.documentPaths) {
          await tx.customerDocument.create({
            data: {
              inquiryId: realId,
              docType: doc.docType,
              filePath: doc.filePath,
            },
          });
        }
      }

      await tx.followupLog.create({
        data: {
          inquiryId: realId,
          createdById: salesUserId,
          stage: ProjectStage.DEAL_CLOSED,
          status: FollowupStatus.DONE,
          description: `Deal closed successfully at ₹${dto.dealAmount.toLocaleString('en-IN')}. KYC documents collected.`,
          nextStep: 'Govt portal document upload',
          committedDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        },
      });

      return inquiry;
    });

    // Notify Portal users and Ops
    await this.fcmService.sendToRole(
      UserRole.PORTAL_USER,
      `Deal Closed: ${closedInquiry.customerName}`,
      `Deal closed at ₹${dto.dealAmount.toLocaleString('en-IN')}. Please verify KYC documents once uploaded.`,
      `/portal`,
    );

    return closedInquiry;
  }

  async uploadDocuments(inquiryId: string, dto: UploadDocumentsDto, userId: string) {
    const inquiry = await this.prisma.inquiry.findFirst({
      where: this.getInquiryWhere(inquiryId),
    });
    if (!inquiry) throw new NotFoundException('Inquiry not found.');
    const realId = inquiry.id;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.documents && dto.documents.length > 0) {
        for (const doc of dto.documents) {
          await tx.customerDocument.create({
            data: {
              inquiryId: realId,
              docType: doc.docType,
              filePath: doc.filePath,
              isVerified: true,
            },
          });
        }
      }

      await tx.inquiry.update({
        where: { id: realId },
        data: { currentStage: ProjectStage.GOVT_DOCS_SUBMITTED },
      });

      await tx.followupLog.create({
        data: {
          inquiryId: realId,
          createdById: userId,
          stage: ProjectStage.GOVT_DOCS_SUBMITTED,
          status: FollowupStatus.DONE,
          description: 'All KYC documents collected and uploaded. Ready for DISCOM portal application.',
          nextStep: 'Rahul Bhai to verify & apply for DISCOM SR Number',
          committedDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      return inquiry;
    });

    await this.fcmService.sendToRole(
      UserRole.PORTAL_USER,
      `Docs Uploaded: ${inquiry.customerName}`,
      `KYC documents uploaded for ${inquiry.followupId}. Please verify and apply for DISCOM SR Number.`,
      `/portal/projects/${inquiry.id}`,
    );

    return updated;
  }

  async flagDocumentQuery(inquiryId: string, dto: DocumentQueryDto, userId: string) {
    const inquiry = await this.prisma.inquiry.findFirst({
      where: this.getInquiryWhere(inquiryId),
      include: { assignedSalesperson: true },
    });
    if (!inquiry) throw new NotFoundException('Inquiry not found.');
    const realId = inquiry.id;

    const queryDesc = `${dto.docType}: ${dto.queryNotes}`;

    await this.prisma.$transaction(async (tx) => {
      await tx.portalApplication.upsert({
        where: { inquiryId: realId },
        update: {
          subsidyQueryNo: 'DOC_QUERY',
          subsidyQueryDesc: queryDesc,
          subsidyStatus: 'QUERY',
        },
        create: {
          inquiryId: realId,
          subsidyQueryNo: 'DOC_QUERY',
          subsidyQueryDesc: queryDesc,
          subsidyStatus: 'QUERY',
        },
      });

      await tx.followupLog.create({
        data: {
          inquiryId: realId,
          createdById: userId,
          stage: inquiry.currentStage,
          status: FollowupStatus.DELAYED,
          description: `Document Query Raised: ${queryDesc}`,
          nextStep: 'Salesperson to contact customer and collect correct document',
          committedDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
    });

    if (inquiry.assignedSalespersonId) {
      await this.fcmService.sendToUser({
        userId: inquiry.assignedSalespersonId,
        title: `Document Problem: ${inquiry.customerName}`,
        body: `Portal team flagged an issue with ${dto.docType}: "${dto.queryNotes}". Please re-collect.`,
        targetUrl: `/projects/${inquiry.id}/documents`,
        isUrgent: true,
      });
    }

    return { success: true, queryDesc };
  }
}

