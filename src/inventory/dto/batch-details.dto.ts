import { IsNumber, IsString, IsDateString, IsOptional, IsArray } from 'class-validator';

export class BatchDetailDto {
  @IsNumber()
  itemId: number;

  @IsString()
  batchNumber: string;

  @IsOptional()
  @IsString()
  serialNumber?: string;

  @IsDateString()
  expiryDate: string;
}

export class SaveBatchDetailsDto {
  @IsNumber()
  purchaseOrderId: number;

  @IsArray()
  items: BatchDetailDto[];
}

export class BulkBatchImportDto {
  @IsNumber()
  purchaseOrderId: number;

  @IsArray()
  batchData: Array<{
    itemId: number;
    batchNumber: string;
    serialNumber?: string;
    expiryDate: string;
  }>;
}
