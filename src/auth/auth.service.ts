import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { SessionUser } from '../common/types/session-user';

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
}
