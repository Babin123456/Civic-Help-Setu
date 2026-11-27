import { describe, it, expect } from 'vitest';
import {
  createSchemaUpcasterRegistry,
  SchemaUpcastError,
} from '../api/_lib/schemaUpcaster.js';

describe('Versioned Payload Schema Upcaster (#1462)', () => {
  function buildRegistry() {
    const reg = createSchemaUpcasterRegistry();
    reg.registerDomain('civic_grievance', {
      latestVersion: 3,
      defaultVersion: 1,
      upcasters: {
        1: (doc) => ({
          ...doc,
          wardCode: doc.ward ? `WARD-${doc.ward}` : 'WARD-UNKNOWN',
        }),
        2: (doc) => ({
          ...doc,
          jurisdiction: { state: 'UP', wardCode: doc.wardCode },
        }),
      },
      downcasters: {
        3: (doc) => {
          const copy = { ...doc };
          delete copy.jurisdiction;
          return copy;
        },
      },
    });
    return reg;
  }

  it('upcasts legacy v1 payloads deterministically across multiple hops and is idempotent', () => {
    const reg = buildRegistry();
    const legacy = { id: 'g-1', ward: 14, description: 'Streetlight out' };

    const first = reg.upcast('civic_grievance', legacy);
    expect(first.fromVersion).toBe(1);
    expect(first.toVersion).toBe(3);
    expect(first.upcasted).toBe(true);
    expect(first.payload.jurisdiction).toEqual({ state: 'UP', wardCode: 'WARD-14' });
    expect(legacy.wardCode).toBeUndefined(); // input not mutated

    const second = reg.upcast('civic_grievance', first.payload);
    expect(second.upcasted).toBe(false);
    expect(second.payload).toEqual(first.payload);
  });

  it('supports downcasting to older client versions and rejects unsupported future versions', () => {
    const reg = buildRegistry();
    const v3 = { id: 'g-2', schemaVersion: 3, wardCode: 'WARD-5', jurisdiction: { state: 'UP', wardCode: 'WARD-5' } };

    const down = reg.downcast('civic_grievance', v3, { targetVersion: 2 });
    expect(down.toVersion).toBe(2);
    expect(down.payload.jurisdiction).toBeUndefined();

    expect(() => reg.upcast('civic_grievance', { schemaVersion: 99 })).toThrow(SchemaUpcastError);
    try {
      reg.upcast('civic_grievance', { schemaVersion: 99 });
    } catch (err) {
      expect(err.code).toBe('UNSUPPORTED_FUTURE_VERSION');
    }
  });

  it('strips prototype-pollution keys during cloning and upcasting', () => {
    const reg = buildRegistry();
    const malicious = JSON.parse('{"id":"g-3","ward":7,"__proto__":{"polluted":true}}');
    const res = reg.upcast('civic_grievance', malicious);
    expect(({}).polluted).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(res.payload, '__proto__')).toBe(false);
  });
});
