import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy, VerifyCallback } from 'passport-google-oauth20';
import { AuthService } from './auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private readonly authService: AuthService) {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      callbackURL:
        process.env.GOOGLE_CALLBACK_URL ?? 'http://localhost:3001/api/v1/auth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<void> {
    void accessToken;
    void refreshToken;

    const email = profile.emails?.[0]?.value;
    if (!email) {
      done(null, false, { message: 'missing_email' });
      return;
    }

    try {
      const user = await this.authService.upsertAllowedGoogleUser({
        sub: profile.id,
        email,
        name: profile.displayName || email,
        picture: profile.photos?.[0]?.value ?? null,
      });

      done(null, user);
    } catch (error) {
      if (error instanceof Error && error.message === 'access_denied') {
        done(null, false, { message: 'access_denied' });
        return;
      }

      done(error as Error, false);
    }
  }
}
