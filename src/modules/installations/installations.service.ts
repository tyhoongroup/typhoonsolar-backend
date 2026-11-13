import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { FcmNotificationService } from '../notifications/fcm.service';
import { UpdateJobProofDto } from './dto/installation.dto';
import { ProjectStage, FollowupStatus, UserRole } from '@prisma/client';

@Injectable()
export class InstallationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fcmService: FcmNotificationService,
  ) {}

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
    const inquiry = await this.prisma.inquiry.findUnique({
      where: { id: inquiryId },
      include: {
        installationJob: true,
        materialDispatch: true,
      },
    });
    if (!inquiry) throw new NotFoundException('Inquiry not found.');
    return inquiry;
  }

  async updateJobProof(dto: UpdateJobProofDto, techUserId: string) {
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
        where: { inquiryId: dto.inquiryId },
        update: data,
        create: {
          inquiryId: dto.inquiryId,
          ...data,
        },
      });

      if (isAllCompleted) {
        await tx.inquiry.update({
          where: { id: dto.inquiryId },
          data: { currentStage: ProjectStage.INSTALLATION_DONE },
        });

        await tx.followupLog.create({
          data: {
            inquiryId: dto.inquiryId,
            createdById: techUserId,
            stage: ProjectStage.INSTALLATION_DONE,
            status: FollowupStatus.DONE,
            description: `Rooftop installation completed. Structure, panels, wiring, and earthing verified. Ready for GEB net-metering file.`,
            nextStep: 'Submit GEB net-meter file',
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

