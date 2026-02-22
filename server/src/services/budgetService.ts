import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/index.js';
import { BudgetMonth, BudgetEntry, MonthlyBudget, MonthlyBudgetRow } from '../models/types.js';
import { NotFoundError } from '../middleware/errorHandler.js';
import * as categoryTargetService from './categoryTargetService.js';

interface CategoryMetadataRow {
  category_id: string;
  category_name: string;
  group_id: string | null;
  group_name: string | null;
  group_sort_order: number | null;
  category_sort_order: number;
}

interface AssignedRow {
  category_id: string;
  year_month: string;
  assigned_amount: number;
}

interface ActivityRow {
  category_id: string;
  year_month: string;
  activity: number;
}

/**
 * Generates a contiguous list of YYYY-MM strings from earliest to target (inclusive).
 */
function getMonthRange(earliest: string, target: string): string[] {
  const months: string[] = [];
  const [startYear, startMonth] = earliest.split('-').map(Number);
  const [endYear, endMonth] = target.split('-').map(Number);

  let y = startYear;
  let m = startMonth;
  while (y < endYear || (y === endYear && m <= endMonth)) {
    months.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return months;
}

interface ComputedBudgetData {
  /** Per-category final balance (available) for the target month */
  balances: Map<string, number>;
  /** Per-category assigned amount for the target month */
  assigned: Map<string, number>;
  /** Per-category activity for the target month */
  activity: Map<string, number>;
  /** Cumulative overspending deducted from RTA (sum of all month-boundary resets before target month) */
  cumulativeOverspending: number;
}

/**
 * Iterates month-by-month from the earliest data month to the target month,
 * applying max(balance, 0) resets at each month boundary.
 */
function computeBudgetWithResets(userId: string, month: string): ComputedBudgetData {
  const db = getDb();

  // Find the earliest month with any budget or transaction data
  const earliestAssigned = db.prepare(`
    SELECT MIN(year_month) as m FROM monthly_budget WHERE user_id = ?
  `).get(userId) as { m: string | null };

  const earliestActivity = db.prepare(`
    SELECT MIN(substr(date, 1, 7)) as m FROM "transaction"
    WHERE user_id = ? AND category_id IS NOT NULL AND linked_transaction_id IS NULL
  `).get(userId) as { m: string | null };

  const candidates = [earliestAssigned.m, earliestActivity.m, month].filter(Boolean) as string[];
  const earliest = candidates.sort()[0];

  // Bulk query: all per-category per-month assignments up through target month
  const assignedRows = db.prepare(`
    SELECT category_id, year_month, assigned_amount
    FROM monthly_budget
    WHERE user_id = ? AND year_month <= ?
  `).all(userId, month) as AssignedRow[];

  // Bulk query: all per-category per-month activity up through target month
  const activityRows = db.prepare(`
    SELECT category_id, substr(date, 1, 7) as year_month, COALESCE(SUM(amount), 0) as activity
    FROM "transaction"
    WHERE user_id = ?
      AND category_id IS NOT NULL
      AND linked_transaction_id IS NULL
      AND substr(date, 1, 7) <= ?
    GROUP BY category_id, substr(date, 1, 7)
  `).all(userId, month) as ActivityRow[];

  // Build lookup maps: "categoryId:month" -> value
  const assignedMap = new Map<string, number>();
  for (const row of assignedRows) {
    assignedMap.set(`${row.category_id}:${row.year_month}`, row.assigned_amount);
  }

  const activityMap = new Map<string, number>();
  for (const row of activityRows) {
    activityMap.set(`${row.category_id}:${row.year_month}`, row.activity);
  }

  // Collect all category IDs that have any data
  const categoryIds = new Set<string>();
  for (const row of assignedRows) categoryIds.add(row.category_id);
  for (const row of activityRows) categoryIds.add(row.category_id);

  // Also include categories with no data yet (so they show up with 0 balance)
  const allCategoryIds = db.prepare(`
    SELECT id FROM category WHERE user_id = ?
  `).all(userId) as { id: string }[];
  for (const row of allCategoryIds) categoryIds.add(row.id);

  const months = getMonthRange(earliest, month);

  // Running balance per category
  const balance = new Map<string, number>();
  for (const catId of categoryIds) balance.set(catId, 0);

  let cumulativeOverspending = 0;

  // Per-category assigned/activity for the target month (to return)
  const targetAssigned = new Map<string, number>();
  const targetActivity = new Map<string, number>();

  for (let i = 0; i < months.length; i++) {
    const m = months[i];

    // At month boundary (before processing this month), reset negative balances
    if (i > 0) {
      for (const catId of categoryIds) {
        const bal = balance.get(catId)!;
        if (bal < 0) {
          cumulativeOverspending += -bal; // add the absolute overspent amount
          balance.set(catId, 0);
        }
      }
    }

    // Apply this month's assigned + activity
    for (const catId of categoryIds) {
      const a = assignedMap.get(`${catId}:${m}`) ?? 0;
      const act = activityMap.get(`${catId}:${m}`) ?? 0;
      balance.set(catId, balance.get(catId)! + a + act);

      if (m === month) {
        targetAssigned.set(catId, a);
        targetActivity.set(catId, act);
      }
    }
  }

  return {
    balances: balance,
    assigned: targetAssigned,
    activity: targetActivity,
    cumulativeOverspending,
  };
}

export function getBudgetForMonth(userId: string, month: string): BudgetMonth {
  const db = getDb();

  // Get category metadata (groups, sort order)
  const metadataRows = db.prepare(`
    SELECT
      c.id as category_id,
      c.name as category_name,
      c.group_id,
      cg.name as group_name,
      cg.sort_order as group_sort_order,
      c.sort_order as category_sort_order
    FROM category c
    LEFT JOIN category_group cg ON cg.id = c.group_id
    WHERE c.user_id = ?
    ORDER BY
      CASE WHEN c.group_id IS NULL THEN 1 ELSE 0 END,
      cg.sort_order,
      cg.name,
      c.sort_order,
      c.name
  `).all(userId) as CategoryMetadataRow[];

  // Compute balances with month-boundary overspending resets
  const computed = computeBudgetWithResets(userId, month);

  // Calculate total inflows (income to budget)
  // Only count UNCATEGORIZED inflows - categorized inflows (e.g., refunds) go directly to category activity
  const inflowsResult = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM "transaction"
    WHERE user_id = ?
      AND amount > 0
      AND linked_transaction_id IS NULL
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

  // Available to Assign: inflows minus assigned minus overspending from prior months
  const availableToAssign = totalInflows - totalAssigned - computed.cumulativeOverspending;

  // Get targets for all categories
  const categoryIds = metadataRows.map(r => r.category_id);
  const targetsMap = categoryTargetService.getTargetsForCategories(userId, categoryIds);

  // Group the categories
  const groupsMap = new Map<string, {
    id: string;
    name: string;
    sortOrder: number;
    categories: BudgetEntry[];
  }>();
  const ungroupedCategories: BudgetEntry[] = [];

  for (const row of metadataRows) {
    const target = targetsMap.get(row.category_id);
    const entry: BudgetEntry = {
      categoryId: row.category_id,
      categoryName: row.category_name,
      groupId: row.group_id,
      groupName: row.group_name,
      sortOrder: row.category_sort_order,
      assigned: computed.assigned.get(row.category_id) ?? 0,
      activity: computed.activity.get(row.category_id) ?? 0,
      available: computed.balances.get(row.category_id) ?? 0,
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
    overspending: computed.cumulativeOverspending,
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

