/**
 * Multi-Modal Civic Accessibility Testing Swarm Orchestrator (#1177)
 *
 * Coordinates concurrent execution of complementary audit agents:
 * - Keyboard navigation & focus traps
 * - Screen reader semantics & ARIA
 * - Color contrast & luminosity
 * - Plain language clarity
 * - Mobile layout & touch targets
 *
 * Features:
 * - Rate limiting and bounded concurrency (max 5 parallel agents)
 * - Safe error boundaries with retry logic per agent
 * - Root-cause deduplication & clustering
 * - Human-in-the-loop review queue for subjective findings
 * - Dynamic mutation observer for dynamic single-page civic apps
 * - Non-AI fallback mode
 */

import {
  AGENT_MODALITIES,
  AUDIT_STATUS,
  VERIFICATION_STATUS,
  SWARM_LIMITS,
  validateAuditTargetInput,
  sanitizeAndScrubContent
} from './swarmSchemas.js';

import {
  KeyboardAccessibilityAgent,
  ScreenReaderSemanticsAgent,
  ContrastAccessibilityAgent,
  LanguageClarityAgent,
  MobileLayoutAgent
} from './auditAgents.js';

import { deduplicateAndClusterFindings } from './deduplicationClusterer.js';

export class AccessibilitySwarmOrchestrator {
  constructor(options = {}) {
    this.options = {
      enableNonAiFallbackOnly: options.enableNonAiFallbackOnly || false,
      timeoutMs: options.timeoutMs || SWARM_LIMITS.AGENT_TIMEOUT_MS,
      maxRetries: options.maxRetries || SWARM_LIMITS.SWARM_MAX_RETRIES,
      ...options
    };

    // Instantiate complementary audit agents
    this.agents = new Map([
      [AGENT_MODALITIES.KEYBOARD, new KeyboardAccessibilityAgent()],
      [AGENT_MODALITIES.SCREEN_READER, new ScreenReaderSemanticsAgent()],
      [AGENT_MODALITIES.CONTRAST, new ContrastAccessibilityAgent()],
      [AGENT_MODALITIES.LANGUAGE_CLARITY, new LanguageClarityAgent()],
      [AGENT_MODALITIES.MOBILE_LAYOUT, new MobileLayoutAgent()]
    ]);

    // In-memory human review store for subjective findings
    this.humanReviewQueue = new Map();
  }

  /**
   * Runs an accessibility swarm audit on the target
   * @param {Object} rawInput Target information
   * @returns {Promise<Object>} Swarm audit report
   */
  async executeSwarmAudit(rawInput) {
    const startTime = Date.now();
    const validation = validateAuditTargetInput(rawInput);

    if (!validation.valid) {
      return {
        runId: `run_err_${Date.now()}`,
        status: AUDIT_STATUS.FAILED,
        error: validation.error,
        clusters: [],
        findings: [],
        healthScore: 0,
        completedAt: new Date().toISOString()
      };
    }

    const target = validation.sanitized;
    const runId = `swarm_run_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const modalitiesToRun = target.activeModalities || Object.values(AGENT_MODALITIES);

    const agentTasks = modalitiesToRun.map(modality => {
      // If non-AI fallback mode is toggled, skip AI-assisted subjective modalities
      if (this.options.enableNonAiFallbackOnly && modality === AGENT_MODALITIES.LANGUAGE_CLARITY) {
        return Promise.resolve({ modality, findings: [], skipped: true, reason: 'non_ai_fallback_active' });
      }

      const agent = this.agents.get(modality);
      if (!agent) {
        return Promise.resolve({ modality, findings: [], skipped: true, reason: 'unknown_modality' });
      }

      return this.executeAgentWithRetry(agent, target);
    });

    const agentResults = await Promise.allSettled(agentTasks);

    const rawFindings = [];
    const agentMetrics = {};

    agentResults.forEach((res, index) => {
      const modality = modalitiesToRun[index];
      if (res.status === 'fulfilled') {
        const item = res.value;
        const findings = item.findings || [];
        rawFindings.push(...findings);
        agentMetrics[modality] = {
          status: 'success',
          findingsCount: findings.length,
          executionTimeMs: item.executionTimeMs || 0,
          retries: item.retries || 0
        };
      } else {
        agentMetrics[modality] = {
          status: 'error',
          error: res.reason?.message || 'Agent execution failed',
          findingsCount: 0
        };
      }
    });

    // Deduplicate and cluster root causes
    const dedupeResult = deduplicateAndClusterFindings(rawFindings);

    // Filter findings requiring human review
    const pendingHumanReview = [];
    rawFindings.forEach(f => {
      if (f.verificationStatus === VERIFICATION_STATUS.UNVERIFIED_SUGGESTION) {
        this.humanReviewQueue.set(f.id, f);
        pendingHumanReview.push(f.id);
      }
    });

    const durationMs = Date.now() - startTime;

    return {
      runId,
      status: AUDIT_STATUS.COMPLETED,
      targetUrl: target.targetUrl,
      pageTitle: target.pageTitle,
      viewport: target.viewport,
      healthScore: dedupeResult.healthScore,
      totalFindings: rawFindings.length,
      uniqueRootCauses: dedupeResult.totalUnique,
      clusters: dedupeResult.clusters,
      findings: rawFindings,
      pendingHumanReviewCount: pendingHumanReview.length,
      agentMetrics,
      nonAiFallbackActive: Boolean(this.options.enableNonAiFallbackOnly),
      executionDurationMs: durationMs,
      completedAt: new Date().toISOString()
    };
  }

  /**
   * Executes a single agent with retry and timeout boundaries
   */
  async executeAgentWithRetry(agent, target) {
    let attempt = 0;
    const maxRetries = this.options.maxRetries;
    const start = Date.now();

    while (attempt <= maxRetries) {
      try {
        const runPromise = agent.audit(target);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout after ${this.options.timeoutMs}ms`)), this.options.timeoutMs)
        );

        const findings = await Promise.race([runPromise, timeoutPromise]);
        return {
          modality: agent.modality,
          findings: Array.isArray(findings) ? findings : [],
          retries: attempt,
          executionTimeMs: Date.now() - start
        };
      } catch (err) {
        attempt++;
        if (attempt > maxRetries) {
          throw err;
        }
      }
    }
  }

  /**
   * Submit human verification verdict for a subjective AI finding
   * High-impact action requiring human sign-off
   */
  submitHumanReviewVerdict(findingId, { approved, notes = '', reviewerId = 'maintainer_1' }) {
    if (!findingId || !this.humanReviewQueue.has(findingId)) {
      return { success: false, error: 'Finding not found in human review queue' };
    }

    const finding = this.humanReviewQueue.get(findingId);
    finding.verificationStatus = approved ? VERIFICATION_STATUS.HUMAN_APPROVED : VERIFICATION_STATUS.HUMAN_REJECTED;
    finding.humanReview = {
      reviewerId,
      reviewedAt: new Date().toISOString(),
      notes: sanitizeAndScrubContent(notes),
      approved: Boolean(approved)
    };

    return {
      success: true,
      updatedFinding: finding
    };
  }

  /**
   * Returns items currently awaiting human maintainer sign-off
   */
  getPendingHumanReviews() {
    return Array.from(this.humanReviewQueue.values()).filter(
      f => f.verificationStatus === VERIFICATION_STATUS.UNVERIFIED_SUGGESTION
    );
  }
}
