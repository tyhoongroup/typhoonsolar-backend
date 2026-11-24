import { IsNotEmpty, IsString, IsNumber, IsOptional, IsDateString } from 'class-validator';

export class PlanMaterialDto {
  @IsString()
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
  @IsString()
  @IsNotEmpty()
  inquiryId: string;

  @IsString({ each: true })
  unloadPhotos: string[]; // Relative paths
}

