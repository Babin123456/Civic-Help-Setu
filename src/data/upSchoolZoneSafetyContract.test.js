import { describe, it, expect } from 'vitest';
import {
  HAZARD_TYPES,
  ROAD_AUTHORITIES,
  AUDIT_STATUSES,
  canTransitionAuditStatus,
  NON_LEGAL_FAULT_DISCLAIMER,
  sanitizeAuditText,
} from './upSchoolZoneSafetyContract';

describe('upSchoolZoneSafetyContract', () => {
  it('defines all required hazard types from issue specifications', () => {
    expect(HAZARD_TYPES.MISSING_ZEBRA_CROSSING).toBe('missing_zebra_crossing');
    expect(HAZARD_TYPES.BLOCKED_FOOTPATH).toBe('blocked_footpath');
    expect(HAZARD_TYPES.SPEEDING_TRAFFIC_NO_CALMING).toBe('speeding_traffic_no_calming');
    expect(HAZARD_TYPES.ABSENT_SIGNAGE).toBe('absent_signage');
    expect(HAZARD_TYPES.POOR_VISIBILITY).toBe('poor_visibility');
    expect(HAZARD_TYPES.DRAINAGE_WATERLOGGING).toBe('drainage_waterlogging');
    expect(HAZARD_TYPES.PICKUP_DROPOFF_CONFLICT).toBe('pickup_dropoff_conflict');
  });

  it('defines the key road authorities in Uttar Pradesh', () => {
    expect(ROAD_AUTHORITIES.MUNICIPAL_CORPORATION).toBe('municipal_corporation');
    expect(ROAD_AUTHORITIES.UP_PWD).toBe('up_pwd');
    expect(ROAD_AUTHORITIES.NHAI).toBe('nhai');
    expect(ROAD_AUTHORITIES.DEVELOPMENT_AUTHORITY).toBe('development_authority');
    expect(ROAD_AUTHORITIES.GRAM_PANCHAYAT).toBe('gram_panchayat');
  });

  describe('Lifecycle State Transitions (AC-4 Invariant)', () => {
    it('strictly forbids marking resolved directly from acknowledged', () => {
      const result = canTransitionAuditStatus(
        AUDIT_STATUSES.ACKNOWLEDGED,
        AUDIT_STATUSES.RESOLVED
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('A report cannot be marked resolved solely because it was acknowledged');
    });

    it('allows valid progression through inspection and interim safety measure', () => {
      // Reported -> Acknowledged
      expect(canTransitionAuditStatus(AUDIT_STATUSES.REPORTED, AUDIT_STATUSES.ACKNOWLEDGED).allowed).toBe(true);

      // Acknowledged -> Inspection Scheduled
      expect(canTransitionAuditStatus(AUDIT_STATUSES.ACKNOWLEDGED, AUDIT_STATUSES.INSPECTION_SCHEDULED).allowed).toBe(true);

      // Inspection Scheduled -> Inspected
      expect(canTransitionAuditStatus(AUDIT_STATUSES.INSPECTION_SCHEDULED, AUDIT_STATUSES.INSPECTED).allowed).toBe(true);

      // Inspected -> Interim Measure
      expect(canTransitionAuditStatus(AUDIT_STATUSES.INSPECTED, AUDIT_STATUSES.INTERIM_MEASURE_IMPLEMENTED).allowed).toBe(true);

      // Interim Measure -> Resolved
      expect(canTransitionAuditStatus(AUDIT_STATUSES.INTERIM_MEASURE_IMPLEMENTED, AUDIT_STATUSES.RESOLVED).allowed).toBe(true);

      // Inspected -> Resolved directly (if engineering work completed on inspection)
      expect(canTransitionAuditStatus(AUDIT_STATUSES.INSPECTED, AUDIT_STATUSES.RESOLVED).allowed).toBe(true);
    });

    it('rejects transitioning to the identical state', () => {
      const res = canTransitionAuditStatus(AUDIT_STATUSES.REPORTED, AUDIT_STATUSES.REPORTED);
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('already in status');
    });
  });

  describe('Ethical & Redaction Safeguards', () => {
    it('contains non-legal fault disclaimer to avoid automatic liability claims', () => {
      expect(NON_LEGAL_FAULT_DISCLAIMER).toContain('does not determine legal liability');
    });

    it('sanitizes UP vehicle number plates and phone numbers from user comments', () => {
      const rawText = 'White van UP 32 AB 1234 parked illegally outside school gate. Call 9876543210.';
      const sanitized = sanitizeAuditText(rawText);
      expect(sanitized).not.toContain('UP 32 AB 1234');
      expect(sanitized).toContain('[REDACTED_VEHICLE_NO]');
      expect(sanitized).not.toContain('9876543210');
      expect(sanitized).toContain('[REDACTED_PHONE]');
    });
  });
});
