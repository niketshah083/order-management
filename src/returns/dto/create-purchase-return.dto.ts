import { IsNumber, IsNotEmpty, IsOptional, IsString, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class PurchaseReturnItemDto {
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  itemId: number;

  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  quantity: number;

  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  unitPrice: number;

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
  @Type(() => Number)
  @IsNumber()
  batchDetailId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  serialDetailId?: number;
}

export class CreatePurchaseReturnDto {
  @IsNotEmpty()
  @IsString()
  poNumber: string;

  @IsNotEmpty()
  @IsString()
  reason: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseReturnItemDto)
  items: PurchaseReturnItemDto[];
}
