import { describe, it, expect, beforeEach } from 'vitest';
import {
  validateAuditTargetInput,
  sanitizeAndScrubContent,
  createCanonicalFinding,
  AGENT_MODALITIES,
  FINDING_SEVERITY,
  VERIFICATION_STATUS
} from './swarmSchemas.js';
import { AccessibilitySwarmOrchestrator } from './swarmOrchestrator.js';
import { deduplicateAndClusterFindings } from './deduplicationClusterer.js';
import {
  SYNTHETIC_CLEAN_PAGE,
  SYNTHETIC_ACCESSIBILITY_DEFECTS_PAGE,
  SYNTHETIC_PII_CONTAMINATED_PAGE
} from './syntheticFixtures.js';

describe('Accessibility Swarm Testing Suite (#1177)', () => {
  let orchestrator;

  beforeEach(() => {
    orchestrator = new AccessibilitySwarmOrchestrator();
  });

  describe('Contract Validation and PII Boundary Sanitization', () => {
    it('rejects invalid inputs safely', () => {
      const result = validateAuditTargetInput(null);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('non-null object');
    });

    it('rejects invalid target URLs', () => {
      const result = validateAuditTargetInput({ targetUrl: 'ftp://bad-url' });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must start with http');
    });

    it('scrubs citizen Aadhaar, PAN, phone and email from payloads', () => {
      const scrubbed = sanitizeAndScrubContent(SYNTHETIC_PII_CONTAMINATED_PAGE);
      expect(scrubbed).not.toContain('9876 5432 1098');
      expect(scrubbed).not.toContain('ABCDE1234F');
      expect(scrubbed).not.toContain('applicant.citizen@example.gov.in');
      expect(scrubbed).toContain('[REDACTED_AADHAAR]');
      expect(scrubbed).toContain('[REDACTED_PAN]');
      expect(scrubbed).toContain('[REDACTED_EMAIL]');
    });
  });

  describe('Swarm Execution on Synthetic Clean Page', () => {
    it('produces high health score and zero critical defects for accessible HTML', async () => {
      const report = await orchestrator.executeSwarmAudit({
        targetUrl: '/services/ration',
        pageTitle: 'Ration Application',
        domSnapshot: SYNTHETIC_CLEAN_PAGE
      });

      expect(report.status).toBe('completed');
      expect(report.healthScore).toBeGreaterThanOrEqual(95);
      expect(report.findings.filter(f => f.severity === FINDING_SEVERITY.CRITICAL)).toHaveLength(0);
    });
  });

  describe('Swarm Execution on Synthetic Defect Page', () => {
    it('detects complementary defects across multiple modalities', async () => {
      const report = await orchestrator.executeSwarmAudit({
        targetUrl: '/services/pension',
        pageTitle: 'Pension Form',
        domSnapshot: SYNTHETIC_ACCESSIBILITY_DEFECTS_PAGE
      });

      expect(report.status).toBe('completed');
      expect(report.findings.length).toBeGreaterThan(0);

      // Verify complementary modalities produced findings
      const modalities = new Set(report.findings.map(f => f.modality));
      expect(modalities.has(AGENT_MODALITIES.KEYBOARD)).toBe(true);
      expect(modalities.has(AGENT_MODALITIES.SCREEN_READER)).toBe(true);
      expect(modalities.has(AGENT_MODALITIES.CONTRAST)).toBe(true);
      expect(modalities.has(AGENT_MODALITIES.LANGUAGE_CLARITY)).toBe(true);
      expect(modalities.has(AGENT_MODALITIES.MOBILE_LAYOUT)).toBe(true);

      // Verify health score reflects penalties
      expect(report.healthScore).toBeLessThan(70);
    });

    it('deduplicates and clusters findings with primary and secondary modalities', () => {
      const f1 = createCanonicalFinding({
        modality: AGENT_MODALITIES.KEYBOARD,
        ruleId: 'keyboard.clickable_div',
        domSelector: 'div.btn-action',
        title: 'Clickable div without focus',
        severity: FINDING_SEVERITY.HIGH
      });

      const f2 = createCanonicalFinding({
        modality: AGENT_MODALITIES.SCREEN_READER,
        ruleId: 'aria.missing_button_role',
        domSelector: 'div.btn-action',
        title: 'Missing button role',
        severity: FINDING_SEVERITY.HIGH
      });

      const clustered = deduplicateAndClusterFindings([f1, f2]);
      expect(clustered.totalUnique).toBe(1);
      expect(clustered.clusters[0].count).toBe(2);
      expect(clustered.clusters[0].modalitiesInvolved).toContain(AGENT_MODALITIES.KEYBOARD);
      expect(clustered.clusters[0].modalitiesInvolved).toContain(AGENT_MODALITIES.SCREEN_READER);
    });
  });

  describe('Human-in-the-Loop Subjective Review & False Positive Handling', () => {
    it('routes subjective findings to pending review queue', async () => {
      const report = await orchestrator.executeSwarmAudit({
        targetUrl: '/services/affidavit',
        domSnapshot: SYNTHETIC_ACCESSIBILITY_DEFECTS_PAGE
      });

      const pending = orchestrator.getPendingHumanReviews();
      expect(pending.length).toBeGreaterThan(0);
      const subjectiveFinding = pending[0];
      expect(subjectiveFinding.verificationStatus).toBe(VERIFICATION_STATUS.UNVERIFIED_SUGGESTION);

      // Maintainer signs off
      const verdict = orchestrator.submitHumanReviewVerdict(subjectiveFinding.id, {
        approved: true,
        notes: 'Approved: Jargon should be simplified for rural citizens',
        reviewerId: 'maintainer_lead'
      });

      expect(verdict.success).toBe(true);
      expect(verdict.updatedFinding.verificationStatus).toBe(VERIFICATION_STATUS.HUMAN_APPROVED);
      expect(verdict.updatedFinding.humanReview.notes).toContain('rural citizens');
    });

    it('allows maintainers to reject false-positives', async () => {
      await orchestrator.executeSwarmAudit({
        targetUrl: '/services/affidavit',
        domSnapshot: SYNTHETIC_ACCESSIBILITY_DEFECTS_PAGE
      });

      const pending = orchestrator.getPendingHumanReviews();
      const findingToReject = pending[0];

      const verdict = orchestrator.submitHumanReviewVerdict(findingToReject.id, {
        approved: false,
        notes: 'False positive: required statutory legal quotation in court rule'
      });

      expect(verdict.success).toBe(true);
      expect(verdict.updatedFinding.verificationStatus).toBe(VERIFICATION_STATUS.HUMAN_REJECTED);
    });
  });

  describe('Non-AI Fallback Mode', () => {
    it('skips subjective AI analysis when non-AI fallback is requested', async () => {
      const fallbackOrchestrator = new AccessibilitySwarmOrchestrator({
        enableNonAiFallbackOnly: true
      });

      const report = await fallbackOrchestrator.executeSwarmAudit({
        targetUrl: '/services/offline',
        domSnapshot: SYNTHETIC_ACCESSIBILITY_DEFECTS_PAGE
      });

      expect(report.nonAiFallbackActive).toBe(true);
      const hasLanguageClarity = report.findings.some(
        f => f.modality === AGENT_MODALITIES.LANGUAGE_CLARITY
      );
      expect(hasLanguageClarity).toBe(false);
      expect(report.agentMetrics.language_clarity.status).toBe('success');
      expect(report.agentMetrics.language_clarity.findingsCount).toBe(0);
    });
  });

  describe('Fault Tolerance, Retry and Concurrency Limits', () => {
    it('handles unexpected agent crashes gracefully without terminating the entire swarm', async () => {
      // Inject a faulty agent
      orchestrator.agents.set(AGENT_MODALITIES.CONTRAST, {
        modality: AGENT_MODALITIES.CONTRAST,
        audit: async () => {
          throw new Error('Simulated contrast engine memory spike failure');
        }
      });

      const report = await orchestrator.executeSwarmAudit({
        targetUrl: '/services/resilience',
        domSnapshot: SYNTHETIC_ACCESSIBILITY_DEFECTS_PAGE
      });

      expect(report.status).toBe('completed');
      expect(report.agentMetrics.contrast.status).toBe('error');
      expect(report.agentMetrics.contrast.error).toContain('Simulated contrast engine');
      // Other agents should have succeeded
      expect(report.agentMetrics.keyboard.status).toBe('success');
    });
  });
});
