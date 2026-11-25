import { describe, it, expect } from 'vitest';
import {
  checkContrast,
  extractVisibleText,
  isInteractiveElement,
  getElementRole,
  calculateAccessibilityScore,
  runRuleBasedChecks,
  ACCESSIBILITY_RULES,
} from './accessibilityInspectorService';

describe('Accessibility Inspector Service - Rule-based Checks', () => {
  describe('checkContrast', () => {
    it('returns passed for WCAG AA normal text (4.5:1 ratio)', () => {
      const result = checkContrast('#111111', '#ffffff');
      expect(result.passed).toBe(true);
      expect(result.level).toBe('AAA');
    });

    it('returns failed for low contrast ratio', () => {
      const result = checkContrast('#555555', '#ffffff');
      expect(result.passed).toBe(false);
      expect(result.level).toBe('fail');
    });

    it('handles null/undefined gracefully', () => {
      const result1 = checkContrast(null, '#ffffff');
      expect(result1.passed).toBe(false);
      expect(result1.ratio).toBe(null);

      const result2 = checkContrast('#111111', null);
      expect(result2.passed).toBe(false);
      expect(result2.ratio).toBe(null);
    });
  });

  describe('extractVisibleText', () => {
    it('extracts text from text nodes', () => {
      const textNode = { nodeType: 3, textContent: 'Hello World' };
      const result = extractVisibleText(textNode);
      expect(result).toBe('Hello World');
    });

    it('extracts text from nested elements', () => {
      const element = {
        nodeType: 1,
        tagName: 'DIV',
        childNodes: [
          { nodeType: 3, textContent: 'Outer' },
          { nodeType: 1, tagName: 'SPAN', childNodes: [{ nodeType: 3, textContent: 'Inner' }] },
        ],
      };
      const result = extractVisibleText(element);
      expect(result).toContain('Outer');
      expect(result).toContain('Inner');
    });

    it('handles null/undefined gracefully', () => {
      expect(extractVisibleText(null)).toBe('');
      expect(extractVisibleText(undefined)).toBe('');
    });
  });

  describe('isInteractiveElement', () => {
    it('recognizes button elements', () => {
      const button = { nodeType: 1, tagName: 'BUTTON', getAttribute: () => null };
      expect(isInteractiveElement(button)).toBe(true);
    });

    it('recognizes link elements', () => {
      const link = { nodeType: 1, tagName: 'A', getAttribute: () => null };
      expect(isInteractiveElement(link)).toBe(true);
    });

    it('recognizes input elements', () => {
      const input = { nodeType: 1, tagName: 'INPUT', getAttribute: () => null };
      expect(isInteractiveElement(input)).toBe(true);
    });

    it('recognizes elements with tabindex', () => {
      const div = {
        nodeType: 1,
        tagName: 'DIV',
        getAttribute: (name) => name === 'tabindex' ? '0' : null,
      };
      expect(isInteractiveElement(div)).toBe(true);
    });

    it('returns false for non-interactive div', () => {
      const div = { nodeType: 1, tagName: 'DIV', getAttribute: () => null };
      expect(isInteractiveElement(div)).toBe(false);
    });
  });

  describe('getElementRole', () => {
    it('identifies heading elements', () => {
      const h3 = { nodeType: 1, tagName: 'H3', getAttribute: () => null };
      expect(getElementRole(h3)).toBe('heading');
    });

    it('identifies navigation elements', () => {
      const nav = { nodeType: 1, tagName: 'NAV', getAttribute: () => null };
      expect(getElementRole(nav)).toBe('navigation');
    });

    it('identifies summary/details', () => {
      const summary = { nodeType: 1, tagName: 'SUMMARY', getAttribute: () => null, parentNode: { tagName: 'DETAILS' } };
      expect(getElementRole(summary)).toBe('disclosure');
    });

    it('returns division for plain div elements', () => {
      const div = { nodeType: 1, tagName: 'DIV', getAttribute: () => null };
      expect(getElementRole(div)).toBe('division');
    });
  });

  describe('calculateAccessibilityScore', () => {
    it('returns score 100 for all passed checks', () => {
      const result = calculateAccessibilityScore([
        { passed: true, severity: 'high', severityWeight: 15 },
        { passed: true, severity: 'medium', severityWeight: 8 },
      ]);
      expect(result.score).toBe(100);
      expect(result.badge).toBe('PASS');
    });

    it('returns score 0 for all failed checks', () => {
      const result = calculateAccessibilityScore([
        { passed: false, severity: 'high', severityWeight: 15 },
        { passed: false, severity: 'medium', severityWeight: 8 },
      ]);
      expect(result.score).toBe(0);
      expect(result.badge).toBe('FAIL');
    });

    it('returns Unknown for empty results', () => {
      const result = calculateAccessibilityScore([]);
      expect(result.score).toBe(0);
      expect(result.level).toBe('Unknown');
      expect(result.badge).toBe('No Data');
    });

    it('gives partial credit for low-confidence evidence', () => {
      const result = calculateAccessibilityScore([
        { passed: false, severity: 'high', severityWeight: 15, evidence: { status: 'low-confidence' } },
        { passed: true, severity: 'medium', severityWeight: 8 },
      ]);
      expect(result.score).toBeGreaterThan(50);
      expect(result.score).toBeLessThan(80);
    });
  });

  describe('runRuleBasedChecks', () => {
    it('runs all registered rules and returns findings', () => {
      const dummyElements = [
        { tagName: 'IMG', getAttribute: () => '' },
        { tagName: 'A', getAttribute: () => '' },
      ];
      const context = { selectedSelector: 'test-page' };
      const findings = runRuleBasedChecks({ elements: dummyElements, context });

      expect(findings).toBeInstanceOf(Array);
      expect(findings.length).toBeGreaterThan(0);
    });

    it('deterministically sorts by severity', () => {
      const dummyElements = [];
      const context = { selectedSelector: 'test' };
      const findings = runRuleBasedChecks({ elements: dummyElements, context });

      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
      for (let i = 1; i < findings.length; i++) {
        const prevSeverity = findings[i - 1].severity;
        const currentSeverity = findings[i].severity;
        const prevOrder = severityOrder[prevSeverity] ?? 99;
        const currentOrder = severityOrder[currentSeverity] ?? 99;
        expect(prevOrder).toBeLessThanOrEqual(currentOrder);
      }
    });

    it('handles empty elements gracefully', () => {
      const findings = runRuleBasedChecks({ elements: [], context: {} });
      expect(findings).toBeInstanceOf(Array);
    });
  });

  describe('ACCESSIBILITY_RULES', () => {
    it('contains all expected rule IDs', () => {
      const ruleIds = ACCESSIBILITY_RULES.map((r) => r.id);
      expect(ruleIds).toContain('color-contrast');
      expect(ruleIds).toContain('missing-alt');
      expect(ruleIds).toContain('keyboard-focus');
      expect(ruleIds).toContain('empty-link');
      expect(ruleIds).toContain('heading-structure');
    });

    it('rules have required properties', () => {
      ACCESSIBILITY_RULES.forEach((rule) => {
        expect(rule).toHaveProperty('id');
        expect(rule).toHaveProperty('name');
        expect(rule).toHaveProperty('severity');
        expect(rule).toHaveProperty('check');
      });
    });
  });
});