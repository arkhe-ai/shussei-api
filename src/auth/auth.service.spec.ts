import { AuthService } from './auth.service';

describe('AuthService', () => {
  const prisma = {
    allowedUser: { findUnique: jest.fn() },
    user: { upsert: jest.fn(), update: jest.fn() },
  } as any;

  const service = new AuthService(prisma);

  it('rejects emails that are not on the allowlist', async () => {
    prisma.allowedUser.findUnique.mockResolvedValue(null);

    await expect(
      service.upsertAllowedGoogleUser({
        sub: 'google-1',
        email: 'blocked@example.com',
        name: 'Blocked User',
        picture: null,
      }),
    ).rejects.toThrow('access_denied');
  });

  it('upserts allowed users and returns a session user', async () => {
    prisma.allowedUser.findUnique.mockResolvedValue({ id: 'allow-1' });
    prisma.user.upsert.mockResolvedValue({
      id: 'user-1',
      email: 'person@example.com',
      name: 'Custom Name',
      avatarUrl: 'https://avatar',
    });

    await expect(
      service.upsertAllowedGoogleUser({
        sub: 'google-2',
        email: 'person@example.com',
        name: 'Person',
        picture: 'https://avatar',
      }),
    ).resolves.toEqual({
      id: 'user-1',
      email: 'person@example.com',
      name: 'Custom Name',
      avatarUrl: 'https://avatar',
    });
    expect(prisma.user.upsert).toHaveBeenCalledWith({
      where: { email: 'person@example.com' },
      update: { googleId: 'google-2', avatarUrl: 'https://avatar', status: 'active' },
      create: expect.objectContaining({ name: 'Person' }),
    });
  });

  it('updates and trims current user name', async () => {
    prisma.user.update.mockResolvedValue({
      id: 'user-1',
      email: 'person@example.com',
      name: 'New Name',
      avatarUrl: null,
    });

    await expect(service.updateProfileName('user-1', ' New Name ')).resolves.toEqual({
      id: 'user-1',
      email: 'person@example.com',
      name: 'New Name',
      avatarUrl: null,
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { name: 'New Name' },
    });
  });
});
