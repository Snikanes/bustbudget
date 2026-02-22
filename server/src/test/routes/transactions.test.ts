import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import { createTestUser } from '../helpers/db.js';
import { makeAuthCookie } from '../helpers/auth.js';
import { createAccount, createCategory, createTransaction, createTransfer } from '../helpers/fixtures.js';

// ---------------------------------------------------------------------------
// GET /api/transactions/:id
// ---------------------------------------------------------------------------

describe('GET /api/transactions/:id', () => {
  it('returns 401 without auth cookie', async () => {
    const { id: userId } = createTestUser();
    const accountId = createAccount(userId);
    const txnId = createTransaction(userId, accountId);

    await request(app).get(`/api/transactions/${txnId}`).expect(401);
  });

  it('returns 404 for a non-existent transaction', async () => {
    const { id: userId, email } = createTestUser();

    await request(app)
      .get('/api/transactions/does-not-exist')
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(404);
  });

  it('returns 404 when the transaction belongs to another user', async () => {
    const { id: owner } = createTestUser({ email: 'owner@test.com' });
    const { id: other, email: otherEmail } = createTestUser({ email: 'other@test.com' });

    const accountId = createAccount(owner);
    const txnId = createTransaction(owner, accountId);

    await request(app)
      .get(`/api/transactions/${txnId}`)
      .set('Cookie', makeAuthCookie(other, otherEmail))
      .expect(404);
  });

  it('returns the full transaction shape with null join fields for a plain transaction', async () => {
    const { id: userId, email } = createTestUser();
    const accountId = createAccount(userId);
    const txnId = createTransaction(userId, accountId, {
      amount: -5000,
      payee: 'Shop',
      memo: 'Groceries',
      isCleared: 0,
    });

    const res = await request(app)
      .get(`/api/transactions/${txnId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(200);

    const { transaction } = res.body;
    expect(transaction.id).toBe(txnId);
    expect(transaction.accountId).toBe(accountId);
    expect(transaction.amount).toBe(-5000);
    expect(transaction.payee).toBe('Shop');
    expect(transaction.memo).toBe('Groceries');
    expect(transaction.isCleared).toBe(false);
    expect(transaction.isReconciled).toBe(false);
    expect(transaction.isStartingBalance).toBe(false);
    expect(transaction.categoryId).toBeNull();
    expect(transaction.categoryName).toBeNull();
    expect(transaction.linkedTransactionId).toBeNull();
    expect(transaction.transferAccountId).toBeNull();
    expect(transaction.transferAccountName).toBeNull();
  });

  it('returns categoryName when a category is assigned', async () => {
    const { id: userId, email } = createTestUser();
    const accountId = createAccount(userId);
    const categoryId = createCategory(userId, { name: 'Groceries' });
    const txnId = createTransaction(userId, accountId, { categoryId });

    const res = await request(app)
      .get(`/api/transactions/${txnId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(200);

    expect(res.body.transaction.categoryId).toBe(categoryId);
    expect(res.body.transaction.categoryName).toBe('Groceries');
  });

  it('returns transferAccountId and transferAccountName for a transfer transaction', async () => {
    const { id: userId, email } = createTestUser();
    const fromAccountId = createAccount(userId, { name: 'Checking' });
    const toAccountId = createAccount(userId, { name: 'Savings' });
    const { fromTxnId, toTxnId } = createTransfer(userId, fromAccountId, toAccountId);

    const resFrom = await request(app)
      .get(`/api/transactions/${fromTxnId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(200);

    expect(resFrom.body.transaction.transferAccountId).toBe(toAccountId);
    expect(resFrom.body.transaction.transferAccountName).toBe('Savings');
    expect(resFrom.body.transaction.amount).toBeLessThan(0);

    const resTo = await request(app)
      .get(`/api/transactions/${toTxnId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(200);

    expect(resTo.body.transaction.transferAccountId).toBe(fromAccountId);
    expect(resTo.body.transaction.transferAccountName).toBe('Checking');
    expect(resTo.body.transaction.amount).toBeGreaterThan(0);
  });

  it('returns isCleared=true for a cleared transaction', async () => {
    const { id: userId, email } = createTestUser();
    const accountId = createAccount(userId);
    const txnId = createTransaction(userId, accountId, { isCleared: 1 });

    const res = await request(app)
      .get(`/api/transactions/${txnId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(200);

    expect(res.body.transaction.isCleared).toBe(true);
    expect(res.body.transaction.isReconciled).toBe(false);
  });

  it('returns isCleared=true and isReconciled=true for a reconciled transaction', async () => {
    const { id: userId, email } = createTestUser();
    const accountId = createAccount(userId);
    const txnId = createTransaction(userId, accountId, { isCleared: 2 });

    const res = await request(app)
      .get(`/api/transactions/${txnId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(200);

    expect(res.body.transaction.isCleared).toBe(true);
    expect(res.body.transaction.isReconciled).toBe(true);
  });

  it('returns isStartingBalance=true for a starting balance transaction', async () => {
    const { id: userId, email } = createTestUser();
    const accountId = createAccount(userId);
    const txnId = createTransaction(userId, accountId, { isStartingBalance: true, isCleared: 1 });

    const res = await request(app)
      .get(`/api/transactions/${txnId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(200);

    expect(res.body.transaction.isStartingBalance).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/transactions/:id
// ---------------------------------------------------------------------------

describe('PUT /api/transactions/:id', () => {
  it('returns 401 without auth cookie', async () => {
    const { id: userId } = createTestUser();
    const accountId = createAccount(userId);
    const txnId = createTransaction(userId, accountId);

    await request(app)
      .put(`/api/transactions/${txnId}`)
      .send({ memo: 'updated' })
      .expect(401);
  });

  it('returns 404 for a non-existent transaction', async () => {
    const { id: userId, email } = createTestUser();

    await request(app)
      .put('/api/transactions/does-not-exist')
      .set('Cookie', makeAuthCookie(userId, email))
      .send({ memo: 'hi' })
      .expect(404);
  });

  it('returns 404 when the transaction belongs to another user', async () => {
    const { id: owner } = createTestUser({ email: 'owner@test.com' });
    const { id: other, email: otherEmail } = createTestUser({ email: 'other@test.com' });
    const accountId = createAccount(owner);
    const txnId = createTransaction(owner, accountId);

    await request(app)
      .put(`/api/transactions/${txnId}`)
      .set('Cookie', makeAuthCookie(other, otherEmail))
      .send({ memo: 'hi' })
      .expect(404);
  });

  it('updates all editable fields on an uncleared transaction', async () => {
    const { id: userId, email } = createTestUser();
    const accountId = createAccount(userId);
    const categoryId = createCategory(userId, { name: 'Food' });
    const txnId = createTransaction(userId, accountId, { isCleared: 0 });

    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const dayBefore = new Date(Date.now() - 172800000).toISOString().split('T')[0];

    const res = await request(app)
      .put(`/api/transactions/${txnId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .send({
        date: dayBefore,
        amount: -9999,
        payee: 'New Payee',
        categoryId,
        memo: 'New memo',
        isCleared: true,
      })
      .expect(200);

    const { transaction } = res.body;
    expect(transaction.date).toBe(dayBefore);
    expect(transaction.amount).toBe(-9999);
    expect(transaction.payee).toBe('New Payee');
    expect(transaction.categoryId).toBe(categoryId);
    expect(transaction.memo).toBe('New memo');
    expect(transaction.isCleared).toBe(true);

    // Suppress unused variable - yesterday used only to check range
    void yesterday;
  });

  it('can clear an uncleared transaction by setting isCleared=true', async () => {
    const { id: userId, email } = createTestUser();
    const accountId = createAccount(userId);
    const txnId = createTransaction(userId, accountId, { isCleared: 0 });

    const res = await request(app)
      .put(`/api/transactions/${txnId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .send({ isCleared: true })
      .expect(200);

    expect(res.body.transaction.isCleared).toBe(true);
    expect(res.body.transaction.isReconciled).toBe(false);
  });

  it('can uncheck a cleared transaction by setting isCleared=false', async () => {
    const { id: userId, email } = createTestUser();
    const accountId = createAccount(userId);
    const txnId = createTransaction(userId, accountId, { isCleared: 1 });

    const res = await request(app)
      .put(`/api/transactions/${txnId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .send({ isCleared: false })
      .expect(200);

    expect(res.body.transaction.isCleared).toBe(false);
  });

  it('can update memo on a cleared transaction', async () => {
    const { id: userId, email } = createTestUser();
    const accountId = createAccount(userId);
    const txnId = createTransaction(userId, accountId, { isCleared: 1 });

    const res = await request(app)
      .put(`/api/transactions/${txnId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .send({ memo: 'Updated memo' })
      .expect(200);

    expect(res.body.transaction.memo).toBe('Updated memo');
  });

  it('returns 422 CLEARED_TRANSACTION_IMMUTABLE when editing date on a cleared transaction', async () => {
    const { id: userId, email } = createTestUser();
    const accountId = createAccount(userId);
    const txnId = createTransaction(userId, accountId, { isCleared: 1 });
    const dayBefore = new Date(Date.now() - 172800000).toISOString().split('T')[0];

    const res = await request(app)
      .put(`/api/transactions/${txnId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .send({ date: dayBefore })
      .expect(422);

    expect(res.body.error.code).toBe('CLEARED_TRANSACTION_IMMUTABLE');
  });

  it('returns 422 CLEARED_TRANSACTION_IMMUTABLE when editing amount on a cleared transaction', async () => {
    const { id: userId, email } = createTestUser();
    const accountId = createAccount(userId);
    const txnId = createTransaction(userId, accountId, { isCleared: 1 });

    const res = await request(app)
      .put(`/api/transactions/${txnId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .send({ amount: -1 })
      .expect(422);

    expect(res.body.error.code).toBe('CLEARED_TRANSACTION_IMMUTABLE');
  });

  it('returns 422 CLEARED_TRANSACTION_IMMUTABLE when editing payee on a cleared transaction', async () => {
    const { id: userId, email } = createTestUser();
    const accountId = createAccount(userId);
    const txnId = createTransaction(userId, accountId, { isCleared: 1 });

    const res = await request(app)
      .put(`/api/transactions/${txnId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .send({ payee: 'New Payee' })
      .expect(422);

    expect(res.body.error.code).toBe('CLEARED_TRANSACTION_IMMUTABLE');
  });

  it('returns 422 CLEARED_TRANSACTION_IMMUTABLE when editing categoryId on a cleared transaction', async () => {
    const { id: userId, email } = createTestUser();
    const accountId = createAccount(userId);
    const categoryId = createCategory(userId);
    const txnId = createTransaction(userId, accountId, { isCleared: 1 });

    const res = await request(app)
      .put(`/api/transactions/${txnId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .send({ categoryId })
      .expect(422);

    expect(res.body.error.code).toBe('CLEARED_TRANSACTION_IMMUTABLE');
  });

  it('can update memo on a reconciled transaction', async () => {
    const { id: userId, email } = createTestUser();
    const accountId = createAccount(userId);
    const txnId = createTransaction(userId, accountId, { isCleared: 2 });

    const res = await request(app)
      .put(`/api/transactions/${txnId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .send({ memo: 'Reconciled note' })
      .expect(200);

    expect(res.body.transaction.memo).toBe('Reconciled note');
    expect(res.body.transaction.isReconciled).toBe(true);
  });

  it('returns 422 RECONCILED_TRANSACTION_IMMUTABLE when editing a non-memo field on a reconciled transaction', async () => {
    const { id: userId, email } = createTestUser();
    const accountId = createAccount(userId);
    const txnId = createTransaction(userId, accountId, { isCleared: 2 });
    const dayBefore = new Date(Date.now() - 172800000).toISOString().split('T')[0];

    const res = await request(app)
      .put(`/api/transactions/${txnId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .send({ date: dayBefore })
      .expect(422);

    expect(res.body.error.code).toBe('RECONCILED_TRANSACTION_IMMUTABLE');
  });

  it('returns 422 STARTING_BALANCE_IMMUTABLE when changing amount on a starting balance', async () => {
    const { id: userId, email } = createTestUser();
    const accountId = createAccount(userId);
    // Must be uncleared (isCleared=0): the cleared-immutability check fires before
    // the starting-balance check, so only an uncleared starting balance reaches
    // the STARTING_BALANCE_IMMUTABLE code path.
    const txnId = createTransaction(userId, accountId, {
      amount: 100000,
      isStartingBalance: true,
      isCleared: 0,
    });

    const res = await request(app)
      .put(`/api/transactions/${txnId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .send({ amount: 50000 })
      .expect(422);

    expect(res.body.error.code).toBe('STARTING_BALANCE_IMMUTABLE');
  });

  it('returns 422 STARTING_BALANCE_NO_CATEGORY when adding a category to a starting balance', async () => {
    const { id: userId, email } = createTestUser();
    const accountId = createAccount(userId);
    const categoryId = createCategory(userId);
    // Must be uncleared: same reasoning as STARTING_BALANCE_IMMUTABLE test above.
    const txnId = createTransaction(userId, accountId, {
      isStartingBalance: true,
      isCleared: 0,
    });

    const res = await request(app)
      .put(`/api/transactions/${txnId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .send({ categoryId })
      .expect(422);

    expect(res.body.error.code).toBe('STARTING_BALANCE_NO_CATEGORY');
  });

  it('can update memo on a starting balance', async () => {
    const { id: userId, email } = createTestUser();
    const accountId = createAccount(userId);
    const txnId = createTransaction(userId, accountId, {
      isStartingBalance: true,
      isCleared: 0,
    });

    const res = await request(app)
      .put(`/api/transactions/${txnId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .send({ memo: 'Opening balance note' })
      .expect(200);

    expect(res.body.transaction.memo).toBe('Opening balance note');
    expect(res.body.transaction.isStartingBalance).toBe(true);
  });

  it('returns 400 when setting a future date', async () => {
    const { id: userId, email } = createTestUser();
    const accountId = createAccount(userId);
    const txnId = createTransaction(userId, accountId, { isCleared: 0 });
    const futureDate = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    const res = await request(app)
      .put(`/api/transactions/${txnId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .send({ date: futureDate })
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 when setting a categoryId that does not exist', async () => {
    const { id: userId, email } = createTestUser();
    const accountId = createAccount(userId);
    const txnId = createTransaction(userId, accountId, { isCleared: 0 });

    await request(app)
      .put(`/api/transactions/${txnId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .send({ categoryId: 'non-existent-category' })
      .expect(404);
  });

  it('returns 404 when the categoryId belongs to another user', async () => {
    const { id: userId, email } = createTestUser({ email: 'user@test.com' });
    const { id: otherId } = createTestUser({ email: 'other@test.com' });
    const accountId = createAccount(userId);
    const txnId = createTransaction(userId, accountId, { isCleared: 0 });
    const otherCategoryId = createCategory(otherId, { name: 'Other Cat' });

    await request(app)
      .put(`/api/transactions/${txnId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .send({ categoryId: otherCategoryId })
      .expect(404);
  });

  it('can clear categoryId by setting it to null', async () => {
    const { id: userId, email } = createTestUser();
    const accountId = createAccount(userId);
    const categoryId = createCategory(userId);
    const txnId = createTransaction(userId, accountId, { categoryId, isCleared: 0 });

    const res = await request(app)
      .put(`/api/transactions/${txnId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .send({ categoryId: null })
      .expect(200);

    expect(res.body.transaction.categoryId).toBeNull();
    expect(res.body.transaction.categoryName).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/transactions/:id
// ---------------------------------------------------------------------------

describe('DELETE /api/transactions/:id', () => {
  it('returns 401 without auth cookie', async () => {
    const { id: userId } = createTestUser();
    const accountId = createAccount(userId);
    const txnId = createTransaction(userId, accountId);

    await request(app).delete(`/api/transactions/${txnId}`).expect(401);
  });

  it('returns 404 for a non-existent transaction', async () => {
    const { id: userId, email } = createTestUser();

    await request(app)
      .delete('/api/transactions/does-not-exist')
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(404);
  });

  it('returns 404 when the transaction belongs to another user', async () => {
    const { id: owner } = createTestUser({ email: 'owner@test.com' });
    const { id: other, email: otherEmail } = createTestUser({ email: 'other@test.com' });
    const accountId = createAccount(owner);
    const txnId = createTransaction(owner, accountId);

    await request(app)
      .delete(`/api/transactions/${txnId}`)
      .set('Cookie', makeAuthCookie(other, otherEmail))
      .expect(404);
  });

  it('deletes a single uncleared transaction and returns 204', async () => {
    const { id: userId, email } = createTestUser();
    const accountId = createAccount(userId);
    const txnId = createTransaction(userId, accountId);

    await request(app)
      .delete(`/api/transactions/${txnId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(204);

    await request(app)
      .get(`/api/transactions/${txnId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(404);
  });

  it('deletes both linked transactions when deleting a transfer', async () => {
    const { id: userId, email } = createTestUser();
    const accountA = createAccount(userId, { name: 'Account A' });
    const accountB = createAccount(userId, { name: 'Account B' });
    const { fromTxnId, toTxnId } = createTransfer(userId, accountA, accountB);

    // Delete from side
    await request(app)
      .delete(`/api/transactions/${fromTxnId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(204);

    // Both sides should now be gone
    await request(app)
      .get(`/api/transactions/${fromTxnId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(404);

    await request(app)
      .get(`/api/transactions/${toTxnId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(404);
  });

  it('deletes both transactions when deleting the TO side of a transfer', async () => {
    const { id: userId, email } = createTestUser();
    const accountA = createAccount(userId, { name: 'Account A' });
    const accountB = createAccount(userId, { name: 'Account B' });
    const { fromTxnId, toTxnId } = createTransfer(userId, accountA, accountB);

    await request(app)
      .delete(`/api/transactions/${toTxnId}`)
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
});

// ---------------------------------------------------------------------------
// POST /api/accounts/:id/transactions — Transfer creation
// ---------------------------------------------------------------------------

describe('POST /api/accounts/:id/transactions (transfers)', () => {
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  it('creates a transfer and returns 201 with transferAccountId populated', async () => {
    const { id: userId, email } = createTestUser();
    const checking = createAccount(userId, { name: 'Checking' });
    const savings = createAccount(userId, { name: 'Savings' });

    const res = await request(app)
      .post(`/api/accounts/${checking}/transactions`)
      .set('Cookie', makeAuthCookie(userId, email))
      .send({ date: yesterday, amount: 50000, transferAccountId: savings })
      .expect(201);

    const { transaction } = res.body;
    expect(transaction.accountId).toBe(checking);
    expect(transaction.transferAccountId).toBe(savings);
    expect(transaction.transferAccountName).toBe('Savings');
    expect(transaction.linkedTransactionId).toBeTruthy();
    expect(transaction.amount).toBe(-50000);
    expect(transaction.categoryId).toBeNull();
  });

  it('creates a sibling transaction in the target account with opposite amount', async () => {
    const { id: userId, email } = createTestUser();
    const checking = createAccount(userId, { name: 'Checking' });
    const savings = createAccount(userId, { name: 'Savings' });

    const res = await request(app)
      .post(`/api/accounts/${checking}/transactions`)
      .set('Cookie', makeAuthCookie(userId, email))
      .send({ date: yesterday, amount: 50000, transferAccountId: savings })
      .expect(201);

    const siblingId = res.body.transaction.linkedTransactionId;
    const sibRes = await request(app)
      .get(`/api/transactions/${siblingId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(200);

    const sibling = sibRes.body.transaction;
    expect(sibling.accountId).toBe(savings);
    expect(sibling.transferAccountId).toBe(checking);
    expect(sibling.transferAccountName).toBe('Checking');
    expect(sibling.amount).toBe(50000);
    expect(sibling.linkedTransactionId).toBe(res.body.transaction.id);
  });

  it('sets auto-generated payees on both sides of the transfer', async () => {
    const { id: userId, email } = createTestUser();
    const checking = createAccount(userId, { name: 'Checking' });
    const savings = createAccount(userId, { name: 'Savings' });

    const res = await request(app)
      .post(`/api/accounts/${checking}/transactions`)
      .set('Cookie', makeAuthCookie(userId, email))
      .send({ date: yesterday, amount: 50000, transferAccountId: savings })
      .expect(201);

    expect(res.body.transaction.payee).toBe('Transfer to Savings');

    const sibRes = await request(app)
      .get(`/api/transactions/${res.body.transaction.linkedTransactionId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(200);

    expect(sibRes.body.transaction.payee).toBe('Transfer from Checking');
  });

  it('shares memo and isCleared between both sides', async () => {
    const { id: userId, email } = createTestUser();
    const checking = createAccount(userId, { name: 'Checking' });
    const savings = createAccount(userId, { name: 'Savings' });

    const res = await request(app)
      .post(`/api/accounts/${checking}/transactions`)
      .set('Cookie', makeAuthCookie(userId, email))
      .send({ date: yesterday, amount: 50000, transferAccountId: savings, memo: 'Savings deposit', isCleared: true })
      .expect(201);

    const sibRes = await request(app)
      .get(`/api/transactions/${res.body.transaction.linkedTransactionId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(200);

    expect(res.body.transaction.memo).toBe('Savings deposit');
    expect(res.body.transaction.isCleared).toBe(true);
    expect(sibRes.body.transaction.memo).toBe('Savings deposit');
    expect(sibRes.body.transaction.isCleared).toBe(true);
  });

  it('returns 400 when transferAccountId equals source account', async () => {
    const { id: userId, email } = createTestUser();
    const checking = createAccount(userId, { name: 'Checking' });

    await request(app)
      .post(`/api/accounts/${checking}/transactions`)
      .set('Cookie', makeAuthCookie(userId, email))
      .send({ date: yesterday, amount: 50000, transferAccountId: checking })
      .expect(400);
  });

  it('returns 404 when transferAccountId does not exist', async () => {
    const { id: userId, email } = createTestUser();
    const checking = createAccount(userId, { name: 'Checking' });

    await request(app)
      .post(`/api/accounts/${checking}/transactions`)
      .set('Cookie', makeAuthCookie(userId, email))
      .send({ date: yesterday, amount: 50000, transferAccountId: 'non-existent' })
      .expect(404);
  });

  it('returns 404 when transferAccountId belongs to another user', async () => {
    const { id: userId, email } = createTestUser({ email: 'user@test.com' });
    const { id: otherId } = createTestUser({ email: 'other@test.com' });
    const checking = createAccount(userId, { name: 'Checking' });
    const otherAccount = createAccount(otherId, { name: 'Other Savings' });

    await request(app)
      .post(`/api/accounts/${checking}/transactions`)
      .set('Cookie', makeAuthCookie(userId, email))
      .send({ date: yesterday, amount: 50000, transferAccountId: otherAccount })
      .expect(404);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/transactions/:id — Transfer update propagation
// ---------------------------------------------------------------------------

describe('PUT /api/transactions/:id (transfers)', () => {
  const dayBefore = new Date(Date.now() - 172800000).toISOString().split('T')[0];

  it('propagates date change to sibling transaction', async () => {
    const { id: userId, email } = createTestUser();
    const accountA = createAccount(userId, { name: 'Account A' });
    const accountB = createAccount(userId, { name: 'Account B' });
    const { fromTxnId, toTxnId } = createTransfer(userId, accountA, accountB);

    await request(app)
      .put(`/api/transactions/${fromTxnId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .send({ date: dayBefore })
      .expect(200);

    const sibRes = await request(app)
      .get(`/api/transactions/${toTxnId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(200);

    expect(sibRes.body.transaction.date).toBe(dayBefore);
  });

  it('propagates amount change (negated) to sibling transaction', async () => {
    const { id: userId, email } = createTestUser();
    const accountA = createAccount(userId, { name: 'Account A' });
    const accountB = createAccount(userId, { name: 'Account B' });
    const { fromTxnId, toTxnId } = createTransfer(userId, accountA, accountB);

    await request(app)
      .put(`/api/transactions/${fromTxnId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .send({ amount: -75000 })
      .expect(200);

    const sibRes = await request(app)
      .get(`/api/transactions/${toTxnId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(200);

    expect(sibRes.body.transaction.amount).toBe(75000);
  });

  it('propagates memo change to sibling transaction', async () => {
    const { id: userId, email } = createTestUser();
    const accountA = createAccount(userId, { name: 'Account A' });
    const accountB = createAccount(userId, { name: 'Account B' });
    const { fromTxnId, toTxnId } = createTransfer(userId, accountA, accountB);

    await request(app)
      .put(`/api/transactions/${fromTxnId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .send({ memo: 'Shared note' })
      .expect(200);

    const sibRes = await request(app)
      .get(`/api/transactions/${toTxnId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(200);

    expect(sibRes.body.transaction.memo).toBe('Shared note');
  });

  it('propagates isCleared change to sibling transaction', async () => {
    const { id: userId, email } = createTestUser();
    const accountA = createAccount(userId, { name: 'Account A' });
    const accountB = createAccount(userId, { name: 'Account B' });
    const { fromTxnId, toTxnId } = createTransfer(userId, accountA, accountB);

    await request(app)
      .put(`/api/transactions/${fromTxnId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .send({ isCleared: true })
      .expect(200);

    const sibRes = await request(app)
      .get(`/api/transactions/${toTxnId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(200);

    expect(sibRes.body.transaction.isCleared).toBe(true);
  });

  it('returns 422 CLEARED_TRANSFER_IMMUTABLE when updating date on a cleared transfer', async () => {
    const { id: userId, email } = createTestUser();
    const accountA = createAccount(userId, { name: 'Account A' });
    const accountB = createAccount(userId, { name: 'Account B' });
    const { fromTxnId } = createTransfer(userId, accountA, accountB);

    await request(app)
      .put(`/api/transactions/${fromTxnId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .send({ isCleared: true })
      .expect(200);

    const res = await request(app)
      .put(`/api/transactions/${fromTxnId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .send({ date: dayBefore })
      .expect(422);

    expect(res.body.error.code).toBe('CLEARED_TRANSFER_IMMUTABLE');
  });

  it('returns 422 CLEARED_TRANSFER_IMMUTABLE when updating amount on a cleared transfer', async () => {
    const { id: userId, email } = createTestUser();
    const accountA = createAccount(userId, { name: 'Account A' });
    const accountB = createAccount(userId, { name: 'Account B' });
    const { fromTxnId } = createTransfer(userId, accountA, accountB);

    await request(app)
      .put(`/api/transactions/${fromTxnId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .send({ isCleared: true })
      .expect(200);

    const res = await request(app)
      .put(`/api/transactions/${fromTxnId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .send({ amount: -1 })
      .expect(422);

    expect(res.body.error.code).toBe('CLEARED_TRANSFER_IMMUTABLE');
  });

  it('can still update memo on a cleared transfer', async () => {
    const { id: userId, email } = createTestUser();
    const accountA = createAccount(userId, { name: 'Account A' });
    const accountB = createAccount(userId, { name: 'Account B' });
    const { fromTxnId } = createTransfer(userId, accountA, accountB);

    await request(app)
      .put(`/api/transactions/${fromTxnId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .send({ isCleared: true })
      .expect(200);

    const res = await request(app)
      .put(`/api/transactions/${fromTxnId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .send({ memo: 'Updated on cleared transfer' })
      .expect(200);

    expect(res.body.transaction.memo).toBe('Updated on cleared transfer');
  });

  it('returns 400 when setting categoryId on a transfer transaction', async () => {
    const { id: userId, email } = createTestUser();
    const accountA = createAccount(userId, { name: 'Account A' });
    const accountB = createAccount(userId, { name: 'Account B' });
    const categoryId = createCategory(userId);
    const { fromTxnId } = createTransfer(userId, accountA, accountB);

    await request(app)
      .put(`/api/transactions/${fromTxnId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .send({ categoryId })
      .expect(400);
  });
});
