import { AuthController } from './auth.controller';

describe('AuthController', () => {
  const auth = {
    updateProfileName: jest.fn(),
    updateProfile: jest.fn(),
    getSessionCookieName: jest.fn().mockReturnValue('session'),
    getSessionCookieOptions: jest.fn().mockReturnValue({ httpOnly: true }),
    getFrontendUrl: jest.fn().mockReturnValue('http://localhost:3000'),
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
});
