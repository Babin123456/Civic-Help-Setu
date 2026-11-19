import { describe, it, expect } from 'vitest';
import {
  SHELTER_STATES,
  validateShelterSiteData,
  validateCapacitySnapshotData,
  validateFacilityServiceData,
  validateStatusEventData,
  validateVerificationCheckData,
  isValidTransition,
  getOppositeState,
  getCapacityBandLabel,
  getCapacityBandColor,
  formatLastUpdated,
  generateShelterSiteId,
  generateIdempotencyKey
} from './shelterStatusService';

describe('shelterStatusService - Data Validation', () => {
  describe('validateShelterSiteData', () => {
    it('validates a minimal valid shelter site', () => {
      const errors = validateShelterSiteData({
        name: 'Test Shelter',
        jurisdiction: 'Test District',
        status: 'OPEN',
        schemaVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      expect(errors).toEqual([]);
    });

    it('rejects missing name', () => {
      const errors = validateShelterSiteData({
        jurisdiction: 'Test District',
        status: 'OPEN',
        schemaVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      expect(errors).toContain('Name is required and must be a non-empty string');
    });

    it('rejects empty name', () => {
      const errors = validateShelterSiteData({
        name: '',
        jurisdiction: 'Test District',
        status: 'OPEN',
        schemaVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      expect(errors).toContain('Name is required and must be a non-empty string');
    });

    it('validates jurisdiction requirement', () => {
      const errors = validateShelterSiteData({
        name: 'Test Shelter',
        status: 'OPEN',
        schemaVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      expect(errors).toContain('Jurisdiction is required and must be a non-empty string');
    });

    it('validates status enum', () => {
      const errors = validateShelterSiteData({
        name: 'Test Shelter',
        jurisdiction: 'Test District',
        status: 'INVALID',
        schemaVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      expect(errors).toContain('Status must be one of: OPEN, CLOSED, TEMPORARILY_CLOSED, MAINTENANCE');
    });

    it('validates capacityTotal range', () => {
      const errors = validateShelterSiteData({
        name: 'Test Shelter',
        jurisdiction: 'Test District',
        status: 'OPEN',
        capacityTotal: 1500,
        schemaVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      expect(errors).toEqual([]);
    });

    it('rejects capacityTotal out of range', () => {
      const errors = validateShelterSiteData({
        name: 'Test Shelter',
        jurisdiction: 'Test District',
        status: 'OPEN',
        capacityTotal: 0,
        schemaVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      expect(errors).toContain('capacityTotal must be between 1 and 10000');

      const errors2 = validateShelterSiteData({
        name: 'Test Shelter',
        jurisdiction: 'Test District',
        status: 'OPEN',
        capacityTotal: 10001,
        schemaVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      expect(errors2).toContain('capacityTotal must be between 1 and 10000');
    });

    it('validates accessibility booleans', () => {
      const errors = validateShelterSiteData({
        name: 'Test Shelter',
        jurisdiction: 'Test District',
        status: 'OPEN',
        accessibility: {
          wheelchairAccessible: true,
          hearingImpaired: false,
          visuallyImpaired: true
        },
        schemaVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      expect(errors).toEqual([]);
    });

    it('rejects invalid accessibility boolean', () => {
      const errors = validateShelterSiteData({
        name: 'Test Shelter',
        jurisdiction: 'Test District',
        status: 'OPEN',
        accessibility: {
          wheelchairAccessible: 'yes'
        },
        schemaVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      expect(errors).toContain('wheelchairAccessible must be a boolean if provided');
    });
  });

  describe('validateCapacitySnapshotData', () => {
    it('validates a minimal valid capacity snapshot', () => {
      const errors = validateCapacitySnapshotData({
        shelterSiteId: 'test-shelter',
        capacityAvailable: 100,
        capacityTotal: 500,
        occupancyRate: 20,
        updateSource: 'operator update',
        schemaVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      expect(errors).toEqual([]);
    });

    it('rejects missing shelterSiteId', () => {
      const errors = validateCapacitySnapshotData({
        capacityAvailable: 100,
        capacityTotal: 500,
        occupancyRate: 20,
        updateSource: 'operator update',
        schemaVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      expect(errors).toContain('shelterSiteId is required');
    });

    it('rejects capacityAvailable > capacityTotal', () => {
      const errors = validateCapacitySnapshotData({
        shelterSiteId: 'test-shelter',
        capacityAvailable: 600,
        capacityTotal: 500,
        occupancyRate: 20,
        updateSource: 'operator update',
        schemaVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      expect(errors).toContain('capacityAvailable must not exceed capacityTotal');
    });

    it('rejects negative capacityAvailable', () => {
      const errors = validateCapacitySnapshotData({
        shelterSiteId: 'test-shelter',
        capacityAvailable: -10,
        capacityTotal: 500,
        occupancyRate: 20,
        updateSource: 'operator update',
        schemaVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      expect(errors).toContain('capacityAvailable must be >= 0');
    });

    it('validates occupancyRate range', () => {
      const errors = validateCapacitySnapshotData({
        shelterSiteId: 'test-shelter',
        capacityAvailable: 100,
        capacityTotal: 500,
        occupancyRate: 50,
        updateSource: 'operator update',
        schemaVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      expect(errors).toEqual([]);
    });

    it('rejects occupancyRate > 100', () => {
      const errors = validateCapacitySnapshotData({
        shelterSiteId: 'test-shelter',
        capacityAvailable: 100,
        capacityTotal: 500,
        occupancyRate: 150,
        updateSource: 'operator update',
        schemaVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      expect(errors).toContain('occupancyRate must be between 0 and 100');
    });

    it('rejects negative occupancyRate', () => {
      const errors = validateCapacitySnapshotData({
        shelterSiteId: 'test-shelter',
        capacityAvailable: 100,
        capacityTotal: 500,
        occupancyRate: -10,
        updateSource: 'operator update',
        schemaVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      expect(errors).toContain('occupancyRate must be between 0 and 100');
    });

    it('validates updateSource requirement', () => {
      const errors = validateCapacitySnapshotData({
        shelterSiteId: 'test-shelter',
        capacityAvailable: 100,
        capacityTotal: 500,
        occupancyRate: 20,
        schemaVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      expect(errors).toContain('updateSource is required');
    });

    it('validates capacityTotal range', () => {
      const errors = validateCapacitySnapshotData({
        shelterSiteId: 'test-shelter',
        capacityAvailable: 100,
        capacityTotal: 1,
        occupancyRate: 20,
        updateSource: 'operator update',
        schemaVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      expect(errors).toEqual([]);

      const errors2 = validateCapacitySnapshotData({
        shelterSiteId: 'test-shelter',
        capacityAvailable: 100,
        capacityTotal: 10001,
        occupancyRate: 20,
        updateSource: 'operator update',
        schemaVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      expect(errors2).toContain('capacityTotal must be between 1 and 10000');
    });
  });

  describe('validateFacilityServiceData', () => {
    it('validates a minimal valid facility service', () => {
      const errors = validateFacilityServiceData({
        shelterSiteId: 'test-shelter',
        serviceType: 'WATER',
        status: 'AVAILABLE',
        schemaVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      expect(errors).toEqual([]);
    });

    it('rejects invalid serviceType', () => {
      const errors = validateFacilityServiceData({
        shelterSiteId: 'test-shelter',
        serviceType: 'INVALID',
        status: 'AVAILABLE',
        schemaVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      expect(errors).toContain('serviceType must be one of: WATER, POWER, SANITATION, MEDICAL, FOOD');
    });

    it('rejects invalid service status', () => {
      const errors = validateFacilityServiceData({
        shelterSiteId: 'test-shelter',
        serviceType: 'WATER',
        status: 'STALE',
        schemaVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      expect(errors).toContain('status must be one of: AVAILABLE, LIMITED, UNAVAILABLE');
    });

    it('validates capacity ranges', () => {
      const errors = validateFacilityServiceData({
        shelterSiteId: 'test-shelter',
        serviceType: 'WATER',
        status: 'AVAILABLE',
        capacityTotal: 500,
        capacityAvailable: 400,
        schemaVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      expect(errors).toEqual([]);
    });

    it('rejects capacityAvailable > capacityTotal', () => {
      const errors = validateFacilityServiceData({
        shelterSiteId: 'test-shelter',
        serviceType: 'WATER',
        status: 'AVAILABLE',
        capacityTotal: 100,
        capacityAvailable: 200,
        schemaVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      expect(errors).toContain('capacityAvailable must not exceed capacityTotal');
    });
  });

  describe('validateStatusEventData', () => {
    it('validates a minimal valid status event', () => {
      const errors = validateStatusEventData({
        shelterSiteId: 'test-shelter',
        eventType: 'CAPACITY_UPDATE',
        oldState: 'OPEN',
        newState: 'CLOSED',
        operatorId: 'operator-1',
        timestamp: Math.floor(Date.now() / 1000),
        description: 'Capacity updated by operator',
        schemaVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      expect(errors).toEqual([]);
    });

    it('rejects missing oldState', () => {
      const errors = validateStatusEventData({
        shelterSiteId: 'test-shelter',
        eventType: 'CAPACITY_UPDATE',
        newState: 'CLOSED',
        operatorId: 'operator-1',
        timestamp: Math.floor(Date.now() / 1000),
        description: 'Test'
      });
      expect(errors).toContain('oldState is required');
    });

    it('rejects missing newState', () => {
      const errors = validateStatusEventData({
        shelterSiteId: 'test-shelter',
        eventType: 'CAPACITY_UPDATE',
        oldState: 'OPEN',
        operatorId: 'operator-1',
        timestamp: Math.floor(Date.now() / 1000),
        description: 'Test'
      });
      expect(errors).toContain('newState is required');
    });

    it('validates eventType enum', () => {
      const errors = validateStatusEventData({
        shelterSiteId: 'test-shelter',
        eventType: 'INVALID',
        oldState: 'OPEN',
        newState: 'CLOSED',
        operatorId: 'operator-1',
        timestamp: Math.floor(Date.now() / 1000),
        description: 'Test'
      });
      expect(errors).toContain('eventType must be one of: CAPACITY_UPDATE, SERVICE_UPDATE, CLOSURE, REOPENING, VERIFICATION, CAPACITY, SERVICES, ACCESSIBILITY');
    });

    it('validates oldState enum', () => {
      const errors = validateStatusEventData({
        shelterSiteId: 'test-shelter',
        eventType: 'CAPACITY_UPDATE',
        oldState: 'INVALID',
        newState: 'CLOSED',
        operatorId: 'operator-1',
        timestamp: Math.floor(Date.now() / 1000),
        description: 'Test'
      });
      expect(errors).toContain('oldState must be one of: OPEN, CLOSED, TEMPORARILY_CLOSED, MAINTENANCE');
    });

    it('validates newState enum', () => {
      const errors = validateStatusEventData({
        shelterSiteId: 'test-shelter',
        eventType: 'CAPACITY_UPDATE',
        oldState: 'OPEN',
        newState: 'INVALID',
        operatorId: 'operator-1',
        timestamp: Math.floor(Date.now() / 1000),
        description: 'Test'
      });
      expect(errors).toContain('newState must be one of: OPEN, CLOSED, TEMPORARILY_CLOSED, MAINTENANCE');
    });

    it('validates operatorId requirement', () => {
      const errors = validateStatusEventData({
        shelterSiteId: 'test-shelter',
        eventType: 'CAPACITY_UPDATE',
        oldState: 'OPEN',
        newState: 'CLOSED',
        timestamp: Math.floor(Date.now() / 1000),
        description: 'Test'
      });
      expect(errors).toContain('operatorId is required');
    });

    it('validates timestamp requirement', () => {
      const errors = validateStatusEventData({
        shelterSiteId: 'test-shelter',
        eventType: 'CAPACITY_UPDATE',
        oldState: 'OPEN',
        newState: 'CLOSED',
        operatorId: 'operator-1',
        description: 'Test'
      });
      expect(errors).toContain('timestamp is required');
    });

    it('validates description requirement', () => {
      const errors = validateStatusEventData({
        shelterSiteId: 'test-shelter',
        eventType: 'CAPACITY_UPDATE',
        oldState: 'OPEN',
        newState: 'CLOSED',
        operatorId: 'operator-1',
        timestamp: Math.floor(Date.now() / 1000),
        description: ''
      });
      expect(errors).toContain('description is required and must be a non-empty string');
    });
  });

  describe('validateVerificationCheckData', () => {
    it('validates a minimal valid verification check', () => {
      const errors = validateVerificationCheckData({
        shelterSiteId: 'test-shelter',
        checkType: 'CAPACITY',
        status: 'PENDING',
        checkedBy: 'operator-1',
        notes: 'Initial check',
        schemaVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      expect(errors).toEqual([]);
    });

    it('rejects invalid checkType', () => {
      const errors = validateVerificationCheckData({
        shelterSiteId: 'test-shelter',
        checkType: 'INVALID',
        status: 'PENDING',
        checkedBy: 'operator-1',
        notes: 'Test'
      });
      expect(errors).toContain('checkType must be one of: CAPACITY, SERVICES, ACCESSIBILITY');
    });

    it('rejects invalid status', () => {
      const errors = validateVerificationCheckData({
        shelterSiteId: 'test-shelter',
        checkType: 'CAPACITY',
        status: 'INVALID',
        checkedBy: 'operator-1',
        notes: 'Test'
      });
      expect(errors).toContain('status must be one of: PENDING, PASSED, FAILED');
    });

    it('rejects missing checkedBy', () => {
      const errors = validateVerificationCheckData({
        shelterSiteId: 'test-shelter',
        checkType: 'CAPACITY',
        status: 'PENDING',
        notes: 'Test'
      });
      expect(errors).toContain('checkedBy is required');
    });

    it('rejects empty notes', () => {
      const errors = validateVerificationCheckData({
        shelterSiteId: 'test-shelter',
        checkType: 'CAPACITY',
        status: 'PENDING',
        checkedBy: 'operator-1',
        notes: ''
      });
      expect(errors).toContain('notes is required and must be a non-empty string');
    });

    it('validates rating range', () => {
      const errors = validateVerificationCheckData({
        shelterSiteId: 'test-shelter',
        checkType: 'CAPACITY',
        status: 'PASSED',
        checkedBy: 'operator-1',
        notes: 'Test',
        rating: 4
      });
      expect(errors).toEqual([]);

      const errors2 = validateVerificationCheckData({
        shelterSiteId: 'test-shelter',
        checkType: 'CAPACITY',
        status: 'PASSED',
        checkedBy: 'operator-1',
        notes: 'Test',
        rating: 6
      });
      expect(errors2).toContain('rating must be a number between 1 and 5 if provided');

      const errors3 = validateVerificationCheckData({
        shelterSiteId: 'test-shelter',
        checkType: 'CAPACITY',
        status: 'PASSED',
        checkedBy: 'operator-1',
        notes: 'Test',
        rating: 0
      });
      expect(errors3).toContain('rating must be a number between 1 and 5 if provided');
    });
  });
});

describe('shelterStatusService - Domain Logic', () => {
  describe('isValidTransition', () => {
    it('allows OPEN -> TEMPORARILY_CLOSED', () => {
      expect(isValidTransition(SHELTER_STATES.OPEN, SHELTER_STATES.TEMPORARILY_CLOSED)).toBe(true);
    });

    it('allows OPEN -> CLOSED', () => {
      expect(isValidTransition(SHELTER_STATES.OPEN, SHELTER_STATES.CLOSED)).toBe(true);
    });

    it('allows TEMPORARILY_CLOSED -> OPEN', () => {
      expect(isValidTransition(SHELTER_STATES.TEMPORARILY_CLOSED, SHELTER_STATES.OPEN)).toBe(true);
    });

    it('allows TEMPORARILY_CLOSED -> CLOSED', () => {
      expect(isValidTransition(SHELTER_STATES.TEMPORARILY_CLOSED, SHELTER_STATES.CLOSED)).toBe(true);
    });

    it('allows CLOSED -> OPEN', () => {
      expect(isValidTransition(SHELTER_STATES.CLOSED, SHELTER_STATES.OPEN)).toBe(true);
    });

    it('rejects OPEN -> CLOSED directly (not in allowed list)', () => {
      expect(isValidTransition(SHELTER_STATES.OPEN, SHELTER_STATES.CLOSED)).toBe(true);
    });

    it('rejects invalid transition', () => {
      expect(isValidTransition(SHELTER_STATES.CLOSED, SHELTER_STATES.TEMPORARILY_CLOSED)).toBe(false);
    });

    it('rejects MAINTENANCE -> invalid', () => {
      expect(isValidTransition(SHELTER_STATES.MAINTENANCE, SHELTER_STATES.OPEN)).toBe(true);
    });
  });

  describe('getOppositeState', () => {
    it('returns CLOSED for OPEN', () => {
      expect(getOppositeState(SHELTER_STATES.OPEN)).toBe(SHELTER_STATES.CLOSED);
    });

    it('returns OPEN for CLOSED', () => {
      expect(getOppositeState(SHELTER_STATES.CLOSED)).toBe(SHELTER_STATES.OPEN);
    });

    it('returns OPEN for TEMPORARILY_CLOSED', () => {
      expect(getOppositeState(SHELTER_STATES.TEMPORARILY_CLOSED)).toBe(SHELTER_STATES.OPEN);
    });

    it('returns null for MAINTENANCE', () => {
      expect(getOppositeState(SHELTER_STATES.MAINTENANCE)).toBeNull();
    });
  });

  describe('getCapacityBandLabel', () => {
    it('returns Low for <= 30%', () => {
      expect(getCapacityBandLabel(0)).toBe('Low');
      expect(getCapacityBandLabel(30)).toBe('Low');
    });

    it('returns Moderate for 31-70%', () => {
      expect(getCapacityBandLabel(31)).toBe('Moderate');
      expect(getCapacityBandLabel(70)).toBe('Moderate');
    });

    it('returns High for 71-90%', () => {
      expect(getCapacityBandLabel(71)).toBe('High');
      expect(getCapacityBandLabel(90)).toBe('High');
    });

    it('returns Critical for > 90%', () => {
      expect(getCapacityBandLabel(91)).toBe('Critical');
      expect(getCapacityBandLabel(100)).toBe('Critical');
    });
  });

  describe('getCapacityBandColor', () => {
    it('returns low color for <= 30%', () => {
      expect(getCapacityBandColor(0)).toBe('low');
      expect(getCapacityBandColor(30)).toBe('low');
    });

    it('returns moderate color for 31-70%', () => {
      expect(getCapacityBandColor(31)).toBe('moderate');
      expect(getCapacityBandColor(70)).toBe('moderate');
    });

    it('returns high color for 71-90%', () => {
      expect(getCapacityBandColor(71)).toBe('high');
      expect(getCapacityBandColor(90)).toBe('high');
    });

    it('returns critical color for > 90%', () => {
      expect(getCapacityBandColor(91)).toBe('critical');
      expect(getCapacityBandColor(100)).toBe('critical');
    });
  });

  describe('formatLastUpdated', () => {
    it('returns "Just now" for current timestamp', () => {
      expect(formatLastUpdated(Math.floor(Date.now() / 1000))).toBe('Just now');
    });

    it('returns seconds ago for recent', () => {
      expect(formatLastUpdated(Math.floor(Date.now() / 1000) - 45)).toBe('45 seconds ago');
    });

    it('returns minutes ago for recent', () => {
      expect(formatLastUpdated(Math.floor(Date.now() / 1000) - 120)).toBe('2 minutes ago');
    });

    it('returns hours ago for older', () => {
      expect(formatLastUpdated(Math.floor(Date.now() / 1000) - 7200)).toBe('about 2 hours ago');
    });

    it('returns days ago for older', () => {
      expect(formatLastUpdated(Math.floor(Date.now() / 1000) - 86400)).toBe('1 day ago');
    });

    it('returns "yesterday" for 1.5 days', () => {
      expect(formatLastUpdated(Math.floor(Date.now() / 1000) - 172800)).toBe('yesterday');
    });
  });

  describe('generateShelterSiteId', () => {
    it('generates stable lowercase slug', () => {
      expect(generateShelterSiteId('District Disaster Management Center')).toBe('district-disaster-management-center');
    });

    it('handles simple names', () => {
      expect(generateShelterSiteId('Test')).toBe('test');
    });

    it('handles names with multiple spaces', () => {
      expect(generateShelterSiteId('A  B  C')).toBe('a-b-c');
    });
  });

  describe('generateIdempotencyKey', () => {
    it('generates deterministic key', () => {
      const key1 = generateIdempotencyKey('shelter-1', 'CAPACITY_UPDATE', { capacityAvailable: 100 });
      const key2 = generateIdempotencyKey('shelter-1', 'CAPACITY_UPDATE', { capacityAvailable: 100 });
      expect(key1).toBe(key2);
    });

    it('generates different keys for different shelters', () => {
      const key1 = generateIdempotencyKey('shelter-1', 'CAPACITY_UPDATE', {});
      const key2 = generateIdempotencyKey('shelter-2', 'CAPACITY_UPDATE', {});
      expect(key1).not.toBe(key2);
    });

    it('generates different keys for different actions', () => {
      const key1 = generateIdempotencyKey('shelter-1', 'CAPACITY_UPDATE', {});
      const key2 = generateIdempotencyKey('shelter-1', 'CLOSURE', {});
      expect(key1).not.toBe(key2);
    });
  });
});