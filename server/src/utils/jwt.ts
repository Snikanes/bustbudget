import jwt, { SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';

// Environment variables with defaults for development
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

/**
 * Resolve JWT_ACCESS_TOKEN_EXPIRY into something jsonwebtoken reads the way
 * an operator expects.
 *
 * jsonwebtoken treats a *number* as seconds but a *string* as an ms() timespan,
 * and ms() reads a bare numeric string as milliseconds. Environment variables
 * are always strings, so JWT_ACCESS_TOKEN_EXPIRY=15 means 15ms, which floors to
 * a zero-second lifetime: every token is issued already expired, the client
 * refreshes successfully, and the retry still 401s. Nobody wants milliseconds
 * here, so a bare number is taken as seconds, matching the library's own
 * documented units.
 */
export function parseAccessTokenExpiry(raw: string | undefined): SignOptions['expiresIn'] {
  const value = raw?.trim();
  if (!value) return '1d';
  if (/^\d+$/.test(value)) return Number(value);
  return value as SignOptions['expiresIn'];
}

const ACCESS_TOKEN_EXPIRY = parseAccessTokenExpiry(process.env.JWT_ACCESS_TOKEN_EXPIRY);

export interface AccessTokenPayload {
  userId: string;
  email: string;
}

export interface DecodedAccessToken extends AccessTokenPayload {
  iat: number;
  exp: number;
}

/**
 * Generate an access token (JWT) for a user
 */
export function generateAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });
}

/**
 * Verify and decode an access token
 * Returns null if invalid or expired
 */
export function verifyAccessToken(token: string): DecodedAccessToken | null {
  try {
    return jwt.verify(token, JWT_SECRET) as DecodedAccessToken;
  } catch {
    return null;
  }
}

/**
 * Generate a secure random refresh token
 */
export function generateRefreshToken(): string {
  return crypto.randomBytes(64).toString('hex');
}

/**
 * Hash a refresh token for secure storage
 */
export function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Calculate refresh token expiration date
 */
export function getRefreshTokenExpiry(): Date {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);
  return expiry;
}

/**
 * Cookie options for access token (HTTP-only, secure in production)
 */
export function getAccessTokenCookieOptions(): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'strict' | 'lax' | 'none';
  maxAge: number;
  path: string;
} {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000, // 1 day in milliseconds
    path: '/',
  };
}

/**
 * Cookie options for refresh token (HTTP-only, secure in production)
 */
export function getRefreshTokenCookieOptions(): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'strict' | 'lax' | 'none';
  maxAge: number;
  path: string;
} {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    maxAge: REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000, // 7 days in milliseconds
    path: '/',
  };
}
