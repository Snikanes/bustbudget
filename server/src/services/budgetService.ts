import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/index.js';
import { BudgetMonth, BudgetEntry, MonthlyBudget, MonthlyBudgetRow } from '../models/types.js';
import { NotFoundError } from '../middleware/errorHandler.js';
import * as categoryTargetService from './categoryTargetService.js';

interface CategoryBudgetRow {
  category_id: string;
  category_name: string;
  group_id: string | null;
  group_name: string | null;
  group_sort_order: number | null;
  category_sort_order: number;
  assigned_this_month: number;
  activity_this_month: number;
  cumulative_assigned: number;
  cumulative_activity: number;
}

export function getBudgetForMonth(userId: string, month: string): BudgetMonth {
  const db = getDb();

  // Get all categories with their budget data
  const rows = db.prepare(`
    WITH monthly_assigned AS (
      SELECT category_id, assigned_amount
      FROM monthly_budget
      WHERE user_id = ? AND year_month = ?
    ),
    monthly_activity AS (
      SELECT category_id, COALESCE(SUM(amount), 0) as activity
      FROM "transaction"
      WHERE user_id = ?
        AND category_id IS NOT NULL
        AND substr(date, 1, 7) = ?
        AND transfer_id IS NULL
      GROUP BY category_id
    ),
    cumulative_assigned AS (
      SELECT category_id, COALESCE(SUM(assigned_amount), 0) as total
      FROM monthly_budget
      WHERE user_id = ? AND year_month <= ?
      GROUP BY category_id
    ),
    cumulative_activity AS (
      SELECT category_id, COALESCE(SUM(amount), 0) as total
      FROM "transaction"
      WHERE user_id = ?
        AND category_id IS NOT NULL
        AND substr(date, 1, 7) <= ?
        AND transfer_id IS NULL
      GROUP BY category_id
    )
    SELECT
      c.id as category_id,
      c.name as category_name,
      c.group_id,
      cg.name as group_name,
      cg.sort_order as group_sort_order,
      c.sort_order as category_sort_order,
      COALESCE(ma.assigned_amount, 0) as assigned_this_month,
      COALESCE(mact.activity, 0) as activity_this_month,
      COALESCE(ca.total, 0) as cumulative_assigned,
      COALESCE(cact.total, 0) as cumulative_activity
    FROM category c
    LEFT JOIN category_group cg ON cg.id = c.group_id
    LEFT JOIN monthly_assigned ma ON ma.category_id = c.id
    LEFT JOIN monthly_activity mact ON mact.category_id = c.id
    LEFT JOIN cumulative_assigned ca ON ca.category_id = c.id
    LEFT JOIN cumulative_activity cact ON cact.category_id = c.id
    WHERE c.user_id = ?
    ORDER BY
      CASE WHEN c.group_id IS NULL THEN 1 ELSE 0 END,
      cg.sort_order,
      cg.name,
      c.sort_order,
      c.name
  `).all(userId, month, userId, month, userId, month, userId, month, userId) as CategoryBudgetRow[];

  // Calculate total inflows (income to budget)
  // Income = positive transactions that are NOT transfers and NOT starting balances with categories
  // Only count UNCATEGORIZED inflows - categorized inflows (e.g., refunds) go directly to category activity
  const inflowsResult = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM "transaction"
    WHERE user_id = ?
      AND amount > 0
      AND transfer_id IS NULL
      AND is_starting_balance = 0
      AND category_id IS NULL
      AND substr(date, 1, 7) <= ?
  `).get(userId, month) as { total: number };

  // Also include starting balances as inflows
  const startingBalancesResult = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM "transaction"
    WHERE user_id = ?
      AND is_starting_balance = 1
      AND substr(date, 1, 7) <= ?
  `).get(userId, month) as { total: number };

  const totalInflows = inflowsResult.total + startingBalancesResult.total;

  // Calculate total assigned (all time through this month)
  const totalAssignedResult = db.prepare(`
    SELECT COALESCE(SUM(assigned_amount), 0) as total
    FROM monthly_budget
    WHERE user_id = ? AND year_month <= ?
  `).get(userId, month) as { total: number };

  const totalAssigned = totalAssignedResult.total;

  // Calculate Available to Assign
  const availableToAssign = totalInflows - totalAssigned;

  // Get targets for all categories
  const categoryIds = rows.map(r => r.category_id);
  const targetsMap = categoryTargetService.getTargetsForCategories(userId, categoryIds);

  // Group the categories
  const groupsMap = new Map<string, {
    id: string;
    name: string;
    sortOrder: number;
    categories: BudgetEntry[];
  }>();
  const ungroupedCategories: BudgetEntry[] = [];

  for (const row of rows) {
    const target = targetsMap.get(row.category_id);
    const entry: BudgetEntry = {
      categoryId: row.category_id,
      categoryName: row.category_name,
      groupId: row.group_id,
      groupName: row.group_name,
      assigned: row.assigned_this_month,
      activity: row.activity_this_month,
      available: row.cumulative_assigned + row.cumulative_activity,
      target: target ?? null,
    };

    if (row.group_id) {
      if (!groupsMap.has(row.group_id)) {
        groupsMap.set(row.group_id, {
          id: row.group_id,
          name: row.group_name!,
          sortOrder: row.group_sort_order!,
          categories: [],
        });
      }
      groupsMap.get(row.group_id)!.categories.push(entry);
    } else {
      ungroupedCategories.push(entry);
    }
  }

  const groups = Array.from(groupsMap.values()).sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.name.localeCompare(b.name);
  });

  return {
    month,
    availableToAssign,
    totalInflows,
    totalAssigned,
    groups,
    ungroupedCategories,
  };
}

