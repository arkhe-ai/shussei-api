import { PresenceService } from './presence.service';

describe('PresenceService', () => {
  const redis = {
    sadd: jest.fn().mockResolvedValue(1),
    srem: jest.fn().mockResolvedValue(1),
    smembers: jest.fn().mockResolvedValue(['user-1']),
    hset: jest.fn().mockResolvedValue(1),
    hgetall: jest.fn().mockResolvedValue({ 'voice-1': JSON.stringify(['user-1']) }),
  } as any;

  const redisService = {
    getClient: jest.fn().mockReturnValue(redis),
  } as any;

  const service = new PresenceService(redisService);

  it('tracks online users and channel occupancy', async () => {
    await service.markOnline('user-1');
    await service.joinVoiceChannel('user-1', 'voice-1');

    await expect(service.snapshot()).resolves.toEqual({
      onlineUserIds: ['user-1'],
      channelOccupancy: { 'voice-1': ['user-1'] },
    });
  });
});
