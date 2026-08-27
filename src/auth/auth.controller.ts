import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('/api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('/me')
  async getMe(@Req() req: { user?: any }) {
    return { user: req.user ?? null };
  }
}
