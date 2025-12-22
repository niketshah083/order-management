import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  IsIn,
  IsOptional,
  IsNumber,
  IsArray,
  ValidateIf,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'John' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  lastName: string;

  @ApiProperty({ example: 'admin@megashop.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '9898989898' })
  @IsString()
  mobileNo: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  password: string;

  @ApiProperty({ example: 'super_admin', enum: ['super_admin', 'distributor', 'manager'] })
  @IsIn(['super_admin', 'distributor', 'manager'])
  role: string;

  @ApiPropertyOptional({ example: [1, 2, 3], description: 'Distributor IDs to assign to manager', type: [Number] })
  @IsOptional()
  @IsArray()
  @ValidateIf((o) => o.role === 'manager')
  distributorIds?: number[];

  @ApiPropertyOptional({ example: 'ABC123456789XYZ', description: 'GSTIN for distributor' })
  @IsOptional()
  @IsString()
  @ValidateIf((o) => o.role === 'distributor')
  gstin?: string;

  @ApiPropertyOptional({ example: '123 Main Street', description: 'Address Line 1 for distributor' })
  @IsOptional()
  @IsString()
  @ValidateIf((o) => o.role === 'distributor')
  addressLine1?: string;

  @ApiPropertyOptional({ example: 'Near City Center', description: 'Address Line 2 for distributor' })
  @IsOptional()
  @IsString()
  @ValidateIf((o) => o.role === 'distributor')
  addressLine2?: string;

  @ApiPropertyOptional({ example: 'Mumbai', description: 'City for distributor' })
  @IsOptional()
  @IsString()
  @ValidateIf((o) => o.role === 'distributor')
  city?: string;

  @ApiPropertyOptional({ example: 'Maharashtra', description: 'State for distributor' })
  @IsOptional()
  @IsString()
  @ValidateIf((o) => o.role === 'distributor')
  state?: string;

  @ApiPropertyOptional({ example: '400001', description: 'Pincode for distributor' })
  @IsOptional()
  @IsString()
  @ValidateIf((o) => o.role === 'distributor')
  pincode?: string;

  @ApiPropertyOptional({ example: 30, description: 'Credit limit in days for distributor' })
  @IsOptional()
  @IsNumber()
  @ValidateIf((o) => o.role === 'distributor')
  creditLimitDays?: number;

  @ApiPropertyOptional({ example: 100000, description: 'Credit limit amount in rupees for distributor' })
  @IsOptional()
  @IsNumber()
  @ValidateIf((o) => o.role === 'distributor')
  creditLimitAmount?: number;

  @ApiPropertyOptional({ example: 'ABC Trading Company', description: 'Business name for distributor' })
  @IsOptional()
  @IsString()
  @ValidateIf((o) => o.role === 'distributor')
  businessName?: string;

  @ApiPropertyOptional({ example: 'Rajesh Kumar', description: 'Owner name for distributor' })
  @IsOptional()
  @IsString()
  @ValidateIf((o) => o.role === 'distributor')
  ownerName?: string;
}
