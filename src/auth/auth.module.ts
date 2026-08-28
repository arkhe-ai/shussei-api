import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { DatabaseModule } from '../database/database.module';
import { GoogleStrategy } from './google.strategy';
import { JwtSessionGuard } from './jwt-session.guard';

@Module({
  imports: [DatabaseModule, PassportModule.register({ session: false })],
  controllers: [AuthController],
  providers: [AuthService, GoogleStrategy, JwtSessionGuard],
  exports: [AuthService, JwtSessionGuard],
})
export class AuthModule {}
