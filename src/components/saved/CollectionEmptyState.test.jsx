import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import CollectionEmptyState from './CollectionEmptyState';

describe('CollectionEmptyState', () => {
  it('renders collection title and contextual instruction', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <CollectionEmptyState collectionName="Driving Documents" onShowAll={() => {}} />
      </MemoryRouter>
    );

    expect(html).toContain('No guides in');
    expect(html).toContain('Driving Documents');
    expect(html).toContain('Notes &amp; Collection');
    expect(html).toContain('Show all saved guides');
    expect(html).toContain('Browse directory to save');
  });

  it('has proper aria labels and semantic heading', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <CollectionEmptyState collectionName="Health Schemes" onShowAll={() => {}} />
      </MemoryRouter>
    );

    expect(html).toContain('aria-labelledby="collection-empty-title"');
    expect(html).toContain('id="collection-empty-title"');
  });
});
