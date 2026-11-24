import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateFollowupDto, UpdateFollowupStatusDto } from './dto/followup.dto';

@Injectable()
export class FollowupsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateFollowupDto, userId: string) {
    const inquiry = await this.prisma.inquiry.findUnique({
      where: { id: dto.inquiryId },
    });
    if (!inquiry) throw new NotFoundException(`Inquiry ${dto.inquiryId} not found.`);

    return this.prisma.$transaction(async (tx) => {
      const log = await tx.followupLog.create({
        data: {
          inquiryId: dto.inquiryId,
          createdById: userId,
          stage: dto.stage,
          status: dto.status,
          description: dto.description,
          committedDate: new Date(dto.committedDate),
          isOverdue: false,
        },
      });

      await tx.inquiry.update({
        where: { id: dto.inquiryId },
        data: {
          currentStage: dto.stage,
          updatedAt: new Date(),
        },
      });

      return log;
    });
  }

  async getByInquiry(inquiryId: string) {
    return this.prisma.followupLog.findMany({
      where: { inquiryId },
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

