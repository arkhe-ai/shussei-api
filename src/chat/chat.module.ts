import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { RedisModule } from '../redis/redis.module';
import { FilesModule } from '../files/files.module';

@Module({
  imports: [RedisModule, FilesModule],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
