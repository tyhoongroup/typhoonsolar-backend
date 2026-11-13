import { IsNotEmpty, IsString, IsNumber, IsOptional, IsEnum, IsUUID } from 'class-validator';

export class CalculateQuotationDto {
  @IsNumber()
  @IsNotEmpty()
  panelWattage: number; // e.g. 580

  @IsNumber()
  @IsNotEmpty()
  panelQuantity: number; // e.g. 8

  @IsString()
  @IsNotEmpty()
  meterPhase: 'Single Phase' | 'Three Phase';

  @IsString()
  @IsNotEmpty()
  panelTech: 'Polycrystalline' | 'Monocrystalline' | 'Bi-facial' | 'Topcon';

  @IsNumber()
  @IsNotEmpty()
  grossCost: number;

  @IsNumber()
  @IsOptional()
  stateSubsidy?: number;
}

export class SaveQuotationDto {
  @IsUUID()
  @IsNotEmpty()
  inquiryId: string;

  @IsString()
  @IsNotEmpty()
  panelBrand: string; // e.g. 'Waaree'

  @IsString()
  @IsNotEmpty()
  panelTech: 'Polycrystalline' | 'Monocrystalline' | 'Bi-facial' | 'Topcon';

  @IsNumber()
  @IsNotEmpty()
  panelWattage: number;

  @IsNumber()
  @IsNotEmpty()
  panelQuantity: number;

  @IsString()
  @IsNotEmpty()
  inverterBrand: string; // e.g. 'Polycab'

  @IsNumber()
  @IsNotEmpty()
  inverterCapacityKw: number;

  @IsNumber()
  @IsNotEmpty()
  grossCost: number;

  @IsNumber()
  @IsOptional()
  stateSubsidy?: number;
}

