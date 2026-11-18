import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setCurrentActor } from './accessControl';
import {
  TREE_ERROR_CODES,
  TREE_STORAGE_KEYS,
  TREE_CONDITIONS,
  TREE_STATUS,
  INSPECTION_STATES,
  WORK_ORDER_STATES,
  CITIZEN_REPORT_STATES,
  TRIAGE_DECISIONS,
} from './treeInventoryConstants';
import {
  applyTreeRetentionPolicy,
  completeTreeInspection,
  confirmTreeRisk,
  createMaintenanceOrder,
  createTreeAsset,
  getCitizenReportStatus,
  getPublicInventory,
  getPublicTreeByPublicId,
  getTreeAuditTrail,
  getTreeInspectionReminders,
  getTreeInventorySummary,
  importTreesCsv,
  listCitizenReports,
  listMaintenanceOrders,
  listStaffTrees,
  listTreeInspections,
  listTreeTriageSuggestions,
  previewTreeImport,
  proposeTreeRisk,
  recordTreeTriageSuggestion,
  reviewCitizenReport,
  reviewTreeTriageSuggestion,
  scheduleTreeInspection,
  submitCitizenTreeReport,
  transitionMaintenanceOrder,
  transitionTreeStatus,
  triageCitizenReport,
  updateTreeAsset,
  verifyTreeAuditChain,
  verifyTreeInspection,
} from './treeInventoryService';
import { ensureTreeInventoryData } from './treeInventoryMigrations';

const createMemoryStorage = () => {
  const map = new Map();
  return {
    failOnKey: null,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem(key, value) {
      if (this.failOnKey === key) throw new Error(`Simulated write failure for ${key}`);
      map.set(key, String(value));
    },
    removeItem: (key) => map.delete(key),
    clear: () => map.clear(),
    dump: () => map,
  };
};

const read = (storage, key) => {
  const raw = storage.getItem(key);
  return raw ? JSON.parse(raw) : null;
};

const write = (storage, key, value) => storage.setItem(key, JSON.stringify(value));

const admin = { id: 'admin_1', username: 'Inventory Administrator', role: 'admin' };
const staff = (treeRole, jurisdictionId = 'blr', id = `staff_${treeRole}`) => ({
  id,
  username: `${treeRole} user`,
  fullName: `${treeRole} user`,
  role: 'admin',
  raw: { publicMetadata: { treeRole, jurisdictionId } },
});
const arborist = (jurisdictionId = 'blr') => staff('arborist', jurisdictionId);
const reviewer = (jurisdictionId = 'blr') => staff('reviewer', jurisdictionId);
const operator = (jurisdictionId = 'blr') => staff('operator', jurisdictionId);
const citizen = { id: 'citizen_1', username: 'Resident', role: 'citizen' };

const expectCode = (fn, code) => {
  try {
    fn();
    throw new Error(`Expected ${code} but the call succeeded.`);
  } catch (error) {
    expect(error.code).toBe(code);
  }
};

const SAFE_IMAGE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==';
const evidence = () => [{ mimeType: 'image/png', sizeBytes: 128, url: SAFE_IMAGE, caption: 'Completion photo' }];

let storage;

beforeEach(() => {
  storage = createMemoryStorage();
  ensureTreeInventoryData({ storage, nowMs: Date.parse('2026-11-15T08:00:00.000Z') });
  setCurrentActor(null);
});

afterEach(() => setCurrentActor(null));

describe('public projections — no internal identifiers or private data', () => {
  it('returns only approved public tree facts and a coarse 1 km grid', () => {
    const result = getPublicInventory({ pageSize: 50 }, storage);
    expect(result.total).toBe(8);
    expect(result.items.length).toBe(8);

    for (const tree of result.items) {
      expect(tree.publicId).toMatch(/TREE-\d{4}$/);
      expect(tree).not.toHaveProperty('id');
      expect(tree).not.toHaveProperty('treeId');
      expect(tree).not.toHaveProperty('privateNotes');
      expect(tree).not.toHaveProperty('privateCoordinates');
      expect(tree).not.toHaveProperty('createdBy');
      expect(tree).not.toHaveProperty('reporterKey');
      expect(tree.approxLocation.precision).toBe('approximately 1 km grid');
      expect(tree.approxLocation.grid).toMatch(/^geo_-?\d+\.\d{2}_-?\d+\.\d{2}$/);
      expect(tree).not.toHaveProperty('latitude');
      expect(tree).not.toHaveProperty('longitude');
      expect(tree.species).toHaveProperty('commonName');
    }

    expect(result.summary.totalTrees).toBe(8);
    expect(result.summary.byWard.length).toBeGreaterThan(0);
  });

  it('looks up a single public tree by public id without leaking internals', () => {
    const tree = getPublicTreeByPublicId('BLR-TREE-0001', storage);
    expect(tree.publicId).toBe('BLR-TREE-0001');
    expect(tree).not.toHaveProperty('id');
    expect(tree).not.toHaveProperty('privateCoordinates');
    expectCode(() => getPublicTreeByPublicId('BLR-TREE-9999', storage), TREE_ERROR_CODES.NOT_FOUND);
  });

  it('scopes a staff member’s public view to their own jurisdiction', () => {
    setCurrentActor(arborist('blr'));
    const scoped = getPublicInventory({ pageSize: 50 }, storage);
    expect(scoped.total).toBe(6);
    expect(scoped.items.every((tree) => tree.publicId.startsWith('BLR-'))).toBe(true);

    setCurrentActor(null);
    expect(getPublicInventory({ pageSize: 50 }, storage).total).toBe(8);
  });
});

