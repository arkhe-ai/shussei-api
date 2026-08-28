import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, Min } from 'class-validator';

export class UpdateChannelDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsEnum(['text', 'voice'])
  type?: 'text' | 'voice';

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}
