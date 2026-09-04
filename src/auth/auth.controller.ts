import {
  Body,
  Controller,
  Get,
  HttpCode,
  Next,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import passport from 'passport';
import { AuthService } from './auth.service';
import { SessionUser } from '../common/types/session-user';
import { JwtSessionGuard } from './jwt-session.guard';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { DesktopExchangeDto } from './dto/desktop-exchange.dto';
import { buildDesktopRedirect, buildDesktopState, parseDesktopState } from './desktop-login';

@Controller('/api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('/google')
  googleLogin(@Req() req: Request, @Res() res: Response, @Next() next: NextFunction) {
    // A desktop sign-in asks to finish on loopback; anything else is the web
    // client, and the state stays empty as it always was.
    const state = buildDesktopState(req.query ?? {});

    passport.authenticate('google', {
      scope: ['email', 'profile'],
      session: false,
      ...(state ? { state } : {}),
    })(req, res, next);
  }

  @Get('/google/callback')
  googleCallback(@Req() req: Request, @Res() res: Response, @Next() next: NextFunction) {
    // Read before authenticating: the state is the only thing that survived
    // the trip through Google, and it is what says where this ends.
    const desktop = parseDesktopState(req.query?.state);

    passport.authenticate(
      'google',
      { session: false },
      (err: unknown, user: SessionUser | false | null, info?: { message?: string }) => {
        if (err) {
          next(err as Error);
          return;
        }

        if (!user) {
          const reason = info?.message === 'access_denied' ? 'access_denied' : 'oauth_failed';

          // The desktop app is sitting on its loopback server waiting. Sending
          // this to the web client instead would leave it waiting for a
          // callback that is never coming.
          if (desktop) {
            res.redirect(buildDesktopRedirect(desktop, { error: reason }));
            return;
          }

          res.redirect(
            reason === 'access_denied'
              ? this.authService.buildAccessDeniedRedirect()
              : this.authService.buildOauthFailureRedirect(),
          );
          return;
        }

        /*
         * Deliberately no cookie here. The browser that just signed in is the
         * user's own, not the desktop app, and a session dropped into it would
         * land where the app cannot reach it. The app trades this code for a
         * session in its own jar instead.
         */
        if (desktop) {
          res.redirect(
            buildDesktopRedirect(desktop, {
              code: this.authService.createDesktopExchangeCode(user),
            }),
          );
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

  /**
   * Closes a desktop sign-in.
   *
   * The session is returned as a `Set-Cookie` rather than in the body so that
   * the app can hand the response straight to its own network session and
   * never handle the token in JavaScript at all.
   */
  @Post('/desktop/exchange')
  @HttpCode(200)
  async exchangeDesktopCode(
    @Body() body: DesktopExchangeDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.authService.getUserFromDesktopExchangeCode(body.code);
    if (!user) throw new UnauthorizedException('invalid_exchange_code');

    res.cookie(
      this.authService.getSessionCookieName(),
      this.authService.createSessionToken(user),
      this.authService.getSessionCookieOptions(),
    );

    return { user };
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
    const user = await this.authService.updateProfile(req.user!.id, body);
    return { user };
  }

  @Get('/me')
  async getMe(@Req() req: Request & { cookies?: Record<string, string | undefined> }) {
    return { user: await this.authService.getSessionUserFromRequest(req) };
  }
}
