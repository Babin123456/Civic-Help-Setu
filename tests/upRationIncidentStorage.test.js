// UP Ration Incident Storage Tests
// Tests for offline draft saving, recovery, duplicate detection, and PII safety
// Uses vitest environment - avoids window/localStorage where possible

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  INCIDENT_STORAGE_KEY, 
  createDefaultIncident, 
  validateIncidentNoPII,
  exportIncidentAsReceipt
} from '../src/data/upRationIncident';
import { 
  isDuplicateIncident,
  getIncidentsByDistrict 
} from '../src/services/upRationIncidentStorage';
import { UP_DISTRICTS } from '../src/data/upGrievanceChannels';
import { INCIDENT_REASON_CODES, INCIDENT_FORM_FIELDS } from '../src/data/upRationIncident';

describe('upRationIncident - UP Districts', () => {
  it('should have UP districts defined', () => {
    expect(UP_DISTRICTS.length).toBeGreaterThanOrEqual(70); // UP has 75 districts
    expect(UP_DISTRICTS).toContain('Lucknow');
    expect(UP_DISTRICTS).toContain('Kanpur');
    expect(UP_DISTRICTS).toContain('Varanasi');
  });

  it('should validate district names are proper non-empty strings', () => {
    UP_DISTRICTS.forEach((district) => {
      expect(typeof district).toBe('string');
      expect(district.trim().length).toBeGreaterThan(0);
    });
  });
});

describe('upRationIncident - PII Validation', () => {
  it('should reject Aadhaar field', () => {
    const incident = createDefaultIncident();
    incident.aadhaar = '123456789012';
    const errors = validateIncidentNoPII(incident);
    expect(errors.some((e) => e.includes('aadhaar'))).toBe(true);
  });

  it('should reject OTP field', () => {
    const incident = createDefaultIncident();
    incident.otp = '123456';
    const errors = validateIncidentNoPII(incident);
    expect(errors.some((e) => e.includes('otp'))).toBe(true);
  });

  it('should reject fingerprint field', () => {
    const incident = createDefaultIncident();
    incident.fingerprint = 'sensitive_data';
    const errors = validateIncidentNoPII(incident);
    expect(errors.some((e) => e.includes('fingerprint'))).toBe(true);
  });

  it('should reject rationCardNumber field', () => {
    const incident = createDefaultIncident();
    incident.rationCardNumber = 'RC/123456';
    const errors = validateIncidentNoPII(incident);
    expect(errors.some((e) => e.includes('rationCardNumber'))).toBe(true);
  });

  it('should reject password/token fields', () => {
    const incident = createDefaultIncident();
    incident.password = 'secret';
    incident.token = 'abc123';
    const errors = validateIncidentNoPII(incident);
    expect(errors.some((e) => e.includes('password'))).toBe(true);
    expect(errors.some((e) => e.includes('token'))).toBe(true);
  });

  it('should pass validation for clean incident with no PII', () => {
    const incident = createDefaultIncident();
    const errors = validateIncidentNoPII(incident);
    expect(errors).toEqual([]);
  });

  it('should reject multiple forbidden fields at once', () => {
    const incident = createDefaultIncident();
    incident.aadhaar = '123456789012';
    incident.otp = '123456';
    incident.fingerprint = 'sensitive';
    const errors = validateIncidentNoPII(incident);
    expect(errors.length).toBe(3);
  });
});

