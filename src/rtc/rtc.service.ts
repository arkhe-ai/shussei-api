import { Injectable } from '@nestjs/common';
import { SessionUser } from '../common/types/session-user';

export type CreateVoiceTokenInput = {
  channelId: string;
  user: SessionUser;
};

@Injectable()
export class RtcService {
  constructor(private readonly livekit: any) {}

  async createVoiceToken(input: CreateVoiceTokenInput) {
    const roomName = `voice-channel-${input.channelId}`;
    const token = this.livekit.createAccessToken();
    token.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
    });
    const jwt = await token.toJwt();

    return {
      token: jwt,
      roomName,
      wsUrl: this.livekit.wsUrl,
    };
  }
}
