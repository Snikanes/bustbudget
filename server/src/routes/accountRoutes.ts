import { Router, Request, Response, NextFunction } from 'express';
import * as accountService from '../services/accountService.js';
import * as transactionService from '../services/transactionService.js';
import { CreateAccountRequest, UpdateAccountRequest, CreateTransactionRequest, ImportTransactionsRequest, AuthenticatedRequest } from '../models/types.js';

const router = Router();

// Wrap async handlers
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// GET /api/accounts
router.get('/', asyncHandler(async (req, res) => {
  const userId = (req as AuthenticatedRequest).user.userId;
  const accounts = accountService.getAllAccounts(userId);
  res.json({ accounts });
}));

// GET /api/accounts/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const userId = (req as AuthenticatedRequest).user.userId;
  const id = req.params.id as string;
  const account = accountService.getAccountById(userId, id);
  res.json({ account });
}));

// POST /api/accounts
router.post('/', asyncHandler(async (req, res) => {
  const userId = (req as AuthenticatedRequest).user.userId;
  const data: CreateAccountRequest = req.body;
  const account = accountService.createAccount(userId, data);
  res.status(201).json({ account });
}));

// PUT /api/accounts/:id
router.put('/:id', asyncHandler(async (req, res) => {
  const userId = (req as AuthenticatedRequest).user.userId;
  const id = req.params.id as string;
  const data: UpdateAccountRequest = req.body;
  const account = accountService.updateAccount(userId, id, data);
  res.json({ account });
}));

// DELETE /api/accounts/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  const userId = (req as AuthenticatedRequest).user.userId;
  const id = req.params.id as string;
  accountService.deleteAccount(userId, id);
  res.status(204).send();
}));

// POST /api/accounts/:id/close
router.post('/:id/close', asyncHandler(async (req, res) => {
  const userId = (req as AuthenticatedRequest).user.userId;
  const id = req.params.id as string;
  const account = accountService.closeAccount(userId, id);
  res.json({ account });
}));

// GET /api/accounts/:id/transactions
router.get('/:id/transactions', asyncHandler(async (req, res) => {
  const userId = (req as AuthenticatedRequest).user.userId;
  const id = req.params.id as string;
  const transactions = transactionService.getTransactionsByAccount(userId, id);
  res.json({ transactions });
}));

// POST /api/accounts/:id/transactions
router.post('/:id/transactions', asyncHandler(async (req, res) => {
  const userId = (req as AuthenticatedRequest).user.userId;
  const id = req.params.id as string;
  const data: CreateTransactionRequest = req.body;
  const transaction = transactionService.createTransaction(userId, id, data);
  res.status(201).json({ transaction });
}));

// POST /api/accounts/:id/starting-balance
router.post('/:id/starting-balance', asyncHandler(async (req, res) => {
  const userId = (req as AuthenticatedRequest).user.userId;
  const id = req.params.id as string;
  const { amount, date } = req.body as { amount: number; date: string };
  const transaction = transactionService.createStartingBalance(userId, id, amount, date);
  res.status(201).json({ transaction });
}));

// POST /api/accounts/:id/import
router.post('/:id/import', asyncHandler(async (req, res) => {
  const userId = (req as AuthenticatedRequest).user.userId;
  const id = req.params.id as string;
  const data: ImportTransactionsRequest = req.body;
  const result = transactionService.importTransactions(userId, id, data.transactions);
  res.status(201).json(result);
}));

// POST /api/accounts/:id/reconcile
router.post('/:id/reconcile', asyncHandler(async (req, res) => {
  const userId = (req as AuthenticatedRequest).user.userId;
  const id = req.params.id as string;
  const result = transactionService.reconcileAccount(userId, id);
  res.json(result);
}));

export default router;