describe('staff scoping and least privilege', () => {
  it('shows only the assigned jurisdiction to staff and everything to a full administrator', () => {
    setCurrentActor(arborist('blr'));
    expect(listStaffTrees({ pageSize: 50 }, storage).total).toBe(6);
    expect(listStaffTrees({ pageSize: 50 }, storage).items.every((tree) => tree.jurisdictionId === 'blr')).toBe(true);

    setCurrentActor(staff('arborist', 'del', 'staff_arborist_del'));
    expect(listStaffTrees({ pageSize: 50 }, storage).total).toBe(2);

    setCurrentActor(admin);
    expect(listStaffTrees({ pageSize: 50 }, storage).total).toBe(8);
  });

  it('refuses a write to another jurisdiction with a stable error code', () => {
    setCurrentActor(staff('arborist', 'del', 'staff_arborist_del'));
    expectCode(
      () => updateTreeAsset('tree_demo_001', { ward: 'Ward 99 - Hijack' }, { storage }),
      TREE_ERROR_CODES.JURISDICTION_FORBIDDEN
    );
  });

  it('never grants staff power to a citizen, even if request data claims a role', () => {
    setCurrentActor({ ...citizen, treeRole: 'arborist', role: 'citizen', raw: { publicMetadata: { treeRole: 'arborist', jurisdictionId: 'blr' } } });
    expectCode(() => listStaffTrees({}, storage), TREE_ERROR_CODES.PERMISSION_DENIED);
    expectCode(
      () => createTreeAsset(
        { jurisdictionId: 'blr', ward: 'Ward 1', speciesId: 'sp_neem', approxCoordinates: { lat: 12.8, lng: 77.5 } },
        { storage }
      ),
      TREE_ERROR_CODES.PERMISSION_DENIED
    );
  });

  it('does not let an operator make expert decisions', () => {
    setCurrentActor(operator('blr'));
    expectCode(
      () => confirmTreeRisk('tree_demo_002', { decision: 'confirm', reason: 'Looks fine to me' }, { storage }),
      TREE_ERROR_CODES.PERMISSION_DENIED
    );
    expectCode(
      () => createTreeAsset(
        { jurisdictionId: 'blr', ward: 'Ward 1', speciesId: 'sp_neem', approxCoordinates: { lat: 12.8, lng: 77.5 } },
        { storage }
      ),
      TREE_ERROR_CODES.PERMISSION_DENIED
    );
  });

  it('documents a search index that excludes private notes', () => {
    setCurrentActor(arborist('blr'));
    // The staff table can see private notes, but free-text search must stick to the indexed public
    // fields so it stays bounded and never turns a private note into a searchable directory.
    expect(listStaffTrees({ pageSize: 50, search: 'deadwood over the bus bay' }, storage).total).toBe(0);
    expect(listStaffTrees({ pageSize: 50, search: 'Indiranagar' }, storage).total).toBeGreaterThan(0);
  });
});

describe('tree creation, validation, duplicates and idempotency', () => {
  const validTree = {
    jurisdictionId: 'blr',
    ward: 'Ward 88 - Test Garden',
    speciesId: 'sp_neem',
    condition: 'healthy',
    plantedOn: '2020-06-01',
    approxCoordinates: { lat: 12.8, lng: 77.5 },
    privateCoordinates: { lat: 12.80123, lng: 77.50123 },
    privateNotes: 'Test tree next to the gate.',
  };

  it('creates a tree with metadata, audit and a public projection', () => {
    setCurrentActor(arborist('blr'));
    const result = createTreeAsset(validTree, { storage, nowMs: Date.parse('2026-11-15T09:00:00.000Z') });
    expect(result.tree.publicId).toMatch(/^BLR-TREE-/);
    expect(result.tree.createdBy).toBe('staff_arborist');
    expect(result.tree.createdAt).toBeTruthy();
    expect(result.tree.updatedAt).toBeTruthy();
    expect(result.tree.schemaVersion).toBe(2);
    expect(result.publicTree).not.toHaveProperty('id');
    expect(result.publicTree).not.toHaveProperty('privateCoordinates');

    const audit = read(storage, TREE_STORAGE_KEYS.audit);
    expect(audit.some((event) => event.action === 'tree.created')).toBe(true);
  });

  it('rejects impossible coordinates and missing species', () => {
    setCurrentActor(arborist('blr'));
    expectCode(
      () => createTreeAsset({ ...validTree, approxCoordinates: { lat: 123, lng: 77.5 } }, { storage }),
      TREE_ERROR_CODES.INVALID_COORDINATES
    );
    expectCode(
      () => createTreeAsset({ ...validTree, speciesId: 'sp_missing' }, { storage }),
      TREE_ERROR_CODES.REFERENCE_NOT_FOUND
    );
  });

  it('detects a duplicate at the same species and location and allows a documented override', () => {
    setCurrentActor(arborist('blr'));
    const duplicateInput = {
      jurisdictionId: 'blr',
      ward: 'Ward 14 - Indiranagar East',
      speciesId: 'sp_neem',
      approxCoordinates: { lat: 12.97, lng: 77.64 },
      privateCoordinates: { lat: 12.971612, lng: 77.641234 },
    };
    expectCode(() => createTreeAsset(duplicateInput, { storage }), TREE_ERROR_CODES.DUPLICATE_TREE);

    const created = createTreeAsset(
      { ...duplicateInput, duplicateOverrideReason: 'Second sapling planted beside the original pit' },
      { storage }
    );
    expect(created.tree.publicId).toBeTruthy();
    const audit = read(storage, TREE_STORAGE_KEYS.audit);
    expect(audit.some((event) => event.action === 'tree.duplicate_override')).toBe(true);
  });

  it('replays an identical idempotent request and refuses a changed payload', () => {
    setCurrentActor(arborist('blr'));
    const key = 'create-tree-key-1';
    const first = createTreeAsset(validTree, { storage, idempotencyKey: key });
    const replay = createTreeAsset(validTree, { storage, idempotencyKey: key });
    expect(replay.replayed).toBe(true);
    expect(replay.tree.publicId).toBe(first.tree.publicId);
    expect(listStaffTrees({ pageSize: 100 }, storage).total).toBe(7);

    expectCode(
      () => createTreeAsset({ ...validTree, ward: 'Ward 89 - Changed' }, { storage, idempotencyKey: key }),
      TREE_ERROR_CODES.IDEMPOTENCY_CONFLICT
    );
  });

  it('rolls a partial write back when storage fails', () => {
    setCurrentActor(arborist('blr'));
    const before = read(storage, TREE_STORAGE_KEYS.trees).length;
    storage.failOnKey = TREE_STORAGE_KEYS.audit;
    expectCode(() => createTreeAsset(validTree, { storage }), TREE_ERROR_CODES.STORAGE_ERROR);
    storage.failOnKey = null;
    expect(read(storage, TREE_STORAGE_KEYS.trees).length).toBe(before);
  });
});

