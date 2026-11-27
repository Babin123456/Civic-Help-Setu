import { describe, it, expect, beforeEach } from 'vitest';
import {
  NODE_TYPE,
  DEPENDENCY_TYPE,
  IMPACT_LEVEL,
  IMPACT_DECISION_STATUS,
  GRAPH_VIEWER_STATE,
  AUTHORIZATION_ROLE,
  STATUTORY_ADMIN_DISCLAIMER,
  DEFAULT_CATALOGUE_REGISTRY,
  validateDependencyIntegrity,
  computeDownstreamImpactGraph,
  getTabularImpactReport,
  recordImpactDecision,
  getImpactReviewHistory,
  sanitizeImpactRecordForExport,
  _resetDecisionAuditStore,
} from './civicServiceDependencyImpactService.js';

describe('CivicServiceDependencyImpactService', () => {
  beforeEach(() => {
    _resetDecisionAuditStore();
  });

  describe('Integrity & Cycle Validation', () => {
    it('validates default catalogue registry successfully', () => {
      const integrity = validateDependencyIntegrity(DEFAULT_CATALOGUE_REGISTRY);
      expect(integrity.isValid).toBe(true);
      expect(integrity.brokenReferences).toHaveLength(0);
      expect(integrity.detectedCycles).toHaveLength(0);
      expect(integrity.totalNodes).toBeGreaterThan(0);
      expect(integrity.totalEdges).toBeGreaterThan(0);
    });

    it('throws error when catalogue or arrays are missing', () => {
      expect(() => validateDependencyIntegrity(null)).toThrow('Valid catalogue with nodes and edges arrays is required');
      expect(() => validateDependencyIntegrity({ nodes: [] })).toThrow('Valid catalogue with nodes and edges arrays is required');
    });

    it('flags broken references when edges target non-existent nodes', () => {
      const brokenCatalogue = {
        nodes: [{ id: 'NODE_A', title: 'Node A', nodeType: NODE_TYPE.SHARED_RULE }],
        edges: [{ source: 'NODE_A', target: 'NON_EXISTENT_NODE', type: DEPENDENCY_TYPE.INCORPORATES_RULE }],
      };

      const integrity = validateDependencyIntegrity(brokenCatalogue);
      expect(integrity.isValid).toBe(false);
      expect(integrity.brokenReferences.length).toBe(1);
      expect(integrity.brokenReferences[0].missingTarget).toBe(true);
    });

    it('detects cycles using DFS traversal', () => {
      const cyclicCatalogue = {
        nodes: [
          { id: 'NODE_X', title: 'X', nodeType: NODE_TYPE.SHARED_RULE },
          { id: 'NODE_Y', title: 'Y', nodeType: NODE_TYPE.SERVICE_GUIDE },
          { id: 'NODE_Z', title: 'Z', nodeType: NODE_TYPE.CHECKLIST },
        ],
        edges: [
          { source: 'NODE_X', target: 'NODE_Y', type: DEPENDENCY_TYPE.INCORPORATES_RULE },
          { source: 'NODE_Y', target: 'NODE_Z', type: DEPENDENCY_TYPE.REQUIRES_DOCUMENT },
          { source: 'NODE_Z', target: 'NODE_X', type: DEPENDENCY_TYPE.MANDATES_PREREQUISITE },
        ],
      };

      const integrity = validateDependencyIntegrity(cyclicCatalogue);
      expect(integrity.isValid).toBe(false);
      expect(integrity.detectedCycles.length).toBeGreaterThan(0);
      expect(integrity.detectedCycles[0]).toContain('NODE_X');
    });
  });

  describe('computeDownstreamImpactGraph', () => {
    it('throws error for missing or invalid root node', () => {
      expect(() => computeDownstreamImpactGraph(DEFAULT_CATALOGUE_REGISTRY, null)).toThrow(
        'A valid rootNodeId is required'
      );
      expect(() => computeDownstreamImpactGraph(DEFAULT_CATALOGUE_REGISTRY, 'UNKNOWN_NODE')).toThrow(
        'Catalogue node \'UNKNOWN_NODE\' not found'
      );
    });

    it('traverses downstream dependencies from root rule across multiple levels', () => {
      const result = computeDownstreamImpactGraph(DEFAULT_CATALOGUE_REGISTRY, 'RULE_INCOME_CRITERIA_EWS', {
        maxDepth: 3,
        changedFields: ['incomeCeilingINR'],
      });

      expect(result.status).toBe(GRAPH_VIEWER_STATE.READY);
      expect(result.rootNode.id).toBe('RULE_INCOME_CRITERIA_EWS');
      expect(result.nodes.length).toBeGreaterThan(0);
      expect(result.impactSummary.criticalCount).toBeGreaterThan(0);
      expect(result.requiresReview).toBe(true);
      expect(result.advisorySummary.isAdvisory).toBe(true);
      expect(result.advisorySummary.statutoryNotice).toBe(STATUTORY_ADMIN_DISCLAIMER);

      // Verify node types discovered downstream
      const nodeIds = result.nodes.map((n) => n.id);
      expect(nodeIds).toContain('SRV_INCOME_CERT');
      expect(nodeIds).toContain('CHK_INCOME_DOCS');
      expect(nodeIds).toContain('FORM_INCOME_RTS_1');
      expect(nodeIds).toContain('ART_EWS_ELIGIBILITY_EXPLAINER');
    });

    it('respects maxDepth boundary parameter', () => {
      const depth1Result = computeDownstreamImpactGraph(DEFAULT_CATALOGUE_REGISTRY, 'RULE_INCOME_CRITERIA_EWS', {
        maxDepth: 1,
      });

      const maxDepthObserved = Math.max(...depth1Result.nodes.map((n) => n.depth));
      expect(maxDepthObserved).toBe(1);
    });

    it('filters impact results by content type', () => {
      const filtered = computeDownstreamImpactGraph(DEFAULT_CATALOGUE_REGISTRY, 'RULE_INCOME_CRITERIA_EWS', {
        contentTypeFilter: NODE_TYPE.SERVICE_GUIDE,
      });

      filtered.nodes.forEach((n) => {
        expect(n.nodeType).toBe(NODE_TYPE.SERVICE_GUIDE);
      });
    });

    it('filters impact results by jurisdiction', () => {
      const filtered = computeDownstreamImpactGraph(DEFAULT_CATALOGUE_REGISTRY, 'RULE_FIRE_NOC_HEIGHT_15M', {
        jurisdictionFilter: 'MUNICIPAL_TOWN_PLANNING',
      });

      filtered.nodes.forEach((n) => {
        expect(n.jurisdiction).toBe('MUNICIPAL_TOWN_PLANNING');
      });
    });

    it('returns empty viewer state when a leaf node has no downstream dependents', () => {
      const leafResult = computeDownstreamImpactGraph(DEFAULT_CATALOGUE_REGISTRY, 'FORM_INCOME_RTS_1');
      expect(leafResult.status).toBe(GRAPH_VIEWER_STATE.EMPTY);
      expect(leafResult.nodes).toHaveLength(0);
      expect(leafResult.impactSummary.totalImpactedNodes).toBe(0);
    });
  });

  describe('getTabularImpactReport', () => {
    it('produces accessible tabular summary rows for assistive technology', () => {
      const impactGraph = computeDownstreamImpactGraph(DEFAULT_CATALOGUE_REGISTRY, 'RULE_FIRE_NOC_HEIGHT_15M', {
        changedFields: ['heightThresholdMeters'],
      });

      const table = getTabularImpactReport(impactGraph);
      expect(Array.isArray(table)).toBe(true);
      expect(table.length).toBeGreaterThan(0);

      const srvRow = table.find((r) => r.nodeId === 'SRV_BUILDING_SANCTION');
      expect(srvRow).toBeDefined();
      expect(srvRow.nodeType).toBe(NODE_TYPE.SERVICE_GUIDE);
      expect(srvRow.impactLevel).toBe(IMPACT_LEVEL.CRITICAL);
      expect(srvRow.directParent).toBe('RULE_FIRE_NOC_HEIGHT_15M');
      expect(srvRow.statutoryCitation).toBeDefined();
    });

    it('throws error when invalid graph is passed', () => {
      expect(() => getTabularImpactReport(null)).toThrow('Valid impactGraph with nodes array is required');
    });
  });

  describe('Decision Recording & RBAC Audit', () => {
    it('allows CATALOGUE_ADMIN to approve changes with formal audit logging', () => {
      const decision = recordImpactDecision({
        rootNodeId: 'RULE_INCOME_CRITERIA_EWS',
        decision: IMPACT_DECISION_STATUS.APPROVED,
        reviewerId: 'admin_officer_sharma',
        reviewerRole: AUTHORIZATION_ROLE.CATALOGUE_ADMIN,
        rationale: 'Gazetted annual revision vetted against central state guidelines',
        sourceVersion: '1.2.0',
      });

      expect(decision.decisionId).toBeDefined();
      expect(decision.decision).toBe(IMPACT_DECISION_STATUS.APPROVED);
      expect(decision.statutoryNotice).toBe(STATUTORY_ADMIN_DISCLAIMER);

      const history = getImpactReviewHistory('RULE_INCOME_CRITERIA_EWS', AUTHORIZATION_ROLE.CATALOGUE_ADMIN);
      expect(history.length).toBe(1);
      expect(history[0].reviewerId).toBe('admin_officer_sharma');
    });

    it('enforces rationale requirement when CONTENT_REVIEWER approves changes', () => {
      expect(() =>
        recordImpactDecision({
          rootNodeId: 'RULE_FIRE_NOC_HEIGHT_15M',
          decision: IMPACT_DECISION_STATUS.APPROVED,
          reviewerId: 'rev_anita',
          reviewerRole: AUTHORIZATION_ROLE.CONTENT_REVIEWER,
          rationale: 'short', // less than 10 chars
        })
      ).toThrow('Formal rationale of at least 10 characters is required');
    });

    it('rejects unauthorized roles from recording review decisions', () => {
      expect(() =>
        recordImpactDecision({
          rootNodeId: 'RULE_FIRE_NOC_HEIGHT_15M',
          decision: IMPACT_DECISION_STATUS.APPROVED,
          reviewerId: 'citizen_guest',
          reviewerRole: AUTHORIZATION_ROLE.VIEWER,
          rationale: 'Unauthorized citizen attempt',
        })
      ).toThrow('Permission Denied');
    });

    it('rejects invalid decision status values', () => {
      expect(() =>
        recordImpactDecision({
          rootNodeId: 'RULE_FIRE_NOC_HEIGHT_15M',
          decision: 'INVALID_STATUS',
          reviewerId: 'admin_1',
          reviewerRole: AUTHORIZATION_ROLE.CATALOGUE_ADMIN,
        })
      ).toThrow('Invalid decision status');
    });

    it('enforces RBAC on review history retrieval', () => {
      expect(() => getImpactReviewHistory('RULE_FIRE_NOC_HEIGHT_15M', 'GUEST_USER')).toThrow(
        'Permission Denied: Valid authorization role is required'
      );
    });

    it('sanitizes decision records for compliance export', () => {
      const decision = recordImpactDecision({
        rootNodeId: 'RULE_INCOME_CRITERIA_EWS',
        decision: IMPACT_DECISION_STATUS.APPROVED,
        reviewerId: 'admin_officer_sharma',
        reviewerRole: AUTHORIZATION_ROLE.CATALOGUE_ADMIN,
        rationale: 'Approved based on state order',
      });

      const exported = sanitizeImpactRecordForExport(decision);
      expect(exported.reviewerMasked).toBe('rev_***_rma');
      expect(exported.reviewerId).toBeUndefined();
    });

    it('returns null when exporting invalid decision record', () => {
      expect(sanitizeImpactRecordForExport(null)).toBeNull();
    });
  });
});
