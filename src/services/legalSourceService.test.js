import { describe, it, expect, beforeEach } from 'vitest';
import {
  listLegalSources,
  getLegalSourceById,
  createDraftSource,
  updateDraftSource,
  reviewAndPublishSource,
  supersedeSource,
  rollbackSourceVersion,
  auditTemplateCitations,
  bindHistoricalSourcesSnapshot,
  getHistoricalDraftSnapshot,
  isSourceStale,
  incrementVersion,
  verifyOutcomeNeutrality,
  VERSION_STATUSES,
} from './legalSourceService.js';
import { setCurrentActor } from './accessControl.js';

describe('legalSourceService', () => {
  let mockStorage;
  let store;

  const ADMIN_USER = { id: 'admin-1', role: 'admin', fullName: 'Verified Legal Admin' };
  const CITIZEN_USER = { id: 'user-1', role: 'citizen', fullName: 'Citizen User' };

  beforeEach(() => {
    store = new Map();
    mockStorage = {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, val) => store.set(key, String(val)),
      removeItem: (key) => store.delete(key),
    };
    setCurrentActor(ADMIN_USER);
  });

  describe('Listing & Filtering', () => {
    it('lists registered legal sources and filters by template and status', () => {
      const all = listLegalSources({}, mockStorage);
      expect(all.length).toBeGreaterThan(0);

      const reraSources = listLegalSources({ templateId: 'rera_homebuyer_dispute' }, mockStorage);
      expect(reraSources.every((s) => s.applicableTemplates.includes('rera_homebuyer_dispute'))).toBe(true);

      const reviewedOnly = listLegalSources({ status: VERSION_STATUSES.REVIEWED }, mockStorage);
      expect(reviewedOnly.every((s) => s.status === VERSION_STATUSES.REVIEWED)).toBe(true);

      const searchResult = listLegalSources({ search: 'delay interest' }, mockStorage);
      expect(searchResult.length).toBeGreaterThan(0);
      expect(searchResult[0].summary.toLowerCase()).toContain('delay');
    });

    it('correctly detects stale sources (>365 days)', () => {
      const freshSource = {
        reviewedAt: new Date().toISOString(),
      };
      expect(isSourceStale(freshSource, 365)).toBe(false);

      const staleSource = {
        reviewedAt: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString(), // 400 days ago
      };
      expect(isSourceStale(staleSource, 365)).toBe(true);

      const unreviewedSource = { reviewedAt: null };
      expect(isSourceStale(unreviewedSource, 365)).toBe(true);
    });

    it('increments semver version string correctly', () => {
      expect(incrementVersion('1.0.0', 'patch')).toBe('1.0.1');
      expect(incrementVersion('1.0.0', 'minor')).toBe('1.1.0');
      expect(incrementVersion('1.2.3', 'major')).toBe('2.0.0');
    });
  });

  describe('Role-Based Access Control (RBAC)', () => {
    it('denies citizens from creating, updating, or reviewing legal sources', async () => {
      setCurrentActor(CITIZEN_USER);

      expect(() => {
        createDraftSource(
          {
            title: 'Citizen Draft',
            actName: 'Test Act',
            provision: 'Sec 1',
          },
          mockStorage
        );
      }).toThrow(/Not allowed: legalSources.manage/);

      expect(() => {
        updateDraftSource('src-rera-sec18', { title: 'Unauthorized' }, mockStorage);
      }).toThrow(/Not allowed: legalSources.manage/);

      expect(() => {
        reviewAndPublishSource('src-rera-sec18', { reviewerNotes: 'Unauthorized' }, mockStorage);
      }).toThrow(/Not allowed: legalSources.review/);

      expect(() => {
        supersedeSource('src-rera-sec18', {}, mockStorage);
      }).toThrow(/Not allowed: legalSources.review/);

      expect(() => {
        rollbackSourceVersion('src-rera-sec18', '1.0.0', {}, mockStorage);
      }).toThrow(/Not allowed: legalSources.review/);
    });

    it('denies anonymous visitors from modifying legal sources', () => {
      setCurrentActor(null);

      expect(() => {
        createDraftSource({ title: 'Anon', actName: 'Act', provision: 'Sec 1' }, mockStorage);
      }).toThrow(/Not allowed: legalSources.manage/);

      expect(() => {
        reviewAndPublishSource('src-rera-sec18', {}, mockStorage);
      }).toThrow(/Not allowed: legalSources.review/);
    });
  });

  describe('Version Lifecycles & Transitions (Draft -> Reviewed -> Superseded)', () => {
    it('creates draft source and publishes it after authorized review', async () => {
      setCurrentActor(ADMIN_USER);

      const draft = await createDraftSource(
        {
          id: 'src-test-consumer-clause',
          title: 'Section 2(47), Consumer Protection Act, 2019 - Unfair Trade Practice',
          actName: 'Consumer Protection Act, 2019',
          provision: 'Section 2(47)',
          jurisdiction: 'National',
          applicableTemplates: ['consumer_protection_drip_pricing'],
          officialUrl: 'https://consumeraffairs.nic.in/',
          summary: 'Defines unfair trade practice including deceptive representations regarding prices and goods.',
          fullText: 'Unfair trade practice means a trade practice which adopts any unfair method or unfair practice.',
          initialVersion: '0.1.0',
        },
        mockStorage
      );

      expect(draft.status).toBe(VERSION_STATUSES.DRAFT);
      expect(draft.currentVersion).toBe('0.1.0');
      expect(draft.reviewedAt).toBeNull();
      expect(draft.reviewedBy).toBeNull();

      // Authorized Review & Publication
      const published = await reviewAndPublishSource(
        'src-test-consumer-clause',
        {
          reviewerNotes: 'Verified against Gazette of India notification. Approved for public template citation.',
          nextVersion: '1.0.0',
        },
        mockStorage
      );

      expect(published.status).toBe(VERSION_STATUSES.REVIEWED);
      expect(published.currentVersion).toBe('1.0.0');
      expect(published.reviewedAt).toBeDefined();
      expect(published.reviewedBy).toContain('Verified Legal Admin');
      expect(published.reviewerNotes).toContain('Approved for public template citation');
    });

    it('supersedes an older source with modern replacement', async () => {
      setCurrentActor(ADMIN_USER);

      const superseded = await supersedeSource(
        'src-rera-sec18',
        {
          replacementSourceId: 'src-rera-sec40',
          supersededReason: 'Replaced by consolidated recovery standard under 2026 rules.',
        },
        mockStorage
      );

      expect(superseded.status).toBe(VERSION_STATUSES.SUPERSEDED);
      expect(superseded.supersededBy).toBe('src-rera-sec40');
      expect(superseded.supersededReason).toContain('2026 rules');
      expect(superseded.versionHistory.length).toBeGreaterThan(0);
      expect(superseded.versionHistory[0].version).toBe('1.0.0');
    });

    it('rolls back a source to a previously reviewed historical version', async () => {
      setCurrentActor(ADMIN_USER);

      // src-mwpsc-sec4 already has a historical 1.0.0 in seed data
      const sourceBefore = getLegalSourceById('src-mwpsc-sec4', mockStorage);
      expect(sourceBefore.currentVersion).toBe('1.1.0');
      expect(sourceBefore.versionHistory.some((h) => h.version === '1.0.0')).toBe(true);

      const rolledBack = await rollbackSourceVersion(
        'src-mwpsc-sec4',
        '1.0.0',
        { rollbackReason: 'Restoring conservative statutory wording per High Court order' },
        mockStorage
      );

      expect(rolledBack.status).toBe(VERSION_STATUSES.REVIEWED);
      expect(rolledBack.currentVersion).toBe('1.1.1'); // Incremented patch
      expect(rolledBack.summary).toBe('Maintenance entitlement for senior citizens under MWPSC Act.');
      expect(rolledBack.reviewerNotes).toContain('Restored from historical revision 1.0.0');
    });
  });

  describe('Template Citation Audit Engine', () => {
    it('audits valid templates with 100% health score', () => {
      const result = auditTemplateCitations('rera_homebuyer_dispute', {}, mockStorage);
      expect(result.isValid).toBe(true);
      expect(result.healthScore).toBe(100);
      expect(result.summary.missingCount).toBe(0);
      expect(result.summary.supersededCount).toBe(0);
      expect(result.summary.draftCount).toBe(0);
    });

    it('flags missing citations with critical severity', () => {
      const result = auditTemplateCitations(
        'rera_homebuyer_dispute',
        { citedSourceIds: ['src-nonexistent-act-99'] },
        mockStorage
      );

      expect(result.isValid).toBe(false);
      expect(result.summary.missingCount).toBe(1);
      expect(result.issues[0].type).toBe('MISSING');
      expect(result.issues[0].severity).toBe('CRITICAL');
      expect(result.healthScore).toBeLessThan(100);
    });

    it('flags unreviewed draft citations and superseded citations', () => {
      const result = auditTemplateCitations(
        'rera_homebuyer_dispute',
        { citedSourceIds: ['src-draft-rera-amendment', 'src-old-swm-2000'] },
        mockStorage
      );

      expect(result.isValid).toBe(false);
      expect(result.summary.draftCount).toBe(1);
      expect(result.summary.supersededCount).toBe(1);

      const draftIssue = result.issues.find((i) => i.type === 'UNREVIEWED_DRAFT');
      expect(draftIssue).toBeDefined();

      const supersededIssue = result.issues.find((i) => i.type === 'SUPERSEDED');
      expect(supersededIssue).toBeDefined();
      expect(supersededIssue.recommendation).toContain('src-swm-rules');
    });

    it('flags stale citations (>365 days since review)', () => {
      const result = auditTemplateCitations(
        'tree_preservation_notice',
        { citedSourceIds: ['src-delhi-tree-act-stale'] },
        mockStorage
      );

      expect(result.hasWarnings).toBe(true);
      expect(result.summary.staleCount).toBe(1);
      const staleIssue = result.issues.find((i) => i.type === 'STALE');
      expect(staleIssue).toBeDefined();
      expect(staleIssue.daysSinceReview).toBeGreaterThan(365);
    });

    it('flags jurisdiction conflicts when user circumstance does not match state source', () => {
      // src-maha-rera-rule3 applies to Maharashtra
      const result = auditTemplateCitations(
        'rera_homebuyer_dispute',
        {
          citedSourceIds: ['src-maha-rera-rule3'],
          userJurisdiction: 'Delhi',
        },
        mockStorage
      );

      expect(result.isValid).toBe(false);
      expect(result.summary.conflictCount).toBe(1);
      const conflictIssue = result.issues.find((i) => i.type === 'JURISDICTION_CONFLICT');
      expect(conflictIssue).toBeDefined();
      expect(conflictIssue.sourceJurisdiction).toBe('Maharashtra');
      expect(conflictIssue.userJurisdiction).toBe('Delhi');
    });
  });

  describe('Historical Reference Preservation for Generated Citizen Drafts', () => {
    it('binds an immutable snapshot of citations when draft is created and retrieves it', async () => {
      const draftId = 'citizen-draft-rera-001';
      const snapshot = await bindHistoricalSourcesSnapshot(
        draftId,
        'rera_homebuyer_dispute',
        { userJurisdiction: 'National' },
        mockStorage
      );

      expect(snapshot.draftId).toBe(draftId);
      expect(snapshot.sources.length).toBe(2);
      expect(snapshot.sources[0].version).toBe('1.0.0');

      // Now supersede one of the sources in the registry afterwards
      setCurrentActor(ADMIN_USER);
      await supersedeSource(
        'src-rera-sec18',
        { replacementSourceId: 'src-rera-sec40', supersededReason: 'Amended law 2026' },
        mockStorage
      );

      // Loading the historical draft should preserve the original citations, but alert to evolution
      const loaded = getHistoricalDraftSnapshot(draftId, mockStorage);
      expect(loaded).toBeDefined();
      expect(loaded.sources[0].id).toBe('src-rera-sec18');
      expect(loaded.sources[0].version).toBe('1.0.0'); // Historical preserved!
      expect(loaded.evolutionNotices.length).toBe(1);
      expect(loaded.evolutionNotices[0].type).toBe('SUBSEQUENTLY_SUPERSEDED');
      expect(loaded.evolutionNotices[0].notice).toContain('Your draft preserves the statutory text effective');
    });
  });

  describe('Outcome Neutrality & Disclaimers', () => {
    it('flags outcome-predicting claims and validates neutral language', () => {
      const biasedText = 'Filing this petition guarantees refund of full advance amount and you will win easily.';
      const checkBiased = verifyOutcomeNeutrality(biasedText);
      expect(checkBiased.isNeutral).toBe(false);
      expect(checkBiased.disallowedTerms.length).toBeGreaterThanOrEqual(1);

      const neutralText =
        'Section 18 provides a statutory remedy for home buyers to seek refund or monthly delay interest from the promoter.';
      const checkNeutral = verifyOutcomeNeutrality(neutralText);
      expect(checkNeutral.isNeutral).toBe(true);
      expect(checkNeutral.disallowedTerms.length).toBe(0);
    });
  });
});
