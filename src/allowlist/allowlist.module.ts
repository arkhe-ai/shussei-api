import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { AllowlistController } from './allowlist.controller';
import { AllowlistService } from './allowlist.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [AllowlistController],
  providers: [AllowlistService],
})
export class AllowlistModule {}
