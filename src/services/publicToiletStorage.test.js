import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadFacilities,
  saveFacility,
  getFacilityById,
  loadCleaningEvents,
  saveCleaningEvent,
  saveMaintenanceTicket,
  loadFeedbackReports,
  saveFeedbackReport,
  recordAuditEvent,
  loadAuditEvents,
  pruneStaleRecords,
  migrateToiletData,
  resetToiletStorage,
} from './publicToiletStorage.js';

describe('Public Toilet Storage Service (#758)', () => {
  beforeEach(() => {
    resetToiletStorage();
  });

  it('bootstraps initial data from seeds when storage is empty', () => {
    const facilities = loadFacilities();
    expect(facilities.length).toBeGreaterThan(0);
    expect(facilities[0].id).toBe('pt-blr-ward150-001');
  });

  it('persists a new facility and updates an existing one', () => {
    const newFacility = {
      id: 'pt-test-999',
      name: 'Indiranagar 100ft Road Restroom',
      category: 'standalone_urinal',
      jurisdiction: { state: 'Karnataka', district: 'Bengaluru Urban', ward: '112' },
      location: { latitude: 12.9719, longitude: 77.6412, address: '100ft Road Indiranagar' },
      status: 'verified_active',
    };
    saveFacility(newFacility);

    const retrieved = getFacilityById('pt-test-999');
    expect(retrieved).not.toBeNull();
    expect(retrieved.name).toBe('Indiranagar 100ft Road Restroom');
    expect(retrieved.schemaVersion).toBe(1);

    // Update
    retrieved.name = 'Indiranagar Metro Public Restroom';
    saveFacility(retrieved);
    expect(getFacilityById('pt-test-999').name).toBe('Indiranagar Metro Public Restroom');
  });

  it('records a cleaning event and updates the facility lastCleanedAt timestamp', () => {
    const facilityId = 'pt-blr-ward150-001';
    const timestamp = '2026-05-18T14:30:00Z';

    const event = {
      id: 'cln-test-01',
      facilityId,
      cleanedAt: timestamp,
      checklist: { waterSupplyVerified: true, floorSanitized: true, suppliesRestocked: true },
    };

    saveCleaningEvent(event);

    const events = loadCleaningEvents(facilityId);
    expect(events.some((e) => e.id === 'cln-test-01')).toBe(true);

    const facility = getFacilityById(facilityId);
    expect(facility.lastCleanedAt).toBe(timestamp);
  });

  it('transitions facility to under_maintenance when a critical maintenance ticket is filed', () => {
    const facilityId = 'pt-blr-ward150-001';
    const facilityBefore = getFacilityById(facilityId);
    expect(facilityBefore.status).toBe('verified_active');

    const criticalTicket = {
      id: 'tkt-crit-01',
      facilityId,
      category: 'water_outage',
      severity: 'critical',
      status: 'reported',
      description: 'Main borewell pump failed completely, no water available',
    };

    saveMaintenanceTicket(criticalTicket);

    const facilityAfter = getFacilityById(facilityId);
    expect(facilityAfter.status).toBe('under_maintenance');
  });

  it('handles feedback idempotency without creating duplicate records', () => {
    const report1 = {
      id: 'fb-idem-01',
      facilityId: 'pt-blr-ward150-001',
      rating: 4,
      idempotencyKey: 'idem-key-12345',
      comment: 'Clean facilities',
    };

    const firstSave = saveFeedbackReport(report1);
    expect(firstSave.id).toBe('fb-idem-01');

    // Duplicate call with same idempotencyKey
    const duplicateReport = {
      id: 'fb-idem-duplicate',
      facilityId: 'pt-blr-ward150-001',
      rating: 1, // should be ignored
      idempotencyKey: 'idem-key-12345',
      comment: 'Bad',
    };

    const secondSave = saveFeedbackReport(duplicateReport);
    expect(secondSave.id).toBe('fb-idem-01'); // returns original

    const allReports = loadFeedbackReports('pt-blr-ward150-001');
    const matches = allReports.filter((r) => r.idempotencyKey === 'idem-key-12345');
    expect(matches).toHaveLength(1);
  });

  it('appends and loads audit log events', () => {
    recordAuditEvent({
      facilityId: 'pt-blr-ward150-001',
      action: 'TEMPORARY_CLOSURE',
      actorRole: 'operator',
      reason: 'Plumbing overhaul',
    });

    const audits = loadAuditEvents('pt-blr-ward150-001');
    expect(audits.length).toBeGreaterThan(0);
    expect(audits[0].action).toBe('TEMPORARY_CLOSURE');
  });

  it('prunes cleaning events older than retention cutoff', () => {
    const oldTimestamp = new Date(Date.now() - 100 * 24 * 3600 * 1000).toISOString(); // 100 days ago
    saveCleaningEvent({
      id: 'cln-ancient-01',
      facilityId: 'pt-blr-ward150-001',
      cleanedAt: oldTimestamp,
      checklist: { waterSupplyVerified: true, floorSanitized: true, suppliesRestocked: true },
    });

    const pruneStats = pruneStaleRecords({ cleaningDays: 90, ticketDays: 365 });
    expect(pruneStats.prunedCleaningCount).toBeGreaterThanOrEqual(1);

    const remaining = loadCleaningEvents('pt-blr-ward150-001');
    expect(remaining.some((e) => e.id === 'cln-ancient-01')).toBe(false);
  });

  it('migrates legacy records to schema version 1', () => {
    const legacy = [
      {
        id: 'legacy-01',
        name: 'Old Toilet',
        schemaVersion: 0,
      },
    ];

    const migrated = migrateToiletData(legacy, 1);
    expect(migrated[0].schemaVersion).toBe(1);
    expect(migrated[0].feeStructure).toBeDefined();
    expect(migrated[0].capacity).toBeDefined();
    expect(migrated[0].features).toBeDefined();
  });
});

