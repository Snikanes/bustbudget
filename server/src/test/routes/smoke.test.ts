import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import { createTestUser } from '../helpers/db.js';
import { makeAuthCookie } from '../helpers/auth.js';

describe('harness smoke test', () => {
  it('GET /api/health returns ok', async () => {
    const res = await request(app).get('/api/health').expect(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('GET /api/accounts returns 401 without cookie', async () => {
    await request(app).get('/api/accounts').expect(401);
  });

  it('GET /api/accounts returns 200 with valid cookie', async () => {
    const { id, email } = createTestUser();
    const res = await request(app)
      .get('/api/accounts')
      .set('Cookie', makeAuthCookie(id, email))
      .expect(200);
    expect(res.body.accounts).toEqual([]);
  });
});
