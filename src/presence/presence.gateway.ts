import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PresenceService } from './presence.service';
import { ChatService } from '../chat/chat.service';

@WebSocketGateway({ namespace: '/app', cors: { origin: true, credentials: true } })
export class PresenceGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;

  constructor(
    private readonly presenceService: PresenceService,
    private readonly chatService: ChatService,
  ) {}

  async handleConnection() {
    // Connection logic
  }

  async handleDisconnect(client: Socket) {
    const userId = client.data.userId as string | undefined;
    if (userId) {
      await this.presenceService.markOffline(userId);
      this.server.emit('presence.changed', { userId, status: 'offline', channelId: null });
    }
  }

  @SubscribeMessage('presence.identify')
  async identify(@ConnectedSocket() client: Socket, @MessageBody() payload: { userId: string }) {
    client.data.userId = payload.userId;
    await this.presenceService.markOnline(payload.userId);
    const snapshot = await this.presenceService.snapshot();
    client.emit('presence.snapshot', snapshot);
    this.server.emit('presence.changed', { userId: payload.userId, status: 'online', channelId: null });
  }

  @SubscribeMessage('chat.send')
  async sendChat(@ConnectedSocket() client: Socket, @MessageBody() payload: { channelId: string; body: string }) {
    const userId = client.data.userId;
    const user = { id: userId, email: 'user@example.com', name: 'User', avatarUrl: null };
    const message = await this.chatService.pushMessage({
      channelId: payload.channelId,
      body: payload.body,
      author: user,
    });
    this.server.emit('chat.message', message);
    return message;
  }
}
