import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import EvidenceDossierDisclaimer from './EvidenceDossierDisclaimer.jsx';

describe('EvidenceDossierDisclaimer', () => {
  it('renders the cryptographic and privacy notice with key explanations', () => {
    const html = renderToStaticMarkup(<EvidenceDossierDisclaimer />);

    expect(html).toContain('Local Cryptographic Integrity &amp; Privacy Notice');
    expect(html).toContain('Zero-Upload Client Processing');
    expect(html).toContain('Integrity vs. Authenticity');
    expect(html).toContain('A SHA-256 hash confirms byte-level immutability');
    expect(html).toContain('Limits &amp; Preservation');
  });
});