export function updateBudgetEntry(
  userId: string,
  month: string,
  categoryId: string,
  assigned: number
): MonthlyBudget {
  const db = getDb();

  // Validate category exists and belongs to user
  const category = db.prepare('SELECT id FROM category WHERE user_id = ? AND id = ?').get(userId, categoryId);
  if (!category) {
    throw new NotFoundError('Category', categoryId);
  }

  // Check if entry exists
  const existing = db.prepare(`
    SELECT * FROM monthly_budget WHERE user_id = ? AND category_id = ? AND year_month = ?
  `).get(userId, categoryId, month) as MonthlyBudgetRow | undefined;

  const now = new Date().toISOString();

  if (existing) {
    db.prepare(`
      UPDATE monthly_budget SET assigned_amount = ? WHERE user_id = ? AND id = ?
    `).run(assigned, userId, existing.id);

    return {
      id: existing.id,
      categoryId: existing.category_id,
      yearMonth: existing.year_month,
      assignedAmount: assigned,
      createdAt: existing.created_at,
      updatedAt: now,
    };
  } else {
    const id = uuidv4();
    db.prepare(`
      INSERT INTO monthly_budget (id, user_id, category_id, year_month, assigned_amount, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, userId, categoryId, month, assigned, now, now);

    return {
      id,
      categoryId,
      yearMonth: month,
      assignedAmount: assigned,
      createdAt: now,
      updatedAt: now,
    };
  }
}

export function getAvailableToAssign(userId: string, month: string): {
  availableToAssign: number;
  breakdown: {
    totalInflows: number;
    totalAssigned: number;
    overspending: number;
  };
} {
  const db = getDb();

  // Total inflows up to this month
  // Only count UNCATEGORIZED inflows - categorized inflows (e.g., refunds) go directly to category activity
  const inflowsResult = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM "transaction"
    WHERE user_id = ?
      AND amount > 0
      AND transfer_id IS NULL
      AND is_starting_balance = 0
      AND category_id IS NULL
      AND substr(date, 1, 7) <= ?
  `).get(userId, month) as { total: number };

  const startingBalancesResult = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM "transaction"
    WHERE user_id = ?
      AND is_starting_balance = 1
      AND substr(date, 1, 7) <= ?
  `).get(userId, month) as { total: number };

  const totalInflows = inflowsResult.total + startingBalancesResult.total;

  // Total assigned (all time - future assignments reduce current available)
  const totalAssignedResult = db.prepare(`
    SELECT COALESCE(SUM(assigned_amount), 0) as total
    FROM monthly_budget
    WHERE user_id = ?
  `).get(userId) as { total: number };

  const totalAssigned = totalAssignedResult.total;

  // Calculate overspending (negative category balances through this month)
  const overspendingResult = db.prepare(`
    WITH category_balances AS (
      SELECT
        c.id,
        COALESCE(assigned.total, 0) + COALESCE(activity.total, 0) as balance
      FROM category c
      LEFT JOIN (
        SELECT category_id, SUM(assigned_amount) as total
        FROM monthly_budget
        WHERE user_id = ? AND year_month <= ?
        GROUP BY category_id
      ) assigned ON assigned.category_id = c.id
      LEFT JOIN (
        SELECT category_id, SUM(amount) as total
        FROM "transaction"
        WHERE user_id = ?
          AND category_id IS NOT NULL
          AND transfer_id IS NULL
          AND substr(date, 1, 7) <= ?
        GROUP BY category_id
      ) activity ON activity.category_id = c.id
      WHERE c.user_id = ?
    )
    SELECT COALESCE(SUM(CASE WHEN balance < 0 THEN balance ELSE 0 END), 0) as total
    FROM category_balances
  `).get(userId, month, userId, month, userId) as { total: number };

  const overspending = overspendingResult.total;

  // Available to Assign includes overspending deduction
  const availableToAssign = totalInflows - totalAssigned + overspending;

  return {
    availableToAssign,
    breakdown: {
      totalInflows,
      totalAssigned,
      overspending,
    },
  };
}
