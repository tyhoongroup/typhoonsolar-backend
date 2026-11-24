import { IsNotEmpty, IsString, IsOptional, IsDateString } from 'class-validator';

export class SubmitSrNumberDto {
  @IsString()
  @IsNotEmpty()
  inquiryId: string;

  @IsString()
  @IsNotEmpty()
  srNumber: string;
}

export class UpdateMeterDatesDto {
  @IsString()
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
  @IsString()
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

