import { WsException } from '@nestjs/websockets';
import { PresenceGateway } from './presence.gateway';

describe('PresenceGateway', () => {
  const user = { id: 'user-1', email: 'person@example.com', name: 'Custom Name', avatarUrl: null };
  const presence = {
    markOnline: jest.fn(),
    markOffline: jest.fn(),
    snapshot: jest.fn(),
  } as any;
  const chat = { pushMessage: jest.fn() } as any;
  const auth = {
    getSessionCookieName: jest.fn().mockReturnValue('session'),
    getSessionUserFromToken: jest.fn(),
    getUserById: jest.fn(),
  } as any;
  const gateway = new PresenceGateway(presence, chat, auth);
  const server = { emit: jest.fn() };
  const client = {
    data: {},
    handshake: { headers: { cookie: 'other=x; session=token-1' } },
    emit: jest.fn(),
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    gateway.server = server as any;
    presence.snapshot.mockResolvedValue({ onlineUserIds: ['user-1'], channelOccupancy: {} });
  });

  it('identifies socket from session cookie instead of payload user ID', async () => {
    auth.getSessionUserFromToken.mockResolvedValue(user);

    await gateway.identify(client, { userId: 'attacker' });

    expect(auth.getSessionUserFromToken).toHaveBeenCalledWith('token-1');
    expect(client.data.userId).toBe('user-1');
    expect(presence.markOnline).toHaveBeenCalledWith('user-1');
  });

  it('uses authenticated user name in chat message', async () => {
    client.data.userId = 'user-1';
    auth.getUserById.mockResolvedValue(user);
    chat.pushMessage.mockResolvedValue({ author: user, body: 'hello' });

    await gateway.sendChat(client, { channelId: 'text-1', body: 'hello' });

    expect(chat.pushMessage).toHaveBeenCalledWith({
      channelId: 'text-1', body: 'hello', author: user,
    });
  });

  it('rejects identify without a valid session', async () => {
    auth.getSessionUserFromToken.mockResolvedValue(null);

    await expect(gateway.identify(client, { userId: 'user-1' })).rejects.toThrow(
      new WsException('authentication_required'),
    );
  });
});
