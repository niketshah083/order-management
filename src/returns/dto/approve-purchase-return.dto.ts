import { IsNotEmpty, IsString, IsOptional, IsEnum } from 'class-validator';

export class ApprovePurchaseReturnDto {
  @IsNotEmpty()
  @IsEnum(['approved', 'rejected'])
  status: 'approved' | 'rejected';

  @IsOptional()
  @IsString()
  rejectionReason?: string;

  @IsOptional()
  @IsString()
  adminComments?: string;
}
