import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { LogTeamFollowupDto } from './dto/team.dto';
import { UserRole, FollowupStatus } from '@prisma/client';

@Injectable()
export class TeamService {
  constructor(private readonly prisma: PrismaService) {}

  async getTeamTracker() {
    const now = new Date();
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const members = await this.prisma.user.findMany({
      where: {
        isActive: true,
        role: { not: UserRole.ADMIN },
      },
      select: {
        id: true,
        fullName: true,
        phone: true,
        role: true,
        createdFollowups: {
          where: { status: { in: [FollowupStatus.ON_TRACK, FollowupStatus.DELAYED] } },
          orderBy: { committedDate: 'asc' },
          take: 1,
          include: {
            inquiry: { select: { followupId: true, customerName: true } },
          },
        },
      },
    });

    const formattedList = members.map((m) => {
      const activeTask = m.createdFollowups[0];
      let statusTag = 'ON_TRACK';
      let dueLabel = 'On track';

      if (activeTask) {
        const committed = new Date(activeTask.committedDate);
        if (committed < now) {
          statusTag = 'OVERDUE';
          dueLabel = 'Overdue';
        } else if (committed <= endOfToday) {
          statusTag = 'DUE_TODAY';
          dueLabel = 'Today';
        } else {
          const daysLeft = Math.ceil((committed.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          dueLabel = `${daysLeft} days`;
        }
      }

      return {
        id: m.id,
        fullName: m.fullName,
        phone: m.phone,
        role: m.role,
        currentTask: activeTask
          ? `${activeTask.description.slice(0, 50)} (${activeTask.inquiry.followupId})`
          : 'No active tasks',
        statusTag,
        dueLabel,
      };
    });

    const overdueCount = formattedList.filter((m) => m.statusTag === 'OVERDUE').length;
    const dueTodayCount = formattedList.filter((m) => m.statusTag === 'DUE_TODAY').length;
    const onTrackCount = formattedList.filter((m) => m.statusTag === 'ON_TRACK').length;

    return {
      summary: `${overdueCount} OVERDUE · ${dueTodayCount} DUE TODAY · ${onTrackCount} ON TRACK`,
      overdueCount,
      dueTodayCount,
      onTrackCount,
      members: formattedList,
    };
  }

  async getMemberDetail(memberId: string) {
    const member = await this.prisma.user.findUnique({
      where: { id: memberId },
      include: {
        createdFollowups: {
          orderBy: { committedDate: 'asc' },
          take: 10,
          include: {
            inquiry: { select: { id: true, followupId: true, customerName: true } },
          },
        },
      },
    });
    if (!member) throw new NotFoundException('Team member not found.');
    return member;
  }

  async logTeamFollowup(dto: LogTeamFollowupDto, managerUserId: string) {
    const member = await this.prisma.user.findUnique({
      where: { id: dto.teamMemberId },
    });
    if (!member) throw new NotFoundException('Team member not found.');

    // Find latest active followup by this member and update it
    const activeFollowup = await this.prisma.followupLog.findFirst({
      where: {
        createdById: dto.teamMemberId,
        status: { in: [FollowupStatus.ON_TRACK, FollowupStatus.DELAYED] },
      },
      orderBy: { committedDate: 'asc' },
    });

    if (activeFollowup) {
      return this.prisma.followupLog.update({
        where: { id: activeFollowup.id },
        data: {
          status: dto.status,
          description: `${activeFollowup.description} | Update: ${dto.whatTheySaid}`,
          committedDate: new Date(dto.newCommittedDate),
          isOverdue: false,
        },
      });
    }

    return { message: 'Follow-up recorded successfully.' };
  }
}

