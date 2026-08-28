import { RtcService } from './rtc.service';

describe('RtcService', () => {
  const livekit = {
    apiKey: 'lk-key',
    apiSecret: 'lk-secret',
    wsUrl: 'wss://rtc.example.com',
  };

  const service = new RtcService(livekit);

  it('maps a voice channel to a LiveKit room token', async () => {
    const result = await service.createVoiceToken({
      channelId: 'voice-general',
      user: { id: 'user-1', email: 'user@example.com', name: 'User', avatarUrl: null },
    });

    expect(result.roomName).toBe('voice-channel-voice-general');
    expect(result.wsUrl).toBe('wss://rtc.example.com');
    expect(result.token.split('.')).toHaveLength(3);
    const claims = JSON.parse(Buffer.from(result.token.split('.')[1], 'base64url').toString());
    expect(claims.name).toBe('User');
  });
});