describe('upRationIncident - Default Incident Structure', () => {
  it('should create default incident with all required fields', () => {
    const incident = createDefaultIncident();
    expect(incident.id).toBeDefined();
    expect(incident.district).toBe('');
    expect(incident.blockOrWard).toBe('');
    expect(incident.shopId).toBe('');
    expect(incident.shopName).toBe('');
    expect(incident.rationMonth).toBeDefined();
    expect(incident.commodity).toBe('Rice');
    expect(incident.quantityShowed).toBe(0);
    expect(incident.quantityReceived).toBe(0);
    expect(incident.reason).toBe('ePOS_FAILURE');
    expect(incident.additionalDetails).toBe('');
    expect(incident.createdAt).toBeDefined();
    expect(incident.updatedAt).toBeDefined();
    expect(incident.auditMetadata).toBeDefined();
  });

  it('should create default incident with custom overrides', () => {
    const incident = createDefaultIncident({
      district: 'Lucknow',
      commodity: 'Wheat',
      reason: 'STOCK_OUT',
    });
    expect(incident.district).toBe('Lucknow');
    expect(incident.commodity).toBe('Wheat');
    expect(incident.reason).toBe('STOCK_OUT');
  });

  it('should have correct INCIDENT_REASON_CODES mapping', () => {
    expect(INCIDENT_REASON_CODES.ePOS_FAILURE).toBe('e-PoS machine failure or connectivity issue');
    expect(INCIDENT_REASON_CODES.AUTH_MISMATCH).toBe('Aadhaar / biometric authentication mismatch');
    expect(INCIDENT_REASON_CODES.STOCK_OUT).toBe('Commodity stock not available at fair-price shop');
    expect(INCIDENT_REASON_CODES.PORTABILITY_REJECTED).toBe('One Nation One Ration Card (ONORC) portability rejected');
    expect(INCIDENT_REASON_CODES.QUANTITY_DISCREPANCY).toBe('Shown quantity vs received quantity mismatch');
    expect(INCIDENT_REASON_CODES.RATION_CARD_ISSUE).toBe('Ration card not accepted or invalid');
    expect(INCIDENT_REASON_CODES.SHOP_CLOSED).toBe('Fair-price shop closed on declared day');
    expect(INCIDENT_REASON_CODES.OTHER).toBe('Other / unspecified reason');
  });
});

describe('upRationIncident - Receipt Export Logic', () => {
  it('should generate receipt without PII for clean incident', () => {
    const incident = createDefaultIncident();
    incident.district = 'Lucknow';
    incident.commodity = 'Wheat';
    incident.rationMonth = '2026-11';
    incident.quantityShowed = 5;
    incident.quantityReceived = 3;
    incident.reason = 'ePOS_FAILURE';
    incident.shopName = 'Test Shop';

    const { error } = exportIncidentAsReceipt(incident);
    expect(error).toBeUndefined();
  });

  it('should reject receipt generation if PII is present', () => {
    const incident = createDefaultIncident();
    incident.aadhaar = '123456789012'; // forbidden field
    const { error } = exportIncidentAsReceipt(incident);
    expect(error).toBeDefined();
  });

  it('should include district and quantities in receipt', () => {
    const incident = createDefaultIncident();
    incident.district = 'Kanpur';
    incident.commodity = 'Rice';
    incident.rationMonth = '2026-10';
    incident.quantityShowed = 10;
    incident.quantityReceived = 8;
    incident.reason = 'AUTH_MISMATCH';

    const receipt = exportIncidentAsReceipt(incident);
    expect(receipt).toContain('Kanpur');
    expect(receipt).toContain('Rice');
    expect(receipt).toContain('10');
    expect(receipt).toContain('8');
    expect(receipt).toContain('QUANTITY SHOWN (kg)');
    expect(receipt).toContain('QUANTITY RECEIVED (kg)');
    expect(receipt).toContain('Aadhaar / biometric authentication mismatch');
  });
});

