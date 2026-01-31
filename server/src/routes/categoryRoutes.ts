import { Router, Request, Response, NextFunction } from 'express';
import * as categoryService from '../services/categoryService.js';
import { CreateCategoryRequest, UpdateCategoryRequest, AuthenticatedRequest } from '../models/types.js';

const router = Router();

// Wrap async handlers
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// GET /api/categories
router.get('/', asyncHandler(async (req, res) => {
  const userId = (req as AuthenticatedRequest).user.userId;
  const categories = categoryService.getAllCategories(userId);
  res.json({ categories });
}));

// GET /api/categories/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const userId = (req as AuthenticatedRequest).user.userId;
  const id = req.params.id as string;
  const category = categoryService.getCategoryById(userId, id);
  res.json({ category });
}));

// POST /api/categories
router.post('/', asyncHandler(async (req, res) => {
  const userId = (req as AuthenticatedRequest).user.userId;
  const data: CreateCategoryRequest = req.body;
  const category = categoryService.createCategory(userId, data);
  res.status(201).json({ category });
}));

// PUT /api/categories/:id
router.put('/:id', asyncHandler(async (req, res) => {
  const userId = (req as AuthenticatedRequest).user.userId;
  const id = req.params.id as string;
  const data: UpdateCategoryRequest = req.body;
  const category = categoryService.updateCategory(userId, id, data);
  res.json({ category });
}));

// DELETE /api/categories/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  const userId = (req as AuthenticatedRequest).user.userId;
  const id = req.params.id as string;
  const result = categoryService.deleteCategory(userId, id);
  res.json({ success: true, returnedAmount: result.returnedAmount });
}));

// POST /api/categories/reorder
router.post('/reorder', asyncHandler(async (req, res) => {
  const userId = (req as AuthenticatedRequest).user.userId;
  const { groupId, orderedIds } = req.body as { groupId: string | null; orderedIds: string[] };
  categoryService.reorderCategories(userId, groupId, orderedIds);
  res.json({ success: true });
}));

export default router;
