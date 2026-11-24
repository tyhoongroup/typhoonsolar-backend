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
  @IsOptional()
  email?: string;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsString()
  @IsOptional()
  pincode?: string;

  @IsString()
  @IsOptional()
  state?: string;

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

export class LogCallDto {
  @IsString()
  @IsNotEmpty()
  callResult: string; // 'CALL_DONE' or 'NOT_REACHABLE'

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsOptional()
  committedDate?: string;
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

  @IsOptional()
  documentPaths?: { docType: string; filePath: string }[];

  @IsOptional()
  milestones?: {
    title: string;
    amount: number;
    actionTrigger?: string;
    dueDate?: string;
  }[];
}

export class UpdateInquiryDto {
  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsString()
  customerPhone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  pincode?: string;

  @IsOptional()
  @IsNumber()
  requestedKw?: number;

  @IsOptional()
  @IsString()
  meterPhase?: string;

  @IsOptional()
  @IsBoolean()
  isUrgent?: boolean;
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

  @IsOptional()
  @IsString()
  type?: 'inquiry' | 'project' | 'all';

  @IsOptional()
  @IsString()
  salespersonId?: string;
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


