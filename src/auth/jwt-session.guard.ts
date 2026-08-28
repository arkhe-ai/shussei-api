import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import type { SessionUser } from '../common/types/session-user';

type SessionRequest = Request & {
  user?: SessionUser;
  cookies?: Record<string, string | undefined>;
};

@Injectable()
export class JwtSessionGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<SessionRequest>();
    const user = request.user ?? (await this.authService.getSessionUserFromRequest(request));

    if (!user) {
      throw new UnauthorizedException('authentication_required');
    }

    request.user = user;
    return true;
  }
}
