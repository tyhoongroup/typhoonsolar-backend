import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class RecordPaymentDto {
  @IsUUID()
  @IsNotEmpty()
  milestoneId: string;

  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @IsString()
  @IsOptional()
  transactionRef?: string;
}

