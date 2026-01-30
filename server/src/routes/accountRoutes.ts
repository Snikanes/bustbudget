import { Router, Request, Response, NextFunction } from 'express';
import * as accountService from '../services/accountService.js';
import * as transactionService from '../services/transactionService.js';
import { CreateAccountRequest, UpdateAccountRequest, CreateTransactionRequest } from '../models/types.js';

const router = Router();

// Wrap async handlers
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// GET /api/accounts
router.get('/', asyncHandler(async (req, res) => {
  const accounts = accountService.getAllAccounts();
  res.json({ accounts });
}));

// GET /api/accounts/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const account = accountService.getAccountById(req.params.id);
  res.json({ account });
}));

// POST /api/accounts
router.post('/', asyncHandler(async (req, res) => {
  const data: CreateAccountRequest = req.body;
  const account = accountService.createAccount(data);
  res.status(201).json({ account });
}));

// PUT /api/accounts/:id
router.put('/:id', asyncHandler(async (req, res) => {
  const data: UpdateAccountRequest = req.body;
  const account = accountService.updateAccount(req.params.id, data);
  res.json({ account });
}));

// DELETE /api/accounts/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  accountService.deleteAccount(req.params.id);
  res.status(204).send();
}));

// POST /api/accounts/:id/close
router.post('/:id/close', asyncHandler(async (req, res) => {
  const account = accountService.closeAccount(req.params.id);
  res.json({ account });
}));

// GET /api/accounts/:id/transactions
router.get('/:id/transactions', asyncHandler(async (req, res) => {
  const transactions = transactionService.getTransactionsByAccount(req.params.id);
  res.json({ transactions });
}));

// POST /api/accounts/:id/transactions
router.post('/:id/transactions', asyncHandler(async (req, res) => {
  const data: CreateTransactionRequest = req.body;
  const transaction = transactionService.createTransaction(req.params.id, data);
  res.status(201).json({ transaction });
}));

// POST /api/accounts/:id/starting-balance
router.post('/:id/starting-balance', asyncHandler(async (req, res) => {
  const { amount, date } = req.body as { amount: number; date: string };
  const transaction = transactionService.createStartingBalance(req.params.id, amount, date);
  res.status(201).json({ transaction });
}));

export default router;
