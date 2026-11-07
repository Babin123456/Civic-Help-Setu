import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import SavedEmptyState from './SavedEmptyState';

describe('SavedEmptyState', () => {
  const html = renderToStaticMarkup(
    <MemoryRouter>
      <SavedEmptyState />
    </MemoryRouter>
  );

  it('links to the services directory with descriptive text', () => {
    expect(html).toContain('href="/services"');
    expect(html).toContain('Browse the services directory');
  });

  it('has a labelled heading and descriptive highlights', () => {
    expect(html).toContain('aria-labelledby="saved-empty-title"');
    expect(html).toContain('<h2 id="saved-empty-title"');
    expect(html).toContain('Custom Collections');
    expect(html).toContain('Renewal Reminders');
    expect(html).toContain('Private Notes');
  });

  it('explains the save guide feature clearly', () => {
    expect(html).toContain('Save Guide');
    expect(html).toContain('schedule document renewal reminders');
  });
});

