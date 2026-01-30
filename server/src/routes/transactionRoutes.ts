import { Router, Request, Response, NextFunction } from 'express';
import * as transactionService from '../services/transactionService.js';
import { UpdateTransactionRequest } from '../models/types.js';

const router = Router();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// GET /api/transactions/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const transaction = transactionService.getTransactionById(req.params.id);
  res.json({ transaction });
}));

// PUT /api/transactions/:id
router.put('/:id', asyncHandler(async (req, res) => {
  const data: UpdateTransactionRequest = req.body;
  const transaction = transactionService.updateTransaction(req.params.id, data);
  res.json({ transaction });
}));

// DELETE /api/transactions/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  transactionService.deleteTransaction(req.params.id);
  res.status(204).send();
}));

export default router;
