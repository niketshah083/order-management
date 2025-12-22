import { IsNumber, IsNotEmpty, IsOptional, IsString, IsDecimal, IsIn } from 'class-validator';

export class CreatePaymentRequestDto {
  @IsOptional()
  @IsNumber()
  orderId?: number;

  @IsOptional()
  @IsNumber()
  distributorId?: number;

  @IsNotEmpty()
  amount: string | number;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsIn(['cash', 'online', 'credit'])
  paymentType?: 'cash' | 'online' | 'credit';

  @IsOptional()
  @IsNumber()
  customerId?: number;

  @IsOptional()
  @IsNumber()
  billingId?: number;
}
