import { Controller, Get, Param, Post, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { RtcService } from './rtc.service';
import { SessionUser } from '../common/types/session-user';
import { AuthService } from '../auth/auth.service';

@Controller('/api/v1/channels')
export class RtcController {
  constructor(
    private readonly rtcService: RtcService,
    private readonly authService: AuthService,
  ) {}

  private async requireSessionUser(
    req: Request & { user?: SessionUser; cookies?: Record<string, string | undefined> },
  ): Promise<SessionUser> {
    const user = req.user ?? (await this.authService.getSessionUserFromRequest(req));
    if (!user) {
      throw new UnauthorizedException('authentication_required');
    }

    return user;
  }

  @Post('/:channelId/voice-token')
  async createVoiceToken(
    @Param('channelId') channelId: string,
    @Req() req: Request & { user?: SessionUser; cookies?: Record<string, string | undefined> },
  ) {
    const user = await this.requireSessionUser(req);
    return this.rtcService.createVoiceToken({ channelId, user });
  }

  @Get('/:channelId/voice-token')
  async getVoiceToken(
    @Param('channelId') channelId: string,
    @Req() req: Request & { user?: SessionUser; cookies?: Record<string, string | undefined> },
  ) {
    const user = await this.requireSessionUser(req);
    return this.rtcService.createVoiceToken({ channelId, user });
  }
}
