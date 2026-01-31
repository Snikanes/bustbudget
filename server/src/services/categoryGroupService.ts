import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/index.js';
import {
  CategoryGroupRow,
  CategoryRow,
  CategoryGroup,
  Category,
  CreateCategoryGroupRequest,
  UpdateCategoryGroupRequest,
} from '../models/types.js';
import { NotFoundError } from '../middleware/errorHandler.js';

function categoryRowToCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    groupId: row.group_id,
    name: row.name,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToCategoryGroup(row: CategoryGroupRow, categories: Category[]): CategoryGroup {
  return {
    id: row.id,
    name: row.name,
    sortOrder: row.sort_order,
    categories: categories.filter(c => c.groupId === row.id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getAllCategoryGroups(userId: string): CategoryGroup[] {
  const db = getDb();

  const groupRows = db.prepare(`
    SELECT * FROM category_group WHERE user_id = ? ORDER BY sort_order, name
  `).all(userId) as CategoryGroupRow[];

  const categoryRows = db.prepare(`
    SELECT * FROM category WHERE user_id = ? ORDER BY sort_order, name
  `).all(userId) as CategoryRow[];

  const categories = categoryRows.map(categoryRowToCategory);

  return groupRows.map(row => rowToCategoryGroup(row, categories));
}

export function getCategoryGroupById(userId: string, id: string): CategoryGroup {
  const db = getDb();

  const row = db.prepare('SELECT * FROM category_group WHERE user_id = ? AND id = ?').get(userId, id) as CategoryGroupRow | undefined;
  if (!row) {
    throw new NotFoundError('CategoryGroup', id);
  }

  const categoryRows = db.prepare(`
    SELECT * FROM category WHERE user_id = ? AND group_id = ? ORDER BY sort_order, name
  `).all(userId, id) as CategoryRow[];

  const categories = categoryRows.map(categoryRowToCategory);

  return rowToCategoryGroup(row, categories);
}

export function createCategoryGroup(userId: string, data: CreateCategoryGroupRequest): CategoryGroup {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();

  // Get max sort order if not provided
  let sortOrder = data.sortOrder;
  if (sortOrder === undefined) {
    const max = db.prepare('SELECT MAX(sort_order) as max FROM category_group WHERE user_id = ?').get(userId) as { max: number | null };
    sortOrder = (max.max ?? -1) + 1;
  }

  db.prepare(`
    INSERT INTO category_group (id, user_id, name, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, userId, data.name, sortOrder, now, now);

  return getCategoryGroupById(userId, id);
}

export function updateCategoryGroup(userId: string, id: string, data: UpdateCategoryGroupRequest): CategoryGroup {
  const db = getDb();

  // Check exists and belongs to user
  const existing = db.prepare('SELECT id FROM category_group WHERE user_id = ? AND id = ?').get(userId, id);
  if (!existing) {
    throw new NotFoundError('CategoryGroup', id);
  }

  const updates: string[] = [];
  const params: unknown[] = [];

  if (data.name !== undefined) {
    updates.push('name = ?');
    params.push(data.name);
  }

  if (data.sortOrder !== undefined) {
    updates.push('sort_order = ?');
    params.push(data.sortOrder);
  }

  if (updates.length > 0) {
    params.push(userId, id);
    db.prepare(`UPDATE category_group SET ${updates.join(', ')} WHERE user_id = ? AND id = ?`).run(...params);
  }

  return getCategoryGroupById(userId, id);
}

export function deleteCategoryGroup(userId: string, id: string): { movedCategories: string[] } {
  const db = getDb();

  // Check exists and belongs to user
  const existing = db.prepare('SELECT id FROM category_group WHERE user_id = ? AND id = ?').get(userId, id);
  if (!existing) {
    throw new NotFoundError('CategoryGroup', id);
  }

  // Get categories that will be moved
  const categories = db.prepare('SELECT id FROM category WHERE user_id = ? AND group_id = ?').all(userId, id) as { id: string }[];
  const movedCategoryIds = categories.map(c => c.id);

  // Move categories to top-level (null group_id)
  db.prepare('UPDATE category SET group_id = NULL WHERE user_id = ? AND group_id = ?').run(userId, id);

  // Delete the group
  db.prepare('DELETE FROM category_group WHERE user_id = ? AND id = ?').run(userId, id);

  return { movedCategories: movedCategoryIds };
}

export function reorderCategoryGroups(userId: string, orderedIds: string[]): void {
  const db = getDb();

  const stmt = db.prepare('UPDATE category_group SET sort_order = ? WHERE user_id = ? AND id = ?');

  orderedIds.forEach((id, index) => {
    stmt.run(index, userId, id);
  });
}
