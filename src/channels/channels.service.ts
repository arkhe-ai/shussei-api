import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

export type ChannelDto = {
  id: string;
  name: string;
  type: string;
  position: number;
};

@Injectable()
export class ChannelsService {
  constructor(private readonly prisma: PrismaService) {}

  async listChannels(): Promise<ChannelDto[]> {
    const channels = await this.prisma.channel.findMany({
      orderBy: { position: 'asc' },
    });
    return channels.map((channel: any) => ({
      id: channel.id,
      name: channel.name,
      type: channel.type,
      position: channel.position,
    }));
  }
}
