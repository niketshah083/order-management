import {
  IsString,
  IsNumber,
  IsOptional,
  IsDateString,
  IsObject,
} from 'class-validator';

export class CreateLotDto {
  @IsString()
  lotNumber: string;

  @IsNumber()
  itemId: number;

  @IsOptional()
  @IsDateString()
  manufactureDate?: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @IsOptional()
  @IsDateString()
  receivedDate?: string;

  @IsOptional()
  @IsNumber()
  supplierId?: number;

  @IsOptional()
  @IsString()
  supplierBatchNo?: string;

  @IsOptional()
  @IsNumber()
  purchaseOrderId?: number;

  @IsOptional()
  @IsNumber()
  grnId?: number;

  @IsOptional()
  @IsNumber()
  unitCost?: number;

  @IsOptional()
  @IsNumber()
  landedCost?: number;

  @IsOptional()
  @IsNumber()
  distributorId?: number;

  @IsOptional()
  @IsNumber()
  warehouseId?: number;

  @IsOptional()
  @IsObject()
  attributes?: Record<string, any>;
}
