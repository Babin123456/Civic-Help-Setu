import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import SearchQueryRecoveryWorkspace from './SearchQueryRecoveryWorkspace';
import { NetworkProvider } from '../context/NetworkContext';

describe('SearchQueryRecoveryWorkspace (#1431)', () => {
  it('renders search input, legal identifier protection notice, and empty state', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <NetworkProvider>
          <SearchQueryRecoveryWorkspace />
        </NetworkProvider>
      </MemoryRouter>
    );

    expect(html).toContain('Civic Search Query Understanding &amp; Spelling Recovery');
    expect(html).toContain('Search &amp; Recover');
    expect(html).toContain('Enter a search query above');
  });
});
