import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateFollowupDto, UpdateFollowupStatusDto } from './dto/followup.dto';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class FollowupsService {
  constructor(private readonly prisma: PrismaService) {}

  private getInquiryWhere(inquiryId: string) {
    if (UUID_REGEX.test(inquiryId)) {
      return { OR: [{ id: inquiryId }, { followupId: inquiryId }] };
    }
    return { followupId: inquiryId };
  }

  private async resolveStaffId(userId?: string | null, fallbackId?: string | null): Promise<string> {
    if (userId && UUID_REGEX.test(userId)) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (user) return user.id;
    }
    if (fallbackId && UUID_REGEX.test(fallbackId)) {
      const fallbackUser = await this.prisma.user.findUnique({ where: { id: fallbackId } });
      if (fallbackUser) return fallbackUser.id;
    }
    const defaultUser = await this.prisma.user.findFirst();
    return defaultUser?.id || userId || '';
  }

  async create(dto: CreateFollowupDto, userId: string) {
    const inquiry = await this.prisma.inquiry.findFirst({
      where: this.getInquiryWhere(dto.inquiryId),
    });
    if (!inquiry) throw new NotFoundException(`Inquiry ${dto.inquiryId} not found.`);

    const staffId = await this.resolveStaffId(userId, inquiry.assignedSalespersonId);

    return this.prisma.$transaction(async (tx) => {
      const log = await tx.followupLog.create({
        data: {
          inquiryId: inquiry.id,
          createdById: staffId,
          stage: dto.stage,
          status: dto.status,
          description: dto.description,
          committedDate: new Date(dto.committedDate),
          isOverdue: false,
        },
      });

      await tx.inquiry.update({
        where: { id: inquiry.id },
        data: {
          currentStage: dto.stage,
          updatedAt: new Date(),
        },
      });

      return log;
    });
  }

  async findAll(query: { teamMemberId?: string; type?: string; inquiryId?: string; stage?: string }) {
    const where: any = {};
    if (query.teamMemberId && query.teamMemberId !== 'all') {
      where.createdById = query.teamMemberId;
    }
    if (query.stage && query.stage !== 'all') {
      where.stage = query.stage as any;
    }
    if (query.inquiryId) {
      where.inquiryId = query.inquiryId;
    }

    const inquiryStages: any[] = [
      'INQUIRY_RECEIVED',
      'SITE_VISIT_PLANNED',
      'QUOTATION_SENT',
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

  async getByInquiry(inquiryId: string) {
    const inquiry = await this.prisma.inquiry.findFirst({
      where: this.getInquiryWhere(inquiryId),
    });
    if (!inquiry) {
      return [];
    }

    return this.prisma.followupLog.findMany({
      where: { inquiryId: inquiry.id },
      include: {
        createdBy: {
          select: { id: true, fullName: true, role: true, phone: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getMyAgenda(userId: string) {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    return this.prisma.followupLog.findMany({
      where: {
        createdById: userId,
        committedDate: {
          gte: startOfToday,
          lte: endOfToday,
        },
      },
      include: {
        inquiry: {
          select: {
            id: true,
            followupId: true,
            customerName: true,
            customerPhone: true,
            city: true,
            requestedKw: true,
            meterPhase: true,
            currentStage: true,
          },
        },
      },
      orderBy: { committedDate: 'asc' },
    });
  }

  async updateStatus(followupId: string, dto: UpdateFollowupStatusDto, userId: string) {
    const existing = await this.prisma.followupLog.findUnique({
      where: { id: followupId },
    });
    if (!existing) throw new NotFoundException('Follow-up record not found.');

    const data: any = {
      status: dto.status,
      isOverdue: false,
    };

    if (dto.description) data.description = dto.description;
    if (dto.newCommittedDate) data.committedDate = new Date(dto.newCommittedDate);

    return this.prisma.followupLog.update({
      where: { id: followupId },
      data,
    });
  }
}

