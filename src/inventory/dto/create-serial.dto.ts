import {
  IsString,
  IsNumber,
  IsOptional,
  IsDateString,
  IsObject,
  IsEnum,
} from 'class-validator';

export class CreateSerialDto {
  @IsString()
  serialNumber: string;

  @IsNumber()
  itemId: number;

  @IsOptional()
  @IsNumber()
  lotId?: number;

  @IsOptional()
  @IsNumber()
  currentWarehouseId?: number;

  @IsOptional()
  @IsEnum(['COMPANY', 'DISTRIBUTOR', 'CUSTOMER'])
  currentOwnerType?: 'COMPANY' | 'DISTRIBUTOR' | 'CUSTOMER';

  @IsOptional()
  @IsNumber()
  currentOwnerId?: number;

  @IsOptional()
  @IsNumber()
  purchaseOrderId?: number;

  @IsOptional()
  @IsNumber()
  grnId?: number;

  @IsOptional()
  @IsDateString()
  receivedDate?: string;

  @IsOptional()
  @IsNumber()
  unitCost?: number;

  @IsOptional()
  @IsDateString()
  warrantyStartDate?: string;

  @IsOptional()
  @IsDateString()
  warrantyEndDate?: string;

  @IsOptional()
  @IsString()
  warrantyTerms?: string;

  @IsOptional()
  @IsNumber()
  distributorId?: number;

  @IsOptional()
  @IsObject()
  attributes?: Record<string, any>;
}
