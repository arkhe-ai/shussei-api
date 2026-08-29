import { Injectable } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { RedisService } from '../redis/redis.service';
import { SessionUser } from '../common/types/session-user';
import { randomUUID } from 'crypto';
import { FilesService } from '../files/files.service';

export type EphemeralMessage = {
  id: string;
  channelId: string;
  author: SessionUser;
  body: string;
  sentAt: string;
  attachments?: FileAttachment[];
};

export type FileAttachment = {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  downloadUrl: string;
};

export type SendMessageInput = {
  channelId: string;
  body: string;
  author: SessionUser;
  fileIds?: string[];
};

@Injectable()
export class ChatService {
  constructor(
    private readonly redisService: RedisService,
    private readonly filesService: FilesService,
  ) {}

  async pushMessage(input: SendMessageInput): Promise<EphemeralMessage> {
    const body = input.body.trim();
    const fileIds = [...new Set(input.fileIds ?? [])];
    if (!body && fileIds.length === 0) throw new WsException('message_content_required');
    const attachments = await this.filesService.getAttachments(input.channelId, fileIds);

    const message: EphemeralMessage = {
      id: randomUUID(),
      channelId: input.channelId,
      author: input.author,
      body,
      attachments,
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
    return raw.map((entry) => {
      const message = JSON.parse(entry) as EphemeralMessage;
      const attachments = Array.isArray(message.attachments)
        ? message.attachments.filter(this.isValidAttachment)
        : [];
      return { ...message, attachments };
    });
  }

  private isValidAttachment(attachment: FileAttachment | null | undefined): attachment is FileAttachment {
    return Boolean(
      attachment &&
        typeof attachment.id === 'string' &&
        typeof attachment.originalName === 'string' &&
        typeof attachment.mimeType === 'string' &&
        typeof attachment.sizeBytes === 'number' &&
        typeof attachment.downloadUrl === 'string',
    );
  }
}
