import { describe, it, expect } from 'vitest';
import {
  resolveAttribute,
  assessStop,
  findStaleStops,
  buildImprovementReport,
  searchStopsAsText,
  ACCESSIBILITY_REQUIRED,
} from './busStopAccessibilityService';

const NOW = new Date('2026-06-01T00:00:00Z').getTime();
const recent = '2026-05-10T00:00:00Z';
const old = '2025-10-01T00:00:00Z';

const official = (attribute, present, observedAt = recent) => ({ attribute, present, observedAt, source: 'official' });
const citizen = (attribute, present, moderation = 'approved', observedAt = recent) => ({
  attribute,
  present,
  observedAt,
  source: 'citizen',
  moderation,
});

describe('resolveAttribute', () => {
  it('trusts a fresh official record', () => {
    const r = resolveAttribute([official('shelter', true)], 'shelter', NOW);
    expect(r).toMatchObject({ state: 'present', verified: true, basis: 'official' });
  });

  it('needs two agreeing moderated citizen observations', () => {
    expect(resolveAttribute([citizen('lighting', true)], 'lighting', NOW).verified).toBe(false);
    const two = resolveAttribute([citizen('lighting', true), citizen('lighting', true)], 'lighting', NOW);
    expect(two).toMatchObject({ state: 'present', verified: true, basis: 'citizen' });
  });

  it('ignores citizen observations that are not approved', () => {
    const r = resolveAttribute(
      [citizen('lighting', true, 'pending'), citizen('lighting', true, 'rejected')],
      'lighting',
      NOW
    );
    expect(r.verified).toBe(false);
  });

  it('ignores stale records', () => {
    expect(resolveAttribute([official('shelter', true, old)], 'shelter', NOW).verified).toBe(false);
  });

  it('flags a conflict between official and citizen evidence', () => {
    const obs = [official('kerbAccess', true), citizen('kerbAccess', false), citizen('kerbAccess', false)];
    expect(resolveAttribute(obs, 'kerbAccess', NOW).state).toBe('conflict');
  });

  it('copes with empty or malformed input', () => {
    expect(resolveAttribute(undefined, 'shelter', NOW).state).toBe('unknown');
    const bad = [{ attribute: 'shelter', present: true, observedAt: 'nope', source: 'official' }];
    expect(resolveAttribute(bad, 'shelter', NOW).verified).toBe(false);
  });
});

describe('assessStop', () => {
  const full = ACCESSIBILITY_REQUIRED.map((a) => official(a, true));

  it('labels a stop accessible only with every required attribute verified', () => {
    expect(assessStop({ id: 's1', name: 'A', observations: full }, NOW).status).toBe('verified_accessible');
    expect(assessStop({ id: 's1', name: 'A', observations: full.slice(1) }, NOW).status).toBe(
      'insufficient_evidence'
    );
  });

  it('does not accept single unconfirmed citizen reports', () => {
    const obs = ACCESSIBILITY_REQUIRED.map((a) => citizen(a, true));
    expect(assessStop({ id: 's2', name: 'B', observations: obs }, NOW).status).toBe('insufficient_evidence');
  });

  it('reports not_accessible when a required attribute is verified missing', () => {
    const obs = [...full.slice(1), official('kerbAccess', false)];
    expect(assessStop({ id: 's3', name: 'C', observations: obs }, NOW).status).toBe('not_accessible');
  });

  it('lists the evidence still missing', () => {
    const res = assessStop({ id: 's4', name: 'D', observations: [official('lighting', true)] }, NOW);
    expect(res.missingEvidence).toEqual(['kerbAccess', 'tactilePaving', 'signage']);
  });
});

describe('findStaleStops', () => {
  it('returns stops with no or old observations', () => {
    const stops = [
      { id: 'a', name: 'Fresh', observations: [official('shelter', true)] },
      { id: 'b', name: 'Old', observations: [official('shelter', true, old)] },
      { id: 'c', name: 'Empty', observations: [] },
    ];
    expect(findStaleStops(stops, NOW).map((s) => s.stopId)).toEqual(['b', 'c']);
  });
});

describe('reports and text search', () => {
  const stop = {
    id: 's9',
    name: 'Market Road',
    locality: 'Old Town',
    observations: [official('shelter', false), official('lighting', true)],
  };

  it('builds an improvement report', () => {
    const text = buildImprovementReport(stop, NOW);
    expect(text).toContain('Stop: Market Road (s9)');
    expect(text).toContain('- Shelter (official)');
    expect(text).toContain('Not yet verified:');
  });

  it('searches by name or locality and returns text rows', () => {
    expect(searchStopsAsText([stop], 'old town', NOW)).toHaveLength(1);
    expect(searchStopsAsText([stop], 'nothing', NOW)).toHaveLength(0);
    expect(searchStopsAsText([stop], '', NOW)[0]).toContain('Verified: Lighting');
  });
});
