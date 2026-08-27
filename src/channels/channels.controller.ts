import { Controller, Get, Param } from '@nestjs/common';
import { ChannelsService } from './channels.service';
import { ChatService } from '../chat/chat.service';

@Controller('/api/v1/channels')
export class ChannelsController {
  constructor(
    private readonly channelsService: ChannelsService,
    private readonly chatService: ChatService,
  ) {}

  @Get()
  async listChannels() {
    return { channels: await this.channelsService.listChannels() };
  }

  @Get('/:channelId/messages')
  async listMessages(@Param('channelId') channelId: string) {
    return { messages: await this.chatService.listRecent(channelId) };
  }
}
