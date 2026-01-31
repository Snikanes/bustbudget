import { Router, Request, Response, NextFunction } from 'express';
import * as budgetService from '../services/budgetService.js';
import { UpdateBudgetRequest, AuthenticatedRequest } from '../models/types.js';

const router = Router();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// GET /api/budgets/:month
router.get('/:month', asyncHandler(async (req, res) => {
  const userId = (req as AuthenticatedRequest).user.userId;
  const month = req.params.month as string;
  const budget = budgetService.getBudgetForMonth(userId, month);
  res.json(budget);
}));

// GET /api/budgets/:month/available
router.get('/:month/available', asyncHandler(async (req, res) => {
  const userId = (req as AuthenticatedRequest).user.userId;
  const month = req.params.month as string;
  const result = budgetService.getAvailableToAssign(userId, month);
  res.json(result);
}));

// PUT /api/budgets/:month/categories/:categoryId
router.put('/:month/categories/:categoryId', asyncHandler(async (req, res) => {
  const userId = (req as AuthenticatedRequest).user.userId;
  const month = req.params.month as string;
  const categoryId = req.params.categoryId as string;
  const { assigned } = req.body as UpdateBudgetRequest;
  const monthlyBudget = budgetService.updateBudgetEntry(
    userId,
    month,
    categoryId,
    assigned
  );
  res.json({ monthlyBudget });
}));

export default router;
