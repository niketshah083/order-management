import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateInternalUserDto {
  @IsNotEmpty()
  @IsString()
  firstName: string;

  @IsNotEmpty()
  @IsString()
  lastName: string;

  @IsNotEmpty()
  @IsString()
  email: string;

  @IsNotEmpty()
  @IsString()
  mobileNo: string;

  @IsNotEmpty()
  @IsString()
  password: string;

  @IsNotEmpty()
  @IsString()
  role: 'super_admin' | 'manager';

  @IsOptional()
  @IsArray()
  distributorIds?: number[];
}
