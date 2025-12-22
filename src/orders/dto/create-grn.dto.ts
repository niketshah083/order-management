import { IsNumber, IsArray, IsOptional, IsString, ValidateNested, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateGrnDto {
  @IsNumber()
  purchaseOrderId: number;

  @IsArray()
  items: GrnItemDto[];

  @IsOptional()
  @IsNumber()
  distributorId?: number;

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class BatchEntryDto {
  @IsNotEmpty()
  @IsString()
  batchNumber: string;

  @IsNotEmpty()
  @IsNumber()
  quantity: number;

  @IsOptional()
  @IsString()
  expiryDate?: string;
}

export class SerialEntryDto {
  @IsNotEmpty()
  @IsString()
  serialNumber: string;

  @IsOptional()
  @IsNumber()
  quantity?: number;

  @IsOptional()
  @IsString()
  expiryDate?: string;
}

export class GrnItemDto {
  @IsNumber()
  poItemId: number;

  @IsNumber()
  itemId: number;

  @IsNumber()
  receivedQuantity: number;

  @IsNumber()
  originalQuantity: number;

  @IsNumber()
  unitPrice: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BatchEntryDto)
  batchDetails?: BatchEntryDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SerialEntryDto)
  serialDetails?: SerialEntryDto[];

  // Legacy support
  @IsOptional()
  @IsString()
  batchNumber?: string;

  @IsOptional()
  @IsString()
  serialNumber?: string;

  @IsOptional()
  @IsString()
  expiryDate?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BatchEntryDto)
  batches?: BatchEntryDto[];
}