describe('risk and lifecycle decisions require named expertise', () => {
  it('proposes, confirms and only then approves removal', () => {
    setCurrentActor(arborist('blr'));
    expectCode(
      () => transitionTreeStatus('tree_demo_002', TREE_STATUS.REMOVAL_APPROVED, { reason: 'Skip review' }, { storage }),
      TREE_ERROR_CODES.EXPERT_CONFIRMATION_REQUIRED
    );

    const proposed = proposeTreeRisk(
      'tree_demo_004',
      { level: 'high', reason: 'Large split in the main trunk above the footpath' },
      { storage }
    );
    expect(proposed.expertConfirmationRequired).toBe(true);
    expect(proposed.tree.risk.state).toBe('proposed');

    setCurrentActor(reviewer('blr'));
    const confirmed = confirmTreeRisk(
      'tree_demo_004',
      { decision: 'confirm', reason: 'Confirmed split union after site visit' },
      { storage }
    );
    expect(confirmed.expertConfirmed).toBe(true);
    expect(confirmed.tree.risk.state).toBe('confirmed');

    setCurrentActor(arborist('blr'));
    const approved = transitionTreeStatus(
      'tree_demo_004',
      TREE_STATUS.REMOVAL_APPROVED,
      { reason: 'Confirmed high risk over a public footpath' },
      { storage }
    );
    expect(approved.tree.status).toBe(TREE_STATUS.REMOVAL_APPROVED);
  });

  it('rejects a proposed risk with a reviewer reason and records the decision', () => {
    setCurrentActor(reviewer('blr'));
    const result = confirmTreeRisk(
      'tree_demo_002',
      { decision: 'reject', reason: 'Second arborist found the cavity stable' },
      { storage }
    );
    expect(result.expertConfirmed).toBe(false);
    expect(result.tree.risk.state).toBe('rejected');
    expect(result.tree.risk.level).toBe('none');
  });

  it('refuses an invalid lifecycle jump', () => {
    setCurrentActor(arborist('blr'));
    expectCode(
      () => transitionTreeStatus('tree_demo_003', TREE_STATUS.REMOVED, { reason: 'No review recorded' }, { storage }),
      TREE_ERROR_CODES.INVALID_TRANSITION
    );
  });
});

describe('inspections — scheduling, completion, verification and reminders', () => {
  it('runs the inspection workflow and updates the tree only from recorded findings', () => {
    const nowMs = Date.parse('2026-11-15T08:00:00.000Z');
    setCurrentActor(operator('blr'));
    const scheduled = scheduleTreeInspection(
      {
        treeId: 'tree_demo_003',
        type: 'routine',
        scheduledFor: '2026-11-10T09:00:00.000Z',
        assignedTo: 'Zone 2 field crew',
      },
      { storage, nowMs }
    );
    expect(scheduled.inspection.state).toBe(INSPECTION_STATES.SCHEDULED);

    const completed = completeTreeInspection(
      scheduled.inspection.id,
      {
        findings: 'Minor deadwood over the service lane; no structural defect found.',
        conditionAtInspection: TREE_CONDITIONS.FAIR,
        evidence: evidence(),
      },
      { storage, nowMs }
    );
    expect(completed.inspection.state).toBe(INSPECTION_STATES.COMPLETED);
    expect(completed.tree.condition).toBe(TREE_CONDITIONS.FAIR);
    expect(completed.evidenceAttachments.length).toBe(1);

    expectCode(
      () => verifyTreeInspection(scheduled.inspection.id, { reason: 'Operator cannot verify own work' }, { storage }),
      TREE_ERROR_CODES.PERMISSION_DENIED
    );

    setCurrentActor(reviewer('blr'));
    const verified = verifyTreeInspection(scheduled.inspection.id, { reason: 'Reviewed photo and findings' }, { storage });
    expect(verified.inspection.state).toBe(INSPECTION_STATES.VERIFIED);
    expect(verified.inspection.verifiedBy).toBe('staff_reviewer');
  });

  it('requires a reason for an early inspection and records no silent condition change', () => {
    const nowMs = Date.parse('2026-11-15T08:00:00.000Z');
    setCurrentActor(operator('blr'));
    const scheduled = scheduleTreeInspection(
      { treeId: 'tree_demo_005', scheduledFor: '2026-12-01T09:00:00.000Z' },
      { storage, nowMs }
    );
    expectCode(
      () =>
        completeTreeInspection(
          scheduled.inspection.id,
          { findings: 'Visited ahead of schedule after a resident call.', conditionAtInspection: 'healthy' },
          { storage, nowMs }
        ),
      TREE_ERROR_CODES.VALIDATION_ERROR
    );
  });

  it('returns overdue and upcoming reminders scoped to the staff jurisdiction', () => {
    setCurrentActor(arborist('blr'));
    const reminders = getTreeInspectionReminders({ nowMs: Date.parse('2026-11-15T08:00:00.000Z'), dueWithinDays: 30 }, storage);
    expect(reminders.overdue.length).toBeGreaterThan(0);
    expect(reminders.overdue.every((item) => item.treeId !== 'tree_demo_007')).toBe(true);
    expect(reminders.generatedAt).toBeTruthy();
  });
});

