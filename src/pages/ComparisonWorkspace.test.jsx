import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import ComparisonWorkspace from './ComparisonWorkspace';
import { ToastProvider } from '../context/ToastContext';

const render = (url) =>
  renderToStaticMarkup(
    <MemoryRouter initialEntries={[url]}>
      <ToastProvider>
        <ComparisonWorkspace />
      </ToastProvider>
    </MemoryRouter>
  );

describe('ComparisonWorkspace (#824)', () => {
  it('starts with an explanatory, accessible service-first flow', () => {
    const html = render('/comparison');

    expect(html).toContain('Local Civic Office Comparison Workspace');
    expect(html).toContain('Choose a service and locality');
    expect(html).toContain('Start with a service');
    expect(html).toContain('Select a service above.');
    expect(html).toContain('Your filters and selected offices are saved only in this browser session.');
    expect(html).toContain('This workspace is not a government application status');
    expect(html).toContain('for="comparison-service"');
    expect(html).toContain('All states in the registry');
    expect(html).not.toContain('Selected comparison');
  });

  it('ranks offices for the requested service and preselects the top two', () => {
    const html = render('/comparison?service=driving-license');

    expect(html).toContain('Local Civic Office Comparison Workspace');
    expect(html).toContain('15 offices for Driving License');
    expect(html).toContain('Ranked by recorded service capability');
    expect(html).toContain('Suggestion, not an official decision');
    expect(html).toContain('Selected comparison');
    expect(html).toContain('2 of 3 selected');
    expect(html).toContain('Regional Transport Office (RTO) - Sarai Kale Khan');
    expect(html).toContain('href="/office/delhi-rto-sarai-kale-khan?service=driving-license"');
    expect(html).toContain('&amp;report=1');
    expect(html).toContain('Page 1 of 3');
    expect(html).toContain('data version office-registry-');
  });

  it('shows a non-blocking stale-record warning with the data version', () => {
    const html = render('/comparison?service=driving-license');
    expect(html).toContain('Some records need re-verification');
    expect(html).toContain('older than');
    expect(html).toContain('180 days');
    expect(html).toContain('Confirm with the office before travelling.');
    expect(html).toContain('Office registry data version');
  });

  it('renders an empty state and a reset action when no office matches', () => {
    const html = render('/comparison?service=driving-license&locality=not-a-real-locality-xyz');
    expect(html).toContain('No offices match these filters');
    expect(html).toContain('Reset filters');
    expect(html).not.toContain('Selected comparison');
  });

  it('rejects a service outside the built-in catalogue without crashing', () => {
    const html = render('/comparison?service=flying-licence');
    expect(html).toContain('This service is not in the built-in catalogue');
    expect(html).toContain('Choose a built-in service from the list');
    expect(html).not.toContain('15 offices');
  });

  it('supports a table-only view driven by the URL', () => {
    const html = render('/comparison?service=driving-license&view=table');
    expect(html).toContain('Side-by-side comparison for Driving License');
    expect(html).not.toContain('Selected comparison');
    expect(html).toContain('scope="row"');
  });

  it('explains deterministic ranking, suggestions and the missing-pin rule', () => {
    const html = render('/comparison?service=driving-license');
    expect(html).toContain('explicit service capability (50%)');
    expect(html).toContain('jurisdiction coverage (30%)');
    expect(html).toContain('verification freshness (20%)');
    expect(html).toContain('No AI model chooses the order');
    expect(html).toContain('not an official decision');
    expect(html).toContain('Conflicting evidence or missing jurisdiction is marked');
  });

  it('renders no map pins and a full text alternative when coordinates are unverified', () => {
    const html = render('/comparison?service=driving-license&view=map');
    expect(html).toContain('Map with verified coordinates only');
    expect(html).toContain('No verified coordinates in these results');
    expect(html).toContain('Pins are shown only when an office record has an explicit, sourced coordinate verification');
    expect(html).toContain('Text alternative for all results');
    expect(html).toContain('Last verified:');
    expect(html).not.toContain('Civic Centers Geographic Map');
  });

  it('keeps the responsive, focus and reduced-motion CSS contract', () => {
    const css = readFileSync(fileURLToPath(new URL('./ComparisonWorkspace.css', import.meta.url)), 'utf8');
    expect(css).toContain('@media (max-width: 640px)');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('grid-template-columns: repeat(auto-fit, minmax(min(100%, 330px), 1fr))');
    expect(css).toContain('overflow-x: auto');
    expect(css).toContain('outline: 2px solid var(--accent-main)');
    expect(css).toContain('scroll-behavior: auto !important');
    expect(css).toContain('min-width: 720px');
  });
});
