import { Transform } from 'class-transformer';
import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ALLOWED_SPRITE_IDS } from '../../common/types/session-user';

export class UpdateProfileDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(40)
  name?: string;

  @IsOptional()
  @IsIn(ALLOWED_SPRITE_IDS)
  spriteId?: string | null;
}
