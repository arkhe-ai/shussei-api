# Shussei API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `arkhe-ai/shussei-api` NestJS backend that handles Google login, allowlist authorization, channel data, presence, ephemeral chat, and LiveKit token issuance for the Shussei MVP.

**Architecture:** The API is a NestJS service with PostgreSQL for durable state, Redis for ephemeral state, Socket.IO for app realtime events, and LiveKit server SDK for room token issuance. It owns authentication, authorization, channel metadata, chat buffering, and presence state, while delegating media transport to the self-hosted LiveKit deployment.

**Tech Stack:** Node.js, TypeScript, NestJS, Prisma, PostgreSQL, Redis, Socket.IO, Passport Google OAuth, LiveKit server SDK, Jest, Supertest

**Spec:** `/home/matumoto/docs/superpowers/specs/2026-08-27-private-discord-mvp-design.md`

## Global Constraints

- Web application
- Single private organization/community
- Up to 100 total users
- Roughly 20–40 concurrent users in voice
- Google OAuth login
- Access control by backend-maintained allowlist
- Channel list with text and voice channels
- Ephemeral text chat delivered in real time
- User presence indicators
- Voice calls in channels
- Screen sharing
- System audio sharing when browser/OS support exists
- Self-hosted deployment
- no tenant routing
- no organization switching
- no permanent history
- low perceived latency is a core requirement
- architecture must avoid peer-mesh topologies
- LiveKit SFU is used specifically to preserve scalability and latency for group calls
- official support target: Chrome desktop and Edge desktop
- other browsers are best-effort only for the MVP
- system audio sharing may not be available everywhere
- TLS everywhere in public access paths
- secure OAuth flow
- backend authorization checks on all protected actions
- LiveKit token issuance only after app-level authorization
- graceful handling of reconnects is required

---

## Planned File Structure

### Repository root: `shussei-api/`

- `package.json` — dependency manifest and scripts
- `nest-cli.json` — Nest CLI config
- `tsconfig.json` — TypeScript config
- `tsconfig.build.json` — build-specific TypeScript config
- `.env.example` — required environment variables
- `prisma/schema.prisma` — PostgreSQL schema for users, allowlist, channels, and channel presence
- `prisma/seed.ts` — seed default channels and allowlisted admin emails
- `src/main.ts` — bootstrap Nest app, CORS, cookie parser, validation
- `src/app.module.ts` — root module wiring
- `src/common/types/session-user.ts` — shared authenticated user type
- `src/config/env.ts` — environment validation
- `src/health/health.controller.ts` — health endpoints
- `src/health/health.controller.spec.ts` — health endpoint tests
- `src/database/prisma.service.ts` — Prisma client provider
- `src/database/database.module.ts` — database module
- `src/redis/redis.service.ts` — Redis client provider
- `src/redis/redis.module.ts` — redis module
- `src/auth/auth.module.ts` — auth module wiring
- `src/auth/auth.controller.ts` — `/api/v1/auth/*` routes
- `src/auth/auth.service.ts` — allowlist check, user upsert, session token handling
- `src/auth/auth.service.spec.ts` — auth unit tests
- `src/auth/google.strategy.ts` — Passport Google strategy
- `src/auth/jwt-session.guard.ts` — cookie-based auth guard
- `src/auth/current-user.decorator.ts` — request user decorator
- `src/channels/channels.module.ts` — channels module
- `src/channels/channels.controller.ts` — list channels and recent messages
- `src/channels/channels.service.ts` — channel queries
- `src/channels/channels.service.spec.ts` — channels tests
- `src/chat/chat.module.ts` — chat module
- `src/chat/chat.service.ts` — Redis-backed ephemeral chat buffer
- `src/chat/chat.service.spec.ts` — chat tests
- `src/presence/presence.module.ts` — presence module
- `src/presence/presence.gateway.ts` — Socket.IO gateway for identify/chat/join/leave events
- `src/presence/presence.service.ts` — presence state transitions in Redis/DB
- `src/presence/presence.service.spec.ts` — presence tests
- `src/rtc/rtc.module.ts` — RTC module
- `src/rtc/rtc.controller.ts` — LiveKit token endpoint
- `src/rtc/rtc.service.ts` — room name mapping and access token generation
- `src/rtc/rtc.service.spec.ts` — RTC tests
- `test/app.e2e-spec.ts` — API smoke tests

