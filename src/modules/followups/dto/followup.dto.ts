import { IsNotEmpty, IsString, IsEnum, IsOptional, IsDateString, IsUUID } from 'class-validator';
import { ProjectStage, FollowupStatus } from '@prisma/client';

export class CreateFollowupDto {
  @IsUUID()
  @IsNotEmpty()
  inquiryId: string;

  @IsEnum(ProjectStage)
  @IsNotEmpty()
  stage: ProjectStage;

  @IsEnum(FollowupStatus)
  @IsNotEmpty()
  status: FollowupStatus;

  @IsString()
  @IsNotEmpty()
  description: string; // "What customer said / delay reason"

  @IsDateString()
  @IsNotEmpty()
  committedDate: string; // SLA promised deadline
}

export class UpdateFollowupStatusDto {
  @IsEnum(FollowupStatus)
  @IsNotEmpty()
  status: FollowupStatus;

  @IsString()
  @IsOptional()
  description?: string;

  @IsDateString()
  @IsOptional()
  newCommittedDate?: string;
}

