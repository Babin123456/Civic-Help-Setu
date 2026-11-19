import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import CatalogueCardPreview from './CatalogueCardPreview.jsx';
import { LanguageProvider } from '../../context/LanguageContext';
import { runVisualQaScan } from '../../services/catalogueVisualQaService.js';

const renderPreview = ({ showBoxes = true, viewportId = 'mobile', contentLength = 'long' } = {}) => {
  const report = runVisualQaScan({ contentLength, viewportIds: [viewportId], pageSize: 1 });
  const viewport = report.viewports[0];
  const card = viewport.cards[0];
  const html = renderToStaticMarkup(
    <MemoryRouter>
      <LanguageProvider>
        <CatalogueCardPreview card={card} viewport={viewport} showBoxes={showBoxes} />
      </LanguageProvider>
    </MemoryRouter>
  );
  return { html, card };
};

describe('CatalogueCardPreview (#841)', () => {
  it('uses the production card in preview mode without a navigation link', () => {
    const { html, card } = renderPreview();
    expect(html).toContain('role="group"');
    expect(html).toContain('Synthetic card fixture');
    expect(html).toContain(card.fixtureId);
    expect(html).not.toContain('href="/services/');
    expect(html).toContain('Record status:');
  });

  it('repeats every decorative marker as text with remediation', () => {
    const { html, card } = renderPreview();
    expect(card.issues.length).toBeGreaterThan(0);
    expect(html).toContain('qa-overlay');
    for (const issue of card.issues.slice(0, 4)) {
      expect(html).toContain(issue.code);
      expect(html).toContain(issue.message);
      expect(html).toContain(issue.remediation);
    }
    expect(html).toContain('Measured:');
    expect(html).toContain('confidence');
  });

  it('omits the decorative overlay when bounding boxes are turned off', () => {
    const { html } = renderPreview({ showBoxes: false });
    expect(html).not.toContain('qa-overlay');
    expect(html).toContain('Detected layout findings');
  });

  it('renders the named viewport and synthetic content labels at each lane', () => {
    const desktop = renderPreview({ viewportId: 'desktop', contentLength: 'short' });
    expect(desktop.html).toContain('Desktop');
    expect(desktop.html).toContain('1024px');
    expect(desktop.html).toContain('short');
    expect(desktop.html).toContain('en');
  });
});
