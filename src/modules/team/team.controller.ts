import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { TeamService } from './team.service';
import { LogTeamFollowupDto } from './dto/team.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@Controller('api/v1/team')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @Get('tracker')
  @Roles(UserRole.ADMIN, UserRole.OPS_MANAGER)
  async getTeamTracker() {
    return this.teamService.getTeamTracker();
  }

  @Get('member/:id')
  @Roles(UserRole.ADMIN, UserRole.OPS_MANAGER)
  async getMemberDetail(@Param('id') id: string) {
    return this.teamService.getMemberDetail(id);
  }

  @Post('log-followup')
  @Roles(UserRole.ADMIN, UserRole.OPS_MANAGER)
  async logTeamFollowup(@Body() dto: LogTeamFollowupDto, @CurrentUser('id') managerId: string) {
    return this.teamService.logTeamFollowup(dto, managerId);
  }
}

