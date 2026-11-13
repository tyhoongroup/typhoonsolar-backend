import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';
import { FcmNotificationService } from './fcm.service';
import { FollowupStatus, UserRole } from '@prisma/client';

@Injectable()
export class SlaCronService {
  private readonly logger = new Logger(SlaCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fcmService: FcmNotificationService,
  ) {}

  // Check every 15 minutes for overdue follow-ups
  @Cron('*/15 * * * *')
  async checkOverdueSla() {
    const now = new Date();

    const overdueFollowups = await this.prisma.followupLog.findMany({
      where: {
        status: { in: [FollowupStatus.ON_TRACK, FollowupStatus.DELAYED] },
        committedDate: { lt: now },
        isOverdue: false,
      },
      include: {
        inquiry: true,
        createdBy: true,
      },
    });

    if (overdueFollowups.length === 0) return;

    this.logger.warn(`Found ${overdueFollowups.length} newly overdue follow-up tasks!`);

    for (const log of overdueFollowups) {
      // 1. Mark as overdue in DB
      await this.prisma.followupLog.update({
        where: { id: log.id },
        data: { isOverdue: true },
      });

      // 2. Alert the assigned staff member
      await this.fcmService.sendToUser({
        userId: log.createdById,
        title: `OVERDUE: Task for ${log.inquiry.followupId}`,
        body: `Your committed date for ${log.inquiry.customerName} has passed! Please log an update.`,
        targetUrl: `/inquiries/${log.inquiry.id}`,
        isUrgent: true,
      });

      // 3. Alert Operations Managers
      await this.fcmService.sendToRole(
        UserRole.OPS_MANAGER,
        `SLA Breach: ${log.inquiry.followupId} (${log.createdBy.fullName})`,
        `Committed date passed for ${log.inquiry.customerName} on ${log.stage}.`,
        `/team/tracker`,
      );
    }
  }
}