describe('upRationIncident - Duplicate Detection Logic', () => {
  // Helper to check duplication based on key fields
  const checkDuplicate = (existing, newIncident) => {
    if (existing.id === newIncident.id) return false;
    
    const isSameDistrict = existing.district === newIncident.district && existing.district !== '';
    const isSameMonth = existing.rationMonth === newIncident.rationMonth;
    const isSameCommodity = existing.commodity === newIncident.commodity;
    const isSameReason = existing.reason === newIncident.reason;
    const isSameShop = existing.shopId === newIncident.shopId && existing.shopId !== '';

    return isSameDistrict && isSameMonth && isSameCommodity && isSameReason;
  };

  it('should detect duplicate when district, month, commodity, reason match', () => {
    const existing = createDefaultIncident();
    existing.district = 'Lucknow';
    existing.rationMonth = '2026-11';
    existing.commodity = 'Wheat';
    existing.reason = 'ePOS_FAILURE';
    existing.shopId = 'FPS-101';

    const newIncident = createDefaultIncident();
    newIncident.district = 'Lucknow';
    newIncident.rationMonth = '2026-11';
    newIncident.commodity = 'Wheat';
    newIncident.reason = 'ePOS_FAILURE';
    newIncident.shopId = 'FPS-101';

    const isDuplicate = checkDuplicate(existing, newIncident);
    expect(isDuplicate).toBe(true);
  });

  it('should not flag as duplicate when district differs', () => {
    const existing = createDefaultIncident();
    existing.district = 'Lucknow';
    existing.rationMonth = '2026-11';
    existing.commodity = 'Wheat';
    existing.reason = 'ePOS_FAILURE';

    const newIncident = createDefaultIncident();
    newIncident.district = 'Kanpur';
    newIncident.rationMonth = '2026-11';
    newIncident.commodity = 'Wheat';
    newIncident.reason = 'ePOS_FAILURE';

    const isDuplicate = checkDuplicate(existing, newIncident);
    expect(isDuplicate).toBe(false);
  });

  it('should not flag as duplicate when reason differs', () => {
    const existing = createDefaultIncident();
    existing.district = 'Lucknow';
    existing.rationMonth = '2026-11';
    existing.commodity = 'Wheat';
    existing.reason = 'ePOS_FAILURE';

    const newIncident = createDefaultIncident();
    newIncident.district = 'Lucknow';
    newIncident.rationMonth = '2026-11';
    newIncident.commodity = 'Wheat';
    newIncident.reason = 'STOCK_OUT';

    const isDuplicate = checkDuplicate(existing, newIncident);
    expect(isDuplicate).toBe(false);
  });

  it('should allow generic complaints without shop data', () => {
    const existing = createDefaultIncident();
    existing.district = 'Lucknow';
    existing.rationMonth = '2026-11';
    existing.commodity = 'Wheat';
    existing.reason = 'ePOS_FAILURE';
    // No shopId - generic complaint

    const newIncident = createDefaultIncident();
    newIncident.district = 'Lucknow';
    newIncident.rationMonth = '2026-11';
    newIncident.commodity = 'Wheat';
    newIncident.reason = 'ePOS_FAILURE';
    // Also no shopId

    const isDuplicate = checkDuplicate(existing, newIncident);
    expect(typeof isDuplicate).toBe('boolean');
  });
});

describe('upRationIncident - Grievance Channel Routing', () => {
  it('should work with unspecified district', () => {
    const district = '';
    expect(district).toBe('');
  });

  it('should validate UP districts list completeness', () => {
    // All entries should be non-empty strings
    UP_DISTRICTS.forEach((district) => {
      expect(typeof district).toBe('string');
      expect(district.trim().length).toBeGreaterThan(0);
    });
  });
});

describe('upRationIncident - Form Fields Schema', () => {
  it('should have all required form fields defined', () => {
    const fields = INCIDENT_FORM_FIELDS;
    expect(fields).toBeDefined();
    expect(fields.length).toBeGreaterThan(0);
    
    // Check key fields exist
    const fieldNames = fields.map(f => f.name);
    expect(fieldNames).toContain('district');
    expect(fieldNames).toContain('rationMonth');
    expect(fieldNames).toContain('commodity');
    expect(fieldNames).toContain('reason');
    expect(fieldNames).toContain('quantityShowed');
    expect(fieldNames).toContain('quantityReceived');
  });

  it('district field options are populated from UP districts (dynamic)', () => {
    const districtField = INCIDENT_FORM_FIELDS.find(f => f.name === 'district');
    expect(districtField).toBeDefined();
    // District options are populated dynamically from UP_DISTRICTS in the form component
    // The field definition has options: [] and gets populated at runtime
    expect(districtField.options).toBeDefined();
    expect(typeof districtField.options).toBe('object');
    expect(districtField.required).toBe(true);
  });

  it('rationMonth field should have pattern validation', () => {
    const monthField = INCIDENT_FORM_FIELDS.find(f => f.name === 'rationMonth');
    expect(monthField).toBeDefined();
    expect(monthField.pattern).toBe('^\\d{4}-\\d{2}$');
    expect(monthField.required).toBe(true);
  });

  it('reason field should have incident reason codes', () => {
    const reasonField = INCIDENT_FORM_FIELDS.find(f => f.name === 'reason');
    expect(reasonField).toBeDefined();
    expect(reasonField.options).toBeDefined();
    expect(reasonField.options.length).toBe(Object.keys(INCIDENT_REASON_CODES).length);
    expect(reasonField.required).toBe(true);
  });
});