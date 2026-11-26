import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import EvidenceGraphContradictionModal from './EvidenceGraphContradictionModal';
import { SYNTHETIC_VAULT_DOCUMENTS } from '../../../tests/fixtures/syntheticEvidenceFixtures';

describe('EvidenceGraphContradictionModal', () => {
  it('does not render when isOpen is false', () => {
    const html = renderToStaticMarkup(
      <EvidenceGraphContradictionModal isOpen={false} onClose={() => {}} documents={[]} />
    );
    expect(html).toBe('');
  });

  it('renders modal header, disclaimer, and empty state when < 2 documents', () => {
    const html = renderToStaticMarkup(
      <EvidenceGraphContradictionModal isOpen={true} onClose={() => {}} documents={[]} />
    );

    expect(html).toContain('Civic Evidence Graph: Discrepancy Detector');
    expect(html).toContain('At least 2 documents needed for cross-verification');
    expect(html).toContain('Load Synthetic Test Documents');
    expect(html).toContain('Docs: 0');
  });

  it('populates conflicts and renders metric badges when multiple documents provided', () => {
    const docs = [SYNTHETIC_VAULT_DOCUMENTS[0], SYNTHETIC_VAULT_DOCUMENTS[1]];
    const html = renderToStaticMarkup(
      <EvidenceGraphContradictionModal isOpen={true} onClose={() => {}} documents={docs} />
    );

    expect(html).toContain('Civic Evidence Graph: Discrepancy Detector');
    expect(html).toContain('Docs: 2');
    expect(html).toContain('Critical Mismatches');
    expect(html).toContain('Warnings');
    expect(html).toContain('Near Matches');

    // Should render card view for conflicts
    expect(html).toContain('Conflicting Dates of Birth');
    expect(html).toContain('Phonetic transliteration near-match');
    expect(html).toContain('Authoritative: AADHAAR CARD');
    expect(html).toContain('Authoritative: SCHOOL LEAVING CERTIFICATE');
  });

  it('renders accessible table tab and report controls', () => {
    const docs = [SYNTHETIC_VAULT_DOCUMENTS[0], SYNTHETIC_VAULT_DOCUMENTS[1]];
    const html = renderToStaticMarkup(
      <EvidenceGraphContradictionModal isOpen={true} onClose={() => {}} documents={docs} />
    );

    expect(html).toContain('Cards View');
    expect(html).toContain('Accessible Table');
    expect(html).toContain('Audit Report');
    expect(html).toContain('Close');
  });
});