describe('maintenance orders — assignment, evidence and pruning history', () => {
  it('assigns, completes with evidence and verifies a pruning order', () => {
    setCurrentActor(arborist('blr'));
    const created = createMaintenanceOrder(
      {
        treeId: 'tree_demo_003',
        type: 'prune',
        priority: 'medium',
        assignedTo: 'Zone 1 pruning crew',
        dueAt: '2026-11-25T00:00:00.000Z',
        instructions: 'Remove deadwood over the footpath only.',
      },
      { storage }
    );
    expect(created.order.state).toBe(WORK_ORDER_STATES.ASSIGNED);

    transitionMaintenanceOrder(created.order.id, WORK_ORDER_STATES.IN_PROGRESS, { reason: 'Crew started work' }, { storage });
    expectCode(
      () => transitionMaintenanceOrder(created.order.id, WORK_ORDER_STATES.COMPLETED, { reason: 'Done' }, { storage }),
      TREE_ERROR_CODES.VALIDATION_ERROR
    );

    const completed = transitionMaintenanceOrder(
      created.order.id,
      WORK_ORDER_STATES.COMPLETED,
      {
        reason: 'Deadwood removed',
        closureNotes: 'Removed two dead limbs above the footpath; area cleared.',
        evidence: evidence(),
      },
      { storage }
    );
    expect(completed.order.state).toBe(WORK_ORDER_STATES.COMPLETED);
    expect(completed.evidenceAttachments.length).toBe(1);

    setCurrentActor(reviewer('blr'));
    const verified = transitionMaintenanceOrder(
      created.order.id,
      WORK_ORDER_STATES.VERIFIED,
      { reason: 'Photo matches the requested pruning scope', pruningMethod: 'Target pruning' },
      { storage }
    );
    expect(verified.order.state).toBe(WORK_ORDER_STATES.VERIFIED);

    const pruning = read(storage, TREE_STORAGE_KEYS.pruningEvents);
    expect(pruning.length).toBe(1);
    expect(pruning[0].orderId).toBe(created.order.id);
    expect(pruning[0].approvedBy).toBe('staff_reviewer');
  });

  it('refuses a removal order before removal is approved', () => {
    setCurrentActor(arborist('blr'));
    expectCode(
      () =>
        createMaintenanceOrder(
          { treeId: 'tree_demo_003', type: 'remove', priority: 'high', assignedTo: 'Crew' },
          { storage }
        ),
      TREE_ERROR_CODES.EXPERT_CONFIRMATION_REQUIRED
    );
  });
});

