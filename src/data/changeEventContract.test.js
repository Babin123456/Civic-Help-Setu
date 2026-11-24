import { describe, it, expect } from 'vitest';
import {
  CHANGE_EVENT_SCHEMA_VERSION,
  CHANGE_TYPES,
  CHANGE_REASONS,
  CHANGE_STATUS,
  CHANGE_TRANSITIONS,
  isChangeEvent,
  validateChangeEvent,
  validateSubscription,
  generateId,
} from './changeEventContract.js';

describe('changeEventContract', () => {
  it('exports correct schema version and constants', () => {
    expect(CHANGE_EVENT_SCHEMA_VERSION).toBe(1);
    expect(CHANGE_TYPES).toContain('POLICY_CHANGE');
    expect(CHANGE_TYPES).toContain('FEE_SCHEDULE_UPDATE');
    expect(CHANGE_REASONS).toContain('editorial');
    expect(CHANGE_REASONS).toContain('regulatory');
    expect(CHANGE_STATUS).toContain('pending');
    expect(CHANGE_STATUS).toContain('approved');
  });

  it('validates allowed state transitions', () => {
    expect(CHANGE_TRANSITIONS.pending).toContain('approved');
    expect(CHANGE_TRANSITIONS.pending).toContain('rejected');
    expect(CHANGE_TRANSITIONS.approved).toContain('archived');
    expect(CHANGE_TRANSITIONS.archived).toHaveLength(0);
  });

  it('generates unique valid identifiers', () => {
    const id1 = generateId('change');
    const id2 = generateId('change');
    expect(id1).toMatch(/^change-/);
    expect(id1).not.toBe(id2);
  });

  it('identifies valid and invalid ChangeEvent objects', () => {
    const valid = {
      id: 'change-1',
      serviceId: 'aadhaar-guide',
      changeType: 'POLICY_CHANGE',
      changeReason: 'regulatory',
      effectiveDate: '2026-12-01',
      editorId: 'editor-1',
      changedAt: '2026-11-19',
      affectedJurisdictions: [{ level: 'national' }],
    };
    expect(isChangeEvent(valid)).toBe(true);
    expect(isChangeEvent(null)).toBe(false);
    expect(isChangeEvent({ id: 'incomplete' })).toBe(false);
  });

  it('validates change event payloads and returns actionable error list', () => {
    const badPayload = {
      serviceId: '',
      changeType: 'INVALID_TYPE',
      effectiveDate: 'not-a-date',
    };
    const errors = validateChangeEvent(badPayload);
    expect(errors.length).toBeGreaterThan(0);
    const fields = errors.map(e => e.field);
    expect(fields).toContain('serviceId');
    expect(fields).toContain('changeType');
    expect(fields).toContain('effectiveDate');
  });

  it('validates subscription payloads correctly', () => {
    const validSub = {
      userId: 'user-123',
      serviceId: 'aadhaar-guide',
      type: 'SERVICE',
      frequency: 'IMMEDIATE',
    };
    const errors = validateSubscription(validSub);
    expect(errors).toHaveLength(0);

    const invalidSub = {
      userId: '',
      type: 'UNKNOWN',
    };
    const badErrors = validateSubscription(invalidSub);
    expect(badErrors.length).toBeGreaterThan(0);
  });
});
