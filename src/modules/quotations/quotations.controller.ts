import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { QuotationsService } from './quotations.service';
import { CalculateQuotationDto, SaveQuotationDto } from './dto/quotation.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('api/v1/quotations')
@UseGuards(JwtAuthGuard)
export class QuotationsController {
  constructor(private readonly quotationsService: QuotationsService) {}

  @Post('calculate')
  calculate(@Body() dto: CalculateQuotationDto) {
    return this.quotationsService.calculate(dto);
  }

  @Post('save')
  async save(@Body() dto: SaveQuotationDto, @CurrentUser('id') userId: string) {
    return this.quotationsService.save(dto, userId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.quotationsService.findByInquiry(id);
  }
}

