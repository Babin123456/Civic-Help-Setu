import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import LibraryDirectory from './LibraryDirectory';
import LibraryCard from '../components/library/LibraryCard';
import LibraryEmptyState from '../components/library/LibraryEmptyState';
import LibraryErrorState from '../components/library/LibraryErrorState';
import { ToastProvider } from '../context/ToastContext';
import { VERIFIED_LIBRARY_FACILITIES } from '../data/libraryFacilities';

describe('LibraryDirectory Page (#727)', () => {
  it('renders verified directory header, disclaimer, and library cards', () => {
    const html = renderToStaticMarkup(
      <ToastProvider>
        <LibraryDirectory />
      </ToastProvider>
    );

    expect(html).toContain('Public Library Membership &amp; Digital Learning Directory');
    expect(html).toContain('Notice for Citizens &amp; Students:');
    expect(html).toContain('Verified Libraries &amp; Resource Centres');
    expect(html).toContain('Delhi Public Library - Central Library');
    expect(html).toContain('Anna Centenary Library - Kotturpuram');
  });

  it('renders stale-data warning badge when a library audit is overdue (>365 days)', () => {
    const staleLibrary = {
      ...VERIFIED_LIBRARY_FACILITIES[0],
      auditMetadata: {
        ...VERIFIED_LIBRARY_FACILITIES[0].auditMetadata,
        lastVerified: '2023-01-01', // definitely overdue
      },
    };

    const html = renderToStaticMarkup(
      <ToastProvider>
        <LibraryCard
          library={staleLibrary}
          onOpenDetails={() => {}}
          onOpenChecklist={() => {}}
          onOpenCorrection={() => {}}
        />
      </ToastProvider>
    );

    expect(html).toContain('Audit Overdue (Stale Record)');
  });

  it('renders empty state with reset button when no libraries match', () => {
    const html = renderToStaticMarkup(
      <LibraryEmptyState onReset={() => {}} />
    );

    expect(html).toContain('No Verified Libraries Found');
    expect(html).toContain('Reset All Filters');
  });

  it('renders accessible error alert with retry button upon loading failure', () => {
    const html = renderToStaticMarkup(
      <LibraryErrorState error={new Error('Failed to fetch institutional registry')} onRetry={() => {}} />
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain('Unable to Load Verified Library Directory');
    expect(html).toContain('Failed to fetch institutional registry');
    expect(html).toContain('Retry');
  });

  it('renders digital learning resource badges and OPAC links on library cards', () => {
    const cardHtml = renderToStaticMarkup(
      <ToastProvider>
        <LibraryCard
          library={VERIFIED_LIBRARY_FACILITIES[0]}
          onOpenDetails={() => {}}
          onOpenChecklist={() => {}}
          onOpenCorrection={() => {}}
        />
      </ToastProvider>
    );

    expect(cardHtml).toContain('Digital Repositories');
    expect(cardHtml).toContain('Online OPAC Catalogue');
    expect(cardHtml).toContain('View Rules &amp; Resources');
    expect(cardHtml).toContain('Checklist');
  });
});

