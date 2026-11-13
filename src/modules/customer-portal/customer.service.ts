import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SubmitFeedbackDto } from './dto/customer.dto';
import { ProjectStage, PaymentStatus } from '@prisma/client';

@Injectable()
export class CustomerService {
  constructor(private readonly prisma: PrismaService) {}

  private mapStageToNumber(stage: ProjectStage): { step: number; percentage: number; label: string } {
    switch (stage) {
      case ProjectStage.INQUIRY_RECEIVED:
        return { step: 1, percentage: 10, label: 'Application started' };
      case ProjectStage.SITE_VISIT_PLANNED:
        return { step: 2, percentage: 20, label: 'Site visit planned' };
      case ProjectStage.QUOTATION_SENT:
        return { step: 3, percentage: 30, label: 'Quotation sent' };
      case ProjectStage.DEAL_CLOSED:
        return { step: 4, percentage: 40, label: 'Deal finalized & KYC' };
      case ProjectStage.GOVT_DOCS_SUBMITTED:
        return { step: 5, percentage: 50, label: 'Portal verification' };
      case ProjectStage.SR_NUMBER_ISSUED:
        return { step: 6, percentage: 60, label: 'SR Number received' };
      case ProjectStage.MATERIAL_PLANNED:
      case ProjectStage.MATERIAL_UNLOADED:
        return { step: 7, percentage: 70, label: 'Material on site' };
      case ProjectStage.INSTALLATION_DONE:
        return { step: 8, percentage: 80, label: 'Installation completed' };
      case ProjectStage.METER_FILE_SUBMITTED:
      case ProjectStage.METER_STARTED:
        return { step: 9, percentage: 90, label: 'Net-meter live' };
      case ProjectStage.SUBSIDY_CLAIMED:
      case ProjectStage.SUBSIDY_RECEIVED:
      case ProjectStage.COMPLETED:
        return { step: 10, percentage: 100, label: 'Project completed' };
      default:
        return { step: 1, percentage: 10, label: 'In progress' };
    }
  }

  async trackProject(token: string) {
    const inquiry = await this.prisma.inquiry.findUnique({
      where: { customerAccessToken: token },
      include: {
        quotation: true,
        payments: true,
        feedback: true,
        portalApplication: true,
        assignedSalesperson: { select: { fullName: true, phone: true } },
        documents: true,
      },
    });
    if (!inquiry) throw new NotFoundException('Project link invalid or expired.');

    const stageInfo = this.mapStageToNumber(inquiry.currentStage);

    const totalPaid = inquiry.payments
      .filter((p) => p.status === PaymentStatus.PAID)
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const totalPending = inquiry.payments
      .filter((p) => p.status !== PaymentStatus.PAID)
      .reduce((sum, p) => sum + Number(p.amount), 0);

    return {
      id: inquiry.id,
      followupId: inquiry.followupId,
      customerName: inquiry.customerName,
      city: inquiry.city,
      requestedKw: Number(inquiry.requestedKw),
      meterPhase: inquiry.meterPhase,
      stageNumber: stageInfo.step,
      progressPercentage: stageInfo.percentage,
      currentStageLabel: stageInfo.label,
      currentStage: inquiry.currentStage,
      dealAmount: Number(inquiry.dealAmount || 0),
      totalPaid,
      totalPending,
      hasFeedback: !!inquiry.feedback,
      srNumber: inquiry.portalApplication?.srNumber || null,
      activeQuery: inquiry.portalApplication?.subsidyQueryDesc || null,
      salespersonName: inquiry.assignedSalesperson?.fullName || 'Typhoon Executive',
      salespersonPhone: inquiry.assignedSalesperson?.phone || '9898950959',
      documents: inquiry.documents,
    };
  }

  async getCustomerLedger(token: string) {
    const inquiry = await this.prisma.inquiry.findUnique({
      where: { customerAccessToken: token },
      include: {
        payments: { orderBy: { dueDate: 'asc' } },
      },
    });
    if (!inquiry) throw new NotFoundException('Project link invalid.');

    const totalPaid = inquiry.payments
      .filter((p) => p.status === PaymentStatus.PAID)
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const totalPending = inquiry.payments
      .filter((p) => p.status !== PaymentStatus.PAID)
      .reduce((sum, p) => sum + Number(p.amount), 0);

    return {
      totalPaid,
      totalPending,
      milestones: inquiry.payments.map((p) => ({
        id: p.id,
        title: p.title,
        amount: Number(p.amount),
        status: p.status,
      })),
    };
  }

  async submitFeedback(token: string, dto: SubmitFeedbackDto) {
    const inquiry = await this.prisma.inquiry.findUnique({
      where: { customerAccessToken: token },
    });
    if (!inquiry) throw new NotFoundException('Project link invalid.');

    return this.prisma.customerFeedback.upsert({
      where: { inquiryId: inquiry.id },
      update: {
        rating: dto.rating,
        tags: dto.tags || [],
        comments: dto.comments,
      },
      create: {
        inquiryId: inquiry.id,
        rating: dto.rating,
        tags: dto.tags || [],
        comments: dto.comments,
      },
    });
  }
}

