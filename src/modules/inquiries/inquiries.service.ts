import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { FcmNotificationService } from '../notifications/fcm.service';
import { CreateInquiryDto, AssignSalespersonDto, SiteVisitReportDto, CloseDealDto, InquiryFilterDto, UploadDocumentsDto, DocumentQueryDto } from './dto/inquiry.dto';
import { ProjectStage, UserRole, FollowupStatus } from '@prisma/client';

@Injectable()
export class InquiriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fcmService: FcmNotificationService,
  ) {}

  private async generateNextFollowupId(): Promise<string> {
    const count = await this.prisma.inquiry.count();
    return `F-${1001 + count}`;
  }

  async create(dto: CreateInquiryDto, opsUserId: string) {
    const followupId = await this.generateNextFollowupId();

    const result = await this.prisma.$transaction(async (tx) => {
      const inquiry = await tx.inquiry.create({
        data: {
          followupId,
          customerName: dto.customerName,
          customerPhone: dto.customerPhone,
          address: dto.address,
          city: dto.city,
          requestedKw: dto.requestedKw,
          meterPhase: dto.meterPhase,
          isUrgent: dto.isUrgent ?? false,
          currentStage: dto.assignedSalespersonId ? ProjectStage.SITE_VISIT_PLANNED : ProjectStage.INQUIRY_RECEIVED,
          assignedSalespersonId: dto.assignedSalespersonId || null,
          quoteDueDays: dto.assignedSalespersonId ? 3 : null,
        },
      });

      // Automatically create initial audit follow-up log
      await tx.followupLog.create({
        data: {
          inquiryId: inquiry.id,
          createdById: opsUserId,
          stage: dto.assignedSalespersonId ? ProjectStage.SITE_VISIT_PLANNED : ProjectStage.INQUIRY_RECEIVED,
          status: FollowupStatus.CALL_DONE,
          description: dto.assignedSalespersonId
            ? `Inquiry recorded for ${dto.requestedKw} kW (${dto.meterPhase}) in ${dto.city} and assigned to salesperson.`
            : `Inquiry recorded for ${dto.requestedKw} kW (${dto.meterPhase}) in ${dto.city}.`,
          nextStep: dto.assignedSalespersonId ? 'Visit terrace or send quotation' : 'Assign salesperson',
          committedDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Next day
        },
      });

      return inquiry;
    });

    if (dto.assignedSalespersonId) {
      await this.fcmService.sendToUser({
        userId: dto.assignedSalespersonId,
        title: 'New Lead Assigned',
        body: `Lead ${dto.customerName} (${dto.requestedKw} kW) has been assigned to you.`,
        targetUrl: `/inquiries/${result.id}`,
      });
    }

    return result;
  }

  async findAll(filter: InquiryFilterDto, user: { id: string; role: UserRole }) {
    const where: any = {};

    // Row-level security: Salespersons only see inquiries assigned to them
    if (user.role === UserRole.SALESPERSON) {
      where.assignedSalespersonId = user.id;
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

  async findOne(id: string) {
    const inquiry = await this.prisma.inquiry.findFirst({
      where: { OR: [{ id }, { followupId: id }] },
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
    const salesperson = await this.prisma.user.findUnique({
      where: { id: dto.salespersonId },
    });
    if (!salesperson || salesperson.role !== UserRole.SALESPERSON) {
      throw new BadRequestException('Selected user is not a valid salesperson.');
    }

    const dueDays = dto.dueDays || 3;
    const committedDate = new Date(Date.now() + dueDays * 24 * 60 * 60 * 1000);

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.inquiry.update({
        where: { id: inquiryId },
        data: {
          assignedSalespersonId: dto.salespersonId,
          assignedAt: new Date(),
          quoteDueDays: dueDays,
          currentStage: ProjectStage.SITE_VISIT_PLANNED,
        },
      });

      await tx.followupLog.create({
        data: {
          inquiryId,
          createdById: opsUserId,
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
      userId: dto.salespersonId,
      title: 'Lead Assigned to You',
      body: `You have been assigned inquiry ${inquiryId}. Survey & quotation due in ${dueDays} days.`,
      targetUrl: `/inquiries/${inquiryId}`,
    });

    return result;
  }

  async submitSiteVisit(inquiryId: string, dto: SiteVisitReportDto, salesUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      const siteVisit = await tx.siteVisit.upsert({
        where: { inquiryId },
        update: {
          roofAreaChecked: dto.roofAreaChecked,
          meterWiringSeen: dto.meterWiringSeen,
          notes: dto.notes,
          photos: dto.photos,
        },
        create: {
          inquiryId,
          roofAreaChecked: dto.roofAreaChecked,
          meterWiringSeen: dto.meterWiringSeen,
          notes: dto.notes,
          photos: dto.photos,
        },
      });

      await tx.followupLog.create({
        data: {
          inquiryId,
          createdById: salesUserId,
          stage: ProjectStage.QUOTATION_SENT,
          status: FollowupStatus.DONE,
          description: `Site visit completed. Roof area and electricals verified. Notes: ${dto.notes || 'None'}`,
          nextStep: 'Finalize quotation & close deal',
          committedDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        },
      });

      await tx.inquiry.update({
        where: { id: inquiryId },
        data: { currentStage: ProjectStage.QUOTATION_SENT },
      });

      return siteVisit;
    });
  }

  async closeDeal(inquiryId: string, dto: CloseDealDto, salesUserId: string) {
    const closedInquiry = await this.prisma.$transaction(async (tx) => {
      const inquiry = await tx.inquiry.update({
        where: { id: inquiryId },
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
              inquiryId,
              docType: doc.docType,
              filePath: doc.filePath,
            },
          });
        }
      }

      await tx.followupLog.create({
        data: {
          inquiryId,
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
    const inquiry = await this.prisma.inquiry.findUnique({
      where: { id: inquiryId },
    });
    if (!inquiry) throw new NotFoundException('Inquiry not found.');

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.documents && dto.documents.length > 0) {
        for (const doc of dto.documents) {
          await tx.customerDocument.create({
            data: {
              inquiryId,
              docType: doc.docType,
              filePath: doc.filePath,
              isVerified: true,
            },
          });
        }
      }

      await tx.inquiry.update({
        where: { id: inquiryId },
        data: { currentStage: ProjectStage.GOVT_DOCS_SUBMITTED },
      });

      await tx.followupLog.create({
        data: {
          inquiryId,
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
    const inquiry = await this.prisma.inquiry.findUnique({
      where: { id: inquiryId },
      include: { assignedSalesperson: true },
    });
    if (!inquiry) throw new NotFoundException('Inquiry not found.');

    const queryDesc = `${dto.docType}: ${dto.queryNotes}`;

    await this.prisma.$transaction(async (tx) => {
      await tx.portalApplication.upsert({
        where: { inquiryId },
        update: {
          subsidyQueryNo: 'DOC_QUERY',
          subsidyQueryDesc: queryDesc,
          subsidyStatus: 'QUERY',
        },
        create: {
          inquiryId,
          subsidyQueryNo: 'DOC_QUERY',
          subsidyQueryDesc: queryDesc,
          subsidyStatus: 'QUERY',
        },
      });

      await tx.followupLog.create({
        data: {
          inquiryId,
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

