import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { RecordPaymentDto } from './dto/payment.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@Controller('api/v1/payments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('overview')
  @Roles(UserRole.ADMIN, UserRole.OPS_MANAGER, UserRole.ACCOUNTANT)
  async getOverview() {
    return this.paymentsService.getOverview();
  }

  @Get('ledger/:id')
  @Roles(UserRole.ADMIN, UserRole.OPS_MANAGER, UserRole.ACCOUNTANT)
  async getLedger(@Param('id') id: string) {
    return this.paymentsService.getLedger(id);
  }

  @Post('record')
  @Roles(UserRole.ADMIN, UserRole.OPS_MANAGER, UserRole.ACCOUNTANT)
  async recordPayment(@Body() dto: RecordPaymentDto, @CurrentUser('id') userId: string) {
    return this.paymentsService.recordPayment(dto, userId);
  }

  @Get('reminder-text/:id')
  @Roles(UserRole.ADMIN, UserRole.OPS_MANAGER, UserRole.ACCOUNTANT)
  async getReminderText(@Param('id') id: string, @Query('milestoneId') milestoneId?: string) {
    return this.paymentsService.getWhatsAppPaymentReminder(id, milestoneId);
  }
}