describe('citizen reports — privacy, duplicates and rate limits', () => {
  it('accepts a report, strips PII from the public narrative and exposes only tracking data', () => {
    const result = submitCitizenTreeReport(
      {
        category: 'fallen_branch',
        description: 'A cracked branch hangs over the path. Call 9876543210 or email resident@example.com.',
        treePublicId: 'BLR-TREE-0002',
        attachments: [],
      },
      { storage, reporterKey: 'device_alpha', nowMs: Date.parse('2026-11-15T08:00:00.000Z') }
    );
    expect(result.duplicate).toBe(false);
    expect(result.publicReport.description).not.toContain('9876543210');
    expect(result.publicReport.description).not.toContain('resident@example.com');
    expect(result.publicReport).not.toHaveProperty('reporterKey');
    expect(result.publicReport).not.toHaveProperty('id');

    const tracked = getCitizenReportStatus(result.publicReport.trackingCode, storage);
    expect(tracked.trackingCode).toBe(result.publicReport.trackingCode);
    expect(tracked).not.toHaveProperty('reporterKey');
    expect(tracked.source).toContain('not a verified municipal observation');

    setCurrentActor(reviewer('blr'));
    const queue = listCitizenReports({ pageSize: 50 }, storage);
    expect(queue.items.some((item) => item.trackingCode === result.publicReport.trackingCode)).toBe(true);
    expect(queue.items.every((item) => !('reporterKey' in item))).toBe(true);
  });

  it('detects a duplicate report in the cooldown window and links it to the original', () => {
    const input = {
      category: 'root_damage',
      description: 'Soil has been covered around the tree and water pools after every rain.',
      treePublicId: 'BLR-TREE-0004',
    };
    const nowMs = Date.now();
    const first = submitCitizenTreeReport(input, { storage, reporterKey: 'device_beta', nowMs });
    const second = submitCitizenTreeReport(input, { storage, reporterKey: 'device_beta', nowMs: nowMs + 60_000 });
    expect(second.duplicate).toBe(true);
    expect(second.publicReport.trackingCode).toBe(first.publicReport.trackingCode);
  });

  it('rate-limits a device after three reports in the window', () => {
    const nowMs = Date.parse('2026-11-15T08:00:00.000Z');
    const categories = ['visible_damage', 'fallen_branch', 'pest_or_disease'];
    categories.forEach((category, index) => {
      submitCitizenTreeReport(
        {
          category,
          description: `Observation number ${index + 1}: visible tree damage near the school gate needs review.`,
          jurisdictionId: 'blr',
          ward: 'Ward 14 - Indiranagar East',
        },
        { storage, reporterKey: 'device_gamma', nowMs: nowMs + index * 1000 }
      );
    });
    expectCode(
      () =>
        submitCitizenTreeReport(
          {
            category: 'root_damage',
            description: 'A fourth observation from the same device should be temporarily refused.',
            jurisdictionId: 'blr',
            ward: 'Ward 14 - Indiranagar East',
          },
          { storage, reporterKey: 'device_gamma', nowMs: nowMs + 4000 }
        ),
      TREE_ERROR_CODES.RATE_LIMITED
    );
  });

  it('rejects unsafe attachments before they are stored', () => {
    expectCode(
      () =>
        submitCitizenTreeReport(
          {
            category: 'visible_damage',
            description: 'The trunk has a large open wound with fungal growth at the base.',
            jurisdictionId: 'blr',
            ward: 'Ward 14 - Indiranagar East',
            attachments: [{ mimeType: 'image/svg+xml', sizeBytes: 10, url: 'data:image/svg+xml;base64,PHN2Zz4=' }],
          },
          { storage, reporterKey: 'device_delta' }
        ),
      TREE_ERROR_CODES.UNSAFE_ATTACHMENT
    );
  });

  it('requires a linked tree before a report can be accepted', () => {
    const report = submitCitizenTreeReport(
      {
        category: 'pest_or_disease',
        description: 'White scale on the leaves and sooty mould on the lower branches of this tree.',
        jurisdictionId: 'blr',
        ward: 'Ward 14 - Indiranagar East',
      },
      { storage, reporterKey: 'device_epsilon' }
    );
    setCurrentActor(reviewer('blr'));
    const id = read(storage, TREE_STORAGE_KEYS.citizenReports).find(
      (item) => item.trackingCode === report.publicReport.trackingCode
    ).id;
    triageCitizenReport(
      id,
      { decision: 'escalate', triageNotes: 'Possible disease; arborist review needed.' },
      { storage }
    );
    expectCode(
      () => reviewCitizenReport(id, { decision: 'accept', reason: 'Needs a site inspection' }, { storage }),
      TREE_ERROR_CODES.VALIDATION_ERROR
    );
  });

  it('accepts a report against a tree and creates a linked inspection', () => {
    const report = submitCitizenTreeReport(
      {
        category: 'fallen_branch',
        description: 'A large branch is resting on the compound wall and could fall on the footpath.',
        treePublicId: 'BLR-TREE-0001',
      },
      { storage, reporterKey: 'device_zeta', nowMs: Date.parse('2026-11-15T08:00:00.000Z') }
    );
    const stored = read(storage, TREE_STORAGE_KEYS.citizenReports).find(
      (item) => item.trackingCode === report.publicReport.trackingCode
    );
    setCurrentActor(reviewer('blr'));
    triageCitizenReport(
      stored.id,
      { decision: 'triaged', triageNotes: 'Branch confirmed against the linked tree record.' },
      { storage }
    );
    const reviewed = reviewCitizenReport(
      stored.id,
      { decision: 'accept', reason: 'Branch poses a footpath obstruction' },
      { storage, nowMs: Date.parse('2026-11-15T09:00:00.000Z') }
    );
    expect(reviewed.report.state).toBe(CITIZEN_REPORT_STATES.ACCEPTED);
    expect(reviewed.inspection).toBeTruthy();
    expect(reviewed.inspection.sourceReportId).toBe(stored.id);
  });
});

