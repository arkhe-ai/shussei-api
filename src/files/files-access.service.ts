import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class FilesAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async assertChannel(channelId: string): Promise<void> {
    const channel = await this.prisma.channel.findUnique({ where: { id: channelId }, select: { id: true } });
    if (!channel) throw new NotFoundException('channel_not_found');
  }

  async assertFolder(folderId: string, channelId?: string) {
    const folder = await this.prisma.folder.findUnique({ where: { id: folderId } });
    if (!folder || (channelId !== undefined && folder.channelId !== channelId)) {
      throw new NotFoundException('folder_not_found');
    }
    return folder;
  }
}
