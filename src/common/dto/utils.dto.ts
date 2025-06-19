import { IsNumber, Min, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class PaginationParams {
  @ApiProperty({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  page?: number;

  @ApiProperty({ example: 10, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number;

  @ApiProperty({ example: 10, default: 'DESC' })
  @IsOptional()
  order?: 'ASC' | 'DESC' | undefined;

  @ApiProperty({ example: 'DESC', default: 'DESC', required: false })
  @IsOptional()
  sortingOrder?: 'ASC' | 'DESC';

  @ApiProperty({ example: 'createdAt', default: 'createdAt', required: false })
  @IsOptional()
  sortingColumn?: string;
}
