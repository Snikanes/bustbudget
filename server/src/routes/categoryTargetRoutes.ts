import { Router } from 'express';
import * as categoryTargetService from '../services/categoryTargetService.js';
import { CreateCategoryTargetRequest, UpdateCategoryTargetRequest } from '../models/types.js';

const router = Router();

// GET /api/categories/:categoryId/target
router.get('/:categoryId/target', (req, res, next) => {
  try {
    const { categoryId } = req.params;
    const target = categoryTargetService.getTargetByCategory(categoryId);

    if (!target) {
      return res.status(404).json({ error: 'Category target not found' });
    }

    res.json(target);
  } catch (error) {
    next(error);
  }
});

// POST /api/categories/:categoryId/target
router.post('/:categoryId/target', (req, res, next) => {
  try {
    const { categoryId } = req.params;
    const data = req.body as CreateCategoryTargetRequest;
    const target = categoryTargetService.createCategoryTarget(categoryId, data);
    res.status(201).json(target);
  } catch (error) {
    next(error);
  }
});

// PUT /api/categories/:categoryId/target
router.put('/:categoryId/target', (req, res, next) => {
  try {
    const { categoryId } = req.params;
    const data = req.body as UpdateCategoryTargetRequest;
    const target = categoryTargetService.updateCategoryTarget(categoryId, data);
    res.json(target);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/categories/:categoryId/target
router.delete('/:categoryId/target', (req, res, next) => {
  try {
    const { categoryId } = req.params;
    categoryTargetService.deleteCategoryTarget(categoryId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