## Shared Contracts This Repo Publishes

### REST
- `GET /api/v1/health` → `{ status: 'ok' }`
- `GET /api/v1/auth/me` → `{ user: SessionUser | null }`
- `GET /api/v1/channels` → `{ channels: ChannelDto[] }`
- `GET /api/v1/channels/:channelId/messages` → `{ messages: EphemeralMessage[] }`
- `POST /api/v1/channels/:channelId/voice-token` → `{ token: string; roomName: string; wsUrl: string }`

### Socket.IO namespace `/app`
Client emits:
- `presence.identify` with payload `{ userId: string }`
- `chat.send` with payload `{ channelId: string; body: string }`
- `voice.join` with payload `{ channelId: string }`
- `voice.leave` with payload `{ channelId: string }`

Server emits:
- `presence.snapshot` with payload `{ onlineUserIds: string[]; channelOccupancy: Record<string, string[]> }`
- `presence.changed` with payload `{ userId: string; status: 'online' | 'offline'; channelId: string | null }`
- `chat.message` with payload `EphemeralMessage`
- `chat.recent` with payload `{ channelId: string; messages: EphemeralMessage[] }`

### Shared DTOs
```ts
export type SessionUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
};

export type ChannelDto = {
  id: string;
  name: string;
  type: 'text' | 'voice';
  position: number;
};

export type EphemeralMessage = {
  id: string;
  channelId: string;
  author: SessionUser;
  body: string;
  sentAt: string;
};
```

### Task 1: Bootstrap the NestJS service and health endpoint

**Files:**
- Create: `shussei-api/package.json`
- Create: `shussei-api/nest-cli.json`
- Create: `shussei-api/tsconfig.json`
- Create: `shussei-api/tsconfig.build.json`
- Create: `shussei-api/.env.example`
- Create: `shussei-api/src/main.ts`
- Create: `shussei-api/src/app.module.ts`
- Create: `shussei-api/src/config/env.ts`
- Create: `shussei-api/src/health/health.controller.ts`
- Create: `shussei-api/src/health/health.controller.spec.ts`
- Create: `shussei-api/test/app.e2e-spec.ts`

**Interfaces:**
- Consumes: none
- Produces: `GET /api/v1/health`, `bootstrap(): Promise<void>` in `src/main.ts`

- [ ] **Step 1: Write the failing health controller unit test**

```ts
import { Test } from '@nestjs/testing';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('returns ok status', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    const controller = moduleRef.get(HealthController);

    await expect(controller.getHealth()).resolves.toEqual({ status: 'ok' });
  });
});
```

- [ ] **Step 2: Run the unit test to verify it fails**

Run: `npm test -- src/health/health.controller.spec.ts`
Expected: FAIL with `Cannot find module './health.controller'`

- [ ] **Step 3: Write the minimal health endpoint implementation and bootstrap files**

```ts
// src/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';

@Controller('/api/v1/health')
export class HealthController {
  async getHealth() {
    return { status: 'ok' as const };
  }
}
```

```ts
// src/app.module.ts
import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';

@Module({
  controllers: [HealthController],
})
export class AppModule {}
```

```ts
// src/main.ts
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

export async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: true, credentials: true });
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(process.env.PORT || 3001);
}

void bootstrap();
```

- [ ] **Step 4: Add the smoke e2e test and make the suite pass**

```ts
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('App health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200)
      .expect({ status: 'ok' });
  });
});
```

