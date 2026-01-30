import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/index.js';
import {
  CategoryTarget,
  CategoryTargetRow,
  CreateCategoryTargetRequest,
  UpdateCategoryTargetRequest,
} from '../models/types.js';
import { NotFoundError, ValidationError } from '../middleware/errorHandler.js';

function rowToTarget(row: CategoryTargetRow): CategoryTarget {
  return {
    id: row.id,
    categoryId: row.category_id,
    targetType: row.target_type,
    targetAmount: row.target_amount,
    targetDate: row.target_date,
    recurrenceDay: row.recurrence_day,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getTargetByCategory(categoryId: string): CategoryTarget | null {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM category_target WHERE category_id = ?')
    .get(categoryId) as CategoryTargetRow | undefined;

  return row ? rowToTarget(row) : null;
}

export function getTargetsForCategories(categoryIds: string[]): Map<string, CategoryTarget> {
  if (categoryIds.length === 0) {
    return new Map();
  }

  const db = getDb();
  const placeholders = categoryIds.map(() => '?').join(',');
  const rows = db
    .prepare(`SELECT * FROM category_target WHERE category_id IN (${placeholders})`)
    .all(...categoryIds) as CategoryTargetRow[];

  const targetsMap = new Map<string, CategoryTarget>();
  for (const row of rows) {
    targetsMap.set(row.category_id, rowToTarget(row));
  }

  return targetsMap;
}

export function createCategoryTarget(
  categoryId: string,
  data: CreateCategoryTargetRequest
): CategoryTarget {
  const db = getDb();

  // Validate category exists
  const category = db.prepare('SELECT id FROM category WHERE id = ?').get(categoryId);
  if (!category) {
    throw new NotFoundError('Category', categoryId);
  }

  // Validate target amount
  if (data.targetAmount <= 0) {
    throw new ValidationError('Target amount must be greater than 0');
  }

  // Validate recurrence day
  if (data.recurrenceDay !== undefined && data.recurrenceDay !== null) {
    if (data.recurrenceDay < 1 || data.recurrenceDay > 31) {
      throw new ValidationError('Recurrence day must be between 1 and 31');
    }
  }

  // Validate target date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.targetDate)) {
    throw new ValidationError('Target date must be in YYYY-MM-DD format');
  }

  // Check if target already exists
  const existing = db
    .prepare('SELECT id FROM category_target WHERE category_id = ?')
    .get(categoryId);
  if (existing) {
    throw new ValidationError('Category already has a target');
  }

  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO category_target (
      id, category_id, target_type, target_amount, target_date, recurrence_day, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    categoryId,
    data.targetType,
    data.targetAmount,
    data.targetDate,
    data.recurrenceDay ?? null,
    now,
    now
  );

  return {
    id,
    categoryId,
    targetType: data.targetType,
    targetAmount: data.targetAmount,
    targetDate: data.targetDate,
    recurrenceDay: data.recurrenceDay ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

export function updateCategoryTarget(
  categoryId: string,
  data: UpdateCategoryTargetRequest
): CategoryTarget {
  const db = getDb();

  // Get existing target
  const existing = db
    .prepare('SELECT * FROM category_target WHERE category_id = ?')
    .get(categoryId) as CategoryTargetRow | undefined;

  if (!existing) {
    throw new NotFoundError('Category target', categoryId);
  }

  // Validate target amount if provided
  if (data.targetAmount !== undefined && data.targetAmount <= 0) {
    throw new ValidationError('Target amount must be greater than 0');
  }

  // Validate recurrence day if provided
  if (data.recurrenceDay !== undefined && data.recurrenceDay !== null) {
    if (data.recurrenceDay < 1 || data.recurrenceDay > 31) {
      throw new ValidationError('Recurrence day must be between 1 and 31');
    }
  }

  // Validate target date format if provided
  if (data.targetDate !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(data.targetDate)) {
    throw new ValidationError('Target date must be in YYYY-MM-DD format');
  }

  const now = new Date().toISOString();

  // Build update query dynamically
  const updates: string[] = [];
  const values: any[] = [];

  if (data.targetType !== undefined) {
    updates.push('target_type = ?');
    values.push(data.targetType);
  }
  if (data.targetAmount !== undefined) {
    updates.push('target_amount = ?');
    values.push(data.targetAmount);
  }
  if (data.targetDate !== undefined) {
    updates.push('target_date = ?');
    values.push(data.targetDate);
  }
  if (data.recurrenceDay !== undefined) {
    updates.push('recurrence_day = ?');
    values.push(data.recurrenceDay);
  }

  if (updates.length > 0) {
    values.push(existing.id);
    db.prepare(`
      UPDATE category_target SET ${updates.join(', ')} WHERE id = ?
    `).run(...values);
  }

  // Fetch updated row
  const updated = db
    .prepare('SELECT * FROM category_target WHERE id = ?')
    .get(existing.id) as CategoryTargetRow;

  return rowToTarget(updated);
}

export function deleteCategoryTarget(categoryId: string): void {
  const db = getDb();

  const result = db
    .prepare('DELETE FROM category_target WHERE category_id = ?')
    .run(categoryId);

  if (result.changes === 0) {
    throw new NotFoundError('Category target', categoryId);
  }
}
