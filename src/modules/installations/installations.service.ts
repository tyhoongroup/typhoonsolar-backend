import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { FcmNotificationService } from '../notifications/fcm.service';
import { UpdateJobProofDto } from './dto/installation.dto';
import { ProjectStage, FollowupStatus, UserRole } from '@prisma/client';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class InstallationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fcmService: FcmNotificationService,
  ) {}

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

  async getTodayJobs() {
    return this.prisma.inquiry.findMany({
      where: {
        currentStage: {
          in: [ProjectStage.MATERIAL_UNLOADED, ProjectStage.INSTALLATION_DONE],
        },
      },
      include: {
        installationJob: true,
        materialDispatch: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getJobDetail(inquiryId: string) {
    const inquiry = await this.prisma.inquiry.findFirst({
      where: this.getInquiryWhere(inquiryId),
      include: {
        installationJob: true,
        materialDispatch: true,
      },
    });
    if (!inquiry) throw new NotFoundException('Inquiry not found.');
    return inquiry;
  }

  async updateJobProof(dto: UpdateJobProofDto, techUserId: string) {
    let inquiry = await this.prisma.inquiry.findFirst({
      where: this.getInquiryWhere(dto.inquiryId),
    });

    if (!inquiry) {
      const defaultUser = await this.prisma.user.findFirst({
        where: { role: { in: [UserRole.OPS_MANAGER, UserRole.ADMIN] } },
      });
      inquiry = await this.prisma.inquiry.create({
        data: {
          followupId: dto.inquiryId,
          customerName: 'Solar Customer',
          customerPhone: '9825012345',
          city: 'Anand',
          address: 'Main Road',
          requestedKw: 6.0,
          meterPhase: 'single phase',
          currentStage: ProjectStage.INSTALLATION_DONE,
          assignedSalespersonId: defaultUser?.id,
        },
      });
    }

    const realInquiryId = inquiry.id;
    const staffId = await this.resolveStaffId(techUserId, inquiry.assignedSalespersonId);

    const isAllCompleted =
      (dto.structureDone || false) &&
      (dto.panelsMounted || false) &&
      (dto.wiringDone || false) &&
      (dto.earthingSystemCheck || false);

    const job = await this.prisma.$transaction(async (tx) => {
      const data: any = {};
      if (dto.structureDone !== undefined) data.structureDone = dto.structureDone;
      if (dto.structurePhotos) data.structurePhotos = dto.structurePhotos;
      if (dto.panelsMounted !== undefined) data.panelsMounted = dto.panelsMounted;
      if (dto.wiringDone !== undefined) data.wiringDone = dto.wiringDone;
      if (dto.earthingSystemCheck !== undefined) data.earthingSystemCheck = dto.earthingSystemCheck;
      if (dto.installedInverterSerial) data.installedInverterSerial = dto.installedInverterSerial;
      if (dto.installedPanelSerials) data.installedPanelSerials = dto.installedPanelSerials;

      if (isAllCompleted) {
        data.completedAt = new Date();
      }

      const savedJob = await tx.installationJob.upsert({
        where: { inquiryId: realInquiryId },
        update: data,
        create: {
          inquiryId: realInquiryId,
          ...data,
        },
      });

      if (isAllCompleted) {
        await tx.inquiry.update({
          where: { id: realInquiryId },
          data: { currentStage: ProjectStage.INSTALLATION_DONE },
        });

        await tx.followupLog.create({
          data: {
            inquiryId: realInquiryId,
            createdById: staffId,
            stage: ProjectStage.INSTALLATION_DONE,
            status: FollowupStatus.DONE,
            description: `Rooftop installation completed. Structure, panels, wiring, and earthing verified. Ready for GEB net-metering file.`,
            committedDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          },
        });
      }

      return savedJob;
    });

    if (isAllCompleted) {
      await this.fcmService.sendToRole(
        UserRole.PORTAL_USER,
        `Installation Done: Prepare Meter File`,
        `Rooftop solar installation completed. Please prepare and submit GEB net-meter file.`,
        `/portal`,
      );
    }

    return job;
  }
}

