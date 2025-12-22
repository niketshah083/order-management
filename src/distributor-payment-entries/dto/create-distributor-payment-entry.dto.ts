import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsDateString } from 'class-validator';

export class CreateDistributorPaymentEntryDto {
  @ApiProperty({ example: 3, required: false, description: 'Distributor ID (required for admin, auto-set for distributor)' })
  @IsOptional()
  @IsNumber()
  distributorId?: number;

  @ApiProperty({ example: '2025-11-26' })
  @IsDateString()
  paymentDate: string;

  @ApiProperty({ example: 'CHEQUE', enum: ['CASH', 'CHEQUE', 'BANK_TRANSFER', 'UPI', 'NEFT', 'OTHER'] })
  @IsString()
  paymentMode: 'CASH' | 'CHEQUE' | 'BANK_TRANSFER' | 'UPI' | 'NEFT' | 'OTHER';

  @ApiProperty({ example: 5000 })
  @IsNumber()
  amount: number;

  @ApiProperty({ example: 'CHQ123456', required: false })
  @IsOptional()
  @IsString()
  chequeNo?: string;

  @ApiProperty({ example: 'REF-2025-001', required: false })
  @IsOptional()
  @IsString()
  referenceNo?: string;

  @ApiProperty({ example: 'Payment for PO#123', required: false })
  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateDistributorPaymentEntryStatusDto {
  @ApiProperty({ example: 'APPROVED', enum: ['APPROVED', 'REJECTED'] })
  @IsString()
  status: 'APPROVED' | 'REJECTED';

  @ApiProperty({ example: 'Cheque verified and deposited', required: false })
  @IsOptional()
  @IsString()
  adminRemarks?: string;
}
