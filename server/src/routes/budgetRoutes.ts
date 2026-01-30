import { Router, Request, Response, NextFunction } from 'express';
import * as budgetService from '../services/budgetService.js';
import { UpdateBudgetRequest } from '../models/types.js';

const router = Router();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// GET /api/budgets/:month
router.get('/:month', asyncHandler(async (req, res) => {
  const budget = budgetService.getBudgetForMonth(req.params.month);
  res.json(budget);
}));

// GET /api/budgets/:month/available
router.get('/:month/available', asyncHandler(async (req, res) => {
  const result = budgetService.getAvailableToAssign(req.params.month);
  res.json(result);
}));

// PUT /api/budgets/:month/categories/:categoryId
router.put('/:month/categories/:categoryId', asyncHandler(async (req, res) => {
  const { assigned } = req.body as UpdateBudgetRequest;
  const monthlyBudget = budgetService.updateBudgetEntry(
    req.params.month,
    req.params.categoryId,
    assigned
  );
  res.json({ monthlyBudget });
}));

export default router;
