import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import { createTestUser } from '../helpers/db.js';
import { makeAuthCookie } from '../helpers/auth.js';
import { createAccount, createTransfer } from '../helpers/fixtures.js';

const yesterday = () => new Date(Date.now() - 86400000).toISOString().split('T')[0];
const twoDaysAgo = () => new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0];
const tomorrow = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
};

describe('POST /api/transfers', () => {
  it('returns 401 when no auth cookie is present', async () => {
    await request(app).post('/api/transfers').send({}).expect(401);
  });

  it('returns 400 VALIDATION_ERROR when fromAccountId equals toAccountId', async () => {
    const { id: userId, email } = createTestUser();
    const accountId = createAccount(userId);

    const res = await request(app)
      .post('/api/transfers')
      .set('Cookie', makeAuthCookie(userId, email))
      .send({ fromAccountId: accountId, toAccountId: accountId, amount: 1000, date: yesterday() })
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR when amount is 0', async () => {
    const { id: userId, email } = createTestUser();
    const fromId = createAccount(userId, { name: 'From' });
    const toId = createAccount(userId, { name: 'To' });

    const res = await request(app)
      .post('/api/transfers')
      .set('Cookie', makeAuthCookie(userId, email))
      .send({ fromAccountId: fromId, toAccountId: toId, amount: 0, date: yesterday() })
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR when amount is negative', async () => {
    const { id: userId, email } = createTestUser();
    const fromId = createAccount(userId, { name: 'From' });
    const toId = createAccount(userId, { name: 'To' });

    const res = await request(app)
      .post('/api/transfers')
      .set('Cookie', makeAuthCookie(userId, email))
      .send({ fromAccountId: fromId, toAccountId: toId, amount: -500, date: yesterday() })
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR when date is in the future', async () => {
    const { id: userId, email } = createTestUser();
    const fromId = createAccount(userId, { name: 'From' });
    const toId = createAccount(userId, { name: 'To' });

    const res = await request(app)
      .post('/api/transfers')
      .set('Cookie', makeAuthCookie(userId, email))
      .send({ fromAccountId: fromId, toAccountId: toId, amount: 1000, date: tomorrow() })
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 when fromAccountId does not exist', async () => {
    const { id: userId, email } = createTestUser();
    const toId = createAccount(userId);

    await request(app)
      .post('/api/transfers')
      .set('Cookie', makeAuthCookie(userId, email))
      .send({ fromAccountId: 'nonexistent', toAccountId: toId, amount: 1000, date: yesterday() })
      .expect(404);
  });

  it('returns 404 when fromAccountId belongs to another user', async () => {
    const { id: owner } = createTestUser({ email: 'owner@test.com' });
    const { id: userId, email } = createTestUser({ email: 'user@test.com' });
    const otherAccount = createAccount(owner);
    const toId = createAccount(userId);

    await request(app)
      .post('/api/transfers')
      .set('Cookie', makeAuthCookie(userId, email))
      .send({ fromAccountId: otherAccount, toAccountId: toId, amount: 1000, date: yesterday() })
      .expect(404);
  });

  it('returns 404 when toAccountId does not exist', async () => {
    const { id: userId, email } = createTestUser();
    const fromId = createAccount(userId);

    await request(app)
      .post('/api/transfers')
      .set('Cookie', makeAuthCookie(userId, email))
      .send({ fromAccountId: fromId, toAccountId: 'nonexistent', amount: 1000, date: yesterday() })
      .expect(404);
  });

  it('returns 404 when toAccountId belongs to another user', async () => {
    const { id: owner } = createTestUser({ email: 'owner@test.com' });
    const { id: userId, email } = createTestUser({ email: 'user@test.com' });
    const fromId = createAccount(userId);
    const otherAccount = createAccount(owner);

    await request(app)
      .post('/api/transfers')
      .set('Cookie', makeAuthCookie(userId, email))
      .send({ fromAccountId: fromId, toAccountId: otherAccount, amount: 1000, date: yesterday() })
      .expect(404);
  });

  it('returns 201 with the full transfer shape', async () => {
    const { id: userId, email } = createTestUser();
    const fromId = createAccount(userId, { name: 'Checking' });
    const toId = createAccount(userId, { name: 'Savings' });

    const res = await request(app)
      .post('/api/transfers')
      .set('Cookie', makeAuthCookie(userId, email))
      .send({ fromAccountId: fromId, toAccountId: toId, amount: 5000, date: yesterday(), memo: 'Test memo' })
      .expect(201);

    const { transfer } = res.body;
    expect(transfer.id).toBeDefined();
    expect(transfer.fromTransactionId).toBeDefined();
    expect(transfer.toTransactionId).toBeDefined();
    expect(transfer.fromAccountId).toBe(fromId);
    expect(transfer.toAccountId).toBe(toId);
    expect(transfer.amount).toBe(5000);
    expect(transfer.date).toBe(yesterday());
    expect(transfer.memo).toBe('Test memo');
    expect(transfer.createdAt).toBeDefined();
  });

  it('the from-transaction has a negative amount; the to-transaction has a positive amount', async () => {
    const { id: userId, email } = createTestUser();
    const fromId = createAccount(userId, { name: 'From' });
    const toId = createAccount(userId, { name: 'To' });

    const res = await request(app)
      .post('/api/transfers')
      .set('Cookie', makeAuthCookie(userId, email))
      .send({ fromAccountId: fromId, toAccountId: toId, amount: 5000, date: yesterday() })
      .expect(201);

    const { transfer } = res.body;

    const fromRes = await request(app)
      .get(`/api/transactions/${transfer.fromTransactionId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(200);

    const toRes = await request(app)
      .get(`/api/transactions/${transfer.toTransactionId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(200);

    expect(fromRes.body.transaction.amount).toBe(-5000);
    expect(toRes.body.transaction.amount).toBe(5000);
  });

  it('both transactions share the memo provided in the request', async () => {
    const { id: userId, email } = createTestUser();
    const fromId = createAccount(userId, { name: 'From' });
    const toId = createAccount(userId, { name: 'To' });

    const res = await request(app)
      .post('/api/transfers')
      .set('Cookie', makeAuthCookie(userId, email))
      .send({ fromAccountId: fromId, toAccountId: toId, amount: 5000, date: yesterday(), memo: 'Shared note' })
      .expect(201);

    const { transfer } = res.body;

    const fromRes = await request(app)
      .get(`/api/transactions/${transfer.fromTransactionId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(200);

    const toRes = await request(app)
      .get(`/api/transactions/${transfer.toTransactionId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(200);

    expect(fromRes.body.transaction.memo).toBe('Shared note');
    expect(toRes.body.transaction.memo).toBe('Shared note');
  });

  it('both transactions share the isCleared value provided in the request', async () => {
    const { id: userId, email } = createTestUser();
    const fromId = createAccount(userId, { name: 'From' });
    const toId = createAccount(userId, { name: 'To' });

    const res = await request(app)
      .post('/api/transfers')
      .set('Cookie', makeAuthCookie(userId, email))
      .send({ fromAccountId: fromId, toAccountId: toId, amount: 5000, date: yesterday(), isCleared: true })
      .expect(201);

    const { transfer } = res.body;

    const fromRes = await request(app)
      .get(`/api/transactions/${transfer.fromTransactionId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(200);

    const toRes = await request(app)
      .get(`/api/transactions/${transfer.toTransactionId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(200);

    expect(fromRes.body.transaction.isCleared).toBe(true);
    expect(toRes.body.transaction.isCleared).toBe(true);
  });

  it('payees are auto-generated: from-txn gets "Transfer to {toAccountName}", to-txn gets "Transfer from {fromAccountName}"', async () => {
    const { id: userId, email } = createTestUser();
    const fromId = createAccount(userId, { name: 'Checking' });
    const toId = createAccount(userId, { name: 'Savings' });

    const res = await request(app)
      .post('/api/transfers')
      .set('Cookie', makeAuthCookie(userId, email))
      .send({ fromAccountId: fromId, toAccountId: toId, amount: 5000, date: yesterday() })
      .expect(201);

    const { transfer } = res.body;

    const fromRes = await request(app)
      .get(`/api/transactions/${transfer.fromTransactionId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(200);

    const toRes = await request(app)
      .get(`/api/transactions/${transfer.toTransactionId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(200);

    expect(fromRes.body.transaction.payee).toBe('Transfer to Savings');
    expect(toRes.body.transaction.payee).toBe('Transfer from Checking');
  });

  it('both transactions are marked as transfers with transferAccountId set correctly on each', async () => {
    const { id: userId, email } = createTestUser();
    const fromId = createAccount(userId, { name: 'Checking' });
    const toId = createAccount(userId, { name: 'Savings' });

    const res = await request(app)
      .post('/api/transfers')
      .set('Cookie', makeAuthCookie(userId, email))
      .send({ fromAccountId: fromId, toAccountId: toId, amount: 5000, date: yesterday() })
      .expect(201);

    const { transfer } = res.body;

    const fromRes = await request(app)
      .get(`/api/transactions/${transfer.fromTransactionId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(200);

    const toRes = await request(app)
      .get(`/api/transactions/${transfer.toTransactionId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(200);

    expect(fromRes.body.transaction.transferAccountId).toBe(toId);
    expect(toRes.body.transaction.transferAccountId).toBe(fromId);
  });
});

describe('GET /api/transfers/:id', () => {
  it('returns 401 when no auth cookie is present', async () => {
    await request(app).get('/api/transfers/some-id').expect(401);
  });

  it('returns 404 when the transfer does not exist', async () => {
    const { id: userId, email } = createTestUser();

    await request(app)
      .get('/api/transfers/nonexistent')
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(404);
  });

  it('returns 404 when the transfer belongs to another user', async () => {
    const { id: owner } = createTestUser({ email: 'owner@test.com' });
    const { id: userId, email } = createTestUser({ email: 'user@test.com' });
    const fromId = createAccount(owner, { name: 'From' });
    const toId = createAccount(owner, { name: 'To' });
    const { transferId } = createTransfer(owner, fromId, toId);

    await request(app)
      .get(`/api/transfers/${transferId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(404);
  });

  it('returns 200 with all transfer fields correctly populated', async () => {
    const { id: userId, email } = createTestUser();
    const fromId = createAccount(userId, { name: 'Checking' });
    const toId = createAccount(userId, { name: 'Savings' });
    const { transferId, fromTxnId, toTxnId } = createTransfer(userId, fromId, toId, { amount: 7500 });

    const res = await request(app)
      .get(`/api/transfers/${transferId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(200);

    const { transfer } = res.body;
    expect(transfer.id).toBe(transferId);
    expect(transfer.fromTransactionId).toBe(fromTxnId);
    expect(transfer.toTransactionId).toBe(toTxnId);
    expect(transfer.fromAccountId).toBe(fromId);
    expect(transfer.toAccountId).toBe(toId);
    expect(transfer.date).toBeDefined();
    expect(transfer.createdAt).toBeDefined();
  });

  it('the amount field is positive (the to-side amount)', async () => {
    const { id: userId, email } = createTestUser();
    const fromId = createAccount(userId, { name: 'From' });
    const toId = createAccount(userId, { name: 'To' });
    const { transferId } = createTransfer(userId, fromId, toId, { amount: 7500 });

    const res = await request(app)
      .get(`/api/transfers/${transferId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(200);

    expect(res.body.transfer.amount).toBe(7500);
  });
});

describe('PUT /api/transfers/:id', () => {
  it('returns 401 when no auth cookie is present', async () => {
    await request(app).put('/api/transfers/some-id').send({}).expect(401);
  });

  it('returns 404 when the transfer does not exist', async () => {
    const { id: userId, email } = createTestUser();

    await request(app)
      .put('/api/transfers/nonexistent')
      .set('Cookie', makeAuthCookie(userId, email))
      .send({ date: yesterday() })
      .expect(404);
  });

  it('returns 404 when the transfer belongs to another user', async () => {
    const { id: owner } = createTestUser({ email: 'owner@test.com' });
    const { id: userId, email } = createTestUser({ email: 'user@test.com' });
    const fromId = createAccount(owner, { name: 'From' });
    const toId = createAccount(owner, { name: 'To' });
    const { transferId } = createTransfer(owner, fromId, toId);

    await request(app)
      .put(`/api/transfers/${transferId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .send({ date: yesterday() })
      .expect(404);
  });

  it('returns 400 VALIDATION_ERROR when date is set to a future date', async () => {
    const { id: userId, email } = createTestUser();
    const fromId = createAccount(userId, { name: 'From' });
    const toId = createAccount(userId, { name: 'To' });
    const { transferId } = createTransfer(userId, fromId, toId);

    const res = await request(app)
      .put(`/api/transfers/${transferId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .send({ date: tomorrow() })
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 422 CLEARED_TRANSFER_IMMUTABLE when updating date on a cleared transfer', async () => {
    const { id: userId, email } = createTestUser();
    const fromId = createAccount(userId, { name: 'From' });
    const toId = createAccount(userId, { name: 'To' });

    const createRes = await request(app)
      .post('/api/transfers')
      .set('Cookie', makeAuthCookie(userId, email))
      .send({ fromAccountId: fromId, toAccountId: toId, amount: 5000, date: yesterday(), isCleared: true })
      .expect(201);

    const { transfer } = createRes.body;

    const res = await request(app)
      .put(`/api/transfers/${transfer.id}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .send({ date: yesterday() })
      .expect(422);

    expect(res.body.error.code).toBe('CLEARED_TRANSFER_IMMUTABLE');
  });

  it('returns 422 CLEARED_TRANSFER_IMMUTABLE when updating amount on a cleared transfer', async () => {
    const { id: userId, email } = createTestUser();
    const fromId = createAccount(userId, { name: 'From' });
    const toId = createAccount(userId, { name: 'To' });

    const createRes = await request(app)
      .post('/api/transfers')
      .set('Cookie', makeAuthCookie(userId, email))
      .send({ fromAccountId: fromId, toAccountId: toId, amount: 5000, date: yesterday(), isCleared: true })
      .expect(201);

    const { transfer } = createRes.body;

    const res = await request(app)
      .put(`/api/transfers/${transfer.id}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .send({ amount: 8000 })
      .expect(422);

    expect(res.body.error.code).toBe('CLEARED_TRANSFER_IMMUTABLE');
  });

  it('updating date changes date on the returned transfer and on both transactions', async () => {
    const { id: userId, email } = createTestUser();
    const fromId = createAccount(userId, { name: 'From' });
    const toId = createAccount(userId, { name: 'To' });

    const createRes = await request(app)
      .post('/api/transfers')
      .set('Cookie', makeAuthCookie(userId, email))
      .send({ fromAccountId: fromId, toAccountId: toId, amount: 5000, date: yesterday() })
      .expect(201);

    const { transfer } = createRes.body;
    const newDate = twoDaysAgo();

    const res = await request(app)
      .put(`/api/transfers/${transfer.id}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .send({ date: newDate })
      .expect(200);

    expect(res.body.transfer.date).toBe(newDate);

    const fromRes = await request(app)
      .get(`/api/transactions/${transfer.fromTransactionId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(200);

    const toRes = await request(app)
      .get(`/api/transactions/${transfer.toTransactionId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(200);

    expect(fromRes.body.transaction.date).toBe(newDate);
    expect(toRes.body.transaction.date).toBe(newDate);
  });

  it('updating amount changes amount on the returned transfer; from-txn becomes negative, to-txn positive', async () => {
    const { id: userId, email } = createTestUser();
    const fromId = createAccount(userId, { name: 'From' });
    const toId = createAccount(userId, { name: 'To' });

    const createRes = await request(app)
      .post('/api/transfers')
      .set('Cookie', makeAuthCookie(userId, email))
      .send({ fromAccountId: fromId, toAccountId: toId, amount: 5000, date: yesterday() })
      .expect(201);

    const { transfer } = createRes.body;

    const res = await request(app)
      .put(`/api/transfers/${transfer.id}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .send({ amount: 9000 })
      .expect(200);

    expect(res.body.transfer.amount).toBe(9000);

    const fromRes = await request(app)
      .get(`/api/transactions/${transfer.fromTransactionId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(200);

    const toRes = await request(app)
      .get(`/api/transactions/${transfer.toTransactionId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(200);

    expect(fromRes.body.transaction.amount).toBe(-9000);
    expect(toRes.body.transaction.amount).toBe(9000);
  });

  it('updating memo propagates to both underlying transactions', async () => {
    const { id: userId, email } = createTestUser();
    const fromId = createAccount(userId, { name: 'From' });
    const toId = createAccount(userId, { name: 'To' });

    const createRes = await request(app)
      .post('/api/transfers')
      .set('Cookie', makeAuthCookie(userId, email))
      .send({ fromAccountId: fromId, toAccountId: toId, amount: 5000, date: yesterday() })
      .expect(201);

    const { transfer } = createRes.body;

    await request(app)
      .put(`/api/transfers/${transfer.id}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .send({ memo: 'Updated note' })
      .expect(200);

    const fromRes = await request(app)
      .get(`/api/transactions/${transfer.fromTransactionId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(200);

    const toRes = await request(app)
      .get(`/api/transactions/${transfer.toTransactionId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(200);

    expect(fromRes.body.transaction.memo).toBe('Updated note');
    expect(toRes.body.transaction.memo).toBe('Updated note');
  });

  it('setting isCleared=true clears both transactions', async () => {
    const { id: userId, email } = createTestUser();
    const fromId = createAccount(userId, { name: 'From' });
    const toId = createAccount(userId, { name: 'To' });

    const createRes = await request(app)
      .post('/api/transfers')
      .set('Cookie', makeAuthCookie(userId, email))
      .send({ fromAccountId: fromId, toAccountId: toId, amount: 5000, date: yesterday() })
      .expect(201);

    const { transfer } = createRes.body;

    await request(app)
      .put(`/api/transfers/${transfer.id}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .send({ isCleared: true })
      .expect(200);

    const fromRes = await request(app)
      .get(`/api/transactions/${transfer.fromTransactionId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(200);

    const toRes = await request(app)
      .get(`/api/transactions/${transfer.toTransactionId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(200);

    expect(fromRes.body.transaction.isCleared).toBe(true);
    expect(toRes.body.transaction.isCleared).toBe(true);
  });

  it('can update memo on a cleared transfer', async () => {
    const { id: userId, email } = createTestUser();
    const fromId = createAccount(userId, { name: 'From' });
    const toId = createAccount(userId, { name: 'To' });

    const createRes = await request(app)
      .post('/api/transfers')
      .set('Cookie', makeAuthCookie(userId, email))
      .send({ fromAccountId: fromId, toAccountId: toId, amount: 5000, date: yesterday(), isCleared: true })
      .expect(201);

    const { transfer } = createRes.body;

    const res = await request(app)
      .put(`/api/transfers/${transfer.id}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .send({ memo: 'Cleared memo' })
      .expect(200);

    expect(res.body.transfer.memo).toBe('Cleared memo');
  });

  it('can uncheck a cleared transfer by setting isCleared=false', async () => {
    const { id: userId, email } = createTestUser();
    const fromId = createAccount(userId, { name: 'From' });
    const toId = createAccount(userId, { name: 'To' });

    const createRes = await request(app)
      .post('/api/transfers')
      .set('Cookie', makeAuthCookie(userId, email))
      .send({ fromAccountId: fromId, toAccountId: toId, amount: 5000, date: yesterday(), isCleared: true })
      .expect(201);

    const { transfer } = createRes.body;

    await request(app)
      .put(`/api/transfers/${transfer.id}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .send({ isCleared: false })
      .expect(200);

    const fromRes = await request(app)
      .get(`/api/transactions/${transfer.fromTransactionId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(200);

    const toRes = await request(app)
      .get(`/api/transactions/${transfer.toTransactionId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(200);

    expect(fromRes.body.transaction.isCleared).toBe(false);
    expect(toRes.body.transaction.isCleared).toBe(false);
  });
});

describe('DELETE /api/transfers/:id', () => {
  it('returns 401 when no auth cookie is present', async () => {
    await request(app).delete('/api/transfers/some-id').expect(401);
  });

  it('returns 404 when the transfer does not exist', async () => {
    const { id: userId, email } = createTestUser();

    await request(app)
      .delete('/api/transfers/nonexistent')
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(404);
  });

  it('returns 404 when the transfer belongs to another user', async () => {
    const { id: owner } = createTestUser({ email: 'owner@test.com' });
    const { id: userId, email } = createTestUser({ email: 'user@test.com' });
    const fromId = createAccount(owner, { name: 'From' });
    const toId = createAccount(owner, { name: 'To' });
    const { transferId } = createTransfer(owner, fromId, toId);

    await request(app)
      .delete(`/api/transfers/${transferId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(404);
  });

  it('returns 204 with no body', async () => {
    const { id: userId, email } = createTestUser();
    const fromId = createAccount(userId, { name: 'From' });
    const toId = createAccount(userId, { name: 'To' });
    const { transferId } = createTransfer(userId, fromId, toId);

    const res = await request(app)
      .delete(`/api/transfers/${transferId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(204);

    expect(res.body).toEqual({});
  });

  it('both underlying transactions are deleted after transfer deletion', async () => {
    const { id: userId, email } = createTestUser();
    const fromId = createAccount(userId, { name: 'From' });
    const toId = createAccount(userId, { name: 'To' });
    const { transferId, fromTxnId, toTxnId } = createTransfer(userId, fromId, toId);

    await request(app)
      .delete(`/api/transfers/${transferId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(204);

    await request(app)
      .get(`/api/transactions/${fromTxnId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(404);

    await request(app)
      .get(`/api/transactions/${toTxnId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(404);
  });

  it('the transfer itself is gone after deletion', async () => {
    const { id: userId, email } = createTestUser();
    const fromId = createAccount(userId, { name: 'From' });
    const toId = createAccount(userId, { name: 'To' });
    const { transferId } = createTransfer(userId, fromId, toId);

    await request(app)
      .delete(`/api/transfers/${transferId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(204);

    await request(app)
      .get(`/api/transfers/${transferId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(404);
  });
});
