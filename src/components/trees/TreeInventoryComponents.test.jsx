import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import TreePublicInventory from './TreePublicInventory';
import TreeStaffInventory from './TreeStaffInventory';
import TreeTriageReviewPanel from './TreeTriageReviewPanel';
import TreeImportAuditPanel from './TreeImportAuditPanel';
import { validateTreeAssetForm } from './TreeAssetForm';
import { validateCitizenTreeReportForm } from './TreeCitizenReportForm';
import { validateInspectionCompleteForm } from './TreeInspectionForm';
import {
  TreeInventoryEmptyState,
  TreeInventoryErrorState,
  TreeInventorySkeleton,
  TreePermissionDenied,
} from './TreeInventoryStates';
import { setCurrentActor } from '../../services/accessControl';
import { ensureTreeInventoryData } from '../../services/treeInventoryMigrations';
import {
  getPublicInventory,
  getPublicWardMap,
  getTreeAuditTrail,
  getTreeInspectionReminders,
  getTreeInventorySummary,
  listStaffTrees,
  listTreeTriageSuggestions,
  previewTreeImport,
  recordTreeTriageSuggestion,
} from '../../services/treeInventoryService';
import { getTreeInventoryMigrationStatus } from '../../services/treeInventoryMigrations';

const createMemoryStorage = () => {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
};

const admin = { id: 'admin_1', username: 'Inventory Administrator', role: 'admin' };
const arborist = {
  id: 'staff_arborist',
  username: 'arborist user',
  fullName: 'Arborist User',
  role: 'admin',
  raw: { publicMetadata: { treeRole: 'arborist', jurisdictionId: 'blr' } },
};

let storage;

beforeEach(() => {
  storage = createMemoryStorage();
  ensureTreeInventoryData({ storage, nowMs: Date.parse('2026-11-15T08:00:00.000Z') });
  vi.stubGlobal('localStorage', storage);
  setCurrentActor(null);
});

afterEach(() => {
  vi.unstubAllGlobals();
  setCurrentActor(null);
});

describe('TreePublicInventory — accessible list, table and map alternatives', () => {
  const publicData = () => getPublicInventory({ pageSize: 50 }, storage);

  it('renders the approved card list plus a text table and no private fields', () => {
    const html = renderToStaticMarkup(
      <TreePublicInventory
        data={publicData()}
        wardMap={getPublicWardMap({ pageSize: 50 }, storage)}
        view="list"
      />
    );

    expect(html).toContain('Approved public tree register');
    expect(html).toContain('Public tree register — text alternative');
    expect(html).toContain('aria-label="Report visible damage for tree BLR-TREE-0001"');
    expect(html).toContain('Precise coordinates and private notes are not published.');
    expect(html).toContain('geo_12.97_77.64');
    expect(html).not.toContain('Minor deadwood over the bus bay');
    expect(html).not.toContain('12.971612');
  });

  it('keeps an equivalent text table when the ward map view is selected', () => {
    const html = renderToStaticMarkup(
      <TreePublicInventory
        data={publicData()}
        wardMap={getPublicWardMap({ pageSize: 50 }, storage)}
        view="map"
      />
    );

    expect(html).toContain('Ward map summary');
    expect(html).toContain('Ward 14 - Indiranagar East:');
    expect(html).toContain('Public tree register — text alternative for the ward map');
    expect(html).toContain('aria-label="Choose inventory view"');
  });
});

describe('TreeStaffInventory — operational data stays inside the staff view', () => {
  it('shows precise coordinates, private notes, reminders and permitted actions to a scoped arborist', () => {
    setCurrentActor(arborist);
    const html = renderToStaticMarkup(
      <TreeStaffInventory
        data={listStaffTrees({ pageSize: 50 }, storage)}
        reminders={getTreeInspectionReminders({}, storage)}
        summary={getTreeInventorySummary(storage)}
        canCreate
        canRisk
        canTransition
      />
    );

    expect(html).toContain('Staff tree register');
    expect(html).toContain('Private point 12.971612, 77.641234');
    expect(html).toContain('Minor deadwood over the bus bay');
    expect(html).toContain('Staff-only view.');
    expect(html).toContain('Preventive inspection reminders');
    expect(html).toContain('Propose risk');
    expect(html).toContain('Lifecycle status');
    expect(html).toContain('aria-label="Scrollable staff tree table"');
    expect(html).not.toContain('DEL-TREE-0001');
  });
});

describe('TreeTriageReviewPanel — explainable suggestion provenance', () => {
  it('shows ruleset, model, fallback and the human-review requirement', () => {
    setCurrentActor(arborist);
    recordTreeTriageSuggestion(
      { treeId: 'tree_demo_003', symptomTags: ['cavity', 'cracked_bark'] },
      { storage, nowMs: Date.parse('2026-11-15T08:00:00.000Z') }
    );
    const suggestions = listTreeTriageSuggestions({ pageSize: 20 }, storage);

    const html = renderToStaticMarkup(
      <TreeTriageReviewPanel suggestions={suggestions} filters={{}} canReview />
    );

    expect(html).toContain('Image-assisted triage review');
    expect(html).toContain('Suggestions are advisory only.');
    expect(html).toContain('tree-triage-rules-v1');
    expect(html).toContain('deterministic-symptom-rules-v1');
    expect(html).toContain('Deterministic fallback');
    expect(html).toContain('BLR-TREE-0003');
    expect(html).toContain('Automated suggestions and their human review decisions');
  });
});

