import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import LineageExplorerWorkspace from './LineageExplorerWorkspace.jsx';
import { LanguageProvider } from '../context/LanguageContext';
import { NetworkProvider } from '../context/NetworkContext';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { role: 'admin', username: 'SuperAdmin' } }),
}));

vi.mock('../context/ToastContext', () => ({
  useToast: () => ({ toast: { success: vi.fn(), error: vi.fn() } }),
}));

const render = (path = '/provenance') =>
  renderToStaticMarkup(
    <LanguageProvider>
      <NetworkProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/provenance" element={<LineageExplorerWorkspace />} />
            <Route path="/provenance/:id" element={<LineageExplorerWorkspace />} />
          </Routes>
        </MemoryRouter>
      </NetworkProvider>
    </LanguageProvider>
  );

describe('LineageExplorerWorkspace (#777)', () => {
  it('renders the lineage explorer header and descriptions', () => {
    const html = render('/provenance');
    expect(html).toContain('Data Lineage &amp; Provenance Explorer');
    expect(html).toContain('Trace public civic facts, legal requirements, and fees');
    expect(html).toContain('Authoritative Statutory Lineage Explanation');
  });

  it('renders graph view controls and accessible table alternative toggle', () => {
    const html = render('/provenance');
    expect(html).toContain('Graph View');
    expect(html).toContain('Accessible Table');
    expect(html).toContain('Release Signatures &amp; Ledger');
    expect(html).toContain('Fact Dimension');
    expect(html).toContain('Supersessions');
  });

  it('renders export options for JSON, CSV, and Graphviz DOT', () => {
    const html = render('/provenance');
    expect(html).toContain('JSON');
    expect(html).toContain('CSV');
    expect(html).toContain('DOT');
  });

  it('renders the explainable AI summary ruleset version stamp', () => {
    const html = render('/provenance?service=tree-pruning-permission');
    expect(html).toContain('lineage_explainer_ruleset@');
    expect(html).toContain('Strict Invariant: Non-hallucinated DAG edges only');
  });
});

