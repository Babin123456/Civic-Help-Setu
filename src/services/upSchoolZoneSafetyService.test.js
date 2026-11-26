import { describe, it, expect, beforeEach } from 'vitest';
import {
  listSchoolZones,
  getSchoolZoneById,
  resolveRoadOwnershipJurisdiction,
  recordManualJurisdictionOverride,
  calculateSeverityRationale,
  getOriginalEvidencePhoto,
  detectDuplicateReport,
  listAuditReports,
  submitSchoolZoneAudit,
  transitionAuditStatus,
  endorseAuditReport,
  generateSMCPrintableAudit,
} from './upSchoolZoneSafetyService';
import {
  HAZARD_TYPES,
  HAZARD_SEVERITY_LEVELS,
  ROAD_AUTHORITIES,
  AUDIT_STATUSES,
  NON_LEGAL_FAULT_DISCLAIMER,
} from '../data/upSchoolZoneSafetyContract';

const createMockStorage = () => {
  const store = new Map();
  return {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
};

describe('upSchoolZoneSafetyService', () => {
  let mockStorage;

  beforeEach(() => {
    mockStorage = createMockStorage();
  });

  describe('School Zone Register & Discovery (Scope & Invariants)', () => {
    it('lists pilot government schools across Lucknow urban and rural approaches', () => {
      const schools = listSchoolZones({ storage: mockStorage });
      expect(schools.length).toBeGreaterThanOrEqual(4);

      const urbanSchool = schools.find((s) => s.locationType === 'urban');
      const ruralSchool = schools.find((s) => s.locationType === 'rural');

      expect(urbanSchool).toBeDefined();
      expect(urbanSchool.udiseCode).toMatch(/^09/); // UP state code prefix 09
      expect(ruralSchool).toBeDefined();
      expect(ruralSchool.blockOrWard).toContain('Mohanlalganj');
    });

    it('filters schools by query and location type', () => {
      const ruralOnly = listSchoolZones({ locationType: 'rural', storage: mockStorage });
      expect(ruralOnly.every((s) => s.locationType === 'rural')).toBe(true);

      const queryMatches = listSchoolZones({ query: 'Shahmina', storage: mockStorage });
      expect(queryMatches.length).toBe(1);
      expect(queryMatches[0].id).toBe('SCH-UP-LKO-001');
    });

    it('retrieves school by ID or UDISE code', () => {
      const byId = getSchoolZoneById('SCH-UP-LKO-001', mockStorage);
      expect(byId).toBeDefined();
      expect(byId.name).toContain('Government Girls Inter College');

      const byUdise = getSchoolZoneById('09300501201', mockStorage);
      expect(byUdise.id).toBe('SCH-UP-LKO-001');
    });
  });

  describe('AC-1: Audit Report Recording & Provenance', () => {
    it('records school zone, hazard type, date, and provenance trail', () => {
      const report = submitSchoolZoneAudit(
        {
          schoolId: 'SCH-UP-LKO-001',
          gateId: 'G2-WEST',
          hazardType: HAZARD_TYPES.DRAINAGE_WATERLOGGING,
          hazardTitle: 'Severe waterlogging and open culvert at Gate 2',
          description: 'Rainwater accumulation blocks footpath.',
          auditDate: '2026-11-20',
          reporterRole: 'Parent / SMC Member',
        },
        { reporterToken: 'test_rep_token_1' },
        mockStorage
      );

      expect(report.id).toMatch(/^AUD-UP-/);
      expect(report.schoolId).toBe('SCH-UP-LKO-001');
      expect(report.udiseCode).toBe('09300501201');
      expect(report.gateId).toBe('G2-WEST');
      expect(report.hazardType).toBe(HAZARD_TYPES.DRAINAGE_WATERLOGGING);
      expect(report.auditDate).toBe('2026-11-20');
      expect(report.status).toBe(AUDIT_STATUSES.REPORTED);

      // Provenance check
      expect(report.provenance).toBeDefined();
      expect(report.provenance.registeredUdiseCode).toBe('09300501201');
      expect(report.provenance.submittedVia).toBe('CivicHelpSetu-SchoolZoneAudit-v1');
      expect(report.provenance.clientTimestamp).toBeDefined();

      // Non-fault ethical disclaimer check
      expect(report.disclaimerNotice).toBe(NON_LEGAL_FAULT_DISCLAIMER);
    });

    it('throws when school zone identifier is missing or invalid', () => {
      expect(() =>
        submitSchoolZoneAudit(
          { hazardType: HAZARD_TYPES.ABSENT_SIGNAGE },
          {},
          mockStorage
        )
      ).toThrowError(/identifier is required/);

      expect(() =>
        submitSchoolZoneAudit(
          { schoolId: 'NON_EXISTENT_SCHOOL', hazardType: HAZARD_TYPES.ABSENT_SIGNAGE },
          {},
          mockStorage
        )
      ).toThrowError(/not found in register/);
    });
  });

  describe('AC-2: Privacy Redaction & Reporter Confidentiality', () => {
    it('blurs faces and license plates in public photos, while storing unredacted original in private vault', () => {
      const rawSamplePhoto = 'data:image/jpeg;base64,RAW_UNREDACTED_IMAGE_DATA_WITH_CHILD_FACE_AND_UP32_PLATE';
      const reporterToken = 'private_secret_token_abc123';

      const report = submitSchoolZoneAudit(
        {
          schoolId: 'SCH-UP-LKO-002',
          hazardType: HAZARD_TYPES.ABSENT_SIGNAGE,
          photoUri: rawSamplePhoto,
        },
        { reporterToken },
        mockStorage
      );

      // Public photo is privacy-redacted
      expect(report.publicImageUrl).toBeDefined();
      expect(report.publicImageUrl).toContain('data:image/svg+xml');
      expect(report.publicImageUrl).toContain('[FACE REDACTED]');
      expect(report.publicImageUrl).toContain('[PLATE REDACTED]');
      expect(report.publicImageUrl).not.toContain(rawSamplePhoto);

      expect(report.redactionMetadata.isPrivacyRedacted).toBe(true);
      expect(report.redactionMetadata.facesRedactedCount).toBeGreaterThan(0);

      // Reporter can access original with valid token
      const originalForReporter = getOriginalEvidencePhoto(report, reporterToken);
      expect(originalForReporter).toBe(rawSamplePhoto);

      // Unauthorized third party cannot access unredacted photo
      expect(() => getOriginalEvidencePhoto(report, 'wrong_intruder_token')).toThrowError(
        /Unredacted original photo remains private to the verified reporter/
      );
    });
  });

  describe('AC-3: Authority Routing & Manual Correction', () => {
    it('classifies road ownership with cited administrative source', () => {
      const school1 = getSchoolZoneById('SCH-UP-LKO-001', mockStorage);
      const res1 = resolveRoadOwnershipJurisdiction({
        schoolZone: school1,
        gateId: 'G1-NORTH',
        storage: mockStorage,
      });

      expect(res1.authority).toBe(ROAD_AUTHORITIES.UP_PWD);
      expect(res1.source).toContain('UP PWD');
      expect(res1.isManualOverride).toBe(false);

      const ruralSchool = getSchoolZoneById('SCH-UP-LKO-004', mockStorage);
      const resRural = resolveRoadOwnershipJurisdiction({
        schoolZone: ruralSchool,
        gateId: 'G1-RURAL',
        storage: mockStorage,
      });

      expect(resRural.authority).toBe(ROAD_AUTHORITIES.GRAM_PANCHAYAT);
      expect(resRural.source).toContain('Panchayati Raj');
    });

    it('allows manual correction with recorded rationale', () => {
      const report = submitSchoolZoneAudit(
        {
          schoolId: 'SCH-UP-LKO-001',
          gateId: 'G1-NORTH',
          hazardType: HAZARD_TYPES.PICKUP_DROPOFF_CONFLICT,
          manualAuthorityOverride: ROAD_AUTHORITIES.MUNICIPAL_CORPORATION,
          overrideReason: 'Corridor officially transferred to Lucknow Nagar Nigam Zone 2 in 2025',
          forceAllowDuplicate: true,
        },
        {},
        mockStorage
      );

      expect(report.assignedAuthority).toBe(ROAD_AUTHORITIES.MUNICIPAL_CORPORATION);
      expect(report.isAuthorityManuallyOverridden).toBe(true);
      expect(report.authoritySource).toContain('Manual Correction');
      expect(report.authoritySource).toContain('transferred to Lucknow Nagar Nigam');
    });

    it('persists manual jurisdiction override for future school lookups', () => {
      recordManualJurisdictionOverride({
        schoolId: 'SCH-UP-LKO-002',
        gateId: 'G1-SECTOR',
        correctedAuthority: ROAD_AUTHORITIES.MUNICIPAL_CORPORATION,
        reason: 'Handed over by LDA to Municipal Corporation',
        actor: 'Ward Inspector',
        storage: mockStorage,
      });

      const school = getSchoolZoneById('SCH-UP-LKO-002', mockStorage);
      const routing = resolveRoadOwnershipJurisdiction({
        schoolZone: school,
        gateId: 'G1-SECTOR',
        storage: mockStorage,
      });

      expect(routing.authority).toBe(ROAD_AUTHORITIES.MUNICIPAL_CORPORATION);
      expect(routing.isManualOverride).toBe(true);
      expect(routing.overrideReason).toContain('Handed over by LDA');
    });
  });

  describe('AC-4: Lifecycle Transitions & Statutory Guardrail', () => {
    it('strictly prevents marking a report resolved solely because it was acknowledged', () => {
      const report = submitSchoolZoneAudit(
        {
          schoolId: 'SCH-UP-LKO-001',
          hazardType: HAZARD_TYPES.ABSENT_SIGNAGE,
          forceAllowDuplicate: true,
        },
        {},
        mockStorage
      );

      // Reported -> Acknowledged
      const acknowledged = transitionAuditStatus({
        reportId: report.id,
        targetStatus: AUDIT_STATUSES.ACKNOWLEDGED,
        actor: 'PWD Junior Engineer',
        notes: 'Diary Ref #882 assigned',
        storage: mockStorage,
      });
      expect(acknowledged.status).toBe(AUDIT_STATUSES.ACKNOWLEDGED);

      // Attempt illegal transition: Acknowledged -> Resolved
      expect(() =>
        transitionAuditStatus({
          reportId: report.id,
          targetStatus: AUDIT_STATUSES.RESOLVED,
          actor: 'Clerical Staff',
          notes: 'Marking resolved because ticket acknowledged',
          storage: mockStorage,
        })
      ).toThrowError(/A report cannot be marked resolved solely because it was acknowledged/);
    });

    it('permits resolution after verified inspection or interim safety measure', () => {
      const report = submitSchoolZoneAudit(
        {
          schoolId: 'SCH-UP-LKO-003',
          hazardType: HAZARD_TYPES.POOR_VISIBILITY,
          forceAllowDuplicate: true,
        },
        {},
        mockStorage
      );

      transitionAuditStatus({
        reportId: report.id,
        targetStatus: AUDIT_STATUSES.ACKNOWLEDGED,
        storage: mockStorage,
      });

      // Acknowledged -> Inspected
      const inspected = transitionAuditStatus({
        reportId: report.id,
        targetStatus: AUDIT_STATUSES.INSPECTED,
        actor: 'Traffic Inspector',
        notes: 'Foliage and commercial parking blocking sightline confirmed.',
        storage: mockStorage,
      });
      expect(inspected.status).toBe(AUDIT_STATUSES.INSPECTED);

      // Inspected -> Interim Measure Implemented
      const interim = transitionAuditStatus({
        reportId: report.id,
        targetStatus: AUDIT_STATUSES.INTERIM_MEASURE_IMPLEMENTED,
        actor: 'PWD Road Maintenance Wing',
        notes: 'Reflective warning drums and temporary signboards installed.',
        storage: mockStorage,
      });
      expect(interim.status).toBe(AUDIT_STATUSES.INTERIM_MEASURE_IMPLEMENTED);

      // Interim Measure -> Resolved
      const resolved = transitionAuditStatus({
        reportId: report.id,
        targetStatus: AUDIT_STATUSES.RESOLVED,
        actor: 'Executive Engineer',
        notes: 'Permanent sightline clearing and high-friction surfacing complete.',
        storage: mockStorage,
      });
      expect(resolved.status).toBe(AUDIT_STATUSES.RESOLVED);
      expect(resolved.statusHistory.length).toBe(5);
    });
  });

  describe('AC-5: School Management Committee (SMC) Printable Audit Export', () => {
    it('generates a structured, formal printable audit dossier for SMC and authorities', () => {
      const dossier = generateSMCPrintableAudit({
        schoolId: 'SCH-UP-LKO-001',
        requestedBy: 'Smt. Sunita Srivastava (SMC President)',
        storage: mockStorage,
      });

      expect(dossier.documentTitle).toContain('STATUTORY SCHOOL-ZONE ROAD SAFETY AUDIT DOSSIER');
      expect(dossier.statutoryMandate).toContain('Section 21 of the Right of Children to Free and Compulsory Education (RTE) Act');
      expect(dossier.schoolSummary.name).toBe('Government Girls Inter College (GGIC), Shahmina Road');
      expect(dossier.schoolSummary.udiseCode).toBe('09300501201');
      expect(dossier.schoolSummary.studentStrength).toBe(1420);

      // Hazard items present
      expect(dossier.hazardInventory.length).toBeGreaterThan(0);
      expect(dossier.hazardInventory[0].evidenceProvenance).toBeDefined();

      // Sign-off blocks present for committee
      expect(dossier.signOffBlocks.length).toBe(3);
      expect(dossier.signOffBlocks[0].role).toContain('SMC Chairperson');
      expect(dossier.ethicalDisclaimer).toBe(NON_LEGAL_FAULT_DISCLAIMER);
    });
  });

  describe('AC-6: Duplicate Report Detection', () => {
    it('flags duplicate audit if an active report for the same school gate and hazard already exists', () => {
      // First audit
      submitSchoolZoneAudit(
        {
          schoolId: 'SCH-UP-LKO-004',
          gateId: 'G1-RURAL',
          hazardType: HAZARD_TYPES.BLOCKED_FOOTPATH,
        },
        {},
        mockStorage
      );

      // Immediate check for duplicate
      const dupCheck = detectDuplicateReport({
        schoolId: 'SCH-UP-LKO-004',
        gateId: 'G1-RURAL',
        hazardType: HAZARD_TYPES.BLOCKED_FOOTPATH,
        storage: mockStorage,
      });

      expect(dupCheck.isDuplicate).toBe(true);
      expect(dupCheck.message).toContain('already exists at this school gate');

      // Attempting to submit without forceAllowDuplicate throws DUPLICATE_AUDIT_EXISTS
      expect(() =>
        submitSchoolZoneAudit(
          {
            schoolId: 'SCH-UP-LKO-004',
            gateId: 'G1-RURAL',
            hazardType: HAZARD_TYPES.BLOCKED_FOOTPATH,
          },
          {},
          mockStorage
        )
      ).toThrowError(/already exists/);
    });

    it('allows endorsing an existing audit instead of filing duplicates', () => {
      const audits = listAuditReports({ storage: mockStorage });
      const target = audits[0];
      const initialCount = target.endorsementCount || 0;

      const endorsed = endorseAuditReport(target.id, mockStorage);
      expect(endorsed.endorsementCount).toBe(initialCount + 1);
    });
  });

  describe('Severity Scoring & Ethical Non-Fault Rationale', () => {
    it('calculates severity with non-accusatory civil reasoning', () => {
      const result = calculateSeverityRationale({
        hazardType: HAZARD_TYPES.SPEEDING_TRAFFIC_NO_CALMING,
        studentCount: 1500,
        speedLimitKmh: 40,
        isPeakHourConflict: true,
        hasCrossingFacility: false,
      });

      expect(result.severity).toBe(HAZARD_SEVERITY_LEVELS.CRITICAL);
      expect(result.rationale).toContain('student exposure (~1500 children)');
      expect(result.rationale).not.toContain('violator');
      expect(result.rationale).not.toContain('illegal');
    });
  });
});
