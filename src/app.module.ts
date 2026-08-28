import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { ChannelsModule } from './channels/channels.module';
import { ChatModule } from './chat/chat.module';
import { PresenceModule } from './presence/presence.module';
import { RtcModule } from './rtc/rtc.module';
import { UsersController } from './users.controller';
import { AllowlistModule } from './allowlist/allowlist.module';

@Module({
  imports: [DatabaseModule, RedisModule, AuthModule, ChannelsModule, ChatModule, PresenceModule, RtcModule, AllowlistModule],
  controllers: [HealthController, UsersController],
})
export class AppModule {}
