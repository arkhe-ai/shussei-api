import { Controller, Param, Post, Req } from '@nestjs/common';
import { RtcService } from './rtc.service';
import { SessionUser } from '../common/types/session-user';

@Controller('/api/v1/channels')
export class RtcController {
  constructor(private readonly rtcService: RtcService) {}

  @Post('/:channelId/voice-token')
  async createVoiceToken(
    @Param('channelId') channelId: string,
    @Req() req: { user: SessionUser },
  ) {
    return this.rtcService.createVoiceToken({ channelId, user: req.user });
  }
}
