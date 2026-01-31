import { Router, Request, Response, NextFunction } from 'express';
import * as transferService from '../services/transferService.js';
import { CreateTransferRequest, AuthenticatedRequest } from '../models/types.js';

const router = Router();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// POST /api/transfers
router.post('/', asyncHandler(async (req, res) => {
  const userId = (req as AuthenticatedRequest).user.userId;
  const data: CreateTransferRequest = req.body;
  const transfer = transferService.createTransfer(userId, data);
  res.status(201).json({ transfer });
}));

// GET /api/transfers/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const userId = (req as AuthenticatedRequest).user.userId;
  const id = req.params.id as string;
  const transfer = transferService.getTransferById(userId, id);
  res.json({ transfer });
}));

// PUT /api/transfers/:id
router.put('/:id', asyncHandler(async (req, res) => {
  const userId = (req as AuthenticatedRequest).user.userId;
  const id = req.params.id as string;
  const { date, amount, memo, isCleared } = req.body;
  const transfer = transferService.updateTransfer(userId, id, { date, amount, memo, isCleared });
  res.json({ transfer });
}));

// DELETE /api/transfers/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  const userId = (req as AuthenticatedRequest).user.userId;
  const id = req.params.id as string;
  transferService.deleteTransfer(userId, id);
  res.status(204).send();
}));

export default router;
