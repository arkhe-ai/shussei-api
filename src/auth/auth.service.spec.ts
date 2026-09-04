import { AuthService } from './auth.service';

describe('AuthService', () => {
  const prisma = {
    allowedUser: { findUnique: jest.fn() },
    user: { upsert: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
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
      spriteId: null,
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
      spriteId: null,
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { name: 'New Name' },
    });
  });

  describe('desktop exchange code', () => {
    const user = { id: 'user-1', email: 'person@example.com', name: 'Person', avatarUrl: null };

    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'person@example.com',
        name: 'Person',
        avatarUrl: null,
      });
    });

    it('round-trips to the user it was minted for', async () => {
      const code = service.createDesktopExchangeCode(user as any);

      await expect(service.getUserFromDesktopExchangeCode(code)).resolves.toMatchObject({
        id: 'user-1',
      });
    });

    /*
     * The whole point of the audience. This code travels in a redirect URL and
     * can end up in browser history; if it also opened a session by being
     * pasted into the cookie, the short life would be buying nothing.
     */
    it('is not accepted as a session token', async () => {
      const code = service.createDesktopExchangeCode(user as any);

      await expect(service.getSessionUserFromToken(code)).resolves.toBeNull();
    });

    it('does not accept a session token in its place', async () => {
      const session = service.createSessionToken(user as any);

      await expect(service.getUserFromDesktopExchangeCode(session)).resolves.toBeNull();
    });

    it('answers null for a missing or unsigned code', async () => {
      await expect(service.getUserFromDesktopExchangeCode(undefined)).resolves.toBeNull();
      await expect(service.getUserFromDesktopExchangeCode('not-a-jwt')).resolves.toBeNull();
    });
  });
});
