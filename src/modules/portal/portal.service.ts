import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { FcmNotificationService } from '../notifications/fcm.service';
import { SubmitSrNumberDto, UpdateMeterDatesDto, UpdateSubsidyDto } from './dto/portal.dto';
import { ProjectStage, FollowupStatus, UserRole } from '@prisma/client';

@Injectable()
export class PortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fcmService: FcmNotificationService,
  ) {}

  async getApplications() {
    return this.prisma.inquiry.findMany({
      where: {
        currentStage: {
          in: [
            ProjectStage.DEAL_CLOSED,
            ProjectStage.GOVT_DOCS_SUBMITTED,
            ProjectStage.SR_NUMBER_ISSUED,
            ProjectStage.METER_FILE_SUBMITTED,
            ProjectStage.METER_STARTED,
            ProjectStage.SUBSIDY_CLAIMED,
          ],
        },
      },
      include: {
        portalApplication: true,
        documents: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async submitSrNumber(dto: SubmitSrNumberDto, portalUserId: string) {
    const app = await this.prisma.$transaction(async (tx) => {
      const savedApp = await tx.portalApplication.upsert({
        where: { inquiryId: dto.inquiryId },
        update: {
          srNumber: dto.srNumber,
          srNumberIssuedDate: new Date(),
        },
        create: {
          inquiryId: dto.inquiryId,
          srNumber: dto.srNumber,
          srNumberIssuedDate: new Date(),
        },
      });

      await tx.inquiry.update({
        where: { id: dto.inquiryId },
        data: { currentStage: ProjectStage.SR_NUMBER_ISSUED },
      });

      await tx.followupLog.create({
        data: {
          inquiryId: dto.inquiryId,
          createdById: portalUserId,
          stage: ProjectStage.SR_NUMBER_ISSUED,
          status: FollowupStatus.DONE,
          description: `Government SR Number issued: ${dto.srNumber}. Document verification complete. Ready for material planning.`,
          nextStep: 'Material planning (Sohail bhai)',
          committedDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      return savedApp;
    });

    await this.fcmService.sendToRole(
      UserRole.MATERIAL_MANAGER,
      `SR Number Issued: ${dto.srNumber}`,
      `Document verification complete. Please plan material & BOM delivery for project.`,
      `/material`,
    );

    return app;
  }

  async updateMeterDates(dto: UpdateMeterDatesDto, portalUserId: string) {
    const app = await this.prisma.$transaction(async (tx) => {
      const data: any = {};
      if (dto.meterFileSubmitDate) data.meterFileSubmitDate = new Date(dto.meterFileSubmitDate);
      if (dto.gebMeterInstallDate) data.gebMeterInstallDate = new Date(dto.gebMeterInstallDate);
      if (dto.meterStartDate) data.meterStartDate = new Date(dto.meterStartDate);

      const savedApp = await tx.portalApplication.upsert({
        where: { inquiryId: dto.inquiryId },
        update: data,
        create: {
          inquiryId: dto.inquiryId,
          ...data,
        },
      });

      if (dto.meterStartDate) {
        await tx.inquiry.update({
          where: { id: dto.inquiryId },
          data: { currentStage: ProjectStage.METER_STARTED },
        });

        await tx.followupLog.create({
          data: {
            inquiryId: dto.inquiryId,
            createdById: portalUserId,
            stage: ProjectStage.METER_STARTED,
            status: FollowupStatus.DONE,
            description: `GEB bi-directional net meter installed and turned on. System is now generating solar electricity.`,
            nextStep: 'Submit PM Surya Ghar subsidy claim & collect final payment',
            committedDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          },
        });
      } else if (dto.meterFileSubmitDate) {
        await tx.inquiry.update({
          where: { id: dto.inquiryId },
          data: { currentStage: ProjectStage.METER_FILE_SUBMITTED },
        });

        await tx.followupLog.create({
          data: {
            inquiryId: dto.inquiryId,
            createdById: portalUserId,
            stage: ProjectStage.METER_FILE_SUBMITTED,
            status: FollowupStatus.ON_TRACK,
            description: `Meter file submitted to GEB Sub-Division office. Awaiting meter installation in 7 to 10 days.`,
            nextStep: 'GEB meter installation',
            committedDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
          },
        });
      }

      return savedApp;
    });

    if (dto.meterStartDate) {
      await this.fcmService.sendToRole(
        UserRole.ACCOUNTANT,
        `Net-Meter Live: Ready for Final Balance`,
        `Meter started generating solar power. Please collect remaining 20% milestone payment.`,
        `/payments`,
      );
    }

    return app;
  }

  async updateSubsidy(dto: UpdateSubsidyDto, portalUserId: string) {
    const app = await this.prisma.$transaction(async (tx) => {
      const data: any = {
        subsidyStatus: dto.subsidyStatus,
        subsidyQueryNo: dto.subsidyQueryNo,
        subsidyQueryDesc: dto.subsidyQueryDesc,
      };

      if (dto.subsidyStatus === 'RECEIVED') {
        data.subsidyReceivedDate = dto.subsidyReceivedDate ? new Date(dto.subsidyReceivedDate) : new Date();
      }

      const savedApp = await tx.portalApplication.update({
        where: { inquiryId: dto.inquiryId },
        data,
      });

      if (dto.subsidyStatus === 'RECEIVED') {
        await tx.inquiry.update({
          where: { id: dto.inquiryId },
          data: { currentStage: ProjectStage.SUBSIDY_RECEIVED },
        });

        await tx.followupLog.create({
          data: {
            inquiryId: dto.inquiryId,
            createdById: portalUserId,
            stage: ProjectStage.SUBSIDY_RECEIVED,
            status: FollowupStatus.DONE,
            description: `Government subsidy credited into customer bank account. Project complete.`,
            nextStep: 'Deliver final bill & request feedback',
            committedDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        });
      } else if (dto.subsidyStatus === 'QUERY') {
        await tx.followupLog.create({
          data: {
            inquiryId: dto.inquiryId,
            createdById: portalUserId,
            stage: ProjectStage.SUBSIDY_CLAIMED,
            status: FollowupStatus.DELAYED,
            description: `Portal Query ${dto.subsidyQueryNo || ''}: ${dto.subsidyQueryDesc || 'Document clarification requested'}.`,
            nextStep: 'Resolve query & re-upload to portal',
            committedDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
          },
        });
      }

      return savedApp;
    });

    if (dto.subsidyStatus === 'RECEIVED') {
      await this.fcmService.sendToRole(
        UserRole.ACCOUNTANT,
        `Subsidy Received: DBT Credited`,
        `PM Surya Ghar DBT subsidy credited into customer bank account. Deliver final bill.`,
        `/payments`,
      );
    }

    return app;
  }

  async markDocsUploaded(inquiryId: string, portalUserId: string) {
    const inquiry = await this.prisma.inquiry.findFirst({
      where: { OR: [{ id: inquiryId }, { followupId: inquiryId }] },
    });
    if (!inquiry) throw new NotFoundException('Inquiry not found.');

    return this.prisma.$transaction(async (tx) => {
      await tx.inquiry.update({
        where: { id: inquiry.id },
        data: { currentStage: ProjectStage.GOVT_DOCS_SUBMITTED },
      });

      return tx.followupLog.create({
        data: {
          inquiryId: inquiry.id,
          createdById: portalUserId,
          stage: ProjectStage.GOVT_DOCS_SUBMITTED,
          status: FollowupStatus.DONE,
          description: 'Customer KYC documents uploaded on Government Surya Gujarat portal.',
          nextStep: 'Awaiting DISCOM SR number generation',
          committedDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        },
      });
    });
  }
}

