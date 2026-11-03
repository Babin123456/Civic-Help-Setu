import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRateLimiter, emailVerificationResendLimiter, emailChangeRequestLimiter, preferenceUpdateLimiter } from '../services/rateLimiter.js';

describe('rateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('createRateLimiter', () => {
    it('creates a limiter with correct limit and window', () => {
      const limiter = createRateLimiter({ limit: 5, windowMs: 60000 });
      expect(limiter).toBeDefined();
      expect(typeof limiter.take).toBe('function');
      expect(typeof limiter.reset).toBe('function');
      expect(typeof limiter.getWindow).toBe('function');
    });

    it('throws for invalid limit', () => {
      expect(() => createRateLimiter({ limit: 0, windowMs: 60000 })).toThrow();
      expect(() => createRateLimiter({ limit: -1, windowMs: 60000 })).toThrow();
      expect(() => createRateLimiter({ limit: 1.5, windowMs: 60000 })).toThrow();
    });

    it('throws for invalid windowMs', () => {
      expect(() => createRateLimiter({ limit: 5, windowMs: 0 })).toThrow();
      expect(() => createRateLimiter({ limit: 5, windowMs: -1 })).toThrow();
    });

    it('allows requests up to limit', () => {
      const limiter = createRateLimiter({ limit: 3, windowMs: 60000 });

      expect(limiter.take('key1').allowed).toBe(true);
      expect(limiter.take('key1').allowed).toBe(true);
      expect(limiter.take('key1').allowed).toBe(true);
      expect(limiter.take('key1').allowed).toBe(false);
    });

    it('tracks remaining requests', () => {
      const limiter = createRateLimiter({ limit: 3, windowMs: 60000 });

      expect(limiter.take('key1').remaining).toBe(2);
      expect(limiter.take('key1').remaining).toBe(1);
      expect(limiter.take('key1').remaining).toBe(0);
    });

    it('returns retryAfterSeconds when blocked', () => {
      const limiter = createRateLimiter({ limit: 2, windowMs: 60000 });
      limiter.take('key1');
      limiter.take('key1');
      const result = limiter.take('key1');

      expect(result.allowed).toBe(false);
      expect(result.retryAfterSeconds).toBeGreaterThan(0);
      expect(result.retryAfterSeconds).toBeLessThanOrEqual(60);
    });

    it('separates limits by key', () => {
      const limiter = createRateLimiter({ limit: 2, windowMs: 60000 });

      limiter.take('key1');
      limiter.take('key1');
      expect(limiter.take('key1').allowed).toBe(false);
      expect(limiter.take('key2').allowed).toBe(true);
    });

    it('resets after window expires', () => {
      const limiter = createRateLimiter({ limit: 2, windowMs: 60000 });

      limiter.take('key1');
      limiter.take('key1');
      expect(limiter.take('key1').allowed).toBe(false);

      vi.advanceTimersByTime(61000);
      expect(limiter.take('key1').allowed).toBe(true);
    });

    it('resets specific key', () => {
      const limiter = createRateLimiter({ limit: 2, windowMs: 60000 });

      limiter.take('key1');
      limiter.take('key1');
      expect(limiter.take('key1').allowed).toBe(false);

      limiter.reset('key1');
      expect(limiter.take('key1').allowed).toBe(true);
    });

    it('getWindow returns window info', () => {
      const limiter = createRateLimiter({ limit: 2, windowMs: 60000 });
      limiter.take('key1');
      const window = limiter.getWindow('key1');

      expect(window).toBeDefined();
      expect(window.count).toBe(1);
      expect(window.resetAt).toBeGreaterThan(Date.now());
    });

    it('size returns number of active windows', () => {
      const limiter = createRateLimiter({ limit: 2, windowMs: 60000 });

      expect(limiter.size()).toBe(0);
      limiter.take('key1');
      expect(limiter.size()).toBe(1);
      limiter.take('key2');
      expect(limiter.size()).toBe(2);
    });

    it('uses custom now function', () => {
      const customNow = vi.fn(() => 1000000);
      const limiter = createRateLimiter({ limit: 2, windowMs: 60000, now: customNow });

      limiter.take('key1');
      limiter.take('key1');
      expect(limiter.take('key1').allowed).toBe(false);

      customNow.mockReturnValue(1061000);
      expect(limiter.take('key1').allowed).toBe(true);
    });

    it('enforces maxKeys limit', () => {
      const limiter = createRateLimiter({ limit: 1, windowMs: 60000, maxKeys: 2 });

      limiter.take('key1');
      limiter.take('key2');
      expect(limiter.size()).toBe(2);

      limiter.take('key3');
      expect(limiter.size()).toBe(2);
    });
  });

  describe('pre-configured limiters', () => {
    it('emailVerificationResendLimiter has correct config', () => {
      const limiter = emailVerificationResendLimiter;
      expect(limiter.take('test').remaining).toBe(2);
      limiter.take('test');
      limiter.take('test');
      expect(limiter.take('test').allowed).toBe(false);
    });

    it('emailChangeRequestLimiter has correct config', () => {
      const limiter = emailChangeRequestLimiter;
      expect(limiter.take('test').remaining).toBe(1);
      limiter.take('test');
      expect(limiter.take('test').allowed).toBe(false);
    });

    it('preferenceUpdateLimiter has correct config', () => {
      const limiter = preferenceUpdateLimiter;
      expect(limiter.take('test').remaining).toBe(29);
      for (let i = 0; i < 29; i++) limiter.take('test');
      expect(limiter.take('test').allowed).toBe(false);
    });
  });
});