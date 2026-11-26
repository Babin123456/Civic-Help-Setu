import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadLegalSources,
  saveLegalSources,
  loadDraftSnapshots,
  saveDraftSnapshots,
  appendLegalSourceAuditLog,
  loadLegalSourceAuditLogs,
  resetLegalSourcesToDefault,
  computeLegalSourceDigest,
  verifyLegalSourceIntegrity,
  exportLegalSourceDossier,
  INITIAL_LEGAL_SOURCES,
} from './legalSourceStorage.js';

describe('legalSourceStorage', () => {
  let mockStorage;
  let store;

  beforeEach(() => {
    store = new Map();
    mockStorage = {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, val) => store.set(key, String(val)),
      removeItem: (key) => store.delete(key),
    };
  });

  it('initializes with seed legal sources covering key workspace templates', () => {
    const sources = loadLegalSources(mockStorage);
    expect(sources.length).toBeGreaterThanOrEqual(10);

    const rera = sources.find((s) => s.id === 'src-rera-sec18');
    expect(rera).toBeDefined();
    expect(rera.actName).toContain('Real Estate');
    expect(rera.provision).toBe('Section 18(1)');
    expect(rera.applicableTemplates).toContain('rera_homebuyer_dispute');

    const mwpsc = sources.find((s) => s.id === 'src-mwpsc-sec4');
    expect(mwpsc).toBeDefined();
    expect(mwpsc.applicableTemplates).toContain('senior_citizen_maintenance');

    const streetVendor = sources.find((s) => s.id === 'src-sv-sec3');
    expect(streetVendor).toBeDefined();
    expect(streetVendor.applicableTemplates).toContain('street_vendor_tvc_petition');
  });

  it('computes deterministic SHA-256 seal and detects tampering', async () => {
    const source = {
      id: 'src-test-01',
      title: 'Section 18 Test',
      actName: 'Test Act',
      provision: 'Sec 18',
      jurisdiction: 'National',
      currentVersion: '1.0.0',
      status: 'REVIEWED',
      summary: 'Summary text',
      fullText: 'Full statutory text excerpt',
      officialUrl: 'https://indiacode.nic.in/test',
    };

    const digest1 = await computeLegalSourceDigest(source);
    const digest2 = await computeLegalSourceDigest(source);
    expect(digest1).toBe(digest2);
    expect(digest1.length).toBeGreaterThan(0);

    // Attach digest and verify
    source.digest = digest1;
    const verification = await verifyLegalSourceIntegrity(source);
    expect(verification.valid).toBe(true);

    // Tamper with text
    const tampered = { ...source, fullText: 'Tampered illegal claim' };
    const tamperedVerification = await verifyLegalSourceIntegrity(tampered);
    expect(tamperedVerification.valid).toBe(false);
  });

  it('persists and loads modified sources', () => {
    const sources = loadLegalSources(mockStorage);
    const custom = {
      id: 'src-custom-new',
      title: 'Custom Act Provision',
      actName: 'Custom Act 2026',
      provision: 'Section 1',
      jurisdiction: 'Delhi',
      applicableTemplates: ['custom_template'],
      status: 'DRAFT',
      currentVersion: '0.1.0',
    };

    sources.push(custom);
    saveLegalSources(sources, mockStorage);

    const reloaded = loadLegalSources(mockStorage);
    expect(reloaded.find((s) => s.id === 'src-custom-new')).toBeDefined();
  });

  it('records tamper-evident audit logs', () => {
    appendLegalSourceAuditLog(
      {
        action: 'TEST_ACTION',
        sourceId: 'src-rera-sec18',
        actor: 'Admin Reviewer',
        details: 'Initial verification',
      },
      mockStorage
    );

    const logs = loadLegalSourceAuditLogs(mockStorage);
    expect(logs.length).toBe(1);
    expect(logs[0].action).toBe('TEST_ACTION');
    expect(logs[0].sourceId).toBe('src-rera-sec18');
    expect(logs[0].timestamp).toBeDefined();
  });

  it('saves and loads historical draft citation snapshots', () => {
    const snapshot = {
      draftId: 'draft-xyz-123',
      templateId: 'rera_homebuyer_dispute',
      boundAt: new Date().toISOString(),
      sources: [{ id: 'src-rera-sec18', version: '1.0.0' }],
    };

    saveDraftSnapshots([snapshot], mockStorage);
    const loaded = loadDraftSnapshots(mockStorage);
    expect(loaded.length).toBe(1);
    expect(loaded[0].draftId).toBe('draft-xyz-123');
  });

  it('resets legal sources to factory defaults', () => {
    saveLegalSources([], mockStorage);
    expect(loadLegalSources(mockStorage).length).toBe(0);

    resetLegalSourcesToDefault(mockStorage);
    const restored = loadLegalSources(mockStorage);
    expect(restored.length).toBe(INITIAL_LEGAL_SOURCES.length);
  });

  it('exports legal source dossier as valid JSON with summary metrics', () => {
    const sources = loadLegalSources(mockStorage);
    const jsonStr = exportLegalSourceDossier(sources);
    const parsed = JSON.parse(jsonStr);

    expect(parsed.generator).toContain('CivicBridge Versioned Legal Source Registry');
    expect(parsed.totalSources).toBe(sources.length);
    expect(parsed.reviewedCount).toBeGreaterThan(0);
    expect(Array.isArray(parsed.sources)).toBe(true);
  });
});
