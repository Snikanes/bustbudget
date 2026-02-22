import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import { createTestUser } from '../helpers/db.js';
import { makeAuthCookie } from '../helpers/auth.js';
import {
  createAccount,
  createCategory,
  createCategoryGroup,
  createTransaction,
  createTransfer,
  createMonthlyBudget,
  createCategoryTarget,
} from '../helpers/fixtures.js';

describe('GET /api/budgets/:month', () => {
  it('returns 401 when no auth cookie is present', async () => {
    await request(app).get('/api/budgets/2026-01').expect(401);
  });

  it('returns 401 when the auth cookie contains an invalid JWT', async () => {
    await request(app)
      .get('/api/budgets/2026-01')
      .set('Cookie', 'access_token=invalid.token.here')
      .expect(401);
  });

  it('returns a fully zeroed budget when the user has no data at all', async () => {
    const { id: userId, email } = createTestUser();

    const res = await request(app)
      .get('/api/budgets/2026-01')
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(200);

    const body = res.body;
    expect(body.month).toBe('2026-01');
    expect(body.availableToAssign).toBe(0);
    expect(body.totalInflows).toBe(0);
    expect(body.totalAssigned).toBe(0);
    expect(body.overspending).toBe(0);
    expect(body.groups).toEqual([]);
    expect(body.ungroupedCategories).toEqual([]);
  });

  it('a category with no assignments and no activity appears with assigned=0, activity=0, available=0', async () => {
    const { id: userId, email } = createTestUser();
    createCategory(userId, { name: 'Empty Cat' });

    const res = await request(app)
      .get('/api/budgets/2026-01')
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(200);

    const entry = res.body.ungroupedCategories[0];
    expect(entry).toBeDefined();
    expect(entry.categoryName).toBe('Empty Cat');
    expect(entry.assigned).toBe(0);
    expect(entry.activity).toBe(0);
    expect(entry.available).toBe(0);
  });

  it('response contains all top-level fields', async () => {
    const { id: userId, email } = createTestUser();

    const res = await request(app)
      .get('/api/budgets/2026-01')
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(200);

    const body = res.body;
    expect(body).toHaveProperty('month');
    expect(body).toHaveProperty('availableToAssign');
    expect(body).toHaveProperty('totalInflows');
    expect(body).toHaveProperty('totalAssigned');
    expect(body).toHaveProperty('overspending');
    expect(body).toHaveProperty('groups');
    expect(body).toHaveProperty('ungroupedCategories');
  });

  it('a category assigned to a group appears in groups[n].categories, not in ungroupedCategories', async () => {
    const { id: userId, email } = createTestUser();
    const groupId = createCategoryGroup(userId, { name: 'Fixed' });
    const catId = createCategory(userId, { name: 'Rent', groupId });

    const res = await request(app)
      .get('/api/budgets/2026-01')
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(200);

    expect(res.body.ungroupedCategories).toHaveLength(0);
    expect(res.body.groups).toHaveLength(1);
    const group = res.body.groups[0];
    expect(group.id).toBe(groupId);
    expect(group.categories).toHaveLength(1);
    expect(group.categories[0].categoryId).toBe(catId);
  });

  it('a category with no group appears in ungroupedCategories, not in groups', async () => {
    const { id: userId, email } = createTestUser();
    const catId = createCategory(userId, { name: 'Misc' });

    const res = await request(app)
      .get('/api/budgets/2026-01')
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(200);

    expect(res.body.groups).toHaveLength(0);
    expect(res.body.ungroupedCategories).toHaveLength(1);
    expect(res.body.ungroupedCategories[0].categoryId).toBe(catId);
  });

  it('groups are ordered by sort_order ascending', async () => {
    const { id: userId, email } = createTestUser();
    const g1 = createCategoryGroup(userId, { name: 'Savings', sortOrder: 10 });
    const g2 = createCategoryGroup(userId, { name: 'Fixed', sortOrder: 1 });
    const g3 = createCategoryGroup(userId, { name: 'Flex', sortOrder: 5 });
    createCategory(userId, { groupId: g1 });
    createCategory(userId, { groupId: g2 });
    createCategory(userId, { groupId: g3 });

    const res = await request(app)
      .get('/api/budgets/2026-01')
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(200);

    const names = res.body.groups.map((g: { name: string }) => g.name);
    expect(names).toEqual(['Fixed', 'Flex', 'Savings']);
  });

  it('two groups with the same sort_order are ordered alphabetically by name', async () => {
    const { id: userId, email } = createTestUser();
    const g1 = createCategoryGroup(userId, { name: 'Zeta', sortOrder: 0 });
    const g2 = createCategoryGroup(userId, { name: 'Alpha', sortOrder: 0 });
    createCategory(userId, { groupId: g1 });
    createCategory(userId, { groupId: g2 });

    const res = await request(app)
      .get('/api/budgets/2026-01')
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(200);

    const names = res.body.groups.map((g: { name: string }) => g.name);
    expect(names).toEqual(['Alpha', 'Zeta']);
  });

  it('a category with a target has the target object populated on its BudgetEntry', async () => {
    const { id: userId, email } = createTestUser();
    const catId = createCategory(userId, { name: 'Groceries' });
    createCategoryTarget(userId, catId, { targetType: 'monthly', targetAmount: 5000 });

    const res = await request(app)
      .get('/api/budgets/2026-01')
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(200);

    const entry = res.body.ungroupedCategories[0];
    expect(entry.target).not.toBeNull();
    expect(entry.target.categoryId).toBe(catId);
    expect(entry.target.targetType).toBe('monthly');
    expect(entry.target.targetAmount).toBe(5000);
  });

  it('a category without a target has target: null on its BudgetEntry', async () => {
    const { id: userId, email } = createTestUser();
    createCategory(userId, { name: 'Groceries' });

    const res = await request(app)
      .get('/api/budgets/2026-01')
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(200);

    const entry = res.body.ungroupedCategories[0];
    expect(entry.target).toBeNull();
  });

  it('a positive starting balance counts as inflow', async () => {
    const { id: userId, email } = createTestUser();
    const accountId = createAccount(userId);
    createTransaction(userId, accountId, {
      amount: 100000,
      date: '2026-01-01',
      isStartingBalance: true,
      isCleared: 1,
    });

    const res = await request(app)
      .get('/api/budgets/2026-01')
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(200);

    expect(res.body.totalInflows).toBe(100000);
  });

  it('a negative starting balance counts as inflow (subtracts from totalInflows)', async () => {
    const { id: userId, email } = createTestUser();
    const accountId = createAccount(userId);
    createTransaction(userId, accountId, {
      amount: -50000,
      date: '2026-01-01',
      isStartingBalance: true,
      isCleared: 1,
    });

    const res = await request(app)
      .get('/api/budgets/2026-01')
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(200);

    expect(res.body.totalInflows).toBe(-50000);
  });

  it('an uncategorized positive transaction counts as inflow', async () => {
    const { id: userId, email } = createTestUser();
    const accountId = createAccount(userId);
    createTransaction(userId, accountId, {
      amount: 80000,
      date: '2026-01-15',
      categoryId: null,
    });

    const res = await request(app)
      .get('/api/budgets/2026-01')
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(200);

    expect(res.body.totalInflows).toBe(80000);
  });

  it('a categorized positive transaction does NOT count as inflow', async () => {
    const { id: userId, email } = createTestUser();
    const accountId = createAccount(userId);
    const catId = createCategory(userId);
    createTransaction(userId, accountId, {
      amount: 30000,
      date: '2026-01-15',
      categoryId: catId,
    });

    const res = await request(app)
      .get('/api/budgets/2026-01')
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(200);

    expect(res.body.totalInflows).toBe(0);
  });

  it('a transfer inflow does NOT count as inflow', async () => {
    const { id: userId, email } = createTestUser();
    const accountA = createAccount(userId, { name: 'Checking' });
    const accountB = createAccount(userId, { name: 'Savings' });
    createTransfer(userId, accountA, accountB, { amount: 50000, date: '2026-01-15' });

    const res = await request(app)
      .get('/api/budgets/2026-01')
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(200);

    expect(res.body.totalInflows).toBe(0);
  });

  it('a negative uncategorized transaction does NOT count as inflow', async () => {
    const { id: userId, email } = createTestUser();
    const accountId = createAccount(userId);
    createTransaction(userId, accountId, {
      amount: -20000,
      date: '2026-01-15',
      categoryId: null,
    });

    const res = await request(app)
      .get('/api/budgets/2026-01')
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(200);

    expect(res.body.totalInflows).toBe(0);
  });

  it('transactions dated after the target month are NOT included in totalInflows', async () => {
    const { id: userId, email } = createTestUser();
    const accountId = createAccount(userId);
    createTransaction(userId, accountId, {
      amount: 50000,
      date: '2026-02-01',
      categoryId: null,
    });

    const res = await request(app)
      .get('/api/budgets/2026-01')
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(200);

    expect(res.body.totalInflows).toBe(0);
  });

  it('totalInflows = starting_balance + uncategorized_income when both are present', async () => {
    const { id: userId, email } = createTestUser();
    const accountId = createAccount(userId);
    createTransaction(userId, accountId, {
      amount: 100000,
      date: '2026-01-01',
      isStartingBalance: true,
      isCleared: 1,
    });
    createTransaction(userId, accountId, {
      amount: 40000,
      date: '2026-01-15',
      categoryId: null,
    });

    const res = await request(app)
      .get('/api/budgets/2026-01')
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(200);

    expect(res.body.totalInflows).toBe(140000);
  });

  it('totalAssigned is the sum of all monthly_budget rows for months ≤ target month', async () => {
    const { id: userId, email } = createTestUser();
    const catId = createCategory(userId);
    createMonthlyBudget(userId, catId, '2025-12', 20000);
    createMonthlyBudget(userId, catId, '2026-01', 30000);

    const res = await request(app)
      .get('/api/budgets/2026-01')
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(200);

    expect(res.body.totalAssigned).toBe(50000);
  });

  it('an assignment in a month after the target month is NOT included in totalAssigned', async () => {
    const { id: userId, email } = createTestUser();
    const catId = createCategory(userId);
    createMonthlyBudget(userId, catId, '2026-01', 10000);
    createMonthlyBudget(userId, catId, '2026-02', 15000);

    const res = await request(app)
      .get('/api/budgets/2026-01')
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(200);

    expect(res.body.totalAssigned).toBe(10000);
  });

  it('the assigned field on a BudgetEntry shows only the assignment for the target month, not cumulative', async () => {
    const { id: userId, email } = createTestUser();
    const catId = createCategory(userId, { name: 'Food' });
    createMonthlyBudget(userId, catId, '2025-12', 20000);
    createMonthlyBudget(userId, catId, '2026-01', 30000);

    const res = await request(app)
      .get('/api/budgets/2026-01')
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(200);

    const entry = res.body.ungroupedCategories[0];
    expect(entry.categoryName).toBe('Food');
    expect(entry.assigned).toBe(30000);
  });

  it('a spending transaction (negative) on a category shows as negative activity', async () => {
    const { id: userId, email } = createTestUser();
    const accountId = createAccount(userId);
    const catId = createCategory(userId, { name: 'Groceries' });
    createTransaction(userId, accountId, {
      amount: -12000,
      date: '2026-01-10',
      categoryId: catId,
    });

    const res = await request(app)
      .get('/api/budgets/2026-01')
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(200);

    const entry = res.body.ungroupedCategories[0];
    expect(entry.activity).toBe(-12000);
  });

  it('a positive categorized transaction (refund) shows as positive activity', async () => {
    const { id: userId, email } = createTestUser();
    const accountId = createAccount(userId);
    const catId = createCategory(userId, { name: 'Groceries' });
    createTransaction(userId, accountId, {
      amount: 5000,
      date: '2026-01-10',
      categoryId: catId,
    });

    const res = await request(app)
      .get('/api/budgets/2026-01')
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(200);

    const entry = res.body.ungroupedCategories[0];
    expect(entry.activity).toBe(5000);
  });

  it('a transfer transaction is excluded from category activity', async () => {
    const { id: userId, email } = createTestUser();
    const accountA = createAccount(userId, { name: 'Checking' });
    const accountB = createAccount(userId, { name: 'Savings' });
    createCategory(userId, { name: 'Savings Cat' });
    createTransfer(userId, accountA, accountB, { amount: 30000, date: '2026-01-15' });

    const res = await request(app)
      .get('/api/budgets/2026-01')
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(200);

    const entry = res.body.ungroupedCategories[0];
    expect(entry.activity).toBe(0);
  });

  it('a categorized transaction dated after the target month is NOT counted in activity', async () => {
    const { id: userId, email } = createTestUser();
    const accountId = createAccount(userId);
    const catId = createCategory(userId, { name: 'Food' });
    createTransaction(userId, accountId, {
      amount: -8000,
      date: '2026-02-01',
      categoryId: catId,
    });

    const res = await request(app)
      .get('/api/budgets/2026-01')
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(200);

    const entry = res.body.ungroupedCategories[0];
    expect(entry.activity).toBe(0);
  });

  it('activity is the sum of all categorized transactions for that category in the target month', async () => {
    const { id: userId, email } = createTestUser();
    const accountId = createAccount(userId);
    const catId = createCategory(userId, { name: 'Food' });
    createTransaction(userId, accountId, { amount: -5000, date: '2026-01-05', categoryId: catId });
    createTransaction(userId, accountId, { amount: -3000, date: '2026-01-10', categoryId: catId });
    createTransaction(userId, accountId, { amount: 1000, date: '2026-01-20', categoryId: catId });

    const res = await request(app)
      .get('/api/budgets/2026-01')
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(200);

    const entry = res.body.ungroupedCategories[0];
    expect(entry.activity).toBe(-7000);
  });

  it('available = assigned + activity when there is only one month of data', async () => {
    const { id: userId, email } = createTestUser();
    const accountId = createAccount(userId);
    const catId = createCategory(userId, { name: 'Food' });
    createMonthlyBudget(userId, catId, '2026-01', 10000);
    createTransaction(userId, accountId, { amount: -3000, date: '2026-01-10', categoryId: catId });

    const res = await request(app)
      .get('/api/budgets/2026-01')
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(200);

    const entry = res.body.ungroupedCategories[0];
    expect(entry.assigned).toBe(10000);
    expect(entry.activity).toBe(-3000);
    expect(entry.available).toBe(7000);
  });

  it('a positive category balance from a prior month carries forward', async () => {
    const { id: userId, email } = createTestUser();
    const accountId = createAccount(userId);
    const catId = createCategory(userId, { name: 'Savings' });
    createMonthlyBudget(userId, catId, '2026-01', 5000);
    createTransaction(userId, accountId, { amount: -2000, date: '2026-01-15', categoryId: catId });

    const res = await request(app)
      .get('/api/budgets/2026-02')
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(200);

    const entry = res.body.ungroupedCategories[0];
    expect(entry.available).toBe(3000);
  });

  it('a category with a positive prior balance but zero assignment/activity shows the carried-forward balance', async () => {
    const { id: userId, email } = createTestUser();
    const catId = createCategory(userId, { name: 'Vacation' });
    createMonthlyBudget(userId, catId, '2026-01', 20000);

    const res = await request(app)
      .get('/api/budgets/2026-02')
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(200);

    const entry = res.body.ungroupedCategories[0];
    expect(entry.assigned).toBe(0);
    expect(entry.activity).toBe(0);
    expect(entry.available).toBe(20000);
  });

  it('a category negative at end of month 1 resets to 0 at month 2 boundary', async () => {
    const { id: userId, email } = createTestUser();
    const accountId = createAccount(userId);
    const catId = createCategory(userId, { name: 'Food' });
    createTransaction(userId, accountId, { amount: -5000, date: '2026-01-15', categoryId: catId });

    const res = await request(app)
      .get('/api/budgets/2026-02')
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(200);

    const entry = res.body.ungroupedCategories[0];
    expect(entry.available).toBe(0);
  });

  it('the reset amount is added to overspending in the response', async () => {
    const { id: userId, email } = createTestUser();
    const accountId = createAccount(userId);
    const catId = createCategory(userId, { name: 'Food' });
    createTransaction(userId, accountId, { amount: -5000, date: '2026-01-15', categoryId: catId });

    const res = await request(app)
      .get('/api/budgets/2026-02')
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(200);

    expect(res.body.overspending).toBe(5000);
  });

  it('availableToAssign is reduced by overspending', async () => {
    const { id: userId, email } = createTestUser();
    const accountId = createAccount(userId);
    const catId = createCategory(userId, { name: 'Food' });
    createTransaction(userId, accountId, {
      amount: 10000,
      date: '2026-01-01',
      isStartingBalance: true,
      isCleared: 1,
    });
    createTransaction(userId, accountId, { amount: -4000, date: '2026-01-15', categoryId: catId });

    const res = await request(app)
      .get('/api/budgets/2026-02')
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(200);

    expect(res.body.overspending).toBe(4000);
    expect(res.body.availableToAssign).toBe(6000);
  });

  it('overspending in the current (target) month shows as negative available on the category entry', async () => {
    const { id: userId, email } = createTestUser();
    const accountId = createAccount(userId);
    const catId = createCategory(userId, { name: 'Food' });
    createMonthlyBudget(userId, catId, '2026-01', 2000);
    createTransaction(userId, accountId, { amount: -5000, date: '2026-01-15', categoryId: catId });

    const res = await request(app)
      .get('/api/budgets/2026-01')
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(200);

    const entry = res.body.ungroupedCategories[0];
    expect(entry.available).toBe(-3000);
  });

  it('overspending in the current month does NOT appear in the overspending field', async () => {
    const { id: userId, email } = createTestUser();
    const accountId = createAccount(userId);
    const catId = createCategory(userId, { name: 'Food' });
    createTransaction(userId, accountId, { amount: -5000, date: '2026-01-15', categoryId: catId });

    const res = await request(app)
      .get('/api/budgets/2026-01')
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(200);

    expect(res.body.overspending).toBe(0);
  });

  it('overspending in the current month does NOT reduce availableToAssign', async () => {
    const { id: userId, email } = createTestUser();
    const accountId = createAccount(userId);
    const catId = createCategory(userId, { name: 'Food' });
    createTransaction(userId, accountId, {
      amount: 10000,
      date: '2026-01-01',
      isStartingBalance: true,
      isCleared: 1,
    });
    createTransaction(userId, accountId, { amount: -5000, date: '2026-01-15', categoryId: catId });

    const res = await request(app)
      .get('/api/budgets/2026-01')
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(200);

    expect(res.body.overspending).toBe(0);
    expect(res.body.availableToAssign).toBe(10000);
  });

  it('two categories both overspent in a prior month: overspending = sum of both reset amounts', async () => {
    const { id: userId, email } = createTestUser();
    const accountId = createAccount(userId);
    const catA = createCategory(userId, { name: 'Food' });
    const catB = createCategory(userId, { name: 'Transport' });
    createTransaction(userId, accountId, { amount: -3000, date: '2026-01-10', categoryId: catA });
    createTransaction(userId, accountId, { amount: -2000, date: '2026-01-20', categoryId: catB });

    const res = await request(app)
      .get('/api/budgets/2026-02')
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(200);

    expect(res.body.overspending).toBe(5000);
  });

  it('overspending from two or more months ago still counts in overspending', async () => {
    const { id: userId, email } = createTestUser();
    const accountId = createAccount(userId);
    const catId = createCategory(userId, { name: 'Food' });
    createTransaction(userId, accountId, { amount: -3000, date: '2026-01-10', categoryId: catId });
    createMonthlyBudget(userId, catId, '2026-02', 3000);

    const res = await request(app)
      .get('/api/budgets/2026-03')
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(200);

    expect(res.body.overspending).toBe(3000);
  });

  it('budget for user A does not include categories, assignments, or transactions from user B', async () => {
    const { id: userA, email: emailA } = createTestUser({ email: 'userA@test.com' });
    const { id: userB } = createTestUser({ email: 'userB@test.com' });
    const accountB = createAccount(userB);
    const catB = createCategory(userB, { name: 'B Category' });
    createMonthlyBudget(userB, catB, '2026-01', 50000);
    createTransaction(userB, accountB, {
      amount: 100000,
      date: '2026-01-01',
      isStartingBalance: true,
      isCleared: 1,
    });

    const res = await request(app)
      .get('/api/budgets/2026-01')
      .set('Cookie', makeAuthCookie(userA, emailA))
      .expect(200);

    expect(res.body.totalInflows).toBe(0);
    expect(res.body.totalAssigned).toBe(0);
    expect(res.body.groups).toEqual([]);
    expect(res.body.ungroupedCategories).toEqual([]);
  });
});

