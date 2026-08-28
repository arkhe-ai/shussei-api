import { ChannelsService } from './channels.service';
import { PrismaService } from '../database/prisma.service';

describe('ChannelsService', () => {
  const prisma = {
    channel: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    channelPresence: { deleteMany: jest.fn() },
    $transaction: jest.fn(),
  } as any;
  const service = new ChannelsService(prisma as PrismaService);

  beforeEach(() => jest.clearAllMocks());

  it('returns channels sorted by position', async () => {
    prisma.channel.findMany.mockResolvedValue([
      { id: '1', name: 'General', type: 'text', position: 1 },
      { id: '2', name: 'Voice', type: 'voice', position: 2 },
    ]);

    await expect(service.listChannels()).resolves.toEqual([
      { id: '1', name: 'General', type: 'text', position: 1 },
      { id: '2', name: 'Voice', type: 'voice', position: 2 },
    ]);
  });

  it('creates a channel at next position when position is omitted', async () => {
    prisma.channel.findFirst.mockResolvedValue({ position: 4 });
    prisma.channel.create.mockResolvedValue({ id: '5', name: 'Lounge', type: 'text', position: 5 });

    await expect(service.createChannel({ name: ' Lounge ', type: 'text' })).resolves.toEqual({
      id: '5', name: 'Lounge', type: 'text', position: 5,
    });
  });

  it('updates a channel and trims its name', async () => {
    prisma.channel.findUnique.mockResolvedValue({ id: '1' });
    prisma.channel.update.mockResolvedValue({ id: '1', name: 'Lounge', type: 'voice', position: 2 });

    await expect(service.updateChannel('1', { name: ' Lounge ', type: 'voice' })).resolves.toEqual({
      id: '1', name: 'Lounge', type: 'voice', position: 2,
    });
  });

  it('deletes channel presence and channel in a transaction', async () => {
    prisma.channel.findUnique.mockResolvedValue({ id: '1' });
    prisma.$transaction.mockResolvedValue([]);

    await expect(service.deleteChannel('1')).resolves.toBeUndefined();
    expect(prisma.channelPresence.deleteMany).toHaveBeenCalledWith({ where: { channelId: '1' } });
    expect(prisma.channel.delete).toHaveBeenCalledWith({ where: { id: '1' } });
    expect(prisma.$transaction).toHaveBeenCalled();
  });
});
