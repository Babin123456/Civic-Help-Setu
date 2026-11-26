import { describe, it, expect } from 'vitest';
import {
  RULE_GRAPHS,
  validateAllRegisteredGraphs,
  getRuleGraph,
  listRegisteredGraphs,
} from './ruleGraphRegistry.js';

describe('ruleGraphRegistry', () => {
  it('validates all shipped rule graphs without errors', () => {
    expect(() => validateAllRegisteredGraphs()).not.toThrow();
  });

  it('contains expected statutory schemes', () => {
    const list = listRegisteredGraphs();
    const ids = list.map((g) => g.id);
    expect(ids).toContain('pm-kisan');
    expect(ids).toContain('pmay-u');
    expect(ids).toContain('birth-certificate-delayed');
    expect(ids).toContain('ayushman-bharat');
  });

  it('provides statutory citations on every node of every graph', () => {
    for (const graph of Object.values(RULE_GRAPHS)) {
      expect(graph.nodes.length).toBeGreaterThan(0);
      for (const node of graph.nodes) {
        expect(node.citation).toBeDefined();
        expect(node.citation.authority).toBeTruthy();
        expect(node.citation.orderNo).toBeTruthy();
      }
    }
  });

  it('returns null for unknown scheme id', () => {
    expect(getRuleGraph('non-existent-scheme')).toBeNull();
  });
});
