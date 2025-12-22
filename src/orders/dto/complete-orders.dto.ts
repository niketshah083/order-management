import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsNumber } from 'class-validator';

export class CompleteOrdersDto {
  @ApiProperty({
    type: [Number],
  })
  @ArrayNotEmpty()
  @IsArray()
  @IsNumber({}, { each: true })
  ids: number[];
}
