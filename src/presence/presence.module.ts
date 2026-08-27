import { Module } from '@nestjs/common';
import { PresenceService } from './presence.service';
import { PresenceGateway } from './presence.gateway';
import { RedisModule } from '../redis/redis.module';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [RedisModule, ChatModule],
  providers: [PresenceService, PresenceGateway],
  exports: [PresenceService],
})
export class PresenceModule {}
