import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateRazorpayOrderDto {
  @ApiProperty({ description: 'Billing ID to create payment for' })
  @IsNotEmpty()
  @IsNumber()
  billingId: number;

  @ApiProperty({ description: 'Amount in rupees (will be converted to paise)' })
  @IsNotEmpty()
  @IsNumber()
  amount: number;

  @ApiProperty({ description: 'Currency code', default: 'INR' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ description: 'Customer email for receipt' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty({ description: 'Customer contact number' })
  @IsOptional()
  @IsString()
  contact?: string;
}

export class VerifyPaymentDto {
  @ApiProperty({ description: 'Razorpay Order ID' })
  @IsNotEmpty()
  @IsString()
  razorpayOrderId: string;

  @ApiProperty({ description: 'Razorpay Payment ID' })
  @IsNotEmpty()
  @IsString()
  razorpayPaymentId: string;

  @ApiProperty({ description: 'Razorpay Signature for verification' })
  @IsNotEmpty()
  @IsString()
  razorpaySignature: string;
}

export class RefundPaymentDto {
  @ApiProperty({ description: 'Payment ID to refund' })
  @IsNotEmpty()
  @IsNumber()
  paymentId: number;

  @ApiProperty({
    description: 'Amount to refund (optional, full refund if not provided)',
  })
  @IsOptional()
  @IsNumber()
  amount?: number;

  @ApiProperty({ description: 'Reason for refund' })
  @IsOptional()
  @IsString()
  reason?: string;
}
