import { IsNotEmpty, IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateJobProofDto {
  @IsUUID()
  @IsNotEmpty()
  inquiryId: string;

  @IsBoolean()
  @IsOptional()
  structureDone?: boolean;

  @IsString({ each: true })
  @IsOptional()
  structurePhotos?: string[];

  @IsBoolean()
  @IsOptional()
  panelsMounted?: boolean;

  @IsBoolean()
  @IsOptional()
  wiringDone?: boolean;

  @IsBoolean()
  @IsOptional()
  earthingSystemCheck?: boolean;

  @IsString()
  @IsOptional()
  installedInverterSerial?: string;

  @IsString({ each: true })
  @IsOptional()
  installedPanelSerials?: string[];
}