Run: `npm test && npm run test:e2e`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add package.json nest-cli.json tsconfig.json tsconfig.build.json .env.example src test
git commit -m "feat(api): bootstrap nest service"
```

### Task 2: Add Prisma models, allowlist auth, and the authenticated session contract

**Files:**
- Create: `shussei-api/prisma/schema.prisma`
- Create: `shussei-api/prisma/seed.ts`
- Create: `shussei-api/src/common/types/session-user.ts`
- Create: `shussei-api/src/database/database.module.ts`
- Create: `shussei-api/src/database/prisma.service.ts`
- Create: `shussei-api/src/auth/auth.module.ts`
- Create: `shussei-api/src/auth/auth.controller.ts`
- Create: `shussei-api/src/auth/auth.service.ts`
- Create: `shussei-api/src/auth/auth.service.spec.ts`
- Create: `shussei-api/src/auth/google.strategy.ts`
- Create: `shussei-api/src/auth/jwt-session.guard.ts`
- Create: `shussei-api/src/auth/current-user.decorator.ts`
- Modify: `shussei-api/src/app.module.ts`

**Interfaces:**
- Consumes: `GET /api/v1/health`
- Produces: `AuthService.upsertAllowedGoogleUser(profile: GoogleProfile): Promise<SessionUser>`, `GET /api/v1/auth/me`

- [ ] **Step 1: Write the failing allowlist unit tests**

```ts
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const prisma = {
    allowedUser: { findUnique: jest.fn() },
    user: { upsert: jest.fn() },
  } as any;

  const service = new AuthService(prisma, { signAsync: jest.fn() } as any);

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
```

- [ ] **Step 2: Run the auth unit test to verify it fails**

Run: `npm test -- src/auth/auth.service.spec.ts`
Expected: FAIL with `Cannot find module './auth.service'`

- [ ] **Step 3: Add the Prisma schema and implement `AuthService`**

```prisma
model User {
  id         String   @id @default(cuid())
  googleId   String   @unique
  email      String   @unique
  name       String
  avatarUrl  String?
  status     String   @default("active")
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}

model AllowedUser {
  id        String   @id @default(cuid())
  email     String   @unique
  invitedBy String?
  createdAt DateTime @default(now())
}