describe('PUT /api/budgets/:month/categories/:categoryId', () => {
  it('returns 401 when no auth cookie is present', async () => {
    const { id: userId } = createTestUser();
    const catId = createCategory(userId);

    await request(app)
      .put(`/api/budgets/2026-01/categories/${catId}`)
      .send({ assigned: 10000 })
      .expect(401);
  });

  it('creates a new monthly_budget row when none exists; returns 200 with correct shape', async () => {
    const { id: userId, email } = createTestUser();
    const catId = createCategory(userId, { name: 'Rent' });

    const res = await request(app)
      .put(`/api/budgets/2026-01/categories/${catId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .send({ assigned: 15000 })
      .expect(200);

    const mb = res.body.monthlyBudget;
    expect(mb).toBeDefined();
    expect(mb.id).toBeTruthy();
    expect(mb.categoryId).toBe(catId);
    expect(mb.yearMonth).toBe('2026-01');
    expect(mb.assignedAmount).toBe(15000);
  });

  it('assigning 0 is valid; returns 200', async () => {
    const { id: userId, email } = createTestUser();
    const catId = createCategory(userId);

    const res = await request(app)
      .put(`/api/budgets/2026-01/categories/${catId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .send({ assigned: 0 })
      .expect(200);

    expect(res.body.monthlyBudget.assignedAmount).toBe(0);
  });

  it('when a row already exists it is updated, not duplicated; returned id matches the original', async () => {
    const { id: userId, email } = createTestUser();
    const catId = createCategory(userId);
    const originalId = createMonthlyBudget(userId, catId, '2026-01', 5000);

    const res = await request(app)
      .put(`/api/budgets/2026-01/categories/${catId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .send({ assigned: 8000 })
      .expect(200);

    const mb = res.body.monthlyBudget;
    expect(mb.id).toBe(originalId);
    expect(mb.assignedAmount).toBe(8000);
  });

  it('after a PUT, GET for the same month reflects the new assigned value', async () => {
    const { id: userId, email } = createTestUser();
    const catId = createCategory(userId, { name: 'Groceries' });

    await request(app)
      .put(`/api/budgets/2026-01/categories/${catId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .send({ assigned: 12000 })
      .expect(200);

    const res = await request(app)
      .get('/api/budgets/2026-01')
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(200);

    const entry = res.body.ungroupedCategories[0];
    expect(entry.categoryName).toBe('Groceries');
    expect(entry.assigned).toBe(12000);
  });

  it('after a PUT, totalAssigned in the GET response increases by the assigned amount', async () => {
    const { id: userId, email } = createTestUser();
    const catId = createCategory(userId);

    await request(app)
      .put(`/api/budgets/2026-01/categories/${catId}`)
      .set('Cookie', makeAuthCookie(userId, email))
      .send({ assigned: 7500 })
      .expect(200);

    const res = await request(app)
      .get('/api/budgets/2026-01')
      .set('Cookie', makeAuthCookie(userId, email))
      .expect(200);

    expect(res.body.totalAssigned).toBe(7500);
  });

  it('returns 404 when the categoryId does not exist', async () => {
    const { id: userId, email } = createTestUser();

    await request(app)
      .put('/api/budgets/2026-01/categories/non-existent-id')
      .set('Cookie', makeAuthCookie(userId, email))
      .send({ assigned: 5000 })
      .expect(404);
  });

  it('returns 404 when the categoryId belongs to a different user', async () => {
    const { id: userA, email: emailA } = createTestUser({ email: 'userA@test.com' });
    const { id: userB } = createTestUser({ email: 'userB@test.com' });
    const catB = createCategory(userB, { name: 'B Cat' });

    await request(app)
      .put(`/api/budgets/2026-01/categories/${catB}`)
      .set('Cookie', makeAuthCookie(userA, emailA))
      .send({ assigned: 5000 })
      .expect(404);
  });
});
