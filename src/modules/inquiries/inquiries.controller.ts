import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { InquiriesService } from './inquiries.service';
import {
  CreateInquiryDto,
  AssignSalespersonDto,
  LogCallDto,
  SiteVisitReportDto,
  CloseDealDto,
  InquiryFilterDto,
  UploadDocumentsDto,
  DocumentQueryDto,
  UpdateInquiryDto,
} from './dto/inquiry.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@Controller('api/v1/inquiries')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InquiriesController {
  constructor(private readonly inquiriesService: InquiriesService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.OPS_MANAGER, UserRole.SALESPERSON)
  async create(@Body() dto: CreateInquiryDto, @CurrentUser('id') opsUserId: string) {
    return this.inquiriesService.create(dto, opsUserId);
  }

  @Get()
  async findAll(@Query() filter: InquiryFilterDto, @CurrentUser() user: any) {
    return this.inquiriesService.findAll(filter, user);
  }

  @Get('salespersons')
  async getSalespersons() {
    return this.inquiriesService.getSalespersons();
  }

  @Get('my-notifications')
  async getMyNotifications(@CurrentUser() user: any) {
    return this.inquiriesService.getMyNotifications(user);
  }

  @Get('followups/all')
  async getAllFollowups(@Query() query: any) {
    return this.inquiriesService.getAllFollowups(query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.inquiriesService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.OPS_MANAGER)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateInquiryDto,
    @CurrentUser('id') opsUserId: string,
  ) {
    return this.inquiriesService.update(id, dto, opsUserId);
  }

  @Patch(':id/assign')
  @Roles(UserRole.ADMIN, UserRole.OPS_MANAGER)
  async assignSalesperson(
    @Param('id') id: string,
    @Body() dto: AssignSalespersonDto,
    @CurrentUser('id') opsUserId: string,
  ) {
    return this.inquiriesService.assignSalesperson(id, dto, opsUserId);
  }

  @Post(':id/log-call')
  @Roles(UserRole.ADMIN, UserRole.OPS_MANAGER, UserRole.SALESPERSON)
  async logCall(
    @Param('id') id: string,
    @Body() dto: LogCallDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.inquiriesService.logCall(id, dto, userId);
  }

  @Post(':id/site-visit')
  @Roles(UserRole.ADMIN, UserRole.OPS_MANAGER, UserRole.SALESPERSON)
  async submitSiteVisit(
    @Param('id') id: string,
    @Body() dto: SiteVisitReportDto,
    @CurrentUser('id') salesUserId: string,
  ) {
    return this.inquiriesService.submitSiteVisit(id, dto, salesUserId);
  }

  @Post(':id/close-deal')
  @Roles(UserRole.ADMIN, UserRole.SALESPERSON, UserRole.OPS_MANAGER)
  async closeDeal(
    @Param('id') id: string,
    @Body() dto: CloseDealDto,
    @CurrentUser('id') salesUserId: string,
  ) {
    return this.inquiriesService.closeDeal(id, dto, salesUserId);
  }

  @Post(':id/documents')
  @Roles(UserRole.ADMIN, UserRole.SALESPERSON, UserRole.OPS_MANAGER)
  async uploadDocuments(
    @Param('id') id: string,
    @Body() dto: UploadDocumentsDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.inquiriesService.uploadDocuments(id, dto, userId);
  }

  @Post(':id/document-query')
  @Roles(UserRole.ADMIN, UserRole.PORTAL_USER, UserRole.OPS_MANAGER)
  async flagDocumentQuery(
    @Param('id') id: string,
    @Body() dto: DocumentQueryDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.inquiriesService.flagDocumentQuery(id, dto, userId);
  }
}

