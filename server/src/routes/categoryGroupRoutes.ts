import { Router, Request, Response, NextFunction } from 'express';
import * as categoryGroupService from '../services/categoryGroupService.js';
import { CreateCategoryGroupRequest, UpdateCategoryGroupRequest, AuthenticatedRequest } from '../models/types.js';

const router = Router();

// Wrap async handlers
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// GET /api/category-groups
router.get('/', asyncHandler(async (req, res) => {
  const userId = (req as AuthenticatedRequest).user.userId;
  const categoryGroups = categoryGroupService.getAllCategoryGroups(userId);
  res.json({ categoryGroups });
}));

// GET /api/category-groups/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const userId = (req as AuthenticatedRequest).user.userId;
  const id = req.params.id as string;
  const categoryGroup = categoryGroupService.getCategoryGroupById(userId, id);
  res.json({ categoryGroup });
}));

// POST /api/category-groups
router.post('/', asyncHandler(async (req, res) => {
  const userId = (req as AuthenticatedRequest).user.userId;
  const data: CreateCategoryGroupRequest = req.body;
  const categoryGroup = categoryGroupService.createCategoryGroup(userId, data);
  res.status(201).json({ categoryGroup });
}));

// PUT /api/category-groups/:id
router.put('/:id', asyncHandler(async (req, res) => {
  const userId = (req as AuthenticatedRequest).user.userId;
  const id = req.params.id as string;
  const data: UpdateCategoryGroupRequest = req.body;
  const categoryGroup = categoryGroupService.updateCategoryGroup(userId, id, data);
  res.json({ categoryGroup });
}));

// DELETE /api/category-groups/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  const userId = (req as AuthenticatedRequest).user.userId;
  const id = req.params.id as string;
  const result = categoryGroupService.deleteCategoryGroup(userId, id);
  res.json({ success: true, movedCategories: result.movedCategories });
}));

// POST /api/category-groups/reorder
router.post('/reorder', asyncHandler(async (req, res) => {
  const userId = (req as AuthenticatedRequest).user.userId;
  const { orderedIds } = req.body as { orderedIds: string[] };
  categoryGroupService.reorderCategoryGroups(userId, orderedIds);
  res.json({ success: true });
}));

export default router;
