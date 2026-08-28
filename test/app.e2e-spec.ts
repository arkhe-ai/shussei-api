import { NestFactory } from '@nestjs/core';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('App health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await NestFactory.create(AppModule);
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

  it('rejects profile update without session', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/auth/me')
      .send({ name: 'New Name' })
      .expect(401);
  });

  it('logs out without requiring session', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/auth/logout')
      .expect(302)
      .expect('Location', 'http://localhost:3000/login');
  });
});

