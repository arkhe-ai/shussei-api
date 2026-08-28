import { Injectable } from '@nestjs/common';
import { AccessToken } from 'livekit-server-sdk';
import { SessionUser } from '../common/types/session-user';

export type CreateVoiceTokenInput = {
  channelId: string;
  user: SessionUser;
};

@Injectable()
export class RtcService {
  constructor(
    private readonly livekit: { apiKey: string; apiSecret: string; wsUrl: string },
  ) {}

  async createVoiceToken(input: CreateVoiceTokenInput) {
    const roomName = `voice-channel-${input.channelId}`;
    const token = new AccessToken(this.livekit.apiKey, this.livekit.apiSecret, {
      identity: input.user.id,
      name: input.user.name,
    });

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
