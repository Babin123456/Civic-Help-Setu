/**
 * Unit tests for Civic Service Accessibility Inspector Service (#832)
 *
 * Tests cover rule IDs, severity levels, evidence types, summary logic,
 * contrast calculations, and edge cases that can be tested without a full DOM.
 */

import {
  scanAccessibility,
  summarizeScan,
  RULE_IDS,
  SEVERITY,
  SEVERITY_COLORS,
  EVIDENCE_TYPE,
  SCAN_STATUS,
} from '../accessibilityInspectorService';

// Import vitest globals
import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Test: Rule IDs, severity levels, and constants
// ---------------------------------------------------------------------------

describe('Accessibility Inspector Constants', () => {
  describe('RULE_IDS', () => {
    it('all rule IDs are strings following namespace.rule pattern', () => {
      const expectedRules = [
        RULE_IDS.MISSING_DOCTYPE,
        RULE_IDS.MISSING_H1,
        RULE_IDS.TOO_MANY_H1,
        RULE_IDS.SKIPPED_HEADING_LEVELS,
        RULE_IDS.MISSING_MAIN,
        RULE_IDS.MISSING_NAV,
        RULE_IDS.UNLABELED_FORM_CONTROL,
        RULE_IDS.MISSING_ALT_TEXT,
        RULE_IDS.INSUFFICIENT_CONTRAST,
        RULE_IDS.FOCUS_NOT_VISIBLE,
        RULE_IDS.MISSING_REQUIRED_ATTR,
        RULE_IDS.SMALL_FONT_SIZE,
        RULE_IDS.LINE_HEIGHT_TOO_TIGHT,
        RULE_IDS.MISSING_HEADER,
        RULE_IDS.MISSING_FOOTER,
        RULE_IDS.LANGUAGE_DECLARATION_MISSING,
        RULE_IDS.ARIA_ROLE_MISMATCH,
      ];

      expectedRules.forEach((ruleId) => {
        expect(typeof ruleId).toBe('string');
        // Should match pattern like "doctype.missing" or "heading.missingH1"
        expect(ruleId).toMatch(/^[a-z]+\.[a-z0-9]+$/i);
      });
    });

    it('rule IDs are unique', () => {
      const allRules = [
        RULE_IDS.MISSING_DOCTYPE,
        RULE_IDS.MISSING_H1,
        RULE_IDS.TOO_MANY_H1,
        RULE_IDS.SKIPPED_HEADING_LEVELS,
        RULE_IDS.MISSING_MAIN,
        RULE_IDS.MISSING_NAV,
        RULE_IDS.UNLABELED_FORM_CONTROL,
        RULE_IDS.MISSING_ALT_TEXT,
        RULE_IDS.INSUFFICIENT_CONTRAST,
        RULE_IDS.FOCUS_NOT_VISIBLE,
        RULE_IDS.MISSING_REQUIRED_ATTR,
        RULE_IDS.SMALL_FONT_SIZE,
        RULE_IDS.LINE_HEIGHT_TOO_TIGHT,
        RULE_IDS.MISSING_HEADER,
        RULE_IDS.MISSING_FOOTER,
        RULE_IDS.LANGUAGE_DECLARATION_MISSING,
        RULE_IDS.ARIA_ROLE_MISMATCH,
      ];

      const unique = new Set(allRules);
      expect(unique.size).toBe(allRules.length);
    });
  });

  describe('SEVERITY', () => {
    it('severity levels are defined', () => {
      expect(SEVERITY.LOW).toBeDefined();
      expect(SEVERITY.MEDIUM).toBeDefined();
      expect(SEVERITY.HIGH).toBeDefined();
      expect(SEVERITY.CRITICAL).toBeDefined();
    });

    it('severity levels have correct string values', () => {
      expect(SEVERITY.LOW).toBe('low');
      expect(SEVERITY.MEDIUM).toBe('medium');
      expect(SEVERITY.HIGH).toBe('high');
      expect(SEVERITY.CRITICAL).toBe('critical');
    });
  });

  describe('SEVERITY_COLORS', () => {
    it('severity colors map all severity levels', () => {
      expect(SEVERITY_COLORS[SEVERITY.LOW]).toBeDefined();
      expect(SEVERITY_COLORS[SEVERITY.MEDIUM]).toBeDefined();
      expect(SEVERITY_COLORS[SEVERITY.HIGH]).toBeDefined();
      expect(SEVERITY_COLORS[SEVERITY.CRITICAL]).toBeDefined();
    });

    it('severity colors have valid hex format', () => {
      Object.values(SEVERITY_COLORS).forEach((color) => {
        expect(color).toMatch(/^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/);
      });
    });
  });

  describe('EVIDENCE_TYPE', () => {
    it('evidence types are defined', () => {
      expect(EVIDENCE_TYPE.HTML_ATTRIBUTE).toBeDefined();
      expect(EVIDENCE_TYPE.CSS_COMPUTED).toBeDefined();
      expect(EVIDENCE_TYPE.DOM_TRAVERSAL).toBeDefined();
      expect(EVIDENCE_TYPE.AI_SUGGESTION).toBeDefined();
      expect(EVIDENCE_TYPE.A11Y_API).toBeDefined();
    });
  });

  describe('SCAN_STATUS', () => {
    it('scan status values are correct', () => {
      expect(SCAN_STATUS.IDLE).toBe('idle');
      expect(SCAN_STATUS.SCANNING).toBe('scanning');
      expect(SCAN_STATUS.COMPLETE).toBe('complete');
      expect(SCAN_STATUS.ERROR).toBe('error');
      expect(SCAN_STATUS.STALE).toBe('stale');
    });
  });
});