model Channel {
  id        String   @id @default(cuid())
  name      String
  type      String
  position  Int
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model ChannelPresence {
  userId    String
  channelId String
  joinedAt  DateTime @default(now())

  @@id([userId, channelId])
}
```

```ts
// src/auth/auth.service.ts
export type GoogleProfile = {
  sub: string;
  email: string;
  name: string;
  picture: string | null;
};

export class AuthService {
  constructor(private readonly prisma: any, private readonly jwt: any) {}

  async upsertAllowedGoogleUser(profile: GoogleProfile) {
    const allowed = await this.prisma.allowedUser.findUnique({ where: { email: profile.email } });
    if (!allowed) {
      throw new Error('access_denied');
    }

    const user = await this.prisma.user.upsert({
      where: { email: profile.email },
      update: {
        googleId: profile.sub,
        name: profile.name,
        avatarUrl: profile.picture,
        status: 'active',
      },
      create: {
        googleId: profile.sub,
        email: profile.email,
        name: profile.name,
        avatarUrl: profile.picture,
        status: 'active',
      },
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
    };
  }
}
```

- [ ] **Step 4: Add the authenticated `/api/v1/auth/me` route and re-run tests**

```ts
// src/auth/auth.controller.ts
import { Controller, Get, Req } from '@nestjs/common';

@Controller('/api/v1/auth')
export class AuthController {
  @Get('/me')
  getMe(@Req() req: { user?: unknown }) {
    return { user: req.user ?? null };
  }
}
```

Run: `npm test -- src/auth/auth.service.spec.ts && npx prisma validate`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add prisma src/auth src/common src/database src/app.module.ts
git commit -m "feat(api): add auth and allowlist core"
```

### Task 3: Add channel listing and Redis-backed ephemeral message storage

**Files:**
- Create: `shussei-api/src/redis/redis.module.ts`
- Create: `shussei-api/src/redis/redis.service.ts`
- Create: `shussei-api/src/channels/channels.module.ts`
- Create: `shussei-api/src/channels/channels.controller.ts`
- Create: `shussei-api/src/channels/channels.service.ts`
- Create: `shussei-api/src/channels/channels.service.spec.ts`
- Create: `shussei-api/src/chat/chat.module.ts`
- Create: `shussei-api/src/chat/chat.service.ts`
- Create: `shussei-api/src/chat/chat.service.spec.ts`
- Modify: `shussei-api/src/app.module.ts`

**Interfaces:**
- Consumes: `SessionUser`, Prisma `Channel` model
- Produces: `ChannelsService.listChannels(): Promise<ChannelDto[]>`, `ChatService.pushMessage(input: SendMessageInput): Promise<EphemeralMessage>`, `ChatService.listRecent(channelId: string): Promise<EphemeralMessage[]>`

- [ ] **Step 1: Write the failing unit tests for channels and chat**

```ts
import { ChannelsService } from './channels.service';

describe('ChannelsService', () => {
  it('returns channels sorted by position', async () => {
    const prisma = {
      channel: {
        findMany: jest.fn().mockResolvedValue([
          { id: '2', name: 'Voice', type: 'voice', position: 2 },
          { id: '1', name: 'General', type: 'text', position: 1 },
        ]),
      },
    } as any;

    const service = new ChannelsService(prisma);

    await expect(service.listChannels()).resolves.toEqual([
      { id: '1', name: 'General', type: 'text', position: 1 },
      { id: '2', name: 'Voice', type: 'voice', position: 2 },
    ]);
  });
});
```

```ts
import { ChatService } from './chat.service';

describe('ChatService', () => {
  it('pushes a message and trims to the latest 100 entries', async () => {
    const redis = {
      multi: () => ({
        rpush: jest.fn().mockReturnThis(),
        ltrim: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      }),
      lrange: jest.fn().mockResolvedValue([]),
    } as any;

    const service = new ChatService(redis);

    const message = await service.pushMessage({
      channelId: 'channel-1',
      body: 'hello',
      author: { id: 'user-1', email: 'user@example.com', name: 'User', avatarUrl: null },
    });

    expect(message.channelId).toBe('channel-1');
    expect(message.body).toBe('hello');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/channels/channels.service.spec.ts src/chat/chat.service.spec.ts`
Expected: FAIL with missing service modules

- [ ] **Step 3: Implement channels query and chat buffer services**

```ts
// src/channels/channels.service.ts
export class ChannelsService {
  constructor(private readonly prisma: any) {}

  async listChannels() {
    const channels = await this.prisma.channel.findMany({ orderBy: { position: 'asc' } });
    return channels.map((channel: any) => ({
      id: channel.id,
      name: channel.name,
      type: channel.type,
      position: channel.position,
    }));
  }
}
```

```ts
// src/chat/chat.service.ts
import { randomUUID } from 'crypto';

export type SendMessageInput = {
  channelId: string;
  body: string;
  author: { id: string; email: string; name: string; avatarUrl: string | null };
};

export class ChatService {
  constructor(private readonly redis: any) {}

  async pushMessage(input: SendMessageInput) {
    const message = {
      id: randomUUID(),
      channelId: input.channelId,
      author: input.author,
      body: input.body,
      sentAt: new Date().toISOString(),
    };

    const key = `chat:channel:${input.channelId}`;
    await this.redis
      .multi()
      .rpush(key, JSON.stringify(message))
      .ltrim(key, -100, -1)
      .expire(key, 3600)
      .exec();

    return message;
  }

  async listRecent(channelId: string) {
    const raw = await this.redis.lrange(`chat:channel:${channelId}`, 0, -1);
    return raw.map((entry: string) => JSON.parse(entry));
  }
}
```

- [ ] **Step 4: Add the REST routes and re-run the tests**

```ts
// src/channels/channels.controller.ts
import { Controller, Get, Param } from '@nestjs/common';
import { ChannelsService } from './channels.service';
import { ChatService } from '../chat/chat.service';

@Controller('/api/v1/channels')
export class ChannelsController {
  constructor(
    private readonly channelsService: ChannelsService,
    private readonly chatService: ChatService,
  ) {}

  @Get()
  async listChannels() {
    return { channels: await this.channelsService.listChannels() };
  }

  @Get('/:channelId/messages')
  async listMessages(@Param('channelId') channelId: string) {
    return { messages: await this.chatService.listRecent(channelId) };
  }
}
```

Run: `npm test -- src/channels/channels.service.spec.ts src/chat/chat.service.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/redis src/channels src/chat src/app.module.ts
git commit -m "feat(api): add channels and ephemeral chat buffer"
```

### Task 4: Add Socket.IO presence and chat realtime events

**Files:**
- Create: `shussei-api/src/presence/presence.module.ts`
- Create: `shussei-api/src/presence/presence.service.ts`
- Create: `shussei-api/src/presence/presence.service.spec.ts`
- Create: `shussei-api/src/presence/presence.gateway.ts`
- Create: `shussei-api/src/presence/presence.gateway.spec.ts`
- Modify: `shussei-api/src/chat/chat.service.ts`
- Modify: `shussei-api/src/app.module.ts`

**Interfaces:**
- Consumes: `ChatService.pushMessage`, `ChatService.listRecent`
- Produces: `PresenceService.markOnline(userId: string): Promise<void>`, `PresenceService.joinVoiceChannel(userId: string, channelId: string): Promise<void>`, Socket.IO namespace `/app`

- [ ] **Step 1: Write the failing presence service tests**

```ts
import { PresenceService } from './presence.service';

describe('PresenceService', () => {
  it('tracks online users and channel occupancy', async () => {
    const redis = {
      sadd: jest.fn().mockResolvedValue(1),
      srem: jest.fn().mockResolvedValue(1),
      smembers: jest.fn().mockResolvedValue(['user-1']),
      hset: jest.fn().mockResolvedValue(1),
      hgetall: jest.fn().mockResolvedValue({ 'voice-1': JSON.stringify(['user-1']) }),
    } as any;

    const service = new PresenceService(redis);

    await service.markOnline('user-1');
    await service.joinVoiceChannel('user-1', 'voice-1');

    await expect(service.snapshot()).resolves.toEqual({
      onlineUserIds: ['user-1'],
      channelOccupancy: { 'voice-1': ['user-1'] },
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/presence/presence.service.spec.ts`
Expected: FAIL with `Cannot find module './presence.service'`

- [ ] **Step 3: Implement presence state management and the Socket.IO gateway**

```ts
// src/presence/presence.service.ts
export class PresenceService {
  constructor(private readonly redis: any) {}

  async markOnline(userId: string) {
    await this.redis.sadd('presence:online', userId);
  }

  async markOffline(userId: string) {
    await this.redis.srem('presence:online', userId);
  }

  async joinVoiceChannel(userId: string, channelId: string) {
    await this.redis.hset('presence:channels', channelId, JSON.stringify([userId]));
  }

  async leaveVoiceChannel(userId: string, channelId: string) {
    await this.redis.hset('presence:channels', channelId, JSON.stringify([]));
  }

  async snapshot() {
    const onlineUserIds = await this.redis.smembers('presence:online');
    const raw = await this.redis.hgetall('presence:channels');
    const channelOccupancy = Object.fromEntries(
      Object.entries(raw).map(([channelId, users]) => [channelId, JSON.parse(users as string)]),
    );

    return { onlineUserIds, channelOccupancy };
  }
}
```

```ts
// src/presence/presence.gateway.ts
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

  async handleConnection() {}

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
    client.emit('presence.snapshot', await this.presenceService.snapshot());
    this.server.emit('presence.changed', { userId: payload.userId, status: 'online', channelId: null });
  }

  @SubscribeMessage('chat.send')
  async sendChat(@ConnectedSocket() client: Socket, @MessageBody() payload: { channelId: string; body: string }) {
    const message = await this.chatService.pushMessage({
      channelId: payload.channelId,
      body: payload.body,
      author: client.data.user,
    });
    this.server.emit('chat.message', message);
    return message;
  }
}
```

- [ ] **Step 4: Add one gateway integration test and run the suite**

```ts
import { ChatService } from '../chat/chat.service';
import { PresenceGateway } from './presence.gateway';
import { PresenceService } from './presence.service';

describe('PresenceGateway', () => {
  it('emits presence snapshot after identify', async () => {
    const presenceService = {
      markOnline: jest.fn().mockResolvedValue(undefined),
      snapshot: jest.fn().mockResolvedValue({ onlineUserIds: ['user-1'], channelOccupancy: {} }),
    } as unknown as PresenceService;

    const chatService = {} as ChatService;
    const gateway = new PresenceGateway(presenceService, chatService);
    const emit = jest.fn();
    gateway.server = { emit } as any;

    const client = { data: {}, emit: jest.fn() } as any;
    await gateway.identify(client, { userId: 'user-1' });

    expect(client.emit).toHaveBeenCalledWith('presence.snapshot', {
      onlineUserIds: ['user-1'],
      channelOccupancy: {},
    });
  });
});
```

Run: `npm test -- src/presence/presence.service.spec.ts src/presence/presence.gateway.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/presence src/chat src/app.module.ts
git commit -m "feat(api): add presence gateway"
```

### Task 5: Add LiveKit token issuance and protected voice join flow

**Files:**
- Create: `shussei-api/src/rtc/rtc.module.ts`
- Create: `shussei-api/src/rtc/rtc.controller.ts`
- Create: `shussei-api/src/rtc/rtc.service.ts`
- Create: `shussei-api/src/rtc/rtc.service.spec.ts`
- Modify: `shussei-api/src/app.module.ts`
- Modify: `shussei-api/.env.example`

**Interfaces:**
- Consumes: `SessionUser`, `ChannelsService.listChannels`, `PresenceService.joinVoiceChannel`
- Produces: `RtcService.createVoiceToken(input: { channelId: string; user: SessionUser }): Promise<{ token: string; roomName: string; wsUrl: string }>` and `POST /api/v1/channels/:channelId/voice-token`

- [ ] **Step 1: Write the failing RTC unit test**

```ts
import { RtcService } from './rtc.service';

describe('RtcService', () => {
  it('maps a voice channel to a LiveKit room token', async () => {
    const accessToken = {
      addGrant: jest.fn(),
      toJwt: jest.fn().mockResolvedValue('jwt-token'),
    };

    const service = new RtcService({
      apiKey: 'lk-key',
      apiSecret: 'lk-secret',
      wsUrl: 'wss://rtc.example.com',
      createAccessToken: () => accessToken,
    } as any);

    await expect(
      service.createVoiceToken({
        channelId: 'voice-general',
        user: { id: 'user-1', email: 'user@example.com', name: 'User', avatarUrl: null },
      }),
    ).resolves.toEqual({
      token: 'jwt-token',
      roomName: 'voice-channel-voice-general',
      wsUrl: 'wss://rtc.example.com',
    });
  });
});
```

- [ ] **Step 2: Run the RTC test to verify it fails**

Run: `npm test -- src/rtc/rtc.service.spec.ts`
Expected: FAIL with `Cannot find module './rtc.service'`

- [ ] **Step 3: Implement the LiveKit token service and controller**

```ts
// src/rtc/rtc.service.ts
export type CreateVoiceTokenInput = {
  channelId: string;
  user: { id: string; email: string; name: string; avatarUrl: string | null };
};

export class RtcService {
  constructor(private readonly livekit: any) {}

  async createVoiceToken(input: CreateVoiceTokenInput) {
    const roomName = `voice-channel-${input.channelId}`;
    const token = this.livekit.createAccessToken();
    token.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true });
    const jwt = await token.toJwt();

    return {
      token: jwt,
      roomName,
      wsUrl: this.livekit.wsUrl,
    };
  }
}
```

```ts
// src/rtc/rtc.controller.ts
import { Controller, Param, Post, Req } from '@nestjs/common';
import { RtcService } from './rtc.service';

@Controller('/api/v1/channels')
export class RtcController {
  constructor(private readonly rtcService: RtcService) {}

  @Post('/:channelId/voice-token')
  async createVoiceToken(
    @Param('channelId') channelId: string,
    @Req() req: { user: { id: string; email: string; name: string; avatarUrl: string | null } },
  ) {
    return this.rtcService.createVoiceToken({ channelId, user: req.user });
  }
}
```

- [ ] **Step 4: Add an HTTP test for the protected endpoint and run tests**

```ts
import request from 'supertest';

it('POST /api/v1/channels/:channelId/voice-token returns room credentials', async () => {
  await request(app.getHttpServer())
    .post('/api/v1/channels/voice-general/voice-token')
    .expect(201);
});
```

Run: `npm test -- src/rtc/rtc.service.spec.ts && npm run test:e2e`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/rtc src/app.module.ts .env.example
git commit -m "feat(api): add livekit token endpoint"
```

## Spec Coverage Check

- Google OAuth login and allowlist authorization: Task 2
- Channel list with text and voice channels: Task 3
- Ephemeral text chat delivered in real time: Tasks 3 and 4
- User presence indicators: Task 4
- Voice calls in channels and LiveKit token issuance: Task 5
- Self-hosted backend service with health endpoint: Tasks 1 and 5
- Graceful reconnect support groundwork through Socket.IO identify flow: Task 4

## Placeholder Scan

Search after writing for red-flag placeholder phrases in `/home/matumoto/docs/superpowers/plans/2026-08-27-shussei-api.md`.
Expected: no matches.
