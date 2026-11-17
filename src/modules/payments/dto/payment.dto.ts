import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class RecordPaymentDto {
  @IsUUID()
  @IsOptional()
  milestoneId?: string;

  @IsString()
  @IsOptional()
  inquiryId?: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @IsString()
  @IsOptional()
  paymentMode?: string;

  @IsString()
  @IsOptional()
  transactionRef?: string;
}
