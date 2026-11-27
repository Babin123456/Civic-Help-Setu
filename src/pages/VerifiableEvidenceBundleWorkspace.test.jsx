import { describe, it, expect, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import VerifiableEvidenceBundleWorkspace from './VerifiableEvidenceBundleWorkspace';
import { clearAllEvidenceData } from '../services/verifiableEvidenceBundleStorage';
import { createNewBundle, addEvidenceEntry } from '../services/verifiableEvidenceBundleService';
import { PROVENANCE_TIERS, EVIDENCE_SOURCE_TYPES } from '../data/verifiableEvidenceBundleContract';

import { AuthProvider } from '../context/AuthContext';

const renderWorkspace = () => {
  return renderToStaticMarkup(
    <MemoryRouter>
      <AuthProvider>
        <VerifiableEvidenceBundleWorkspace />
      </AuthProvider>
    </MemoryRouter>
  );
};

describe('VerifiableEvidenceBundleWorkspace (#1160)', () => {
  beforeEach(() => {
    clearAllEvidenceData();
  });

  it('renders hero title, statutory disclaimer notice, and empty state', () => {
    const html = renderWorkspace();

    expect(html).toContain('Verifiable Evidence Bundles for Civic Complaints');
    expect(html).toContain('Legal &amp; Verification Notice:');
    expect(html).toContain('Civic Help Setu Verifiable Evidence Bundles establish mathematical data integrity');
    expect(html).toContain('No Evidence Bundles Created Yet');
    expect(html).toContain('New Evidence Bundle');
    expect(html).toContain('Import Bundle Archive');
  });

  it('renders active bundle and append-only evidence ledger with provenance tags', async () => {
    const bundle = createNewBundle(
      {
        id: 'GRV-PWD-09',
        title: 'Pothole Grievance Package',
        department: 'PWD Ward 3',
        officialReferenceNumbers: ['PWD/2026/881'],
      },
      'anonymous_local'
    );

    await addEvidenceEntry(
      bundle.bundleId,
      {
        title: 'Pothole Depth Photo',
        source: EVIDENCE_SOURCE_TYPES.CITIZEN_PHOTO,
        provenanceTier: PROVENANCE_TIERS.CITIZEN_ASSERTION,
        userAnnotation: 'Depth 20cm observed on main road',
      },
      'anonymous_local'
    );

    await addEvidenceEntry(
      bundle.bundleId,
      {
        title: 'PWD Inward Receipt Slip',
        source: EVIDENCE_SOURCE_TYPES.PORTAL_ACKNOWLEDGEMENT,
        provenanceTier: PROVENANCE_TIERS.INDEPENDENT_VERIFICATION,
        userAnnotation: 'Official token issued at counter',
      },
      'anonymous_local'
    );

    const html = renderWorkspace();

    expect(html).toContain('Pothole Grievance Package');
    expect(html).toContain('PWD Ward 3');
    expect(html).toContain('PWD/2026/881');
    expect(html).toContain('Append-Only Evidence Ledger');
    expect(html).toContain('Pothole Depth Photo');
    expect(html).toContain('Citizen Assertion');
    expect(html).toContain('PWD Inward Receipt Slip');
    expect(html).toContain('Independently Verified Record');
    expect(html).toContain('Export JSON');
    expect(html).toContain('Export Dossier');
    expect(html).toContain('CPGRAMS Central Redressal');
    expect(html).toContain('Chain-of-Custody Ledger');
    expect(html).toContain('Selective Redact');
  });
});
