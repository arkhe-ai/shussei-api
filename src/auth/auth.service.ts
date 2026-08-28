import { Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../database/prisma.service';
import { SessionUser } from '../common/types/session-user';

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

  async upsertAllowedGoogleUser(profile: GoogleProfile): Promise<SessionUser> {
    const allowed = await this.prisma.allowedUser.findUnique({
      where: { email: profile.email },
    });
    if (!allowed) {
      throw new Error('access_denied');
    }

    const user = await this.prisma.user.upsert({
      where: { email: profile.email },
      update: {
        googleId: profile.sub,
        name: profile.name,
        avatarUrl: profile.picture,
        status: 'active',
      },
      create: {
        googleId: profile.sub,
        email: profile.email,
        name: profile.name,
        avatarUrl: profile.picture,
        status: 'active',
      },
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
    };
  }

  async getUserById(userId: string): Promise<SessionUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
    };
  }

  async listUsers(): Promise<SessionUser[]> {
    const users = await this.prisma.user.findMany({
      where: { status: 'active' },
      orderBy: { name: 'asc' },
    });

    return users.map((user: any) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
    }));
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

  async getSessionUserFromToken(token?: string): Promise<SessionUser | null> {
    if (!token) {
      return null;
    }

    try {
      const payload = jwt.verify(token, process.env.SESSION_SECRET ?? 'change-me-session') as {
        sub?: string;
      };

      if (!payload?.sub) {
        return null;
      }

      return this.getUserById(payload.sub);
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

  getFrontendUrl(): string {
    return process.env.FRONTEND_URL ?? 'http://localhost:3000';
  }

  buildSuccessRedirect(): string {
    return `${this.getFrontendUrl()}/channels`;
  }

  buildAccessDeniedRedirect(): string {
    return `${this.getFrontendUrl()}/access-denied`;
  }

  buildOauthFailureRedirect(): string {
    return `${this.getFrontendUrl()}/login?error=oauth_failed`;
  }
}
