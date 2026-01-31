import { Router, Request, Response, NextFunction } from 'express';
import * as transactionService from '../services/transactionService.js';
import { UpdateTransactionRequest, AuthenticatedRequest } from '../models/types.js';

const router = Router();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// GET /api/transactions/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const userId = (req as AuthenticatedRequest).user.userId;
  const id = req.params.id as string;
  const transaction = transactionService.getTransactionById(userId, id);
  res.json({ transaction });
}));

// PUT /api/transactions/:id
router.put('/:id', asyncHandler(async (req, res) => {
  const userId = (req as AuthenticatedRequest).user.userId;
  const id = req.params.id as string;
  const data: UpdateTransactionRequest = req.body;
  const transaction = transactionService.updateTransaction(userId, id, data);
  res.json({ transaction });
}));

// DELETE /api/transactions/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  const userId = (req as AuthenticatedRequest).user.userId;
  const id = req.params.id as string;
  transactionService.deleteTransaction(userId, id);
  res.status(204).send();
}));

export default router;
