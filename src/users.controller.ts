import { Controller, Get } from '@nestjs/common';
import { AuthService } from './auth/auth.service';

@Controller('/api/v1/users')
export class UsersController {
  constructor(private readonly authService: AuthService) {}

  @Get()
  async listUsers() {
    return { users: await this.authService.listUsers() };
  }
}
