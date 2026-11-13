import { IsNotEmpty, IsString, IsUUID, IsEnum, IsDateString } from 'class-validator';
import { FollowupStatus } from '@prisma/client';

export class LogTeamFollowupDto {
  @IsUUID()
  @IsNotEmpty()
  teamMemberId: string;

  @IsString()
  @IsNotEmpty()
  taskDescription: string;

  @IsEnum(FollowupStatus)
  @IsNotEmpty()
  status: FollowupStatus; // 'ON_TRACK', 'DELAYED', 'DONE'

  @IsString()
  @IsNotEmpty()
  whatTheySaid: string; // "Waiting for customer Aadhaar copy"

  @IsDateString()
  @IsNotEmpty()
  newCommittedDate: string;
}

