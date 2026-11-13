import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { FcmNotificationService } from '../notifications/fcm.service';
import { RecordPaymentDto } from './dto/payment.dto';
import { PaymentStatus, FollowupStatus, ProjectStage, UserRole } from '@prisma/client';
import { WhatsAppTemplates } from '../../shared';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fcmService: FcmNotificationService,
  ) {}

  async getOverview() {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const paidThisMonth = await this.prisma.paymentMilestone.aggregate({
      _sum: { amount: true },
      where: {
        status: PaymentStatus.PAID,
        paidAt: { gte: startOfMonth },
      },
    });

    const totalPending = await this.prisma.paymentMilestone.aggregate({
      _sum: { amount: true },
      where: { status: { in: [PaymentStatus.PENDING, PaymentStatus.DUE] } },
    });

    const totalPaidEver = await this.prisma.paymentMilestone.aggregate({
      _sum: { amount: true },
      where: { status: PaymentStatus.PAID },
    });

    const paidSum = Number(totalPaidEver._sum.amount || 0);
    const pendingSum = Number(totalPending._sum.amount || 0);
    const totalAmount = paidSum + pendingSum;
    const collectionPercentage = totalAmount > 0 ? Math.round((paidSum / totalAmount) * 100) : 0;

    // Due this week
    const now = new Date();
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const dueThisWeekList = await this.prisma.paymentMilestone.findMany({
      where: {
        status: { in: [PaymentStatus.PENDING, PaymentStatus.DUE] },
        dueDate: { lte: nextWeek },
      },
      include: {
        inquiry: {
          select: { id: true, followupId: true, customerName: true, customerPhone: true },
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    return {
      collectedThisMonth: Number(paidThisMonth._sum.amount || 0),
      totalPending: pendingSum,
      collectionPercentage,
      dueThisWeekCount: dueThisWeekList.length,
      dueThisWeekList,
    };
  }

  async getLedger(inquiryId: string) {
    const inquiry = await this.prisma.inquiry.findUnique({
      where: { id: inquiryId },
      include: {
        payments: { orderBy: { dueDate: 'asc' } },
      },
    });
    if (!inquiry) throw new NotFoundException('Inquiry not found.');

    const totalPaid = inquiry.payments
      .filter((p) => p.status === PaymentStatus.PAID)
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const totalPending = inquiry.payments
      .filter((p) => p.status !== PaymentStatus.PAID)
      .reduce((sum, p) => sum + Number(p.amount), 0);

    return {
      inquiryId: inquiry.id,
      followupId: inquiry.followupId,
      customerName: inquiry.customerName,
      customerPhone: inquiry.customerPhone,
      dealAmount: Number(inquiry.dealAmount || 0),
      totalPaid,
      totalPending,
      milestones: inquiry.payments,
    };
  }

  async recordPayment(dto: RecordPaymentDto, accountantUserId: string) {
    const milestone = await this.prisma.$transaction(async (tx) => {
      const savedMilestone = await tx.paymentMilestone.update({
        where: { id: dto.milestoneId },
        data: {
          status: PaymentStatus.PAID,
          paidAt: new Date(),
          transactionRef: dto.transactionRef,
        },
        include: { inquiry: true },
      });

      await tx.followupLog.create({
        data: {
          inquiryId: savedMilestone.inquiryId,
          createdById: accountantUserId,
          stage: savedMilestone.inquiry.currentStage,
          status: FollowupStatus.DONE,
          description: `Payment received: ₹${dto.amount.toLocaleString('en-IN')} for ${savedMilestone.title}. Ref: ${dto.transactionRef || 'Cash/Cheque'}`,
          nextStep: 'Accounts verified',
          committedDate: new Date(),
        },
      });

      return savedMilestone;
    });

    await this.fcmService.sendToRole(
      UserRole.OPS_MANAGER,
      `Payment Received: ₹${dto.amount.toLocaleString('en-IN')}`,
      `Received payment for ${milestone.inquiry.customerName} (${milestone.title}).`,
      `/payments/${milestone.inquiryId}`,
    );

    return milestone;
  }

  async getWhatsAppPaymentReminder(inquiryId: string, milestoneId?: string) {
    const inquiry = await this.prisma.inquiry.findUnique({
      where: { id: inquiryId },
      include: { payments: true },
    });
    if (!inquiry) throw new NotFoundException('Inquiry not found.');

    const targetMilestone = milestoneId
      ? inquiry.payments.find((p) => p.id === milestoneId)
      : inquiry.payments.find((p) => p.status !== PaymentStatus.PAID);

    if (!targetMilestone) {
      throw new NotFoundException('No pending payment milestone found.');
    }

    const whatsappUrl = WhatsAppTemplates.buildPaymentReminderMessage({
      customerPhone: inquiry.customerPhone,
      customerName: inquiry.customerName,
      milestoneTitle: targetMilestone.title,
      amountDue: Number(targetMilestone.amount),
    });

    return {
      customerName: inquiry.customerName,
      customerPhone: inquiry.customerPhone,
      milestoneTitle: targetMilestone.title,
      amountDue: Number(targetMilestone.amount),
      whatsappUrl,
    };
  }
}

