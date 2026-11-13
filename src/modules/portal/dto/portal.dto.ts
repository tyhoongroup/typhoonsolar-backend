import { IsNotEmpty, IsString, IsOptional, IsDateString, IsUUID } from 'class-validator';

export class SubmitSrNumberDto {
  @IsUUID()
  @IsNotEmpty()
  inquiryId: string;

  @IsString()
  @IsNotEmpty()
  srNumber: string;
}

export class UpdateMeterDatesDto {
  @IsUUID()
  @IsNotEmpty()
  inquiryId: string;

  @IsDateString()
  @IsOptional()
  meterFileSubmitDate?: string;

  @IsDateString()
  @IsOptional()
  gebMeterInstallDate?: string;

  @IsDateString()
  @IsOptional()
  meterStartDate?: string;
}

export class UpdateSubsidyDto {
  @IsUUID()
  @IsNotEmpty()
  inquiryId: string;

  @IsString()
  @IsNotEmpty()
  subsidyStatus: 'PENDING' | 'QUERY' | 'RECEIVED';

  @IsString()
  @IsOptional()
  subsidyQueryNo?: string;

  @IsString()
  @IsOptional()
  subsidyQueryDesc?: string;

  @IsDateString()
  @IsOptional()
  subsidyReceivedDate?: string;
}

