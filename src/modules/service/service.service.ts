import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateServiceTicketDto, SubmitServiceReportDto } from './dto/service.dto';
import { TicketStatus } from '@prisma/client';

@Injectable()
export class ServiceService {
  constructor(private readonly prisma: PrismaService) {}

  private async generateNextTicketNo(): Promise<string> {
    const count = await this.prisma.serviceTicket.count();
    return `S-${201 + count}`;
  }

  async getTickets() {
    return this.prisma.serviceTicket.findMany({
      include: {
        inquiry: {
          select: { id: true, followupId: true, customerName: true, customerPhone: true, city: true },
        },
        assignedTechnician: {
          select: { id: true, fullName: true, phone: true },
        },
      },
      orderBy: [
        { isUrgent: 'desc' },
        { createdAt: 'desc' },
      ],
    });
  }

  async getTicketDetail(id: string) {
    const ticket = await this.prisma.serviceTicket.findFirst({
      where: { OR: [{ id }, { ticketNo: id }] },
      include: {
        inquiry: true,
        assignedTechnician: true,
      },
    });
    if (!ticket) throw new NotFoundException('Service ticket not found.');
    return ticket;
  }

  async create(dto: CreateServiceTicketDto) {
    const ticketNo = await this.generateNextTicketNo();

    return this.prisma.serviceTicket.create({
      data: {
        ticketNo,
        inquiryId: dto.inquiryId,
        issueType: dto.issueType,
        isUrgent: dto.isUrgent ?? false,
        assignedTechnicianId: dto.assignedTechnicianId,
        status: TicketStatus.LOGGED,
      },
    });
  }

  async submitReport(ticketId: string, dto: SubmitServiceReportDto) {
    return this.prisma.serviceTicket.update({
      where: { id: ticketId },
      data: {
        partsUsed: dto.partsUsed,
        daysToResolve: dto.daysToResolve || 1,
        isChargeable: dto.isChargeable,
        repairPhotos: dto.repairPhotos || [],
        status: TicketStatus.RESOLVED,
        resolvedAt: new Date(),
      },
    });
  }

  async closeTicket(ticketId: string) {
    return this.prisma.serviceTicket.update({
      where: { id: ticketId },
      data: { status: TicketStatus.CLOSED },
    });
  }
}

