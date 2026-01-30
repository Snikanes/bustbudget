import { Router, Request, Response, NextFunction } from 'express';
import * as categoryService from '../services/categoryService.js';
import { CreateCategoryRequest, UpdateCategoryRequest } from '../models/types.js';

const router = Router();

// Wrap async handlers
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// GET /api/categories
router.get('/', asyncHandler(async (req, res) => {
  const categories = categoryService.getAllCategories();
  res.json({ categories });
}));

// GET /api/categories/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const category = categoryService.getCategoryById(req.params.id);
  res.json({ category });
}));

// POST /api/categories
router.post('/', asyncHandler(async (req, res) => {
  const data: CreateCategoryRequest = req.body;
  const category = categoryService.createCategory(data);
  res.status(201).json({ category });
}));

// PUT /api/categories/:id
router.put('/:id', asyncHandler(async (req, res) => {
  const data: UpdateCategoryRequest = req.body;
  const category = categoryService.updateCategory(req.params.id, data);
  res.json({ category });
}));

// DELETE /api/categories/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  const result = categoryService.deleteCategory(req.params.id);
  res.json({ success: true, returnedAmount: result.returnedAmount });
}));

// POST /api/categories/reorder
router.post('/reorder', asyncHandler(async (req, res) => {
  const { groupId, orderedIds } = req.body as { groupId: string | null; orderedIds: string[] };
  categoryService.reorderCategories(groupId, orderedIds);
  res.json({ success: true });
}));

export default router;
