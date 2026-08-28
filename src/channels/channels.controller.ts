import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtSessionGuard } from '../auth/jwt-session.guard';
import { ChatService } from '../chat/chat.service';
import { ChannelsService } from './channels.service';
import { CreateChannelDto } from './dto/create-channel.dto';
import { UpdateChannelDto } from './dto/update-channel.dto';

@Controller('/api/v1/channels')
export class ChannelsController {
  constructor(
    private readonly channelsService: ChannelsService,
    private readonly chatService: ChatService,
  ) {}

  @Get()
  @UseGuards(JwtSessionGuard)
  async listChannels() {
    return { channels: await this.channelsService.listChannels() };
  }

  @Post()
  @UseGuards(JwtSessionGuard)
  @HttpCode(HttpStatus.CREATED)
  createChannel(@Body() body: CreateChannelDto) {
    return this.channelsService.createChannel(body);
  }

  @Patch('/:channelId')
  @UseGuards(JwtSessionGuard)
  updateChannel(@Param('channelId') channelId: string, @Body() body: UpdateChannelDto) {
    return this.channelsService.updateChannel(channelId, body);
  }

  @Delete('/:channelId')
  @UseGuards(JwtSessionGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteChannel(@Param('channelId') channelId: string): Promise<void> {
    await this.channelsService.deleteChannel(channelId);
  }

  @Get('/:channelId/messages')
  async listMessages(@Param('channelId') channelId: string) {
    return { messages: await this.chatService.listRecent(channelId) };
  }
}
