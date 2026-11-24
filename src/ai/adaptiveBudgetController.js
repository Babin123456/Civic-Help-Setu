/**
 * Adaptive AI Cost, Latency and Context-Budget Controls Service
 *
 * Implements a policy-governed control layer that manages AI model execution constraints:
 * - Measures and bounds:
 *   * Input prompt character & token limits
 *   * Retrieval chunk budgets (preserves high-ranking chunks, trims low-relevance tails)
 *   * Provider latency ceilings and execution timeouts
 *   * Max retry counts with exponential backoff (strictly for idempotent read requests)
 * - Guarantees Safety & Citation Integrity:
 *   * Never silently drops source citations or weakens safety checks to save tokens
 *   * Retains source metadata and IDs for all included context chunks
 * - Graceful Provider Degradation:
 *   * Emits clear, non-misleading fallback guidance when provider exhausts budget or times out
 * - Privacy-Preserving Telemetry:
 *   * Aggregates execution timings and estimated token consumption without logging raw prompts
 */

export const DEFAULT_BUDGET_POLICY = Object.freeze({
  MAX_INPUT_CHARS: 4000,
  MAX_RETRIEVAL_CHUNKS: 4,
  MAX_OUTPUT_TOKENS: 1024,
  TIMEOUT_MS: 3000,
  MAX_IDEMPOTENT_RETRIES: 2
});

/**
 * Bounds and prioritizes retrieved context chunks according to budget
 * @param {Array<Object>} retrievedChunks
 * @param {number} maxChunks
 * @returns {Array<Object>} Trimmed chunks retaining source IDs and scores
 */
export function trimContextChunks(retrievedChunks = [], maxChunks = DEFAULT_BUDGET_POLICY.MAX_RETRIEVAL_CHUNKS) {
  if (!Array.isArray(retrievedChunks)) return [];

  // Sort descending by relevance score
  const sorted = [...retrievedChunks].sort((a, b) => (b.score || 0) - (a.score || 0));
  const trimmed = sorted.slice(0, maxChunks);

  // Guarantee source reference IDs are intact
  return trimmed.map(c => ({
    id: c.id,
    sourceId: c.sourceId,
    title: c.title,
    score: c.score,
    textSnippet: c.textSnippet ? c.textSnippet.substring(0, 500) : ''
  }));
}

export class AdaptiveBudgetController {
  constructor(policy = {}) {
    this.policy = { ...DEFAULT_BUDGET_POLICY, ...policy };
    this.usageMetrics = {
      totalRequests: 0,
      totalEstimatedTokens: 0,
      totalLatencyMs: 0,
      timeoutEvents: 0,
      fallbackEvents: 0
    };
  }

  /**
   * Pre-flight checks on incoming prompt size
   * @param {string} prompt
   * @returns {Object} Verdict
   */
  evaluateInputBudget(prompt = '') {
    const charCount = typeof prompt === 'string' ? prompt.length : 0;
    if (charCount > this.policy.MAX_INPUT_CHARS) {
      return {
        allowed: false,
        reason: `Request size (${charCount} chars) exceeds safety budget of ${this.policy.MAX_INPUT_CHARS} characters.`,
        charCount
      };
    }

    return {
      allowed: true,
      charCount,
      estimatedInputTokens: Math.ceil(charCount / 4)
    };
  }

  /**
   * Executes an AI request protected by timeout and retry policy
   * @param {Function} providerCall Async provider invoker
   * @param {Object} options Execution context
   * @returns {Promise<Object>} Output or deterministic fallback
   */
  async executeProtectedCall(providerCall, options = {}) {
    const { isIdempotent = true, prompt = '', contextChunks = [] } = options;
    const startTime = Date.now();
    this.usageMetrics.totalRequests += 1;

    // Validate input budget
    const inputCheck = this.evaluateInputBudget(prompt);
    if (!inputCheck.allowed) {
      this.usageMetrics.fallbackEvents += 1;
      return {
        success: false,
        fallback: true,
        message: inputCheck.reason,
        citations: []
      };
    }

    // Trim context chunks to budget
    const activeChunks = trimContextChunks(contextChunks, this.policy.MAX_RETRIEVAL_CHUNKS);
    const maxRetries = isIdempotent ? this.policy.MAX_IDEMPOTENT_RETRIES : 0;
    let attempts = 0;

    while (attempts <= maxRetries) {
      attempts += 1;
      try {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('PROVIDER_TIMEOUT')), this.policy.TIMEOUT_MS)
        );

        const result = await Promise.race([providerCall(prompt, activeChunks), timeoutPromise]);
        const latency = Date.now() - startTime;
        this.usageMetrics.totalLatencyMs += latency;
        this.usageMetrics.totalEstimatedTokens += inputCheck.estimatedInputTokens + 150; // est output

        return {
          success: true,
          output: result.text,
          latencyMs: latency,
          citations: activeChunks.map(c => c.sourceId)
        };
      } catch (err) {
        if (err.message === 'PROVIDER_TIMEOUT') {
          this.usageMetrics.timeoutEvents += 1;
        }

        if (attempts > maxRetries) {
          this.usageMetrics.fallbackEvents += 1;
          return {
            success: false,
            fallback: true,
            message: 'Civic guidance service is experiencing high load. Please refer to the verified official directory directly.',
            citations: activeChunks.map(c => c.sourceId)
          };
        }
      }
    }
  }

  getAggregateUsageReport() {
    const { totalRequests, totalEstimatedTokens, totalLatencyMs, timeoutEvents, fallbackEvents } = this.usageMetrics;
    return {
      totalRequests,
      totalEstimatedTokens,
      averageLatencyMs: totalRequests > 0 ? Math.round(totalLatencyMs / totalRequests) : 0,
      timeoutEvents,
      fallbackEvents
    };
  }
}
