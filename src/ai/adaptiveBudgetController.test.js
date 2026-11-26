import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  AdaptiveBudgetController,
  trimContextChunks,
  DEFAULT_BUDGET_POLICY
} from './adaptiveBudgetController.js';

describe('adaptiveBudgetController', () => {
  describe('trimContextChunks', () => {
    it('prioritizes high-ranking chunks and enforces chunk count limit', () => {
      const chunks = [
        { id: 'c1', sourceId: 'src_1', score: 0.7, title: 'Low score' },
        { id: 'c2', sourceId: 'src_2', score: 0.95, title: 'Top score' },
        { id: 'c3', sourceId: 'src_3', score: 0.85, title: 'Mid score' }
      ];

      const trimmed = trimContextChunks(chunks, 2);
      expect(trimmed.length).toBe(2);
      expect(trimmed[0].id).toBe('c2'); // Highest score
      expect(trimmed[1].id).toBe('c3'); // Second highest
      expect(trimmed.every(c => c.sourceId)).toBe(true);
    });

    it('handles empty or malformed chunks array gracefully', () => {
      expect(trimContextChunks(null)).toEqual([]);
      expect(trimContextChunks([])).toEqual([]);
    });
  });

  describe('AdaptiveBudgetController', () => {
    let controller;

    beforeEach(() => {
      controller = new AdaptiveBudgetController({
        MAX_INPUT_CHARS: 100,
        TIMEOUT_MS: 50,
        MAX_IDEMPOTENT_RETRIES: 1
      });
    });

    it('rejects oversized inputs and returns fallback response', async () => {
      const hugePrompt = 'A'.repeat(150);
      const mockCall = vi.fn();

      const result = await controller.executeProtectedCall(mockCall, { prompt: hugePrompt });
      expect(result.success).toBe(false);
      expect(result.fallback).toBe(true);
      expect(result.message).toContain('exceeds safety budget');
      expect(mockCall).not.toHaveBeenCalled();
    });

    it('executes within budget and records usage metrics', async () => {
      const mockCall = vi.fn().mockResolvedValue({ text: 'Official guidance on ration card.' });
      const chunks = [{ id: '1', sourceId: 'doc_42', score: 0.9 }];

      const result = await controller.executeProtectedCall(mockCall, {
        prompt: 'Ration card query',
        contextChunks: chunks
      });

      expect(result.success).toBe(true);
      expect(result.output).toBe('Official guidance on ration card.');
      expect(result.citations).toEqual(['doc_42']);

      const report = controller.getAggregateUsageReport();
      expect(report.totalRequests).toBe(1);
      expect(report.totalEstimatedTokens).toBeGreaterThan(0);
    });

    it('returns clear fallback message when provider times out without retrying non-idempotent operations', async () => {
      const slowCall = vi.fn().mockImplementation(() => new Promise(res => setTimeout(res, 100)));

      const result = await controller.executeProtectedCall(slowCall, {
        prompt: 'State mutating query',
        isIdempotent: false // Must not retry
      });

      expect(result.success).toBe(false);
      expect(result.fallback).toBe(true);
      expect(result.message).toContain('experiencing high load');
      expect(slowCall).toHaveBeenCalledTimes(1); // Exactly 1 call, no retries
    });
  });
});
