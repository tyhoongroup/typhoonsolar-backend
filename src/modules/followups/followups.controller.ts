import { Controller, Post, Get, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { FollowupsService } from './followups.service';
import { CreateFollowupDto, UpdateFollowupStatusDto } from './dto/followup.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('api/v1/followups')
@UseGuards(JwtAuthGuard)
export class FollowupsController {
  constructor(private readonly followupsService: FollowupsService) {}

  @Get()
  async findAll(@Query() query: any) {
    return this.followupsService.findAll(query);
  }

  @Post()
  async create(@Body() dto: CreateFollowupDto, @CurrentUser('id') userId: string) {
    return this.followupsService.create(dto, userId);
  }

  @Get('inquiry/:id')
  async getByInquiry(@Param('id') inquiryId: string) {
    return this.followupsService.getByInquiry(inquiryId);
  }

  @Get('my-agenda')
  async getMyAgenda(@CurrentUser('id') userId: string) {
    return this.followupsService.getMyAgenda(userId);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateFollowupStatusDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.followupsService.updateStatus(id, dto, userId);
  }
}

