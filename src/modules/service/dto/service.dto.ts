import { IsNotEmpty, IsString, IsBoolean, IsOptional, IsNumber, IsUUID } from 'class-validator';

export class CreateServiceTicketDto {
  @IsUUID()
  @IsNotEmpty()
  inquiryId: string;

  @IsString()
  @IsNotEmpty()
  issueType: string; // 'Inverter short circuit', 'MCB burned', 'No units generated'

  @IsBoolean()
  @IsOptional()
  isUrgent?: boolean;

  @IsString()
  @IsOptional()
  assignedTechnicianId?: string;
}

export class SubmitServiceReportDto {
  @IsString({ each: true })
  partsUsed: string[]; // ['Fuse', 'Cable', 'MCB', 'Inverter']

  @IsNumber()
  @IsOptional()
  daysToResolve?: number;

  @IsBoolean()
  isChargeable: boolean;

  @IsString({ each: true })
  @IsOptional()
  repairPhotos?: string[];
}

