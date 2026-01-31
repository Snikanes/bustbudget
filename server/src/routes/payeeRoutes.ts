import { Router, Request, Response, NextFunction } from 'express';
import * as payeeService from '../services/payeeService.js';
import { NotFoundError } from '../middleware/errorHandler.js';
import { AuthenticatedRequest } from '../models/types.js';

const router = Router();

// Wrap async handlers
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// GET /api/payees
router.get('/', asyncHandler(async (req, res) => {
  const userId = (req as AuthenticatedRequest).user.userId;
  const payees = payeeService.getAllPayees(userId);
  res.json({ payees });
}));

// GET /api/payees/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const userId = (req as AuthenticatedRequest).user.userId;
  const id = req.params.id as string;
  const payee = payeeService.getPayeeWithDetails(userId, id);
  if (!payee) {
    throw new NotFoundError('Payee', id);
  }
  res.json({ payee });
}));

// POST /api/payees
router.post('/', asyncHandler(async (req, res) => {
  const userId = (req as AuthenticatedRequest).user.userId;
  const { name } = req.body as { name: string };
  const payee = payeeService.createPayee(userId, name);
  res.status(201).json({ payee });
}));

// PUT /api/payees/:id
router.put('/:id', asyncHandler(async (req, res) => {
  const userId = (req as AuthenticatedRequest).user.userId;
  const id = req.params.id as string;
  const { name } = req.body as { name: string };
  const payee = payeeService.updatePayee(userId, id, name);
  res.json({ payee });
}));

// DELETE /api/payees/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  const userId = (req as AuthenticatedRequest).user.userId;
  const id = req.params.id as string;
  payeeService.deletePayee(userId, id);
  res.status(204).send();
}));

export default router;