describe('TreeImportAuditPanel — validated import, migration and audit controls', () => {
  const validCsv =
    'ward,species_id,condition,latitude,longitude,planted_on,notes\n' +
    'Ward 88 - Test Garden,sp_neem,healthy,12.80,77.50,2020-06-01,Imported row one';

  it('states the required CSV columns and exposes migration and hash-chain status', () => {
    setCurrentActor(admin);
    const html = renderToStaticMarkup(
      <TreeImportAuditPanel
        audit={getTreeAuditTrail({ limit: 20 }, storage)}
        migration={getTreeInventoryMigrationStatus(storage)}
        preview={previewTreeImport(validCsv, { storage })}
        canImport
        canAudit
        canMigrate
        canRetention
      />
    );

    expect(html).toContain('Import, migration and audit');
    expect(html).toContain('Required columns: ward, species_id, condition, latitude, longitude.');
    expect(html).toContain('CSV is valid');
    expect(html).toContain('Append-only audit trail');
    expect(html).toContain('Hash chain verified');
    expect(html).toContain('Schema migration');
    expect(html).toContain('Roll back to backup');
  });

  it('explains the missing permissions instead of rendering restricted controls', () => {
    setCurrentActor(null);
    const html = renderToStaticMarkup(<TreeImportAuditPanel />);

    expect(html).toContain('Your role does not include bulk import, migration or audit access.');
    expect(html).not.toContain('Bulk CSV import');
    expect(html).not.toContain('Append-only audit trail');
  });
});

describe('Tree forms — client validation is a usability layer with plain-language guidance', () => {
  it('validates a tree asset form: required fields, coordinate range and future planting date', () => {
    expect(Object.keys(validateTreeAssetForm({})).sort()).toEqual(
      expect.arrayContaining(['jurisdictionId', 'ward', 'speciesId', 'condition', 'latitude', 'longitude'])
    );

    const outOfRange = validateTreeAssetForm({
      jurisdictionId: 'blr',
      ward: 'Ward 14 - Indiranagar East',
      speciesId: 'sp_neem',
      condition: 'healthy',
      latitude: '123',
      longitude: '77.64',
    });
    expect(outOfRange.latitude).toBe('Latitude must be between -90 and 90.');

    const future = validateTreeAssetForm({
      jurisdictionId: 'blr',
      ward: 'Ward 14 - Indiranagar East',
      speciesId: 'sp_neem',
      condition: 'healthy',
      latitude: '12.97',
      longitude: '77.64',
      plantedOn: '2099-01-01',
    });
    expect(future.plantedOn).toBe('Planting date cannot be in the future.');

    expect(
      validateTreeAssetForm({
        jurisdictionId: 'blr',
        ward: 'Ward 14 - Indiranagar East',
        speciesId: 'sp_neem',
        condition: 'healthy',
        latitude: '12.97',
        longitude: '77.64',
        plantedOn: '2020-06-01',
      })
    ).toEqual({});
  });

  it('requires an observed condition and safe evidence to complete an inspection', () => {
    const errors = validateInspectionCompleteForm({ conditionAtInspection: '', findings: 'short', evidenceUrl: 'http://insecure.example/photo.jpg' });
    expect(errors.conditionAtInspection).toBe('Choose the condition observed.');
    expect(errors.findings).toBe('Record at least 10 characters of findings.');
    expect(errors.evidenceUrl).toBe('Evidence links must use https://.');

    expect(
      validateInspectionCompleteForm({
        conditionAtInspection: 'fair',
        findings: 'Minor deadwood over the service lane, no structural defect.',
        evidenceUrl: 'https://example.gov.in/photo.jpg',
      })
    ).toEqual({});
  });

  it('validates a citizen report: location, category, description length and attachment count', () => {
    const errors = validateCitizenTreeReportForm({});
    expect(errors.treePublicId).toBe('Choose a public tree, or select the jurisdiction and ward.');
    expect(errors.category).toBe('Choose the kind of visible problem you observed.');
    expect(errors.description).toBe('Describe what you can see in at least 20 characters.');

    expect(
      validateCitizenTreeReportForm({
        treePublicId: 'BLR-TREE-0001',
        category: 'visible_damage',
        description: 'A large split has opened in the trunk above the footpath.',
      })
    ).toEqual({});

    expect(
      validateCitizenTreeReportForm({
        treePublicId: 'BLR-TREE-0001',
        category: 'visible_damage',
        description: 'A large split has opened in the trunk above the footpath.',
        attachments: new Array(9).fill({ mimeType: 'image/png' }),
      }).attachments
    ).toMatch(/Attach at most/);
  });
});

describe('Tree inventory loading, empty and recoverable-error states', () => {
  it('announces loading, empty and recoverable error states with live roles and plain language', () => {
    const loading = renderToStaticMarkup(<TreeInventorySkeleton />);
    expect(loading).toContain('role="status"');
    expect(loading).toContain('Loading the municipal tree register');

    const empty = renderToStaticMarkup(<TreeInventoryEmptyState title="No approved public trees match these filters" />);
    expect(empty).toContain('role="status"');
    expect(empty).toContain('No approved public trees match these filters');

    const failed = renderToStaticMarkup(
      <TreeInventoryErrorState
        error={{ code: 'TREE_STORAGE_ERROR', userMessage: 'The register could not be read. Your records were not changed.' }}
      />
    );
    expect(failed).toContain('role="alert"');
    expect(failed).toContain('Your records were not changed.');
    expect(failed).toContain('Error code: TREE_STORAGE_ERROR');
  });
});

describe('TreePermissionDenied — accessible staff boundary', () => {
  it('renders a role="alert" explanation with a sign-in route', () => {
    const html = renderToStaticMarkup(<TreePermissionDenied />);

    expect(html).toContain('role="alert"');
    expect(html).toContain('Staff workspace requires a municipal tree role');
    expect(html).toContain('href="/login"');
  });
});
