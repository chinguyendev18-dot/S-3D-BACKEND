import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

interface ErrorBody {
  details?: Record<string, string[]>;
  messageCode?: string;
}

/** Runs without network: every request here is answered before Supabase or the database. */
describe('AppController (e2e)', () => {
  let app: INestApplication;
  let server: Parameters<typeof request>[0];

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
    server = app.getHttpServer() as Parameters<typeof request>[0];
  });

  afterAll(async () => {
    await app.close();
  });

  it('/api/v1/health (GET)', async () => {
    await request(server)
      .get('/api/v1/health')
      .expect(200)
      .expect({ success: true, data: { status: 'ok' } });
  });

  it('refuses protected routes without a token', async () => {
    for (const path of [
      '/api/v1/auth/session',
      '/api/v1/accounts',
      '/api/v1/roles',
      '/api/v1/workshop/staff',
    ]) {
      const response = await request(server).get(path).expect(401);
      expect(response.body).toMatchObject({
        messageCode: 'AUTH.UNAUTHORIZED',
        statusCode: 401,
        success: false,
      });
    }
  });

  it('refuses a token that is not a Supabase access token', async () => {
    const response = await request(server)
      .get('/api/v1/auth/session')
      .set('Authorization', 'Bearer not-a-jwt')
      .expect(401);
    expect((response.body as ErrorBody).messageCode).toBe('AUTH.TOKEN_EXPIRED');
  });

  it('checks sign-in fields before calling Supabase', async () => {
    const response = await request(server)
      .post('/api/v1/auth/login')
      .send({ email: 'không-phải-email', password: '' })
      .expect(400);
    expect(response.body).toMatchObject({
      messageCode: 'VALIDATION_ERROR',
      success: false,
    });
    expect(Object.keys((response.body as ErrorBody).details ?? {})).toEqual(
      expect.arrayContaining(['email', 'password']),
    );
  });

  it('refuses fields a route does not take', async () => {
    const response = await request(server)
      .post('/api/v1/auth/login')
      .send({ email: 'a@b.vn', isAdmin: true, password: 'x' })
      .expect(400);
    expect((response.body as ErrorBody).messageCode).toBe('VALIDATION_ERROR');
  });
});
