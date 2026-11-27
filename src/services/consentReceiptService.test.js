import { describe, it, expect, beforeEach } from 'vitest';
import {
  createConsentReceipt,
  getConsentReceipts,
  revokeConsentReceipt,
  isPresentationRevoked,
  clearConsentReceipts
} from './consentReceiptService';
import { CONSENT_STATUSES } from '../data/walletContracts';

describe('consentReceiptService', () => {
  beforeEach(() => {
    clearConsentReceipts();
  });

  it('creates and retrieves DPDP-compliant consent receipts', () => {
    const receipt = createConsentReceipt({
      presentationId: 'vp_test_123',
      relyingParty: {
        serviceId: 'civicbridge:service:ration-card',
        name: 'PDS Ration Card Office'
      },
      purpose: 'Verification of family income and BPL criteria',
      disclosedAttributes: ['fullName', 'isBplQualified', 'householdSize']
    });

    expect(receipt.receiptId).toBeDefined();
    expect(receipt.status).toBe(CONSENT_STATUSES.ACTIVE);
    expect(receipt.disclosedAttributes).toEqual(['fullName', 'isBplQualified', 'householdSize']);

    const list = getConsentReceipts();
    expect(list.length).toBe(1);
    expect(list[0].receiptId).toBe(receipt.receiptId);
  });

  it('revokes consent receipts and flags presentation as revoked', () => {
    const receipt = createConsentReceipt({
      presentationId: 'vp_test_revoke_456',
      relyingParty: 'civicbridge:service:water-tanker',
      purpose: 'Water subsidy verification',
      disclosedAttributes: ['wardNumber']
    });

    expect(isPresentationRevoked('vp_test_revoke_456')).toBe(false);

    const revoked = revokeConsentReceipt(receipt.receiptId, 'Citizen no longer requires subsidy');
    expect(revoked.status).toBe(CONSENT_STATUSES.REVOKED);
    expect(revoked.revokedAt).toBeDefined();
    expect(revoked.revocationReason).toBe('Citizen no longer requires subsidy');

    expect(isPresentationRevoked('vp_test_revoke_456')).toBe(true);
  });

  it('marks active receipts as expired after validUntil has passed', () => {
    const past = Date.now() - 10000;
    const receipt = createConsentReceipt({
      presentationId: 'vp_test_expired_789',
      relyingParty: 'civicbridge:service:library-card',
      purpose: 'Library registration',
      disclosedAttributes: ['fullName'],
      validUntil: new Date(past - 5000).toISOString(),
      now: past - 10000
    });

    const receipts = getConsentReceipts(Date.now());
    const found = receipts.find((r) => r.receiptId === receipt.receiptId);
    expect(found.status).toBe(CONSENT_STATUSES.EXPIRED);
  });
});
