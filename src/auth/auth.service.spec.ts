import { AuthService } from './auth.service';

describe('AuthService', () => {
  const prisma = {
    allowedUser: { findUnique: jest.fn() },
    user: { upsert: jest.fn() },
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
      name: 'Person',
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
      name: 'Person',
      avatarUrl: 'https://avatar',
    });
  });
});
