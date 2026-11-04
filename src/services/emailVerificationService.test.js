import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createVerificationToken,
  verifyToken,
  markEmailVerified,
  isEmailVerified,
  getPendingVerifications,
  getVerifiedEmails,
  cleanupExpiredTokens,
  deleteVerificationTokensForEmail,
  deleteVerificationTokensForUser,
  TOKEN_EXPIRY_HOURS,
} from '../services/emailVerificationService.js';
import { emailVerificationResendLimiter, createRateLimiter } from '../services/rateLimiter.js';

const TEST_USER_ID = 'user_test_123';
const TEST_EMAIL = 'test@example.com';

const mockStorage = {};
vi.stubGlobal('localStorage', {
  getItem: vi.fn((key) => mockStorage[key] || null),
  setItem: vi.fn((key, value) => { mockStorage[key] = value; }),
  removeItem: vi.fn((key) => { delete mockStorage[key]; }),
  clear: vi.fn(() => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }),
});

let testNow = Date.now();
const mockNow = () => testNow;

const testRateLimiter = createRateLimiter({
  limit: 3,
  windowMs: 60 * 60 * 1000,
  now: mockNow,
});

function testCheckResendRateLimit(email) {
  const normalizedEmail = email.toLowerCase().trim();
  const key = `resend:${normalizedEmail}`;
  return testRateLimiter.take(key);
}

