import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { SessionUser } from '../common/types/session-user';
import { randomUUID } from 'crypto';

export type EphemeralMessage = {
  id: string;
  channelId: string;
  author: SessionUser;
  body: string;
  sentAt: string;
};

export type SendMessageInput = {
  channelId: string;
  body: string;
  author: SessionUser;
};

@Injectable()
export class ChatService {
  constructor(private readonly redisService: RedisService) {}

  async pushMessage(input: SendMessageInput): Promise<EphemeralMessage> {
    const message: EphemeralMessage = {
      id: randomUUID(),
      channelId: input.channelId,
      author: input.author,
      body: input.body,
      sentAt: new Date().toISOString(),
    };

    const key = `chat:channel:${input.channelId}`;
    const redis = this.redisService.getClient();
    await redis
      .multi()
      .rpush(key, JSON.stringify(message))
      .ltrim(key, -100, -1)
      .expire(key, 3600)
      .exec();

    return message;
  }

  async listRecent(channelId: string): Promise<EphemeralMessage[]> {
    const redis = this.redisService.getClient();
    const raw = await redis.lrange(`chat:channel:${channelId}`, 0, -1);
    return raw.map((entry) => JSON.parse(entry));
  }
}
