/**
 * src/services/evidenceCustodyLedgerExtension.test.js
 *
 * Unit tests for Civic Evidence Bundle Integrity & Chain-of-Custody Ledger (#1425).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  CUSTODY_EVENT_TYPES,
  CUSTODY_STATUS,
  recordCustodyEvent,
  getCustodyLedger,
  clearCustodyLedgers,
  applySelectiveRedaction,
  verifyCustodyLedger,
  exportBundleWithCustody,
  importBundleWithCustodyVerification,
  redactPIIPatterns,
  detectForbiddenPII,
} from './evidenceCustodyLedgerExtension.js';
import {
  createNewBundle,
  addEvidenceEntry,
  verifyExistingBundle,
} from './verifiableEvidenceBundleService.js';
import { clearAllEvidenceData } from './verifiableEvidenceBundleStorage.js';
import {
  EVIDENCE_SOURCE_TYPES,
  PROVENANCE_TIERS,
  STATUTORY_EVIDENCE_DISCLAIMER,
} from '../data/verifiableEvidenceBundleContract.js';

describe('evidenceCustodyLedgerExtension (#1425)', () => {
  beforeEach(() => {
    clearAllEvidenceData();
    clearCustodyLedgers();
  });

  it('records hash-chained custody events and verifies clean chain', async () => {
    const bundle = createNewBundle({ id: 'C-1', title: 'Water Supply Complaint' }, 'user-1');
    const { addedEntry } = await addEvidenceEntry(
      bundle.bundleId,
      {
        title: 'Dry Tap Photo',
        source: EVIDENCE_SOURCE_TYPES.CITIZEN_PHOTO,
        provenanceTier: PROVENANCE_TIERS.CITIZEN_ASSERTION,
        userAnnotation: 'No water since 6 AM',
      },
      'user-1',
      'photo-bytes-v1'
    );

    const ev1 = await recordCustodyEvent({
      bundleId: bundle.bundleId,
      entryId: addedEntry.entryId,
      eventType: CUSTODY_EVENT_TYPES.CAPTURED,
      actorId: 'user-1',
      rationale: 'Initial photo capture',
      originalHash: addedEntry.entryHash,
      resultingHash: addedEntry.entryHash,
    });

    const ev2 = await recordCustodyEvent({
      bundleId: bundle.bundleId,
      entryId: addedEntry.entryId,
      eventType: CUSTODY_EVENT_TYPES.ANNOTATED,
      actorId: 'user-1',
      rationale: 'Added ward landmark note',
      originalHash: addedEntry.entryHash,
      resultingHash: addedEntry.entryHash,
    });

    expect(ev2.prevCustodyHash).toBe(ev1.custodyEventHash);

    const ledger = getCustodyLedger(bundle.bundleId);
    expect(ledger).toHaveLength(2);

    const verification = await verifyCustodyLedger(bundle, ledger);
    expect(verification.isValid).toBe(true);
    expect(verification.status).toBe(CUSTODY_STATUS.VERIFIED);
    expect(verification.disclaimer).toBe(STATUTORY_EVIDENCE_DISCLAIMER);
  });

  it('applies selective redaction while preserving original entryHash and attachment sha256', async () => {
    const bundle = createNewBundle({ id: 'C-2', title: 'Ration Card Delay' }, 'user-2');
    const { addedEntry } = await addEvidenceEntry(
      bundle.bundleId,
      {
        title: 'Counter Receipt',
        source: EVIDENCE_SOURCE_TYPES.PORTAL_ACKNOWLEDGEMENT,
        provenanceTier: PROVENANCE_TIERS.INDEPENDENT_VERIFICATION,
        userAnnotation: 'Submitted by applicant, contact 9876543210',
      },
      'user-2',
      'receipt-pdf-bytes'
    );

    const originalEntryHash = addedEntry.entryHash;
    const originalAttachmentSha = addedEntry.attachment.sha256;

    const { bundle: updated, custodyEvent, redactedEntryView } = await applySelectiveRedaction({
      bundleId: bundle.bundleId,
      entryId: addedEntry.entryId,
      redactFields: ['pii_auto'],
      redactionReason: 'Remove personal phone before public filing',
      actorId: 'user-2',
    });

    // Original entry hash and attachment hash must remain untouched
    const originalEntryInManifest = updated.entries.find((e) => e.entryId === addedEntry.entryId);
    expect(originalEntryInManifest.entryHash).toBe(originalEntryHash);
    expect(originalEntryInManifest.attachment.sha256).toBe(originalAttachmentSha);

    // Derived redacted view has redacted text & distinct hash
    expect(redactedEntryView.userAnnotation).toContain('[REDACTED:PHONE]');
    expect(redactedEntryView.originalEntryHash).toBe(originalEntryHash);
    expect(redactedEntryView.redactedContentHash).toBeTruthy();

    // Custody event recorded
    expect(custodyEvent.eventType).toBe(CUSTODY_EVENT_TYPES.REDACTED);
    expect(custodyEvent.originalHash).toBe(originalEntryHash);

    // Bundle integrity itself must still pass
    const bundleVerify = await verifyExistingBundle(bundle.bundleId, 'user-2');
    expect(bundleVerify.isValid).toBe(true);
  });

  it('detects tampered custody event hashes and broken chains', async () => {
    const bundle = createNewBundle({ id: 'C-3', title: 'Streetlight Outage' }, 'user-3');
    await recordCustodyEvent({
      bundleId: bundle.bundleId,
      eventType: CUSTODY_EVENT_TYPES.CAPTURED,
      actorId: 'user-3',
      rationale: 'Captured pole photo',
    });

    const ledger = getCustodyLedger(bundle.bundleId);
    const tamperedLedger = [{ ...ledger[0], rationale: 'Silently altered rationale' }];

    const result = await verifyCustodyLedger(bundle, tamperedLedger);
    expect(result.isValid).toBe(false);
    expect(result.status).toBe(CUSTODY_STATUS.TAMPERED);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('rejects forbidden PII in custody log rationale', async () => {
    const bundle = createNewBundle({ id: 'C-4', title: 'Pension Delay' }, 'user-4');
    await expect(
      recordCustodyEvent({
        bundleId: bundle.bundleId,
        eventType: CUSTODY_EVENT_TYPES.ANNOTATED,
        actorId: 'user-4',
        rationale: 'Aadhaar 1234 5678 9012 noted on slip',
      })
    ).rejects.toThrow(/forbidden personal data/i);
  });

  it('exports with custody ledger and verifies hashes on import', async () => {
    const bundle = createNewBundle({ id: 'C-5', title: 'Drain Blockage' }, 'user-5');
    const { addedEntry } = await addEvidenceEntry(
      bundle.bundleId,
      {
        title: 'Drain Photo',
        source: EVIDENCE_SOURCE_TYPES.CITIZEN_PHOTO,
        provenanceTier: PROVENANCE_TIERS.CITIZEN_ASSERTION,
      },
      'user-5',
      'drain-photo-payload'
    );

    await recordCustodyEvent({
      bundleId: bundle.bundleId,
      entryId: addedEntry.entryId,
      eventType: CUSTODY_EVENT_TYPES.CAPTURED,
      actorId: 'user-5',
      rationale: 'Captured drain blockage photo',
      originalHash: addedEntry.entryHash,
      resultingHash: addedEntry.entryHash,
    });

    const exported = await exportBundleWithCustody(bundle.bundleId, 'user-5', true);
    expect(exported.custodyLedger.length).toBe(2); // CAPTURED + EXPORTED
    expect(exported.custodyVerification.isValid).toBe(true);
    expect(exported.jsonString).toContain('do NOT certify factual truth or sovereign legal authenticity');

    // Import into another user scope
    const imported = await importBundleWithCustodyVerification(exported.jsonString, 'reviewer-1');
    expect(imported.success).toBe(true);
    expect(imported.verification.isValid).toBe(true);
    expect(imported.custodyVerification.isValid).toBe(true);
    expect(imported.custodyLedger.length).toBe(3); // CAPTURED + EXPORTED + IMPORTED
  });

  it('rejects import when enclosed custody ledger is tampered', async () => {
    const bundle = createNewBundle({ id: 'C-6', title: 'Road Damage' }, 'user-6');
    await recordCustodyEvent({
      bundleId: bundle.bundleId,
      eventType: CUSTODY_EVENT_TYPES.CAPTURED,
      actorId: 'user-6',
      rationale: 'Original capture',
    });

    const exported = await exportBundleWithCustody(bundle.bundleId, 'user-6', true);
    const parsed = JSON.parse(exported.jsonString);
    parsed.custodyLedger[0].rationale = 'Tampered after export';

    const imported = await importBundleWithCustodyVerification(JSON.stringify(parsed), 'reviewer-2');
    expect(imported.success).toBe(false);
    expect(imported.custodyVerification.isValid).toBe(false);
  });

  it('redacts Aadhaar, PAN, and phone patterns cleanly', () => {
    const { redactedText, patternsRedacted } = redactPIIPatterns(
      'Ref 1234 5678 9012, PAN ABCDE1234F, Call 9876543210'
    );
    expect(redactedText).toContain('[REDACTED:AADHAAR]');
    expect(redactedText).toContain('[REDACTED:PAN]');
    expect(redactedText).toContain('[REDACTED:PHONE]');
    expect(patternsRedacted).toEqual(['aadhaar', 'pan', 'phone']);
    expect(detectForbiddenPII('Clean civic landmark note')).toBeNull();
  });
});
