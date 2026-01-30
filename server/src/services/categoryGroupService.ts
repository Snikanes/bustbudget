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

export function getAllCategoryGroups(): CategoryGroup[] {
  const db = getDb();

  const groupRows = db.prepare(`
    SELECT * FROM category_group ORDER BY sort_order, name
  `).all() as CategoryGroupRow[];

  const categoryRows = db.prepare(`
    SELECT * FROM category ORDER BY sort_order, name
  `).all() as CategoryRow[];

  const categories = categoryRows.map(categoryRowToCategory);

  return groupRows.map(row => rowToCategoryGroup(row, categories));
}

export function getCategoryGroupById(id: string): CategoryGroup {
  const db = getDb();

  const row = db.prepare('SELECT * FROM category_group WHERE id = ?').get(id) as CategoryGroupRow | undefined;
  if (!row) {
    throw new NotFoundError('CategoryGroup', id);
  }

  const categoryRows = db.prepare(`
    SELECT * FROM category WHERE group_id = ? ORDER BY sort_order, name
  `).all(id) as CategoryRow[];

  const categories = categoryRows.map(categoryRowToCategory);

  return rowToCategoryGroup(row, categories);
}

export function createCategoryGroup(data: CreateCategoryGroupRequest): CategoryGroup {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();

  // Get max sort order if not provided
  let sortOrder = data.sortOrder;
  if (sortOrder === undefined) {
    const max = db.prepare('SELECT MAX(sort_order) as max FROM category_group').get() as { max: number | null };
    sortOrder = (max.max ?? -1) + 1;
  }

  db.prepare(`
    INSERT INTO category_group (id, name, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, data.name, sortOrder, now, now);

  return getCategoryGroupById(id);
}

export function updateCategoryGroup(id: string, data: UpdateCategoryGroupRequest): CategoryGroup {
  const db = getDb();

  // Check exists
  const existing = db.prepare('SELECT id FROM category_group WHERE id = ?').get(id);
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
    params.push(id);
    db.prepare(`UPDATE category_group SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  }

  return getCategoryGroupById(id);
}

export function deleteCategoryGroup(id: string): { movedCategories: string[] } {
  const db = getDb();

  // Check exists
  const existing = db.prepare('SELECT id FROM category_group WHERE id = ?').get(id);
  if (!existing) {
    throw new NotFoundError('CategoryGroup', id);
  }

  // Get categories that will be moved
  const categories = db.prepare('SELECT id FROM category WHERE group_id = ?').all(id) as { id: string }[];
  const movedCategoryIds = categories.map(c => c.id);

  // Move categories to top-level (null group_id)
  db.prepare('UPDATE category SET group_id = NULL WHERE group_id = ?').run(id);

  // Delete the group
  db.prepare('DELETE FROM category_group WHERE id = ?').run(id);

  return { movedCategories: movedCategoryIds };
}

export function reorderCategoryGroups(orderedIds: string[]): void {
  const db = getDb();

  const stmt = db.prepare('UPDATE category_group SET sort_order = ? WHERE id = ?');

  orderedIds.forEach((id, index) => {
    stmt.run(index, id);
  });
}
