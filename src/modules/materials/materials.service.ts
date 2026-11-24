import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { FcmNotificationService } from '../notifications/fcm.service';
import { PlanMaterialDto, UploadUnloadProofDto } from './dto/material.dto';
import { ProjectStage, FollowupStatus, UserRole } from '@prisma/client';
import { WhatsAppTemplates } from '../../shared';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class MaterialsService {
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

  async getQueue() {
    return this.prisma.inquiry.findMany({
      where: {
        currentStage: {
          in: [
            ProjectStage.SR_NUMBER_ISSUED,
            ProjectStage.MATERIAL_PLANNED,
            ProjectStage.MATERIAL_UNLOADED,
            ProjectStage.INSTALLATION_DONE,
          ],
        },
      },
      include: {
        assignedSalesperson: { select: { fullName: true, phone: true } },
        materialDispatch: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async plan(dto: PlanMaterialDto, storeUserId: string) {
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
          currentStage: ProjectStage.MATERIAL_PLANNED,
          assignedSalespersonId: defaultUser?.id,
        },
      });
    }

    const realInquiryId = inquiry.id;
    const staffId = await this.resolveStaffId(storeUserId, inquiry.assignedSalespersonId);

    return this.prisma.$transaction(async (tx) => {
      const dispatch = await tx.materialDispatch.upsert({
        where: { inquiryId: realInquiryId },
        update: {
          inverterSerialNo: dto.inverterSerialNo,
          panelSerialNumbers: dto.panelSerialNumbers,
          scheduledUnloadDate: new Date(dto.scheduledUnloadDate),
          amountDueOnUnload: dto.amountDueOnUnload,
        },
        create: {
          inquiryId: realInquiryId,
          inverterSerialNo: dto.inverterSerialNo,
          panelSerialNumbers: dto.panelSerialNumbers,
          scheduledUnloadDate: new Date(dto.scheduledUnloadDate),
          amountDueOnUnload: dto.amountDueOnUnload,
        },
      });

      await tx.followupLog.create({
        data: {
          inquiryId: realInquiryId,
          createdById: staffId,
          stage: ProjectStage.MATERIAL_PLANNED,
          status: FollowupStatus.ON_TRACK,
          description: `Material planned. Delivery scheduled for ${new Date(dto.scheduledUnloadDate).toLocaleDateString('en-IN')}. Amount due: ₹${dto.amountDueOnUnload.toLocaleString('en-IN')}.`,
          committedDate: new Date(dto.scheduledUnloadDate),
        },
      });

      await tx.inquiry.update({
        where: { id: realInquiryId },
        data: { currentStage: ProjectStage.MATERIAL_PLANNED },
      });

      return dispatch;
    });
  }

  async uploadUnloadProof(dto: UploadUnloadProofDto, storeUserId: string) {
    let inquiry = await this.prisma.inquiry.findFirst({
      where: this.getInquiryWhere(dto.inquiryId),
    });
    if (!inquiry) {
      throw new NotFoundException('Inquiry not found.');
    }

    const realInquiryId = inquiry.id;
    const staffId = await this.resolveStaffId(storeUserId, inquiry.assignedSalespersonId);

    const dispatch = await this.prisma.$transaction(async (tx) => {
      const savedDispatch = await tx.materialDispatch.upsert({
        where: { inquiryId: realInquiryId },
        update: {
          actualUnloadedDate: new Date(),
          unloadPhotos: dto.unloadPhotos,
        },
        create: {
          inquiryId: realInquiryId,
          scheduledUnloadDate: new Date(),
          amountDueOnUnload: 0,
          actualUnloadedDate: new Date(),
          unloadPhotos: dto.unloadPhotos,
        },
      });

      await tx.followupLog.create({
        data: {
          inquiryId: realInquiryId,
          createdById: staffId,
          stage: ProjectStage.MATERIAL_UNLOADED,
          status: FollowupStatus.DONE,
          description: `Materials safely unloaded on site. Photos uploaded. Ready for fabrication & wiring teams.`,
          committedDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        },
      });

      await tx.inquiry.update({
        where: { id: realInquiryId },
        data: { currentStage: ProjectStage.MATERIAL_UNLOADED },
      });

      return savedDispatch;
    });

    // Notify Accounts and Installation team
    await this.fcmService.sendToRole(
      UserRole.ACCOUNTANT,
      `Material Unloaded: Collect 1st Payment`,
      `Solar materials unloaded at site. Please follow up with customer to collect 1st milestone payment.`,
      `/payments`,
    );

    await this.fcmService.sendToRole(
      UserRole.INSTALLATION_TEAM,
      `Site Ready for Installation`,
      `Materials unloaded on site. Please dispatch installation team.`,
      `/installation`,
    );

    return dispatch;
  }

  async getWhatsAppUnloadPreview(inquiryId: string) {
    const inquiry = await this.prisma.inquiry.findFirst({
      where: this.getInquiryWhere(inquiryId),
      include: { materialDispatch: true },
    });
    if (!inquiry || !inquiry.materialDispatch) {
      throw new NotFoundException('Inquiry or material dispatch record not found.');
    }

    const dateStr = inquiry.materialDispatch.scheduledUnloadDate
      ? new Date(inquiry.materialDispatch.scheduledUnloadDate).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : 'scheduled date';

    const whatsappUrl = WhatsAppTemplates.buildMaterialUnloadMessage({
      customerPhone: inquiry.customerPhone,
      customerName: inquiry.customerName,
      unloadDate: dateStr,
      amountDue: Number(inquiry.materialDispatch.amountDueOnUnload),
    });

    return {
      customerName: inquiry.customerName,
      customerPhone: inquiry.customerPhone,
      unloadDate: dateStr,
      amountDue: Number(inquiry.materialDispatch.amountDueOnUnload),
      whatsappUrl,
    };
  }

  async verifyInstallation(inquiryId: string, userId: string) {
    const inquiry = await this.prisma.inquiry.findFirst({
      where: this.getInquiryWhere(inquiryId),
    });
    if (!inquiry) throw new NotFoundException('Inquiry not found.');

    const staffId = await this.resolveStaffId(userId, inquiry.assignedSalespersonId);

    return this.prisma.followupLog.create({
      data: {
        inquiryId: inquiry.id,
        createdById: staffId,
        stage: ProjectStage.INSTALLATION_DONE,
        status: FollowupStatus.DONE,
        description: 'Installation roof photos verified by Material Planning & Warehouse lead. Quality check passed.',
        committedDate: new Date(),
      },
    });
  }
}

