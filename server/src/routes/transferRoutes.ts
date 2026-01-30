import { Router, Request, Response, NextFunction } from 'express';
import * as transferService from '../services/transferService.js';
import { CreateTransferRequest } from '../models/types.js';

const router = Router();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// POST /api/transfers
router.post('/', asyncHandler(async (req, res) => {
  const data: CreateTransferRequest = req.body;
  const transfer = transferService.createTransfer(data);
  res.status(201).json({ transfer });
}));

// GET /api/transfers/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const transfer = transferService.getTransferById(req.params.id);
  res.json({ transfer });
}));

// PUT /api/transfers/:id
router.put('/:id', asyncHandler(async (req, res) => {
  const { date, amount, memo, isCleared } = req.body;
  const transfer = transferService.updateTransfer(req.params.id, { date, amount, memo, isCleared });
  res.json({ transfer });
}));

// DELETE /api/transfers/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  transferService.deleteTransfer(req.params.id);
  res.status(204).send();
}));

export default router;
