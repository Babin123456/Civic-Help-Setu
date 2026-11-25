import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import CitizenRetentionLedgerModal from './CitizenRetentionLedgerModal';
import {
  initializeDefaultPurposeLedger,
  generateAccessReceipt,
} from '../../services/citizenRetentionPurposeLedgerService';

describe('CitizenRetentionLedgerModal Integrity UI', () => {
  beforeEach(() => {
    if (globalThis.__mockPrivacyStorage) {
      globalThis.__mockPrivacyStorage.clear();
    }
    if (globalThis.__mockPurposeStorage) {
      globalThis.__mockPurposeStorage.clear();
    }
    initializeDefaultPurposeLedger();
  });

  it('renders modal with active purposes, statutory references, and receipts', () => {
    generateAccessReceipt('CIVIC_ELIGIBILITY_ASSESSMENT');
    const html = renderToStaticMarkup(<CitizenRetentionLedgerModal isOpen={true} onClose={vi.fn()} />);

    expect(html).toContain('Citizen Data Retention &amp; Purpose Ledger');
    expect(html).toContain('Active Purposes');
    expect(html).toContain('Cryptographic Receipts');
    expect(html).toContain('Legal Holds');
    expect(html).toContain('Welfare &amp; Service Eligibility Evaluation');
    expect(html).toContain('DPDP Act 2023');
  });

  it('renders nothing when isOpen is false', () => {
    const html = renderToStaticMarkup(<CitizenRetentionLedgerModal isOpen={false} onClose={vi.fn()} />);
    expect(html).toBe('');
  });
});
