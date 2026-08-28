import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service';
import { ChatService } from '../chat/chat.service';
import { PresenceService } from './presence.service';

function sessionTokenFromSocket(client: Socket, cookieName: string): string | undefined {
  const cookieHeader = client.handshake.headers.cookie;
  if (!cookieHeader) return undefined;

  const cookie = cookieHeader.split(';').find((part) => part.trim().startsWith(`${cookieName}=`));
  return cookie ? cookie.trim().slice(cookieName.length + 1) : undefined;
}

@WebSocketGateway({ namespace: '/app', cors: { origin: true, credentials: true } })
export class PresenceGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;

  constructor(
    private readonly presenceService: PresenceService,
    private readonly chatService: ChatService,
    private readonly authService: AuthService,
  ) {}

  async handleConnection() {
    // Authentication happens when the client identifies itself.
  }

  async handleDisconnect(client: Socket) {
    const userId = client.data.userId as string | undefined;
    if (userId) {
      await this.presenceService.markOffline(userId);
      this.server.emit('presence.changed', { userId, status: 'offline', channelId: null });
    }
  }

  @SubscribeMessage('presence.identify')
  async identify(
    @ConnectedSocket() client: Socket,
    @MessageBody() _payload?: { userId?: string },
  ) {
    const user = await this.authService.getSessionUserFromToken(
      sessionTokenFromSocket(client, this.authService.getSessionCookieName()),
    );
    if (!user) throw new WsException('authentication_required');

    client.data.userId = user.id;
    await this.presenceService.markOnline(user.id);
    const snapshot = await this.presenceService.snapshot();
    client.emit('presence.snapshot', snapshot);
    this.server.emit('presence.changed', { userId: user.id, status: 'online', channelId: null });
  }

  @SubscribeMessage('voice.join')
  async joinVoice(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { channelId: string },
  ) {
    const userId = client.data.userId as string | undefined;
    if (!userId) throw new WsException('authentication_required');

    await this.presenceService.joinVoiceChannel(userId, payload.channelId);
    this.server.emit('presence.changed', {
      userId,
      status: 'online',
      channelId: payload.channelId,
    });
  }

  @SubscribeMessage('voice.leave')
  async leaveVoice(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { channelId: string },
  ) {
    const userId = client.data.userId as string | undefined;
    if (!userId) throw new WsException('authentication_required');

    await this.presenceService.leaveVoiceChannel(userId, payload.channelId);
    this.server.emit('presence.changed', { userId, status: 'online', channelId: null });
  }

  @SubscribeMessage('chat.send')
  async sendChat(@ConnectedSocket() client: Socket, @MessageBody() payload: { channelId: string; body: string }) {
    const userId = client.data.userId as string | undefined;
    if (!userId) throw new WsException('authentication_required');

    const user = await this.authService.getUserById(userId);
    if (!user) throw new WsException('authentication_required');

    const message = await this.chatService.pushMessage({
      channelId: payload.channelId,
      body: payload.body,
      author: user,
    });
    this.server.emit('chat.message', message);
    return message;
  }
}
