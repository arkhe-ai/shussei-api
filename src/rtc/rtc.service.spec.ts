import { RtcService } from './rtc.service';

describe('RtcService', () => {
  const accessToken = {
    addGrant: jest.fn(),
    toJwt: jest.fn().mockResolvedValue('jwt-token'),
  };

  const livekit = {
    apiKey: 'lk-key',
    apiSecret: 'lk-secret',
    wsUrl: 'wss://rtc.example.com',
    createAccessToken: () => accessToken,
  } as any;

  const service = new RtcService(livekit);

  it('maps a voice channel to a LiveKit room token', async () => {
    await expect(
      service.createVoiceToken({
        channelId: 'voice-general',
        user: { id: 'user-1', email: 'user@example.com', name: 'User', avatarUrl: null },
      }),
    ).resolves.toEqual({
      token: 'jwt-token',
      roomName: 'voice-channel-voice-general',
      wsUrl: 'wss://rtc.example.com',
    });
  });
});
