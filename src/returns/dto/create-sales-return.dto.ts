import {
  IsNumber,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SalesReturnItemDto {
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
  rate: number;

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

  @IsOptional()
  @IsString()
  billNo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  billId?: number;

  @IsOptional()
  @IsString()
  condition?: 'good' | 'damaged' | 'defective';
}

export class CreateSalesReturnDto {
  @IsNotEmpty()
  @IsNumber()
  customerId: number;

  @IsNotEmpty()
  @IsString()
  reason: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SalesReturnItemDto)
  items: SalesReturnItemDto[];
}
