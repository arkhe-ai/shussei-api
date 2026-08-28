import { Body, Controller, Get, Next, Patch, Req, Res, UseGuards } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import passport from 'passport';
import { AuthService } from './auth.service';
import { SessionUser } from '../common/types/session-user';
import { JwtSessionGuard } from './jwt-session.guard';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller('/api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('/google')
  googleLogin(@Req() req: Request, @Res() res: Response, @Next() next: NextFunction) {
    passport.authenticate('google', { scope: ['email', 'profile'], session: false })(req, res, next);
  }

  @Get('/google/callback')
  googleCallback(@Req() req: Request, @Res() res: Response, @Next() next: NextFunction) {
    passport.authenticate(
      'google',
      { session: false },
      (err: unknown, user: SessionUser | false | null, info?: { message?: string }) => {
        if (err) {
          next(err as Error);
          return;
        }

        if (!user) {
          const redirectUrl =
            info?.message === 'access_denied'
              ? this.authService.buildAccessDeniedRedirect()
              : this.authService.buildOauthFailureRedirect();
          res.redirect(redirectUrl);
          return;
        }

        const token = this.authService.createSessionToken(user);
        res.cookie(
          this.authService.getSessionCookieName(),
          token,
          this.authService.getSessionCookieOptions(),
        );
        res.redirect(this.authService.buildSuccessRedirect());
      },
    )(req, res, next);
  }

  @Get('/logout')
  logout(@Res() res: Response) {
    res.clearCookie(
      this.authService.getSessionCookieName(),
      this.authService.getSessionCookieOptions(),
    );
    res.redirect(`${this.authService.getFrontendUrl()}/login`);
  }

  @Patch('/me')
  @UseGuards(JwtSessionGuard)
  async updateMe(
    @Req() req: Request & { user?: SessionUser },
    @Body() body: UpdateProfileDto,
  ) {
    const user = await this.authService.updateProfileName(req.user!.id, body.name);
    return { user };
  }

  @Get('/me')
  async getMe(@Req() req: Request & { cookies?: Record<string, string | undefined> }) {
    return { user: await this.authService.getSessionUserFromRequest(req) };
  }
}