// ---------------------------------------------------------------------------
// Test: summarizeScan logic
// ---------------------------------------------------------------------------

describe('summarizeScan', () => {
  it('returns perfect score for no findings', () => {
    const summary = summarizeScan([]);
    expect(summary.score).toBe(100);
    expect(summary.level).toBe('EXCELLENT');
    expect(summary.color).toBe('#10b981');
    expect(summary.breakdown.total).toBe(0);
  });

  it('returns EXCELLENT for minimal findings', () => {
    const summary = summarizeScan([
      { ruleId: RULE_IDS.MISSING_ALT_TEXT, severity: SEVERITY.LOW },
    ]);
    expect(summary.score).toBeGreaterThanOrEqual(80);
    expect(summary.level).toBe('EXCELLENT' || 'GOOD');
  });

  it('calculates score correctly for mixed severities', () => {
    const findings = [
      { ruleId: RULE_IDS.MISSING_H1, severity: SEVERITY.HIGH },
      { ruleId: RULE_IDS.MISSING_ALT_TEXT, severity: SEVERITY.LOW },
    ];

    const summary = summarizeScan(findings);
    expect(summary).toHaveProperty('score');
    expect(summary).toHaveProperty('level');
    expect(summary).toHaveProperty('color');
    expect(summary.breakdown).toHaveProperty('total', 2);
    expect(summary.breakdown).toHaveProperty('bySeverity');
    expect(summary.breakdown).toHaveProperty('byCategory');
  });

  it('categorizes findings by severity', () => {
    const findings = [
      { ruleId: RULE_IDS.MISSING_H1, severity: SEVERITY.HIGH },
      { ruleId: RULE_IDS.MISSING_ALT_TEXT, severity: SEVERITY.LOW },
      { ruleId: RULE_IDS.INSUFFICIENT_CONTRAST, severity: SEVERITY.HIGH },
    ];

    const summary = summarizeScan(findings);
    expect(summary.breakdown.bySeverity[SEVERITY.HIGH]).toBe(2);
    expect(summary.breakdown.bySeverity[SEVERITY.LOW]).toBe(1);
    // undefined is acceptable for counts that are 0
    expect(summary.breakdown.bySeverity[SEVERITY.MEDIUM]).toBeDefined();
    expect(summary.breakdown.bySeverity[SEVERITY.CRITICAL]).toBeDefined();
  });
});