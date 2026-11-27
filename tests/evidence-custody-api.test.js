/**
 * tests/evidence-custody-api.test.js
 *
 * API integration tests for verifiable-evidence-bundles handler with
 * Chain-of-Custody Ledger verification (#1425).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import handler from '../api/_lib/handlers/verifiable-evidence-bundles.js';
import { createNewBundle, addEvidenceEntry } from '../src/services/verifiableEvidenceBundleService.js';
import { clearAllEvidenceData } from '../src/services/verifiableEvidenceBundleStorage.js';
import {
  CUSTODY_EVENT_TYPES,
  CUSTODY_STATUS,
  clearCustodyLedgers,
  recordCustodyEvent,
  getCustodyLedger,
} from '../src/services/evidenceCustodyLedgerExtension.js';
import { EVIDENCE_SOURCE_TYPES, PROVENANCE_TIERS } from '../src/data/verifiableEvidenceBundleContract.js';

function createMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(k, v) {
      this.headers[k] = v;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    end() {
      return this;
    },
  };
  return res;
}

describe('verifiable-evidence-bundles API with Custody Ledger (#1425)', () => {
  beforeEach(() => {
    clearAllEvidenceData();
    clearCustodyLedgers();
  });

  it('GET returns operational status and custodySchemaVersion', async () => {
    const req = { method: 'GET', headers: {} };
    const res = createMockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.custodySchemaVersion).toBe('1.0.0');
    expect(res.body.disclaimer).toBeTruthy();
  });

  it('POST verifies valid bundle and valid custodyLedger (200)', async () => {
    const bundle = createNewBundle({ id: 'API-1', title: 'Drainage Issue' }, 'api-user');
    const { bundle: updated, addedEntry } = await addEvidenceEntry(
      bundle.bundleId,
      {
        title: 'Site Photo',
        source: EVIDENCE_SOURCE_TYPES.CITIZEN_PHOTO,
        provenanceTier: PROVENANCE_TIERS.CITIZEN_ASSERTION,
      },
      'api-user',
      'raw-photo-content'
    );

    await recordCustodyEvent({
      bundleId: bundle.bundleId,
      entryId: addedEntry.entryId,
      eventType: CUSTODY_EVENT_TYPES.CAPTURED,
      actorId: 'api-user',
      rationale: 'Captured at Ward 4 junction',
      originalHash: addedEntry.entryHash,
      resultingHash: addedEntry.entryHash,
    });

    const ledger = getCustodyLedger(bundle.bundleId);

    const req = {
      method: 'POST',
      headers: { 'x-forwarded-for': '10.0.0.11' },
      body: {
        manifest: updated,
        enclosedFiles: { [addedEntry.entryId]: { payload: 'raw-photo-content' } },
        custodyLedger: ledger,
      },
    };
    const res = createMockRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.verified).toBe(true);
    expect(res.body.custodyVerification.status).toBe(CUSTODY_STATUS.VERIFIED);
  });

  it('POST returns 422 when custodyLedger has been tampered', async () => {
    const bundle = createNewBundle({ id: 'API-2', title: 'Road Issue' }, 'api-user-2');
    const { bundle: updated, addedEntry } = await addEvidenceEntry(
      bundle.bundleId,
      {
        title: 'Road Photo',
        source: EVIDENCE_SOURCE_TYPES.CITIZEN_PHOTO,
        provenanceTier: PROVENANCE_TIERS.CITIZEN_ASSERTION,
      },
      'api-user-2'
    );

    await recordCustodyEvent({
      bundleId: bundle.bundleId,
      entryId: addedEntry.entryId,
      eventType: CUSTODY_EVENT_TYPES.CAPTURED,
      actorId: 'api-user-2',
      rationale: 'Original rationale',
      originalHash: addedEntry.entryHash,
    });

    const ledger = getCustodyLedger(bundle.bundleId);
    const tampered = [{ ...ledger[0], rationale: 'Tampered rationale' }];

    const req = {
      method: 'POST',
      headers: { 'x-forwarded-for': '10.0.0.12' },
      body: {
        manifest: updated,
        custodyLedger: tampered,
      },
    };
    const res = createMockRes();
    await handler(req, res);

    expect(res.statusCode).toBe(422);
    expect(res.body.verified).toBe(false);
    expect(res.body.custodyVerification.isValid).toBe(false);
  });

  it('POST returns 400 when custodyLedger contains forbidden PII', async () => {
    const bundle = createNewBundle({ id: 'API-3', title: 'PII Guard Test' }, 'api-user-3');
    const req = {
      method: 'POST',
      headers: { 'x-forwarded-for': '10.0.0.13' },
      body: {
        manifest: bundle,
        custodyLedger: [
          {
            sequence: 1,
            rationale: 'Aadhaar 1234 5678 9012 leaked in log',
          },
        ],
      },
    };
    const res = createMockRes();
    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('Privacy Policy Violation');
  });
});
