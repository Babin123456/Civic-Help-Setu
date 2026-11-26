import { describe, it, expect } from 'vitest';
import {
  createOpenDataRng,
  openDataCsvDataset,
  openDataJsonDataset,
  listOpenDataImportScenarios,
  buildOpenDataCatalogueFromDataset,
  hasSourceMetadata,
  getSourceMetadata,
  detectSchemaDrift,
  IMPORT_LICENSES,
} from './openDataFixtures.js';

describe('open data import connector fixtures', () => {
  describe('createOpenDataRng', () => {
    it('gives the same sequence for the same seed', () => {
      const run = (seed) => {
        const rng = createOpenDataRng(seed);
        return Array.from({ length: 8 }, () => rng.next());
      };
      expect(run(1)).toEqual(run(1));
      expect(run(1)).not.toEqual(run(2));
      expect(run('abc')).toEqual(run('abc'));
      expect(run('abc')).not.toEqual(run('abd'));
    });

    it('stays in range', () => {
      const rng = createOpenDataRng(5);
      for (let i = 0; i < 500; i += 1) {
        const value = rng.next();
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
        const n = rng.int(3, 7);
        expect(n).toBeGreaterThanOrEqual(3);
        expect(n).toBeLessThanOrEqual(7);
        expect(['a', 'b']).toContain(rng.pick(['a', 'b']));
      }
    });
  });

  describe('scenarios', () => {
    it('lists available scenarios', () => {
      const names = listOpenDataImportScenarios();
      expect(names).toContain('reliable');
      expect(names).toContain('drift');
    });

    it('reliable CSV has correct column order', () => {
      const { header } = openDataCsvDataset('reliable');
      expect(header).toHaveLength(21);
      expect(header[0]).toBe('id');
      expect(header[19]).toBe('license');
      expect(header[20]).toBe('attribution');
    });

    it('reliable JSON has service records with source metadata', () => {
      const envelope = openDataJsonDataset('reliable');
      expect(envelope.schemaVersion).toBe(1);
      expect(envelope.services).toHaveLength(8);
      for (const service of envelope.services) {
        expect(hasSourceMetadata(service)).toBe(true);
      }
    });

    it('drift CSV modifies last row source metadata', () => {
      const { header, rows } = openDataCsvDataset('drift');
      expect(header).toHaveLength(21);
      // Drift should modify the last row's sourceUrl/license/attribution
      const lastRow = rows[rows.length - 1];
      expect(lastRow[17]).toBe('CC0-1.0'); // sourceUrl at index 17
      expect(lastRow[19]).not.toBe('');     // license at index 19 should be set
    });

    it('drift JSON modifies last record source metadata', () => {
      const envelope = openDataJsonDataset('drift');
      const last = envelope.services[envelope.services.length - 1];
      expect(last.license).toBe('CC0-1.0');
      expect(last.attribution).toContain('Different attribution');
    });

    it('buildOpenDataCatalogueFromDataset produces valid catalogue', () => {
      const catalogue = buildOpenDataCatalogueFromDataset({ count: 8, type: 'reliable' });
      expect(catalogue).toHaveProperty('schemaVersion');
      expect(catalogue).toHaveProperty('services');
      expect(catalogue.services).toHaveLength(8);
      expect(catalogue.sourceMetadata).toBeDefined();
      for (const service of catalogue.services) {
        expect(hasSourceMetadata(service)).toBe(true);
      }
      // Drift vs reliable should detect changes
      const drift = buildOpenDataCatalogueFromDataset({ count: 8, type: 'drift' });
      const result = detectSchemaDrift(catalogue, drift);
      expect(result.changes.length).toBeGreaterThan(0);
    });

    it('detects schema drift between reliable and drift datasets', () => {
      const reliable = buildOpenDataCatalogueFromDataset({ count: 8, type: 'reliable' });
      const drift = buildOpenDataCatalogueFromDataset({ count: 8, type: 'drift' });
      const result = detectSchemaDrift(reliable, drift);
      expect(result.changes.length).toBeGreaterThan(0);
      expect(result.changes.some((c) => c.includes('License'))).toBe(true);
    });

    it('IMPORT_LICENSES contains expected values', () => {
      expect(IMPORT_LICENSES).toContain('CC0-1.0');
      expect(IMPORT_LICENSES).toContain('CC-BY-4.0');
      expect(IMPORT_LICENSES).toContain('CC-BY-SA-4.0');
      expect(IMPORT_LICENSES).toContain('PDDL-1.0');
      expect(IMPORT_LICENSES).toContain('Public Domain');
      expect(IMPORT_LICENSES).toContain('Custom');
    });
  });
});