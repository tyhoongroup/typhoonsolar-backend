import { IsNotEmpty, IsString, IsNumber, IsOptional, IsDateString, IsUUID } from 'class-validator';

export class PlanMaterialDto {
  @IsUUID()
  @IsNotEmpty()
  inquiryId: string;

  @IsString()
  @IsOptional()
  inverterSerialNo?: string;

  @IsString({ each: true })
  @IsOptional()
  panelSerialNumbers?: string[];

  @IsDateString()
  @IsNotEmpty()
  scheduledUnloadDate: string;

  @IsNumber()
  @IsNotEmpty()
  amountDueOnUnload: number;
}

export class UploadUnloadProofDto {
  @IsUUID()
  @IsNotEmpty()
  inquiryId: string;

  @IsString({ each: true })
  unloadPhotos: string[]; // Relative paths
}