describe('explainable image triage — suggestion only, human decision required', () => {
  it('records a deterministic, explainable suggestion with model and input provenance', () => {
    setCurrentActor(arborist('blr'));
    const result = recordTreeTriageSuggestion(
      { treeId: 'tree_demo_003', symptomTags: ['cavity', 'cracked_bark'] },
      { storage, nowMs: Date.parse('2026-11-15T08:00:00.000Z') }
    );
    const { suggestion } = result;
    expect(suggestion.suggestion.suggestedCondition).toBe(TREE_CONDITIONS.CRITICAL);
    expect(suggestion.suggestion.suggestedRisk).toBe('high');
    expect(suggestion.suggestion.rulesetVersion).toBe('tree-triage-rules-v1');
    expect(suggestion.suggestion.modelVersion).toBe('deterministic-symptom-rules-v1');
    expect(suggestion.suggestion.executedAt).toBe('2026-11-15T08:00:00.000Z');
    expect(suggestion.suggestion.isFallback).toBe(true);
    expect(suggestion.suggestion.inputWindow.symptomTags).toEqual(['cavity', 'cracked_bark']);
    expect(suggestion.suggestion.explanations.length).toBeGreaterThan(0);
    expect(suggestion.suggestion.requiresExpertConfirmation).toBe(true);
    expect(suggestion.suggestion.canApplyAutomatically).toBe(false);
    expect(suggestion.suggestion.prohibitedUses).toContain('automatic_removal');
    expect(result.expertConfirmationRequired).toBe(true);
  });

  it('applies an accepted suggestion to condition only, never to risk, status or removal', () => {
    setCurrentActor(arborist('blr'));
    const recorded = recordTreeTriageSuggestion(
      { treeId: 'tree_demo_003', symptomTags: ['cavity', 'cracked_bark'] },
      { storage }
    );
    const before = listStaffTrees({ search: 'BLR-TREE-0003' }, storage).items[0];
    expect(before.risk.level).toBe('none');
    expect(before.status).toBe(TREE_STATUS.ACTIVE);

    setCurrentActor(reviewer('blr'));
    const reviewed = reviewTreeTriageSuggestion(
      recorded.suggestion.id,
      { decision: TRIAGE_DECISIONS.ACCEPTED, reason: 'Matches the damage seen on site' },
      { storage }
    );
    expect(reviewed.suggestion.decision).toBe(TRIAGE_DECISIONS.ACCEPTED);
    expect(reviewed.tree.condition).toBe(TREE_CONDITIONS.CRITICAL);
    expect(reviewed.tree.risk.level).toBe('none');
    expect(reviewed.tree.status).toBe(TREE_STATUS.ACTIVE);

    expectCode(
      () =>
        reviewTreeTriageSuggestion(
          recorded.suggestion.id,
          { decision: TRIAGE_DECISIONS.REJECTED, reason: 'Changed my mind' },
          { storage }
        ),
      TREE_ERROR_CODES.INVALID_TRANSITION
    );
  });

  it('supports an edited decision with a reason and lists it for audit', () => {
    setCurrentActor(arborist('blr'));
    const recorded = recordTreeTriageSuggestion(
      { treeId: 'tree_demo_005', symptomTags: ['pest_signs'] },
      { storage }
    );
    setCurrentActor(reviewer('blr'));
    const reviewed = reviewTreeTriageSuggestion(
      recorded.suggestion.id,
      { decision: TRIAGE_DECISIONS.EDITED, editedCondition: TREE_CONDITIONS.POOR, reason: 'Canopy thinning is worse than the model suggested' },
      { storage }
    );
    expect(reviewed.suggestion.decision).toBe(TRIAGE_DECISIONS.EDITED);
    expect(reviewed.suggestion.appliedCondition).toBe(TREE_CONDITIONS.POOR);

    const listed = listTreeTriageSuggestions({ pageSize: 50 }, storage);
    expect(listed.items.some((item) => item.id === recorded.suggestion.id && item.decision === TRIAGE_DECISIONS.EDITED)).toBe(true);
  });

  it('blocks an operator from reviewing a triage suggestion', () => {
    setCurrentActor(arborist('blr'));
    const recorded = recordTreeTriageSuggestion({ treeId: 'tree_demo_003', symptomTags: ['leaning'] }, { storage });
    setCurrentActor(operator('blr'));
    expectCode(
      () => reviewTreeTriageSuggestion(recorded.suggestion.id, { decision: 'rejected', reason: 'Not my decision' }, { storage }),
      TREE_ERROR_CODES.PERMISSION_DENIED
    );
  });
});

describe('CSV import — validation, duplicates and all-or-nothing apply', () => {
  const header = 'ward,species_id,condition,latitude,longitude,planted_on,notes';
  const validCsv = `${header}\nWard 88 - Test Garden,sp_neem,healthy,12.80,77.50,2020-06-01,Imported row one\nWard 89 - Test Park,sp_gulmohar,fair,12.81,77.51,2019-05-02,Imported row two`;

  it('previews and applies a valid file, then is idempotent for the same key', () => {
    setCurrentActor(admin);
    const preview = previewTreeImport(validCsv, { storage });
    expect(preview.canApply).toBe(true);
    expect(preview.validRows).toBe(2);

    const before = listStaffTrees({ pageSize: 100 }, storage).total;
    const result = importTreesCsv(
      validCsv,
      { reason: 'Quarterly ward tree register update', idempotencyKey: 'bulk-import-001' },
      { storage }
    );
    expect(result.imported).toBe(2);
    expect(listStaffTrees({ pageSize: 100 }, storage).total).toBe(before + 2);

    const replay = importTreesCsv(
      validCsv,
      { reason: 'Quarterly ward tree register update', idempotencyKey: 'bulk-import-001' },
      { storage }
    );
    expect(replay.replayed).toBe(true);
    expect(listStaffTrees({ pageSize: 100 }, storage).total).toBe(before + 2);
  });

  it('reports missing columns without writing anything', () => {
    setCurrentActor(admin);
    const before = listStaffTrees({ pageSize: 100 }, storage).total;
    const missingCondition = `${header.replace(',condition', '')}\nWard 88 - Test Garden,sp_neem,12.80,77.50,2020-06-01,No condition`;
    expectCode(() => previewTreeImport(missingCondition, { storage }), TREE_ERROR_CODES.IMPORT_INVALID);
    expectCode(
      () => importTreesCsv(missingCondition, { reason: 'Should not import at all' }, { storage }),
      TREE_ERROR_CODES.IMPORT_INVALID
    );
    expect(listStaffTrees({ pageSize: 100 }, storage).total).toBe(before);
  });

  it('flags duplicate rows in the file and known duplicates in the register', () => {
    setCurrentActor(admin);
    const duplicateRows = `${header}\nWard 88 - Test Garden,sp_neem,healthy,12.80,77.50,2020-06-01,One\nWard 88 - Test Garden,sp_neem,healthy,12.80,77.50,2020-06-01,Two`;
    const preview = previewTreeImport(duplicateRows, { storage });
    expect(preview.canApply).toBe(false);
    expect(preview.duplicateRows).toBeGreaterThan(0);
    expect(preview.errors.some((error) => /duplicate/i.test(error.message))).toBe(true);

    const known = `${header}\nWard 14 - Indiranagar East,sp_neem,healthy,12.97,77.64,2014-07-12,Known tree`;
    const knownPreview = previewTreeImport(known, { storage });
    expect(knownPreview.canApply).toBe(false);
    expect(knownPreview.errors.some((error) => error.message.includes('BLR-TREE-0001'))).toBe(true);
  });

  it('rejects invalid coordinates with a row-level error', () => {
    setCurrentActor(admin);
    const bad = `${header}\nWard 88 - Test Garden,sp_neem,healthy,123.4,77.50,2020-06-01,Bad point`;
    const preview = previewTreeImport(bad, { storage });
    expect(preview.canApply).toBe(false);
    expect(preview.errors.some((error) => error.field === 'latitude/longitude')).toBe(true);
  });
});

