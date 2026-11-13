import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { ServiceService } from './service.service';
import { CreateServiceTicketDto, SubmitServiceReportDto } from './dto/service.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('api/v1/service')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ServiceController {
  constructor(private readonly serviceService: ServiceService) {}

  @Get('tickets')
  @Roles(UserRole.ADMIN, UserRole.OPS_MANAGER, UserRole.SERVICE_TECH)
  async getTickets() {
    return this.serviceService.getTickets();
  }

  @Get('tickets/:id')
  @Roles(UserRole.ADMIN, UserRole.OPS_MANAGER, UserRole.SERVICE_TECH)
  async getTicketDetail(@Param('id') id: string) {
    return this.serviceService.getTicketDetail(id);
  }

  @Post('tickets')
  @Roles(UserRole.ADMIN, UserRole.OPS_MANAGER, UserRole.SERVICE_TECH)
  async createTicket(@Body() dto: CreateServiceTicketDto) {
    return this.serviceService.create(dto);
  }

  @Post('tickets/:id/report')
  @Roles(UserRole.ADMIN, UserRole.SERVICE_TECH)
  async submitReport(@Param('id') id: string, @Body() dto: SubmitServiceReportDto) {
    return this.serviceService.submitReport(id, dto);
  }

  @Patch('tickets/:id/close')
  @Roles(UserRole.ADMIN, UserRole.OPS_MANAGER)
  async closeTicket(@Param('id') id: string) {
    return this.serviceService.closeTicket(id);
  }
}

