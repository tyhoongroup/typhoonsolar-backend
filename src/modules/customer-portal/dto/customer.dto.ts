import { IsNotEmpty, IsNumber, IsOptional, IsString, Min, Max } from 'class-validator';

export class SubmitFeedbackDto {
  @IsNumber()
  @Min(1)
  @Max(5)
  rating: number; // 1 to 5 stars

  @IsString({ each: true })
  @IsOptional()
  tags?: string[]; // ['On time', 'Good support', 'Clean work', 'Fast meter start']

  @IsString()
  @IsOptional()
  comments?: string;
}