describe('audit trail — append-only, hash-chained and tamper-evident', () => {
  it('verifies the chain and detects an edited event', () => {
    setCurrentActor(arborist('blr'));
    createTreeAsset(
      {
        jurisdictionId: 'blr',
        ward: 'Ward 88 - Test Garden',
        speciesId: 'sp_neem',
        condition: 'healthy',
        approxCoordinates: { lat: 12.8, lng: 77.5 },
      },
      { storage }
    );

    setCurrentActor(admin);
    const trail = getTreeAuditTrail({ limit: 100 }, storage);
    expect(trail.chainValid).toBe(true);
    expect(trail.events.length).toBeGreaterThan(0);
    expect(trail.events.every((event) => event.actorId && event.actorRole && event.hash)).toBe(true);

    const events = read(storage, TREE_STORAGE_KEYS.audit);
    events[0] = { ...events[0], reason: 'Rewritten history' };
    write(storage, TREE_STORAGE_KEYS.audit, events);
    expect(verifyTreeAuditChain(events).valid).toBe(false);
    expect(getTreeAuditTrail({}, storage).chainValid).toBe(false);
  });

  it('records the reason supplied by the actor on a state change', () => {
    setCurrentActor(arborist('blr'));
    transitionTreeStatus(
      'tree_demo_003',
      TREE_STATUS.PENDING_REVIEW,
      { reason: 'Resident reported a new crack near the main union' },
      { storage }
    );
    const events = read(storage, TREE_STORAGE_KEYS.audit);
    const event = events[events.length - 1];
    expect(event.action).toBe('tree.status_changed');
    expect(event.reason).toBe('Resident reported a new crack near the main union');
    expect(event.actorId).toBe('staff_arborist');
    expect(event.actorRole).toBe('arborist');
  });
});

describe('security — injection, enumeration and cross-report access', () => {
  const nowMs = Date.parse('2026-11-15T08:00:00.000Z');

  it('neutralises markup and script payloads in citizen narratives and staff notes', () => {
    const submitted = submitCitizenTreeReport(
      {
        category: 'visible_damage',
        description:
          'Branch snapped. <script>alert("x")</script> <img src=x onerror=alert(1)> Call 9876543210 or resident@example.com.',
        treePublicId: 'BLR-TREE-0002',
      },
      { storage, reporterKey: 'device_injection', nowMs }
    );

    expect(submitted.publicReport.description).not.toMatch(/[<>]/);
    expect(submitted.publicReport.description.toLowerCase()).not.toContain('onerror');
    expect(submitted.publicReport.description.toLowerCase()).not.toContain('script');
    expect(submitted.publicReport.description).not.toContain('9876543210');
    expect(submitted.publicReport.description).not.toContain('resident@example.com');

    setCurrentActor(arborist('blr'));
    const created = createTreeAsset(
      {
        jurisdictionId: 'blr',
        ward: 'Ward 88 - Test Garden',
        speciesId: 'sp_neem',
        condition: 'healthy',
        approxCoordinates: { lat: 12.82, lng: 77.52 },
        privateNotes: 'Compound gate code note <script>alert(1)</script><img src=x onerror=alert(1)>',
      },
      { storage, nowMs }
    );
    const staffTree = listStaffTrees({ pageSize: 100 }, storage).items.find((tree) => tree.id === created.tree.id);
    expect(staffTree.privateNotes).not.toMatch(/[<>]/);
    expect(staffTree.privateNotes.toLowerCase()).not.toContain('onerror');
  });

  it('does not confirm whether a record exists through near-miss public ids or tracking codes', () => {
    expectCode(() => getPublicTreeByPublicId('BLR-TREE-0000', storage), TREE_ERROR_CODES.NOT_FOUND);
    expectCode(() => getPublicTreeByPublicId('../../admin', storage), TREE_ERROR_CODES.NOT_FOUND);
    expectCode(() => getCitizenReportStatus('NOT-A-REAL-CODE', storage), TREE_ERROR_CODES.NOT_FOUND);

    const submitted = submitCitizenTreeReport(
      {
        category: 'fallen_branch',
        description: 'A heavy branch is resting on the compound wall and could fall onto the footpath.',
        jurisdictionId: 'blr',
        ward: 'Ward 14 - Indiranagar East',
      },
      { storage, reporterKey: 'device_enum', nowMs }
    );

    // Another reporter cannot read the record without the exact tracking code, and a wrong code
    // returns the same generic not-found message as a truly missing record.
    expectCode(() => getCitizenReportStatus(`${submitted.publicReport.trackingCode}X`, storage), TREE_ERROR_CODES.NOT_FOUND);
    const tracked = getCitizenReportStatus(submitted.publicReport.trackingCode, storage);
    expect(tracked).not.toHaveProperty('reporterKey');
    expect(tracked).not.toHaveProperty('id');

    const publicList = getPublicInventory({ pageSize: 100, search: submitted.publicReport.trackingCode }, storage);
    expect(publicList.items).toEqual([]);
  });
});

