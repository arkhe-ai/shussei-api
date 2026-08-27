import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class PresenceService {
  constructor(private readonly redisService: RedisService) {}

  async markOnline(userId: string) {
    const redis = this.redisService.getClient();
    await redis.sadd('presence:online', userId);
  }

  async markOffline(userId: string) {
    const redis = this.redisService.getClient();
    await redis.srem('presence:online', userId);
  }

  async joinVoiceChannel(userId: string, channelId: string) {
    const redis = this.redisService.getClient();
    await redis.hset('presence:channels', channelId, JSON.stringify([userId]));
  }

  async leaveVoiceChannel(userId: string, channelId: string) {
    const redis = this.redisService.getClient();
    await redis.hset('presence:channels', channelId, JSON.stringify([]));
  }

  async snapshot() {
    const redis = this.redisService.getClient();
    const onlineUserIds = await redis.smembers('presence:online');
    const raw = await redis.hgetall('presence:channels');
    const channelOccupancy = Object.fromEntries(
      Object.entries(raw).map(([channelId, users]) => [channelId, JSON.parse(users as string)]),
    );

    return { onlineUserIds, channelOccupancy };
  }
}
