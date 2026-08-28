import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

export type ChannelDto = {
  id: string;
  name: string;
  type: string;
  position: number;
};

export type CreateChannelInput = {
  name: string;
  type: 'text' | 'voice';
  position?: number;
};

export type UpdateChannelInput = {
  name?: string;
  type?: 'text' | 'voice';
  position?: number;
};

@Injectable()
export class ChannelsService {
  constructor(private readonly prisma: PrismaService) {}

  private toDto(channel: { id: string; name: string; type: string; position: number }): ChannelDto {
    return {
      id: channel.id,
      name: channel.name,
      type: channel.type,
      position: channel.position,
    };
  }

  async listChannels(): Promise<ChannelDto[]> {
    const channels = await this.prisma.channel.findMany({
      orderBy: { position: 'asc' },
    });
    return channels.map((channel: any) => this.toDto(channel));
  }

  async createChannel(input: CreateChannelInput): Promise<ChannelDto> {
    let position = input.position;
    if (position === undefined) {
      const lastChannel = await this.prisma.channel.findFirst({
        orderBy: { position: 'desc' },
        select: { position: true },
      });
      position = lastChannel ? lastChannel.position + 1 : 0;
    }

    const channel = await this.prisma.channel.create({
      data: { name: input.name.trim(), type: input.type, position },
    });
    return this.toDto(channel);
  }

  async updateChannel(id: string, input: UpdateChannelInput): Promise<ChannelDto> {
    const existing = await this.prisma.channel.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('channel_not_found');

    const data: UpdateChannelInput = { ...input };
    if (data.name !== undefined) data.name = data.name.trim();

    const channel = await this.prisma.channel.update({ where: { id }, data });
    return this.toDto(channel);
  }

  async deleteChannel(id: string): Promise<void> {
    const existing = await this.prisma.channel.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('channel_not_found');

    await this.prisma.$transaction([
      this.prisma.channelPresence.deleteMany({ where: { channelId: id } }),
      this.prisma.channel.delete({ where: { id } }),
    ]);
  }
}
