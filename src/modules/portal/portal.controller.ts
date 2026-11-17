import { Controller, Get, Patch, Post, Body, Param, UseGuards } from '@nestjs/common';
import { PortalService } from './portal.service';
import { SubmitSrNumberDto, UpdateMeterDatesDto, UpdateSubsidyDto } from './dto/portal.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@Controller('api/v1/portal')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PortalController {
  constructor(private readonly portalService: PortalService) {}

  @Get('applications')
  @Roles(UserRole.ADMIN, UserRole.OPS_MANAGER, UserRole.PORTAL_USER)
  async getApplications() {
    return this.portalService.getApplications();
  }

  @Patch(':id/docs-uploaded')
  @Roles(UserRole.ADMIN, UserRole.OPS_MANAGER, UserRole.PORTAL_USER)
  async markDocsUploaded(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.portalService.markDocsUploaded(id, userId);
  }

  @Patch('sr-number')
  @Roles(UserRole.ADMIN, UserRole.OPS_MANAGER, UserRole.PORTAL_USER)
  async submitSrNumber(@Body() dto: SubmitSrNumberDto, @CurrentUser('id') userId: string) {
    return this.portalService.submitSrNumber(dto, userId);
  }

  @Patch('meter-dates')
  @Roles(UserRole.ADMIN, UserRole.OPS_MANAGER, UserRole.PORTAL_USER)
  async updateMeterDates(@Body() dto: UpdateMeterDatesDto, @CurrentUser('id') userId: string) {
    return this.portalService.updateMeterDates(dto, userId);
  }

  @Post('subsidy')
  @Roles(UserRole.ADMIN, UserRole.OPS_MANAGER, UserRole.PORTAL_USER)
  async updateSubsidy(@Body() dto: UpdateSubsidyDto, @CurrentUser('id') userId: string) {
    return this.portalService.updateSubsidy(dto, userId);
  }
}

