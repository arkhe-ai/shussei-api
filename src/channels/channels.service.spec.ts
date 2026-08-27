import { ChannelsService } from './channels.service';
import { PrismaService } from '../database/prisma.service';

describe('ChannelsService', () => {
  const prisma = {
    channel: {
      findMany: jest.fn().mockResolvedValue([
        { id: '1', name: 'General', type: 'text', position: 1 },
        { id: '2', name: 'Voice', type: 'voice', position: 2 },
      ]),
    },
  } as any;

  const service = new ChannelsService(prisma as PrismaService);

  it('returns channels sorted by position', async () => {
    await expect(service.listChannels()).resolves.toEqual([
      { id: '1', name: 'General', type: 'text', position: 1 },
      { id: '2', name: 'Voice', type: 'voice', position: 2 },
    ]);
  });
});
