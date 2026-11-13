import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { InstallationsService } from './installations.service';
import { UpdateJobProofDto } from './dto/installation.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@Controller('api/v1/jobs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InstallationsController {
  constructor(private readonly installationsService: InstallationsService) {}

  @Get('today')
  @Roles(UserRole.ADMIN, UserRole.OPS_MANAGER, UserRole.INSTALLATION_TEAM, UserRole.MATERIAL_MANAGER)
  async getTodayJobs() {
    return this.installationsService.getTodayJobs();
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.OPS_MANAGER, UserRole.INSTALLATION_TEAM, UserRole.MATERIAL_MANAGER)
  async getJobDetail(@Param('id') id: string) {
    return this.installationsService.getJobDetail(id);
  }

  @Post(':id/proof')
  @Roles(UserRole.ADMIN, UserRole.INSTALLATION_TEAM)
  async updateJobProof(
    @Param('id') id: string,
    @Body() dto: UpdateJobProofDto,
    @CurrentUser('id') techUserId: string,
  ) {
    dto.inquiryId = id;
    return this.installationsService.updateJobProof(dto, techUserId);
  }
}

