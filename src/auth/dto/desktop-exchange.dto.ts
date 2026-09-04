import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class DesktopExchangeDto {
  /** The short-lived code the loopback callback delivered. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  code!: string;
}
