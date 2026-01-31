import { Router, Request, Response, NextFunction } from 'express';
import * as importPayeeMappingService from '../services/importPayeeMappingService.js';
import { AuthenticatedRequest } from '../models/types.js';

const router = Router();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// GET /api/import-payee-mappings
router.get('/', asyncHandler(async (req, res) => {
  const userId = (req as AuthenticatedRequest).user.userId;
  const mappings = importPayeeMappingService.getAllMappings(userId);
  res.json({ mappings });
}));

// POST /api/import-payee-mappings
router.post('/', asyncHandler(async (req, res) => {
  const userId = (req as AuthenticatedRequest).user.userId;
  const { originalPayee, payeeId } = req.body as { originalPayee: string; payeeId: string };
  const mapping = importPayeeMappingService.upsertMapping(userId, originalPayee, payeeId);
  res.status(201).json({ mapping });
}));

// DELETE /api/import-payee-mappings/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  const userId = (req as AuthenticatedRequest).user.userId;
  const id = req.params.id as string;
  importPayeeMappingService.deleteMapping(userId, id);
  res.status(204).send();
}));

export default router;
