import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { MaterialsService } from './materials.service';
import { PlanMaterialDto, UploadUnloadProofDto } from './dto/material.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@Controller('api/v1/material')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MaterialsController {
  constructor(private readonly materialsService: MaterialsService) {}

  @Get('queue')
  @Roles(UserRole.ADMIN, UserRole.OPS_MANAGER, UserRole.MATERIAL_MANAGER)
  async getQueue() {
    return this.materialsService.getQueue();
  }

  @Post('plan')
  @Roles(UserRole.ADMIN, UserRole.OPS_MANAGER, UserRole.MATERIAL_MANAGER)
  async plan(@Body() dto: PlanMaterialDto, @CurrentUser('id') userId: string) {
    return this.materialsService.plan(dto, userId);
  }

  @Post('unload')
  @Roles(UserRole.ADMIN, UserRole.OPS_MANAGER, UserRole.MATERIAL_MANAGER)
  async uploadUnloadProof(@Body() dto: UploadUnloadProofDto, @CurrentUser('id') userId: string) {
    return this.materialsService.uploadUnloadProof(dto, userId);
  }

  @Get('whatsapp-preview/:id')
  @Roles(UserRole.ADMIN, UserRole.OPS_MANAGER, UserRole.MATERIAL_MANAGER)
  async getWhatsAppPreview(@Param('id') id: string) {
    return this.materialsService.getWhatsAppUnloadPreview(id);
  }
}

