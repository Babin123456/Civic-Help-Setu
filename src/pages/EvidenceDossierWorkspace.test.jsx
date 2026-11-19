import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import EvidenceDossierWorkspace from './EvidenceDossierWorkspace.jsx';

describe('EvidenceDossierWorkspace', () => {
  it('renders workspace title, tab navigation, and default builder panel', () => {
    const html = renderToStaticMarkup(<EvidenceDossierWorkspace />);

    expect(html).toContain('Evidence Dossier Integrity &amp; Manifest Workspace');
    expect(html).toContain('Create Manifest');
    expect(html).toContain('Verify Files');
    expect(html).toContain('Saved Vault Dossiers');
    expect(html).toContain('Create Evidence Dossier Manifest');
  });
});
