import { IsNotEmpty, IsOptional, IsUUID, IsString, MaxLength } from 'class-validator';

export class UpdateFileDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  originalName?: string;

  @IsOptional()
  @IsUUID()
  folderId?: string | null;
}
