import { ChatService } from './chat.service';
import { RedisService } from '../redis/redis.service';

describe('ChatService', () => {
  const redis = {
    multi: () => ({
      rpush: jest.fn().mockReturnThis(),
      ltrim: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    }),
    lrange: jest.fn().mockResolvedValue([]),
  } as any;

  const redisService = {
    getClient: jest.fn().mockReturnValue(redis),
  } as unknown as RedisService;

  const filesService = {
    getAttachments: jest.fn().mockResolvedValue([]),
  } as any;
  const service = new ChatService(redisService, filesService);

  it('filters malformed attachments when recovering messages', async () => {
    redis.lrange.mockResolvedValue([
      JSON.stringify({ id: 'message-1', channelId: 'channel-1', body: 'photo', attachments: [null, { id: 'file-1' }] }),
    ]);

    await expect(service.listRecent('channel-1')).resolves.toEqual([
      expect.objectContaining({ attachments: [] }),
    ]);
  });

  it('pushes a message and trims to the latest 100 entries', async () => {
    const message = await service.pushMessage({
      channelId: 'channel-1',
      body: 'hello',
      author: { id: 'user-1', email: 'user@example.com', name: 'User', avatarUrl: null },
    });

    expect(message.channelId).toBe('channel-1');
    expect(message.body).toBe('hello');
    expect(message.attachments).toEqual([]);
  });
});
