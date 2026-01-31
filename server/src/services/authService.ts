import { OAuth2Client } from 'google-auth-library';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/index.js';
import { RefreshTokenRow, User } from '../models/types.js';
import { ValidationError } from '../middleware/errorHandler.js';
import { findOrCreateUserFromGoogle, getUserById, GoogleUserInfo } from './userService.js';
import {
  generateAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  getRefreshTokenExpiry,
  AccessTokenPayload,
} from '../utils/jwt.js';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

// Initialize Google OAuth client
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: User;
}

/**
 * Verify a Google ID token and extract user info
 */
export async function verifyGoogleToken(idToken: string): Promise<GoogleUserInfo> {
  if (!GOOGLE_CLIENT_ID) {
    throw new ValidationError('Google Client ID not configured', {
      hint: 'Set GOOGLE_CLIENT_ID environment variable',
    });
  }

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      throw new ValidationError('Invalid Google token: no payload', {});
    }

    if (!payload.sub || !payload.email) {
      throw new ValidationError('Invalid Google token: missing required fields', {});
    }

    return {
      googleId: payload.sub,
      email: payload.email,
      name: payload.name || null,
      picture: payload.picture || null,
    };
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError('Invalid Google token', {
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Authenticate with Google ID token
 * Creates or updates user, generates access and refresh tokens
 */
export async function authenticateWithGoogle(idToken: string): Promise<AuthTokens> {
  // Verify the Google token
  const googleUser = await verifyGoogleToken(idToken);

  // Find or create user
  const user = findOrCreateUserFromGoogle(googleUser);

  // Generate tokens
  const accessTokenPayload: AccessTokenPayload = {
    userId: user.id,
    email: user.email,
  };
  const accessToken = generateAccessToken(accessTokenPayload);
  const refreshToken = generateRefreshToken();

  // Store refresh token (hashed)
  storeRefreshToken(user.id, refreshToken);

  return {
    accessToken,
    refreshToken,
    user,
  };
}

/**
 * Store a refresh token in the database
 */
function storeRefreshToken(userId: string, token: string): void {
  const db = getDb();
  const id = uuidv4();
  const tokenHash = hashRefreshToken(token);
  const expiresAt = getRefreshTokenExpiry().toISOString();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO refresh_token (id, user_id, token_hash, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, userId, tokenHash, expiresAt, now);
}

/**
 * Refresh access token using a refresh token
 */
export function refreshAccessToken(refreshToken: string): { accessToken: string; user: User } | null {
  const db = getDb();
  const tokenHash = hashRefreshToken(refreshToken);

  const row = db.prepare(`
    SELECT * FROM refresh_token WHERE token_hash = ?
  `).get(tokenHash) as RefreshTokenRow | undefined;

  if (!row) {
    return null;
  }

  // Check if expired
  if (new Date(row.expires_at) < new Date()) {
    // Clean up expired token
    db.prepare('DELETE FROM refresh_token WHERE id = ?').run(row.id);
    return null;
  }

  // Get user
  const user = getUserById(row.user_id);

  // Generate new access token
  const accessTokenPayload: AccessTokenPayload = {
    userId: user.id,
    email: user.email,
  };
  const accessToken = generateAccessToken(accessTokenPayload);

  return { accessToken, user };
}

/**
 * Revoke a refresh token (logout)
 */
export function revokeRefreshToken(refreshToken: string): void {
  const db = getDb();
  const tokenHash = hashRefreshToken(refreshToken);

  db.prepare('DELETE FROM refresh_token WHERE token_hash = ?').run(tokenHash);
}

/**
 * Revoke all refresh tokens for a user (logout all devices)
 */
export function revokeAllUserTokens(userId: string): void {
  const db = getDb();
  db.prepare('DELETE FROM refresh_token WHERE user_id = ?').run(userId);
}

/**
 * Clean up expired refresh tokens (can be called periodically)
 */
export function cleanupExpiredTokens(): number {
  const db = getDb();
  const result = db.prepare(`
    DELETE FROM refresh_token WHERE expires_at < datetime('now')
  `).run();

  return result.changes;
}
