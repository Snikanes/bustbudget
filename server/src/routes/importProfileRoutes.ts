import { Router, Request, Response, NextFunction } from 'express';
import * as importProfileService from '../services/importProfileService.js';
import { AuthenticatedRequest, CreateImportProfileRequest, UpdateImportProfileRequest } from '../models/types.js';

const router = Router();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// GET /api/import-profiles
router.get('/', asyncHandler(async (req, res) => {
  const userId = (req as AuthenticatedRequest).user.userId;
  const profiles = importProfileService.getAllProfiles(userId);
  res.json({ profiles });
}));

// POST /api/import-profiles
router.post('/', asyncHandler(async (req, res) => {
  const userId = (req as AuthenticatedRequest).user.userId;
  const { name, fileType, config } = req.body as CreateImportProfileRequest;
  const profile = importProfileService.createProfile(userId, name, fileType, config);
  res.status(201).json({ profile });
}));

// PUT /api/import-profiles/:id
router.put('/:id', asyncHandler(async (req, res) => {
  const userId = (req as AuthenticatedRequest).user.userId;
  const id = req.params.id as string;
  const updates = req.body as UpdateImportProfileRequest;
  const profile = importProfileService.updateProfile(userId, id, updates);
  res.json({ profile });
}));

// DELETE /api/import-profiles/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  const userId = (req as AuthenticatedRequest).user.userId;
  const id = req.params.id as string;
  importProfileService.deleteProfile(userId, id);
  res.status(204).send();
}));

export default router;
