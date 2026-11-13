import { IsNotEmpty, IsString, IsNumber, IsBoolean, IsOptional, Matches, IsEnum } from 'class-validator';
import { ProjectStage } from '@prisma/client';

export class CreateInquiryDto {
  @IsString()
  @IsNotEmpty()
  customerName: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[6-9]\d{9}$/, { message: 'Must be a valid 10-digit mobile number' })
  customerPhone: string;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsNumber()
  requestedKw: number; // e.g. 6.0

  @IsString()
  @IsNotEmpty()
  meterPhase: string; // 'Single Phase' or 'Three Phase'

  @IsBoolean()
  @IsOptional()
  isUrgent?: boolean;

  @IsString()
  @IsOptional()
  assignedSalespersonId?: string;
}

export class AssignSalespersonDto {
  @IsString()
  @IsNotEmpty()
  salespersonId: string;

  @IsNumber()
  @IsOptional()
  dueDays?: number;
}

export class SiteVisitReportDto {
  @IsBoolean()
  roofAreaChecked: boolean;

  @IsBoolean()
  meterWiringSeen: boolean;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString({ each: true })
  photos: string[]; // Uploaded relative paths from SharpImagePipe
}

export class CloseDealDto {
  @IsNumber()
  @IsNotEmpty()
  dealAmount: number;

  @IsString({ each: true })
  @IsOptional()
  documentPaths?: { docType: string; filePath: string }[];
}

export class InquiryFilterDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(ProjectStage)
  stage?: ProjectStage;

  @IsOptional()
  @IsString()
  statusFilter?: 'ALL' | 'NEW' | 'FOLLOWUP' | 'QUOTATION' | 'NEGOTIATION' | 'CLOSED';
}

export class UploadDocumentItemDto {
  @IsString()
  @IsNotEmpty()
  docType: string;

  @IsString()
  @IsNotEmpty()
  filePath: string;
}

export class UploadDocumentsDto {
  @IsOptional()
  documents?: UploadDocumentItemDto[];
}

export class DocumentQueryDto {
  @IsString()
  @IsNotEmpty()
  docType: string;

  @IsString()
  @IsNotEmpty()
  queryNotes: string;
}

