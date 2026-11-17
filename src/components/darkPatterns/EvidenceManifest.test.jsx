import { it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import EvidenceManifest from './EvidenceManifest.jsx';
it('renders local evidence creation and verification guidance', () => {
  const html = renderToStaticMarkup(<EvidenceManifest />);
  expect(html).toContain('Evidence dossier integrity');
  expect(html).toContain('Create manifest');
  expect(html).toContain('Load JSON manifest');
  expect(html).toContain('not uploaded or stored');
  expect(html).toContain('role="status"');
});