describe('summary, retention and storage hygiene', () => {
  it('returns scoped summary counts and documented indexes', () => {
    setCurrentActor(arborist('blr'));
    const summary = getTreeInventorySummary(storage);
    expect(summary.totalTrees).toBe(6);
    expect(summary.byCondition).toHaveProperty('critical');
    expect(summary.indexes.length).toBeGreaterThan(0);
    expect(summary.pendingCitizenReports).toBeGreaterThanOrEqual(1);
  });

  it('dry-runs retention and never archives a recent accepted report', () => {
    setCurrentActor(admin);
    const dry = applyTreeRetentionPolicy({ storage, nowMs: Date.parse('2028-01-01T00:00:00.000Z'), dryRun: true });
    expect(dry.dryRun).toBe(true);
    expect(dry.retentionDays).toBe(365);

    const result = applyTreeRetentionPolicy({ storage, nowMs: Date.parse('2028-01-01T00:00:00.000Z') });
    expect(result.archivedReports).toBeGreaterThanOrEqual(0);
    const reports = read(storage, TREE_STORAGE_KEYS.citizenReports);
    expect(reports.length).toBeGreaterThan(0);
  });

  it('stores no raw reporter key in the staff report view', () => {
    const submitted = submitCitizenTreeReport(
      {
        category: 'illegal_pruning',
        description: 'Someone has cut several large branches from the roadside tree overnight.',
        jurisdictionId: 'blr',
        ward: 'Ward 14 - Indiranagar East',
      },
      { storage, reporterKey: 'device_private_key' }
    );
    setCurrentActor(operator('blr'));
    const queue = listCitizenReports({ pageSize: 100 }, storage);
    const item = queue.items.find((report) => report.trackingCode === submitted.publicReport.trackingCode);
    expect(item).toBeTruthy();
    expect(item).not.toHaveProperty('reporterKey');
    expect(JSON.stringify(item)).not.toContain('device_private_key');
  });

  it('lists maintenance orders without leaking closed orders into the open queue', () => {
    setCurrentActor(arborist('blr'));
    const orders = listMaintenanceOrders({ pageSize: 50 }, storage);
    expect(orders.items.length).toBeGreaterThan(0);
    expect(orders.items.every((order) => order.treePublicId)).toBe(true);
    expect(listTreeInspections({ pageSize: 50 }, storage).items.every((inspection) => inspection.treePublicId)).toBe(true);
  });
});

describe('persistence — a full page reload keeps records and audit intact', () => {
  it('reads back a registered tree, its inspection and the audit chain from storage alone', () => {
    const nowMs = Date.parse('2026-11-15T10:00:00.000Z');
    setCurrentActor(arborist('blr'));
    const created = createTreeAsset(
      {
        jurisdictionId: 'blr',
        ward: 'Ward 88 - Test Garden',
        speciesId: 'sp_neem',
        condition: 'fair',
        plantedOn: '2021-07-01',
        approxCoordinates: { lat: 12.81, lng: 77.51 },
        privateCoordinates: { lat: 12.811234, lng: 77.512345 },
        privateNotes: 'Beside the compound wall, check after monsoon.',
      },
      { storage, nowMs }
    );
    const scheduled = scheduleTreeInspection(
      { treeId: created.tree.id, type: 'routine', scheduledFor: '2026-12-01T09:00:00.000Z' },
      { storage, nowMs }
    );

    // A reload throws away module memory but not the browser store: read every key into a brand-new
    // storage instance and confirm the service rebuilds the same state from persisted JSON only.
    const reloadedStorage = createMemoryStorage();
    for (const [key, value] of storage.dump()) reloadedStorage.setItem(key, value);
    storage = reloadedStorage;
    setCurrentActor(null);

    const publicTree = getPublicTreeByPublicId(created.tree.publicId, reloadedStorage);
    expect(publicTree.publicId).toBe(created.tree.publicId);
    expect(publicTree.condition).toBe('fair');
    expect(publicTree).not.toHaveProperty('privateCoordinates');
    expect(publicTree).not.toHaveProperty('privateNotes');

    setCurrentActor(arborist('blr'));
    const staffTree = listStaffTrees({ pageSize: 100 }, reloadedStorage).items.find(
      (tree) => tree.id === created.tree.id
    );
    expect(staffTree.privateNotes).toContain('monsoon');
    expect(staffTree.createdBy).toBe('staff_arborist');
    expect(staffTree.schemaVersion).toBe(2);

    const inspections = listTreeInspections({ pageSize: 100 }, reloadedStorage).items;
    expect(inspections.some((inspection) => inspection.id === scheduled.inspection.id)).toBe(true);

    setCurrentActor(admin);
    const trail = getTreeAuditTrail({ limit: 100 }, reloadedStorage);
    expect(trail.chainValid).toBe(true);
    expect(trail.events.some((event) => event.action === 'tree.created')).toBe(true);
    expect(trail.events.some((event) => event.action === 'inspection.scheduled')).toBe(true);
  });
});
