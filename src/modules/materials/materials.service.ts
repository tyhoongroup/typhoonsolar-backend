import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { FcmNotificationService } from '../notifications/fcm.service';
import { PlanMaterialDto, UploadUnloadProofDto } from './dto/material.dto';
import { ProjectStage, FollowupStatus, UserRole } from '@prisma/client';
import { WhatsAppTemplates } from '../../shared';

@Injectable()
export class MaterialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fcmService: FcmNotificationService,
  ) {}

  async getQueue() {
    return this.prisma.inquiry.findMany({
      where: {
        currentStage: {
          in: [ProjectStage.SR_NUMBER_ISSUED, ProjectStage.MATERIAL_PLANNED],
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
    const inquiry = await this.prisma.inquiry.findUnique({
      where: { id: dto.inquiryId },
    });
    if (!inquiry) throw new NotFoundException('Inquiry not found.');

    return this.prisma.$transaction(async (tx) => {
      const dispatch = await tx.materialDispatch.upsert({
        where: { inquiryId: dto.inquiryId },
        update: {
          inverterSerialNo: dto.inverterSerialNo,
          panelSerialNumbers: dto.panelSerialNumbers,
          scheduledUnloadDate: new Date(dto.scheduledUnloadDate),
          amountDueOnUnload: dto.amountDueOnUnload,
        },
        create: {
          inquiryId: dto.inquiryId,
          inverterSerialNo: dto.inverterSerialNo,
          panelSerialNumbers: dto.panelSerialNumbers,
          scheduledUnloadDate: new Date(dto.scheduledUnloadDate),
          amountDueOnUnload: dto.amountDueOnUnload,
        },
      });

      await tx.followupLog.create({
        data: {
          inquiryId: dto.inquiryId,
          createdById: storeUserId,
          stage: ProjectStage.MATERIAL_PLANNED,
          status: FollowupStatus.ON_TRACK,
          description: `Material planned. Delivery scheduled for ${new Date(dto.scheduledUnloadDate).toLocaleDateString('en-IN')}. Amount due: ₹${dto.amountDueOnUnload.toLocaleString('en-IN')}.`,
          nextStep: 'Unload material on site',
          committedDate: new Date(dto.scheduledUnloadDate),
        },
      });

      await tx.inquiry.update({
        where: { id: dto.inquiryId },
        data: { currentStage: ProjectStage.MATERIAL_PLANNED },
      });

      return dispatch;
    });
  }

  async uploadUnloadProof(dto: UploadUnloadProofDto, storeUserId: string) {
    const dispatch = await this.prisma.$transaction(async (tx) => {
      const savedDispatch = await tx.materialDispatch.update({
        where: { inquiryId: dto.inquiryId },
        data: {
          actualUnloadedDate: new Date(),
          unloadPhotos: dto.unloadPhotos,
        },
      });

      await tx.followupLog.create({
        data: {
          inquiryId: dto.inquiryId,
          createdById: storeUserId,
          stage: ProjectStage.MATERIAL_UNLOADED,
          status: FollowupStatus.DONE,
          description: `Materials safely unloaded on site. Photos uploaded. Ready for fabrication & wiring teams.`,
          nextStep: 'Installation & Accounts 2nd term payment',
          committedDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        },
      });

      await tx.inquiry.update({
        where: { id: dto.inquiryId },
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
    const inquiry = await this.prisma.inquiry.findUnique({
      where: { id: inquiryId },
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
      where: { OR: [{ id: inquiryId }, { followupId: inquiryId }] },
    });
    if (!inquiry) throw new NotFoundException('Inquiry not found.');

    return this.prisma.followupLog.create({
      data: {
        inquiryId: inquiry.id,
        createdById: userId,
        stage: ProjectStage.INSTALLATION_DONE,
        status: FollowupStatus.DONE,
        description: 'Installation roof photos verified by Material Planning & Warehouse lead. Quality check passed.',
        nextStep: 'Ready for meter filing with DISCOM',
        committedDate: new Date(),
      },
    });
  }
}

