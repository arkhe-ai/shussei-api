import { AuthController } from './auth.controller';

describe('AuthController', () => {
  const auth = {
    updateProfileName: jest.fn(),
    updateProfile: jest.fn(),
    getSessionCookieName: jest.fn().mockReturnValue('session'),
    getSessionCookieOptions: jest.fn().mockReturnValue({ httpOnly: true }),
    getFrontendUrl: jest.fn().mockReturnValue('http://localhost:3000'),
    getUserFromDesktopExchangeCode: jest.fn(),
    createSessionToken: jest.fn().mockReturnValue('signed-session'),
  } as any;
  const controller = new AuthController(auth);

  beforeEach(() => jest.clearAllMocks());

  it('updates authenticated user profile', async () => {
    const user = { id: 'user-1', email: 'person@example.com', name: 'New Name', avatarUrl: null };
    auth.updateProfile.mockResolvedValue(user);

    await expect(
      controller.updateMe({ user: { id: 'user-1' } } as any, { name: 'New Name' }),
    ).resolves.toEqual({ user });
    expect(auth.updateProfile).toHaveBeenCalledWith('user-1', { name: 'New Name' });
  });

  it('clears session cookie and redirects on logout', () => {
    const response = { clearCookie: jest.fn(), redirect: jest.fn() };

    controller.logout(response as any);

    expect(response.clearCookie).toHaveBeenCalledWith('session', { httpOnly: true });
    expect(response.redirect).toHaveBeenCalledWith('http://localhost:3000/login');
  });

  describe('desktop exchange', () => {
    it('trades a valid code for a session cookie', async () => {
      const user = { id: 'user-1', email: 'person@example.com', name: 'Person', avatarUrl: null };
      auth.getUserFromDesktopExchangeCode.mockResolvedValue(user);
      const response = { cookie: jest.fn() };

      await expect(
        controller.exchangeDesktopCode({ code: 'a-code' }, response as any),
      ).resolves.toEqual({ user });

      expect(auth.getUserFromDesktopExchangeCode).toHaveBeenCalledWith('a-code');
      expect(response.cookie).toHaveBeenCalledWith('session', 'signed-session', {
        httpOnly: true,
      });
    });

    it('refuses a code that does not resolve to a user, without setting anything', async () => {
      auth.getUserFromDesktopExchangeCode.mockResolvedValue(null);
      const response = { cookie: jest.fn() };

      await expect(
        controller.exchangeDesktopCode({ code: 'spent' }, response as any),
      ).rejects.toThrow('invalid_exchange_code');

      expect(response.cookie).not.toHaveBeenCalled();
    });
  });
});
