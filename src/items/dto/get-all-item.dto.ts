import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsIn, IsNotEmpty, IsNumber } from 'class-validator';

export class GetAllItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  page: string;

  @ApiPropertyOptional()
  @IsOptional()
  limit: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  searchName: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  searchUnit: string;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  categoryId: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  sortBy: string;

  @ApiPropertyOptional({
    type: String,
    enum: ['ASC', 'DESC'],
  })
  @IsString()
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortOrder: 'ASC' | 'DESC';
}