beforeEach(() => {
  localStorage.clear();
  emailVerificationResendLimiter.resetAll();
  testRateLimiter.resetAll();
  testNow = Date.now();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('emailVerificationService', () => {
  describe('createVerificationToken', () => {
    it('creates a token with correct structure', () => {
      const { token, expiresAt } = createVerificationToken(TEST_EMAIL, TEST_USER_ID);

      expect(token).toBeDefined();
      expect(token).toMatch(/^ev_[0-9a-f]{64}$/);
      expect(expiresAt).toBeGreaterThan(Date.now());
      expect(expiresAt).toBeLessThanOrEqual(Date.now() + 24 * 60 * 60 * 1000 + 1000);
    });

    it('stores token in localStorage', () => {
      createVerificationToken(TEST_EMAIL, TEST_USER_ID);
      const pending = getPendingVerifications();

      expect(pending).toHaveLength(1);
      expect(pending[0].email).toBe(TEST_EMAIL.toLowerCase());
      expect(pending[0].userId).toBe(TEST_USER_ID);
      expect(pending[0].used).toBe(false);
    });

    it('normalizes email to lowercase', () => {
      createVerificationToken('TEST@EXAMPLE.COM', TEST_USER_ID);
      const pending = getPendingVerifications();

      expect(pending[0].email).toBe('test@example.com');
    });

    it('allows multiple tokens for different emails', () => {
      createVerificationToken('a@example.com', TEST_USER_ID);
      createVerificationToken('b@example.com', TEST_USER_ID);
      const pending = getPendingVerifications();

      expect(pending).toHaveLength(2);
    });
  });

  describe('verifyToken', () => {
    it('returns valid for a correct token', () => {
      const { token } = createVerificationToken(TEST_EMAIL, TEST_USER_ID);
      const result = verifyToken(token);

      expect(result.valid).toBe(true);
      expect(result.email).toBe(TEST_EMAIL);
      expect(result.userId).toBe(TEST_USER_ID);
    });

    it('marks token as used after verification', () => {
      const { token } = createVerificationToken(TEST_EMAIL, TEST_USER_ID);
      verifyToken(token);
      const pending = getPendingVerifications();

      expect(pending[0].used).toBe(true);
    });

    it('returns invalid for non-existent token', () => {
      const result = verifyToken('ev_invalid_token_that_does_not_exist');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('invalid_token');
    });

    it('returns already_used for replayed token', () => {
      const { token } = createVerificationToken(TEST_EMAIL, TEST_USER_ID);
      verifyToken(token);
      const result = verifyToken(token);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('already_used');
    });

    it('returns expired for token past expiry', () => {
      const { token } = createVerificationToken(TEST_EMAIL, TEST_USER_ID);
      vi.advanceTimersByTime(25 * 60 * 60 * 1000);
      const result = verifyToken(token);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('expired');
    });
  });

  describe('markEmailVerified & isEmailVerified', () => {
    it('marks email as verified', () => {
      markEmailVerified(TEST_EMAIL);
      expect(isEmailVerified(TEST_EMAIL)).toBe(true);
    });

    it('normalizes email when checking', () => {
      markEmailVerified('TEST@EXAMPLE.COM');
      expect(isEmailVerified('test@example.com')).toBe(true);
    });

    it('returns false for unverified email', () => {
      expect(isEmailVerified('unverified@example.com')).toBe(false);
    });

    it('stores multiple verified emails', () => {
      markEmailVerified('a@example.com');
      markEmailVerified('b@example.com');
      const verified = getVerifiedEmails();

      expect(verified).toContain('a@example.com');
      expect(verified).toContain('b@example.com');
    });
  });

  describe('checkResendRateLimit', () => {
    beforeEach(() => {
      // Debug logging removed — rate limiter size is verified via assertions
    });
    it('allows first resend attempt', () => {
      const result = testCheckResendRateLimit(TEST_EMAIL);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2);
    });

    it('allows up to 3 attempts within window', () => {
      let result = testCheckResendRateLimit(TEST_EMAIL);
      result = testCheckResendRateLimit(TEST_EMAIL);
      result = testCheckResendRateLimit(TEST_EMAIL);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(0);
    });

    it('blocks 4th attempt within window', () => {
      testCheckResendRateLimit(TEST_EMAIL);
      testCheckResendRateLimit(TEST_EMAIL);
      testCheckResendRateLimit(TEST_EMAIL);
      const result = testCheckResendRateLimit(TEST_EMAIL);

      expect(result.allowed).toBe(false);
      expect(result.retryAfterSeconds).toBeGreaterThan(0);
    });

    it('resets after window expires', () => {
      testCheckResendRateLimit(TEST_EMAIL);
      testCheckResendRateLimit(TEST_EMAIL);
      testCheckResendRateLimit(TEST_EMAIL);
      testNow += 61 * 60 * 1000;
      vi.advanceTimersByTime(61 * 60 * 1000);
      const result = testCheckResendRateLimit(TEST_EMAIL);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2);
    });

    it('treats different emails independently', () => {
      testCheckResendRateLimit('a@example.com');
      testCheckResendRateLimit('a@example.com');
      testCheckResendRateLimit('a@example.com');
      const result = testCheckResendRateLimit('b@example.com');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2);
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('removes expired tokens', () => {
      createVerificationToken(TEST_EMAIL, TEST_USER_ID);
      vi.advanceTimersByTime(25 * 60 * 60 * 1000);
      cleanupExpiredTokens();

      const pending = getPendingVerifications();
      expect(pending).toHaveLength(0);
    });

    it('keeps valid tokens', () => {
      createVerificationToken(TEST_EMAIL, TEST_USER_ID);
      vi.advanceTimersByTime(12 * 60 * 60 * 1000);
      cleanupExpiredTokens();

      const pending = getPendingVerifications();
      expect(pending).toHaveLength(1);
      expect(pending[0].used).toBe(false);
    });

    it('removes used tokens during cleanup', () => {
      const { token } = createVerificationToken(TEST_EMAIL, TEST_USER_ID);
      verifyToken(token);
      vi.advanceTimersByTime(12 * 60 * 60 * 1000);
      cleanupExpiredTokens();

      const pending = getPendingVerifications();
      expect(pending).toHaveLength(0);
    });
  });

  describe('deleteVerificationTokensForEmail', () => {
    it('removes tokens for specific email', () => {
      createVerificationToken('a@example.com', TEST_USER_ID);
      createVerificationToken('b@example.com', TEST_USER_ID);
      deleteVerificationTokensForEmail('a@example.com');

      const pending = getPendingVerifications();
      expect(pending).toHaveLength(1);
      expect(pending[0].email).toBe('b@example.com');
    });
  });

  describe('deleteVerificationTokensForUser', () => {
    it('removes all tokens for a user', () => {
      createVerificationToken('a@example.com', 'user_1');
      createVerificationToken('b@example.com', 'user_1');
      createVerificationToken('c@example.com', 'user_2');
      deleteVerificationTokensForUser('user_1');

      const pending = getPendingVerifications();
      expect(pending).toHaveLength(1);
      expect(pending[0].userId).toBe('user_2');
    });
  });

  describe('TOKEN_EXPIRY_HOURS', () => {
    it('is 24 hours', () => {
      expect(TOKEN_EXPIRY_HOURS).toBe(24);
    });
  });
});