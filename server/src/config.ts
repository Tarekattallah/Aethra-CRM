import 'dotenv/config';
import type { SignOptions } from 'jsonwebtoken';

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must contain at least 32 characters. Configure server/.env before starting.');
  }
  return secret;
}

export const jwtExpiresIn = (process.env.JWT_EXPIRES_IN || '1d') as SignOptions['expiresIn'];
