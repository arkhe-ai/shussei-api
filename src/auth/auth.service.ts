import { Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../database/prisma.service';
import { SessionUser } from '../common/types/session-user';

type ProfileUpdate = { name?: string; spriteId?: string | null };

const jwt = require('jsonwebtoken');

export type GoogleProfile = {
  sub: string;
  email: string;
  name: string;
  picture: string | null;
};

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  private toSessionUser(user: {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
    spriteId?: string | null;
  }): SessionUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      spriteId: user.spriteId ?? null,
    };
  }

  async upsertAllowedGoogleUser(profile: GoogleProfile): Promise<SessionUser> {
    const allowed = await this.prisma.allowedUser.findUnique({ where: { email: profile.email } });
    if (!allowed) throw new Error('access_denied');

    const user = await this.prisma.user.upsert({
      where: { email: profile.email },
      update: { googleId: profile.sub, avatarUrl: profile.picture, status: 'active' },
      create: {
        googleId: profile.sub,
        email: profile.email,
        name: profile.name,
        avatarUrl: profile.picture,
      },
    });

    return this.toSessionUser(user);
  }

  async updateProfileName(userId: string, name: string): Promise<SessionUser> {
    return this.updateProfile(userId, { name });
  }

  async updateProfile(userId: string, input: ProfileUpdate): Promise<SessionUser> {
    const data: ProfileUpdate = { ...input };
    if (data.name !== undefined) data.name = data.name.trim();
    const user = await this.prisma.user.update({ where: { id: userId }, data });
    return this.toSessionUser(user);
  }

  async getUserById(userId: string): Promise<SessionUser | null> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    return user ? this.toSessionUser(user) : null;
  }

  async listUsers(): Promise<SessionUser[]> {
    const users = await this.prisma.user.findMany({ where: { status: 'active' }, orderBy: { name: 'asc' } });
    return users.map((user: any) => this.toSessionUser(user));
  }

  async listUsersByIds(userIds: string[]): Promise<SessionUser[]> {
    if (userIds.length === 0) return [];
    const users = await this.prisma.user.findMany({ where: { id: { in: userIds } } });
    return users.map((user: any) => this.toSessionUser(user));
  }

  getSessionCookieName(): string {
    return process.env.SESSION_COOKIE_NAME ?? 'shussei_session';
  }

  createSessionToken(user: SessionUser): string {
    return jwt.sign(
      { sub: user.id, email: user.email },
      process.env.SESSION_SECRET ?? 'change-me-session',
      { expiresIn: '7d' },
    );
  }

  /**
   * Marks the short-lived code a desktop sign-in ends with.
   *
   * Both it and a session token are signed with the same secret, so without
   * something to tell them apart the code handed to the loopback address would
   * verify as a session and could simply be presented as one. The audience is
   * that separation: session tokens carry none and are rejected here, the code
   * carries this one and is rejected everywhere else.
   */
  private static readonly DESKTOP_EXCHANGE_AUDIENCE = 'shussei:desktop-exchange';

  /**
   * Handed to the desktop app over loopback in place of a session.
   *
   * Two minutes is the whole life of it: long enough to survive the redirect
   * chain out of Google, short enough that a copy left behind in browser
   * history or a proxy log is already spent by the time anyone reads it.
   */
  createDesktopExchangeCode(user: SessionUser): string {
    return jwt.sign(
      { sub: user.id, aud: AuthService.DESKTOP_EXCHANGE_AUDIENCE },
      process.env.SESSION_SECRET ?? 'change-me-session',
      { expiresIn: '2m' },
    );
  }

  async getUserFromDesktopExchangeCode(code?: string): Promise<SessionUser | null> {
    if (!code) return null;
    try {
      const payload = jwt.verify(code, process.env.SESSION_SECRET ?? 'change-me-session', {
        audience: AuthService.DESKTOP_EXCHANGE_AUDIENCE,
      }) as { sub?: string };
      return payload?.sub ? this.getUserById(payload.sub) : null;
    } catch {
      return null;
    }
  }

  async getSessionUserFromToken(token?: string): Promise<SessionUser | null> {
    if (!token) return null;
    try {
      const payload = jwt.verify(token, process.env.SESSION_SECRET ?? 'change-me-session') as {
        sub?: string;
        aud?: string;
      };
      // An exchange code is not a session, however well it verifies.
      if (payload?.aud === AuthService.DESKTOP_EXCHANGE_AUDIENCE) return null;
      return payload?.sub ? this.getUserById(payload.sub) : null;
    } catch {
      return null;
    }
  }

  async getSessionUserFromRequest(req: Request & { cookies?: Record<string, string | undefined> }) {
    return this.getSessionUserFromToken(req.cookies?.[this.getSessionCookieName()]);
  }

  getSessionCookieOptions() {
    const cookieDomain = process.env.COOKIE_DOMAIN;
    return {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 1000 * 60 * 60 * 24 * 7,
      ...(cookieDomain && cookieDomain !== 'localhost' ? { domain: cookieDomain } : {}),
    };
  }

  getFrontendUrl(): string { return process.env.FRONTEND_URL ?? 'http://localhost:3000'; }
  buildSuccessRedirect(): string { return `${this.getFrontendUrl()}/channels`; }
  buildAccessDeniedRedirect(): string { return `${this.getFrontendUrl()}/access-denied`; }
  buildOauthFailureRedirect(): string { return `${this.getFrontendUrl()}/login?error=oauth_failed`; }
}
