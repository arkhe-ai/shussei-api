import { Injectable } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class PresenceService {
  constructor(
    private readonly redisService: RedisService,
    private readonly authService: AuthService,
  ) {}

  async markOnline(userId: string) { await this.redisService.getClient().sadd('presence:online', userId); }

  async markOffline(userId: string) {
    const redis = this.redisService.getClient();
    await redis.srem('presence:online', userId);
    const channels = await redis.hgetall('presence:channels');
    await Promise.all(Object.entries(channels).map(async ([channelId, rawUsers]) => {
      const users = JSON.parse(rawUsers as string) as string[];
      const remaining = users.filter((id) => id !== userId);
      if (remaining.length !== users.length) {
        if (remaining.length === 0) await redis.hdel('presence:channels', channelId);
        else await redis.hset('presence:channels', channelId, JSON.stringify(remaining));
      }
    }));
  }

  async joinVoiceChannel(userId: string, channelId: string) {
    const redis = this.redisService.getClient();
    const rawUsers = await redis.hget('presence:channels', channelId);
    const users = rawUsers ? (JSON.parse(rawUsers) as string[]) : [];
    if (!users.includes(userId)) users.push(userId);
    await redis.hset('presence:channels', channelId, JSON.stringify(users));
  }

  async leaveVoiceChannel(userId: string, channelId: string) {
    const redis = this.redisService.getClient();
    const rawUsers = await redis.hget('presence:channels', channelId);
    if (!rawUsers) return;
    const users = (JSON.parse(rawUsers) as string[]).filter((id) => id !== userId);
    if (users.length === 0) await redis.hdel('presence:channels', channelId);
    else await redis.hset('presence:channels', channelId, JSON.stringify(users));
  }

  async snapshot() {
    const redis = this.redisService.getClient();
    const onlineUserIds = await redis.smembers('presence:online');
    const raw = await redis.hgetall('presence:channels');
    const channelOccupancy = Object.fromEntries(
      Object.entries(raw).map(([channelId, users]) => [channelId, JSON.parse(users as string)]),
    );
    const users = await this.authService.listUsersByIds(onlineUserIds);
    const userSprites = Object.fromEntries(users.map((user) => [user.id, user.spriteId]));
    return { onlineUserIds, channelOccupancy, userSprites };
  }
}
