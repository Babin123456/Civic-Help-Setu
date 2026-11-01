import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import CatalogueEnrichmentReviewPanel from './CatalogueEnrichmentReviewPanel.jsx';
import { ToastProvider } from '../../context/ToastContext.jsx';

const renderPanel = () => {
  return renderToStaticMarkup(
    <ToastProvider>
      <CatalogueEnrichmentReviewPanel />
    </ToastProvider>
  );
};

describe('CatalogueEnrichmentReviewPanel (#407)', () => {
  it('renders panel header, safeguard notice, and review statistics', () => {
    const html = renderPanel();
    expect(html).toContain('AI Catalogue Enrichment Review Queue');
    expect(html).toContain('AI Safeguard &amp; Integrity Policy:');
    expect(html).toContain('PENDING REVIEW');
    expect(html).toContain('APPROVED / MERGED');
    expect(html).toContain('REJECTED / ARCHIVED');
  });

  it('renders pending proposals with field-level before/after diffs', () => {
    const html = renderPanel();
    expect(html).toContain('Voter ID Card Registration');
    expect(html).toContain('CURRENT PUBLISHED VERSION');
    expect(html).toContain('AI PROPOSED ENRICHMENT');
    expect(html).toContain('Approve Field');
    expect(html).toContain('Edit Field');
    expect(html).toContain('Reject Field');
    expect(html).toContain('Finalize Review &amp; Apply');
    expect(html).toContain('Reject Entire Proposal');
  });
});
