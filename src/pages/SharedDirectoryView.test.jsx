import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import SharedDirectoryView from './SharedDirectoryView';
import { LanguageProvider } from '../context/LanguageContext';
import * as service from '../services/shareableDirectoryService';

describe('SharedDirectoryView Component (#475)', () => {
  it('renders curated directory list with security banner and active filters', () => {
    vi.spyOn(service, 'resolveSharedDirectoryView').mockReturnValue({
      status: 'ACTIVE',
      view: {
        title: 'Agricultural Support Schemes',
        description: 'Schemes specifically relevant for rural farmers and artisans.',
        filters: {
          search: 'Farmer',
          category: 'Agriculture',
          department: 'all',
          location: 'all',
        },
        createdAt: Date.now() - 3600000,
        expiresAt: Date.now() + 86400000,
      },
      readOnly: true,
    });

    const html = renderToStaticMarkup(
      <LanguageProvider>
        <MemoryRouter>
          <SharedDirectoryView initialToken="token-valid-123" />
        </MemoryRouter>
      </LanguageProvider>
    );

    expect(html).toContain('Agricultural Support Schemes');
    expect(html).toContain('Curated Directory View');
    expect(html).toContain('Shared Catalogue List');
    expect(html).toContain('Category: Agriculture');
    expect(html).toContain('&quot;Farmer&quot;');
  });

  it('renders revoked notice when shared directory is deactivated', () => {
    vi.spyOn(service, 'resolveSharedDirectoryView').mockReturnValue({
      status: 'REVOKED',
      error: 'This shared directory list has been revoked',
    });

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <SharedDirectoryView initialToken="token-revoked" />
      </MemoryRouter>
    );

    expect(html).toContain('Shared Directory Link Revoked');
    expect(html).toContain('Browse Full Service Directory');
  });
});
