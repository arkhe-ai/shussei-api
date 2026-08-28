import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { AllowlistService } from './allowlist.service';
import { PrismaService } from '../database/prisma.service';

describe('AllowlistService', () => {
  const prisma = {
    allowedUser: {
      findMany: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
  } as any;
  const service = new AllowlistService(prisma as PrismaService);

  beforeEach(() => jest.clearAllMocks());

  it('normalizes e-mail before creating entry', async () => {
    const createdAt = new Date('2026-01-01');
    prisma.allowedUser.create.mockResolvedValue({ id: 'allow-1', email: 'person@example.com', createdAt });

    await expect(service.createEntry({ email: ' Person@Example.COM ' })).resolves.toEqual({
      id: 'allow-1', email: 'person@example.com', createdAt,
    });
    expect(prisma.allowedUser.create).toHaveBeenCalledWith({ data: { email: 'person@example.com' } });
  });

  it('maps duplicate Prisma constraint to conflict', async () => {
    prisma.allowedUser.create.mockRejectedValue(
      new PrismaClientKnownRequestError('duplicate', { code: 'P2002', clientVersion: '5.22.0' }),
    );

    await expect(service.createEntry({ email: 'person@example.com' })).rejects.toThrow('email_already_allowed');
  });

  it('lists entries sorted by e-mail', async () => {
    prisma.allowedUser.findMany.mockResolvedValue([]);
    await service.listEntries();
    expect(prisma.allowedUser.findMany).toHaveBeenCalledWith({
      orderBy: { email: 'asc' },
      select: { id: true, email: true, createdAt: true },
    });
  });

  it('normalizes e-mail when deleting', async () => {
    prisma.allowedUser.delete.mockResolvedValue({});
    await service.deleteEntry(' Person@Example.COM ');
    expect(prisma.allowedUser.delete).toHaveBeenCalledWith({ where: { email: 'person@example.com' } });
  });
});
