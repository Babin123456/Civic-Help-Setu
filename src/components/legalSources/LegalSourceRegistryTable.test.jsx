import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import LegalSourceRegistryTable from './LegalSourceRegistryTable.jsx';
import { INITIAL_LEGAL_SOURCES } from '../../services/legalSourceStorage.js';

describe('LegalSourceRegistryTable Component (#949)', () => {
  it('renders table headers, search input, and filter controls', () => {
    const html = renderToStaticMarkup(
      <LegalSourceRegistryTable sources={INITIAL_LEGAL_SOURCES} canReview={false} canManage={false} />
    );

    expect(html).toContain('Citation &amp; Provision');
    expect(html).toContain('Act Name');
    expect(html).toContain('Jurisdiction');
    expect(html).toContain('Version');
    expect(html).toContain('Review Status');
    expect(html).toContain('Templates');
    expect(html).toContain('Search by Act, Section, Citation');
    expect(html).toContain('All Statuses');
    expect(html).toContain('All Templates');
  });

  it('renders registered statutory provisions with status and version badges', () => {
    const html = renderToStaticMarkup(
      <LegalSourceRegistryTable sources={INITIAL_LEGAL_SOURCES} canReview={true} canManage={true} />
    );

    // Provisions from seed
    expect(html).toContain('Section 18(1)');
    expect(html).toContain('Real Estate (Regulation and Development) Act, 2016');
    expect(html).toContain('v1.0.0');
    expect(html).toContain('REVIEWED');

    // Admin action buttons
    expect(html).toContain('Inspect');
    expect(html).toContain('Review');
    expect(html).toContain('Supersede');
    expect(html).toContain('Add Draft Source');
  });

  it('renders stale badge for sources reviewed over 365 days ago', () => {
    const html = renderToStaticMarkup(
      <LegalSourceRegistryTable sources={INITIAL_LEGAL_SOURCES} canReview={false} canManage={false} />
    );

    expect(html).toContain('Stale (&gt;365d)');
    expect(html).toContain('Section 9, Delhi Preservation of Trees Act, 1994');
  });

  it('renders superseded badge for repealed legacy rules', () => {
    const html = renderToStaticMarkup(
      <LegalSourceRegistryTable sources={INITIAL_LEGAL_SOURCES} canReview={false} canManage={false} />
    );

    expect(html).toContain('SUPERSEDED');
    expect(html).toContain('Municipal Solid Wastes (Management and Handling) Rules, 2000');
  });
});
