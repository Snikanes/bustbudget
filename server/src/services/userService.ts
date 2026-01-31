import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/index.js';
import { UserRow, User } from '../models/types.js';
import { NotFoundError } from '../middleware/errorHandler.js';

function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    googleId: row.google_id,
    email: row.email,
    name: row.name,
    picture: row.picture,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface GoogleUserInfo {
  googleId: string;
  email: string;
  name: string | null;
  picture: string | null;
}

/**
 * Find a user by their Google ID
 */
export function getUserByGoogleId(googleId: string): User | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT * FROM user WHERE google_id = ?
  `).get(googleId) as UserRow | undefined;

  return row ? rowToUser(row) : null;
}

/**
 * Find a user by their email
 */
export function getUserByEmail(email: string): User | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT * FROM user WHERE email = ?
  `).get(email) as UserRow | undefined;

  return row ? rowToUser(row) : null;
}

/**
 * Find a user by their ID
 */
export function getUserById(id: string): User {
  const db = getDb();
  const row = db.prepare(`
    SELECT * FROM user WHERE id = ?
  `).get(id) as UserRow | undefined;

  if (!row) {
    throw new NotFoundError('User', id);
  }

  return rowToUser(row);
}

/**
 * Create a new user from Google OAuth info
 */
export function createUser(googleUser: GoogleUserInfo): User {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO user (id, google_id, email, name, picture, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, googleUser.googleId, googleUser.email, googleUser.name, googleUser.picture, now, now);

  return getUserById(id);
}

/**
 * Update an existing user's Google info (name, picture may change)
 */
export function updateUserFromGoogle(id: string, googleUser: GoogleUserInfo): User {
  const db = getDb();

  db.prepare(`
    UPDATE user SET name = ?, picture = ?, google_id = ? WHERE id = ?
  `).run(googleUser.name, googleUser.picture, googleUser.googleId, id);

  return getUserById(id);
}

/**
 * Find or create a user based on Google OAuth info
 * If user exists with same email, links Google ID and updates profile
 * If user doesn't exist, creates new user
 */
export function findOrCreateUserFromGoogle(googleUser: GoogleUserInfo): User {
  // First try to find by Google ID
  const existingByGoogleId = getUserByGoogleId(googleUser.googleId);
  if (existingByGoogleId) {
    // Update name/picture in case they changed
    return updateUserFromGoogle(existingByGoogleId.id, googleUser);
  }

  // Then try to find by email (could be existing user linking Google account)
  const existingByEmail = getUserByEmail(googleUser.email);
  if (existingByEmail) {
    // Link Google ID to existing account
    return updateUserFromGoogle(existingByEmail.id, googleUser);
  }

  // Create new user
  return createUser(googleUser);
}
