import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { CustomerService } from './customer.service';
import { SubmitFeedbackDto } from './dto/customer.dto';

@Controller('api/v1/public')
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Get('track/:token')
  async trackProject(@Param('token') token: string) {
    return this.customerService.trackProject(token);
  }

  @Get('ledger/:token')
  async getCustomerLedger(@Param('token') token: string) {
    return this.customerService.getCustomerLedger(token);
  }

  @Post('feedback/:token')
  async submitFeedback(@Param('token') token: string, @Body() dto: SubmitFeedbackDto) {
    return this.customerService.submitFeedback(token, dto);
  }
}

