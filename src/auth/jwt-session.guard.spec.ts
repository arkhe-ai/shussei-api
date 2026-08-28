import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtSessionGuard } from './jwt-session.guard';

function contextWithRequest(request: Record<string, unknown>): ExecutionContext {
  return { switchToHttp: () => ({ getRequest: () => request }) } as ExecutionContext;
}

describe('JwtSessionGuard', () => {
  it('rejects requests without a session user', async () => {
    const auth = { getSessionUserFromRequest: jest.fn().mockResolvedValue(null) };
    const guard = new JwtSessionGuard(auth as any);

    await expect(guard.canActivate(contextWithRequest({}))).rejects.toThrow(
      new UnauthorizedException('authentication_required'),
    );
  });

  it('assigns authenticated user to request and allows request', async () => {
    const user = { id: 'user-1', email: 'user@example.com', name: 'User', avatarUrl: null };
    const auth = { getSessionUserFromRequest: jest.fn().mockResolvedValue(user) };
    const request: Record<string, unknown> = {};
    const guard = new JwtSessionGuard(auth as any);

    await expect(guard.canActivate(contextWithRequest(request))).resolves.toBe(true);
    expect(request.user).toEqual(user);
  });
});
