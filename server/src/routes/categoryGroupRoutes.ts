import { Router, Request, Response, NextFunction } from 'express';
import * as categoryGroupService from '../services/categoryGroupService.js';
import { CreateCategoryGroupRequest, UpdateCategoryGroupRequest } from '../models/types.js';

const router = Router();

// Wrap async handlers
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// GET /api/category-groups
router.get('/', asyncHandler(async (req, res) => {
  const categoryGroups = categoryGroupService.getAllCategoryGroups();
  res.json({ categoryGroups });
}));

// GET /api/category-groups/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const categoryGroup = categoryGroupService.getCategoryGroupById(req.params.id);
  res.json({ categoryGroup });
}));

// POST /api/category-groups
router.post('/', asyncHandler(async (req, res) => {
  const data: CreateCategoryGroupRequest = req.body;
  const categoryGroup = categoryGroupService.createCategoryGroup(data);
  res.status(201).json({ categoryGroup });
}));

// PUT /api/category-groups/:id
router.put('/:id', asyncHandler(async (req, res) => {
  const data: UpdateCategoryGroupRequest = req.body;
  const categoryGroup = categoryGroupService.updateCategoryGroup(req.params.id, data);
  res.json({ categoryGroup });
}));

// DELETE /api/category-groups/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  const result = categoryGroupService.deleteCategoryGroup(req.params.id);
  res.json({ success: true, movedCategories: result.movedCategories });
}));

// POST /api/category-groups/reorder
router.post('/reorder', asyncHandler(async (req, res) => {
  const { orderedIds } = req.body as { orderedIds: string[] };
  categoryGroupService.reorderCategoryGroups(orderedIds);
  res.json({ success: true });
}));

export default router;
