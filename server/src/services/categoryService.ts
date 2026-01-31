import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/index.js';
import {
  CategoryRow,
  Category,
  CreateCategoryRequest,
  UpdateCategoryRequest,
} from '../models/types.js';
import { NotFoundError } from '../middleware/errorHandler.js';

function rowToCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    groupId: row.group_id,
    name: row.name,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getAllCategories(userId: string): Category[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM category WHERE user_id = ? ORDER BY group_id, sort_order, name
  `).all(userId) as CategoryRow[];

  return rows.map(rowToCategory);
}

export function getCategoryById(userId: string, id: string): Category {
  const db = getDb();
  const row = db.prepare('SELECT * FROM category WHERE user_id = ? AND id = ?').get(userId, id) as CategoryRow | undefined;

  if (!row) {
    throw new NotFoundError('Category', id);
  }

  return rowToCategory(row);
}

export function createCategory(userId: string, data: CreateCategoryRequest): Category {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();

  // Validate group exists and belongs to user if provided
  if (data.groupId) {
    const group = db.prepare('SELECT id FROM category_group WHERE user_id = ? AND id = ?').get(userId, data.groupId);
    if (!group) {
      throw new NotFoundError('CategoryGroup', data.groupId);
    }
  }

  // Get max sort order within the group if not provided
  let sortOrder = data.sortOrder;
  if (sortOrder === undefined) {
    const max = db.prepare(`
      SELECT MAX(sort_order) as max FROM category WHERE user_id = ? AND group_id IS ?
    `).get(userId, data.groupId ?? null) as { max: number | null };
    sortOrder = (max.max ?? -1) + 1;
  }

  db.prepare(`
    INSERT INTO category (id, user_id, group_id, name, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, userId, data.groupId ?? null, data.name, sortOrder, now, now);

  return getCategoryById(userId, id);
}

export function updateCategory(userId: string, id: string, data: UpdateCategoryRequest): Category {
  const db = getDb();

  // Check exists and belongs to user
  const existing = db.prepare('SELECT id FROM category WHERE user_id = ? AND id = ?').get(userId, id);
  if (!existing) {
    throw new NotFoundError('Category', id);
  }

  // Validate group if changing
  if ('groupId' in data && data.groupId !== null && data.groupId !== undefined) {
    const group = db.prepare('SELECT id FROM category_group WHERE user_id = ? AND id = ?').get(userId, data.groupId);
    if (!group) {
      throw new NotFoundError('CategoryGroup', data.groupId);
    }
  }

  const updates: string[] = [];
  const params: unknown[] = [];

  if (data.name !== undefined) {
    updates.push('name = ?');
    params.push(data.name);
  }

  if ('groupId' in data) {
    updates.push('group_id = ?');
    params.push(data.groupId ?? null);
  }

  if (data.sortOrder !== undefined) {
    updates.push('sort_order = ?');
    params.push(data.sortOrder);
  }

  if (updates.length > 0) {
    params.push(userId, id);
    db.prepare(`UPDATE category SET ${updates.join(', ')} WHERE user_id = ? AND id = ?`).run(...params);
  }

  return getCategoryById(userId, id);
}

export function deleteCategory(userId: string, id: string): { returnedAmount: number } {
  const db = getDb();

  // Check exists and belongs to user
  const existing = db.prepare('SELECT id FROM category WHERE user_id = ? AND id = ?').get(userId, id);
  if (!existing) {
    throw new NotFoundError('Category', id);
  }

  // Calculate total assigned amount that will be returned to Available to Assign
  const totalAssigned = db.prepare(`
    SELECT COALESCE(SUM(assigned_amount), 0) as total
    FROM monthly_budget
    WHERE user_id = ? AND category_id = ?
  `).get(userId, id) as { total: number };

  // Transactions with this category will have category_id set to NULL due to ON DELETE SET NULL
  // Monthly budgets will be deleted due to ON DELETE CASCADE

  db.prepare('DELETE FROM category WHERE user_id = ? AND id = ?').run(userId, id);

  return { returnedAmount: totalAssigned.total };
}

export function reorderCategories(userId: string, groupId: string | null, orderedIds: string[]): void {
  const db = getDb();

  const stmt = db.prepare('UPDATE category SET sort_order = ?, group_id = ? WHERE user_id = ? AND id = ?');

  orderedIds.forEach((id, index) => {
    stmt.run(index, groupId ?? null, userId, id);
  });
}
