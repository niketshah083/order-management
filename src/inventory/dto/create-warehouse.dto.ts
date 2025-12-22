import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsBoolean,
} from 'class-validator';

export class CreateWarehouseDto {
  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsEnum(['MAIN', 'TRANSIT', 'RETURN', 'QUARANTINE', 'VIRTUAL'])
  type?: 'MAIN' | 'TRANSIT' | 'RETURN' | 'QUARANTINE' | 'VIRTUAL';

  @IsOptional()
  @IsString()
  addressLine1?: string;

  @IsOptional()
  @IsString()
  addressLine2?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  pincode?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsNumber()
  distributorId?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
