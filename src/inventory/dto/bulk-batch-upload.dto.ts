import { IsNotEmpty, IsNumber, IsArray, ValidateNested, IsString, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class BatchDetailDto {
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

export class BulkBatchUploadDto {
  @IsNotEmpty()
  @IsNumber()
  itemId: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BatchDetailDto)
  batches: BatchDetailDto[];
}

export class SerialDetailDto {
  @IsNotEmpty()
  @IsString()
  serialNumber: string;

  @IsOptional()
  @IsString()
  expiryDate?: string;
}

export class BulkSerialUploadDto {
  @IsNotEmpty()
  @IsNumber()
  itemId: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SerialDetailDto)
  serials: SerialDetailDto[];
}
