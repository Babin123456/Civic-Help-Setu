import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProviderCircuitBreaker } from './circuitBreaker.js';
import { CIRCUIT_STATE, GATEWAY_ERROR_CODES } from './gatewayTypes.js';

describe('CircuitBreaker (#1153)', () => {
  let breaker;

  beforeEach(() => {
    breaker = new ProviderCircuitBreaker({
      failureThreshold: 2,
      cooldownPeriodMs: 50,
      defaultTimeoutMs: 100,
    });
  });

  it('initializes in CLOSED state', () => {
    expect(breaker.getState('test-provider')).toBe(CIRCUIT_STATE.CLOSED);
    expect(breaker.canExecute('test-provider')).toBe(true);
  });

  it('transitions to OPEN state after reaching failure threshold', () => {
    breaker.recordFailure('test-provider', new Error('Fail 1'));
    expect(breaker.getState('test-provider')).toBe(CIRCUIT_STATE.CLOSED);

    breaker.recordFailure('test-provider', new Error('Fail 2'));
    expect(breaker.getState('test-provider')).toBe(CIRCUIT_STATE.OPEN);
    expect(breaker.canExecute('test-provider')).toBe(false);
  });

  it('executes fallback immediately when circuit is OPEN without waiting', async () => {
    breaker.recordFailure('test-provider', new Error('Fail 1'));
    breaker.recordFailure('test-provider', new Error('Fail 2'));

    const mockPrimary = vi.fn();
    const mockFallback = vi.fn().mockResolvedValue({ status: 'fallback-executed' });

    const result = await breaker.execute('test-provider', mockPrimary, mockFallback);

    expect(mockPrimary).not.toHaveBeenCalled();
    expect(mockFallback).toHaveBeenCalledWith(
      expect.objectContaining({
        fallbackTriggered: true,
        fallbackReason: expect.stringContaining(GATEWAY_ERROR_CODES.CIRCUIT_BREAKER_OPEN),
      })
    );
    expect(result.status).toBe('fallback-executed');
  });

  it('triggers fallback on request timeout', async () => {
    const slowFn = () => new Promise((resolve) => setTimeout(resolve, 200));
    const fallbackFn = vi.fn().mockResolvedValue({ status: 'timeout-fallback' });

    const result = await breaker.execute('test-provider', slowFn, fallbackFn, { timeoutMs: 50 });

    expect(fallbackFn).toHaveBeenCalledWith(
      expect.objectContaining({
        fallbackTriggered: true,
        fallbackReason: expect.stringContaining(GATEWAY_ERROR_CODES.TIMEOUT_EXCEEDED),
      })
    );
    expect(result.status).toBe('timeout-fallback');
  });

  it('transitions to HALF_OPEN after cooldown period and recovers on success', async () => {
    breaker.recordFailure('test-provider', new Error('Err 1'));
    breaker.recordFailure('test-provider', new Error('Err 2'));
    expect(breaker.getState('test-provider')).toBe(CIRCUIT_STATE.OPEN);

    // Wait for cooldown
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(breaker.getState('test-provider')).toBe(CIRCUIT_STATE.HALF_OPEN);

    // Successful execution in half-open should close the circuit
    breaker.recordSuccess('test-provider');
    expect(breaker.getState('test-provider')).toBe(CIRCUIT_STATE.CLOSED);
  });

  it('retries transient failures and succeeds if an attempt succeeds', async () => {
    let attempts = 0;
    const transientFn = vi.fn().mockImplementation(async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('Transient 503');
      return { status: 'retry-succeeded' };
    });
    const fallbackFn = vi.fn();

    const result = await breaker.execute('retry-provider', transientFn, fallbackFn, {
      maxRetries: 1,
      retryDelayMs: 10,
    });

    expect(attempts).toBe(2);
    expect(result.status).toBe('retry-succeeded');
    expect(fallbackFn).not.toHaveBeenCalled();
    expect(breaker.getState('retry-provider')).toBe(CIRCUIT_STATE.CLOSED);
  });

  it('exhausts retries and falls back when all attempts fail', async () => {
    let attempts = 0;
    const persistentFail = vi.fn().mockImplementation(async () => {
      attempts += 1;
      throw new Error('Persistent failure');
    });
    const fallbackFn = vi.fn().mockResolvedValue({ status: 'fallback-after-retries' });

    const result = await breaker.execute('retry-fail-provider', persistentFail, fallbackFn, {
      maxRetries: 2,
      retryDelayMs: 5,
    });

    expect(attempts).toBe(3); // 1 initial + 2 retries
    expect(result.status).toBe('fallback-after-retries');
    expect(fallbackFn).toHaveBeenCalledWith(
      expect.objectContaining({ retriesExhausted: true })
    );
  });
});
