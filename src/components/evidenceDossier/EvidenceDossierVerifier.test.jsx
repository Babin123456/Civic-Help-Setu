import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import EvidenceDossierVerifier from './EvidenceDossierVerifier.jsx';

describe('EvidenceDossierVerifier', () => {
  it('renders verification controls when no manifest is initially loaded', () => {
    const html = renderToStaticMarkup(<EvidenceDossierVerifier />);

    expect(html).toContain('Verify Evidence Files Against Manifest');
    expect(html).toContain('Step A: Load Manifest JSON or Pick Saved Dossier');
    expect(html).toContain('Upload Exported .json Manifest');
  });

  it('renders preloaded manifest details when initialManifest is provided', () => {
    const initial = {
      title: 'Electricity Overbilling Dossier',
      caseReference: 'ELEC-2026-44',
      createdAt: '2026-11-18T10:00:00.000Z',
      algorithm: 'SHA-256',
      entries: [
        {
          name: 'bill.pdf',
          size: 2048,
          sha256: 'a'.repeat(64),
        },
      ],
    };

    const html = renderToStaticMarkup(<EvidenceDossierVerifier initialManifest={initial} />);

    expect(html).toContain('Loaded Manifest: Electricity Overbilling Dossier');
    expect(html).toContain('ELEC-2026-44');
    expect(html).toContain('Step B: Select Candidate Files to Verify');
  });
});
