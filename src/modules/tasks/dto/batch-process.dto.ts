import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEnum, IsNotEmpty, IsString } from 'class-validator';

export class BatchProcessDto {
  @ApiProperty({ example: ['uuid1', 'uuid2'], description: 'List of task IDs' })
  @IsArray()
  @IsString({ each: true })
  tasks: string[];

  @ApiProperty({
    example: 'complete',
    enum: ['complete', 'delete'],
    description: 'Action to perform on tasks',
  })
  @IsNotEmpty()
  @IsEnum(['complete', 'delete'])
  action: 'complete' | 'delete';
}
