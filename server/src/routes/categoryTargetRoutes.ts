import { Router, Request, Response, NextFunction } from 'express';
import * as categoryTargetService from '../services/categoryTargetService.js';
import { CreateCategoryTargetRequest, UpdateCategoryTargetRequest, AuthenticatedRequest } from '../models/types.js';

const router = Router();

// GET /api/categories/:categoryId/target
router.get('/:categoryId/target', (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const categoryId = req.params.categoryId as string;
    const target = categoryTargetService.getTargetByCategory(userId, categoryId);

    if (!target) {
      return res.status(404).json({ error: 'Category target not found' });
    }

    res.json(target);
  } catch (error) {
    next(error);
  }
});

// POST /api/categories/:categoryId/target
router.post('/:categoryId/target', (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const categoryId = req.params.categoryId as string;
    const data = req.body as CreateCategoryTargetRequest;
    const target = categoryTargetService.createCategoryTarget(userId, categoryId, data);
    res.status(201).json(target);
  } catch (error) {
    next(error);
  }
});

// PUT /api/categories/:categoryId/target
router.put('/:categoryId/target', (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const categoryId = req.params.categoryId as string;
    const data = req.body as UpdateCategoryTargetRequest;
    const target = categoryTargetService.updateCategoryTarget(userId, categoryId, data);
    res.json(target);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/categories/:categoryId/target
router.delete('/:categoryId/target', (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const categoryId = req.params.categoryId as string;
    categoryTargetService.deleteCategoryTarget(userId, categoryId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
