import { IsNotEmpty, IsOptional, IsString, IsNumber } from 'class-validator';

export class CreateCustomerDto {
  @IsNotEmpty({ message: 'Mobile number is required' })
  @IsString()
  mobileNo: string;

  @IsNotEmpty({ message: 'First name is required' })
  @IsString()
  firstname: string;

  @IsOptional()
  @IsString()
  lastname?: string;

  @IsOptional()
  @IsString()
  emailId?: string;

  @IsOptional()
  @IsString()
  gstin?: string;

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
  @IsNumber()
  distributorId?: number;

  @IsOptional()
  @IsNumber()
  creditLimitDays?: number;

  @IsOptional()
  @IsNumber()
  creditLimitAmount?: number;
}
