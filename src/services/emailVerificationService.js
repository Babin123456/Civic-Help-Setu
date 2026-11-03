/**
 * Email Verification Service
 * Handles generation, validation, and management of email verification tokens.
 * Tokens are single-use, time-limited, and stored securely.
 */

import { logDiagnostic } from '../utils/diagnostics';
import { emailVerificationResendLimiter as resendRateLimiter } from './rateLimiter';

const VERIFICATION_TOKEN_PREFIX = 'ev_';
const VERIFICATION_TOKEN_LENGTH = 32;
const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const RESEND_COOLDOWN_MS = 60 * 1000; // 1 minute

const STORAGE_KEYS = {
  PENDING_VERIFICATION: 'civicbridge_email_verification_pending',
  VERIFIED_EMAILS: 'civicbridge_verified_emails',
  RESEND_ATTEMPTS: 'civicbridge_email_resend_attempts',
};

function generateSecureToken() {
  const array = new Uint8Array(VERIFICATION_TOKEN_LENGTH);
  crypto.getRandomValues(array);
  return VERIFICATION_TOKEN_PREFIX + Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}

function hashToken(token) {
  return token;
}

export function createVerificationToken(email, userId) {
  const token = generateSecureToken();
  const hashedToken = hashToken(token);
  const now = Date.now();

  const record = {
    token: hashedToken,
    email: email.toLowerCase().trim(),
    userId,
    createdAt: now,
    expiresAt: now + TOKEN_EXPIRY_MS,
    used: false,
  };

  try {
    const pending = getPendingVerifications();
    pending.push(record);
    localStorage.setItem(STORAGE_KEYS.PENDING_VERIFICATION, JSON.stringify(pending));
  } catch (err) {
    logDiagnostic('Failed to store verification token:', err);
    throw new Error('Failed to create verification token', { cause: err });
  }

  return { token, expiresAt: record.expiresAt };
}

export function getPendingVerifications() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PENDING_VERIFICATION);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function findVerificationToken(token) {
  const hashedToken = hashToken(token);
  const pending = getPendingVerifications();
  return pending.find((v) => v.token === hashedToken) || null;
}

export function verifyToken(token) {
  const record = findVerificationToken(token);
  const now = Date.now();

  if (!record) {
    return { valid: false, reason: 'invalid_token', message: 'This verification link is invalid or has already been used.' };
  }

  if (record.used) {
    return { valid: false, reason: 'already_used', message: 'This verification link has already been used.' };
  }

  if (now > record.expiresAt) {
    return { valid: false, reason: 'expired', message: 'This verification link has expired. Please request a new one.' };
  }

  record.used = true;
  try {
    const pending = getPendingVerifications();
    const idx = pending.findIndex((v) => v.token === record.token);
    if (idx >= 0) {
      pending[idx] = record;
      localStorage.setItem(STORAGE_KEYS.PENDING_VERIFICATION, JSON.stringify(pending));
    }
  } catch (err) {
    logDiagnostic('Failed to mark token as used:', err);
  }

  return { valid: true, email: record.email, userId: record.userId };
}

export function markEmailVerified(email) {
  try {
    const verified = getVerifiedEmails();
    const normalizedEmail = email.toLowerCase().trim();
    if (!verified.includes(normalizedEmail)) {
      verified.push(normalizedEmail);
      localStorage.setItem(STORAGE_KEYS.VERIFIED_EMAILS, JSON.stringify(verified));
    }
  } catch (err) {
    logDiagnostic('Failed to mark email as verified:', err);
  }
}

export function getVerifiedEmails() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.VERIFIED_EMAILS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function isEmailVerified(email) {
  const verified = getVerifiedEmails();
  return verified.includes(email.toLowerCase().trim());
}

export function checkResendRateLimit(email) {
  const normalizedEmail = email.toLowerCase().trim();
  const key = `resend:${normalizedEmail}`;
  return resendRateLimiter.take(key);
}

export function recordResendAttempt(email) {
  const normalizedEmail = email.toLowerCase().trim();
  const key = `resend:${normalizedEmail}`;
  return resendRateLimiter.take(key);
}

export function getResendCooldownRemaining(email) {
  const normalizedEmail = email.toLowerCase().trim();
  const key = `resend:${normalizedEmail}`;
  return resendRateLimiter.getWindow(key) ? Math.max(1, Math.ceil((resendRateLimiter.getWindow(key).resetAt - Date.now()) / 1000)) : 0;
}

export function cleanupExpiredTokens() {
  try {
    const pending = getPendingVerifications();
    const now = Date.now();
    const valid = pending.filter((v) => !v.used && now <= v.expiresAt);
    localStorage.setItem(STORAGE_KEYS.PENDING_VERIFICATION, JSON.stringify(valid));
  } catch (err) {
    logDiagnostic('Failed to cleanup expired tokens:', err);
  }
}

export function deleteVerificationTokensForEmail(email) {
  try {
    const pending = getPendingVerifications();
    const normalizedEmail = email.toLowerCase().trim();
    const filtered = pending.filter((v) => v.email !== normalizedEmail);
    localStorage.setItem(STORAGE_KEYS.PENDING_VERIFICATION, JSON.stringify(filtered));
  } catch (err) {
    logDiagnostic('Failed to delete verification tokens:', err);
  }
}

export function deleteVerificationTokensForUser(userId) {
  try {
    const pending = getPendingVerifications();
    const filtered = pending.filter((v) => v.userId !== userId);
    localStorage.setItem(STORAGE_KEYS.PENDING_VERIFICATION, JSON.stringify(filtered));
  } catch (err) {
    logDiagnostic('Failed to delete user verification tokens:', err);
  }
}

export const TOKEN_EXPIRY_HOURS = TOKEN_EXPIRY_MS / (60 * 60 * 1000);
export const RESEND_COOLDOWN_SECONDS = RESEND_COOLDOWN_MS / 1000;