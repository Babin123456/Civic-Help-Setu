import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import TransitConcessionsDirectory from './TransitConcessionsDirectory';

describe('TransitConcessionsDirectory', () => {
  it('renders accessible cascading selectors, separate modes, provenance, and local checklist controls', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    });
    const markup = renderToStaticMarkup(
      <MemoryRouter><TransitConcessionsDirectory /></MemoryRouter>
    );

    expect(markup).toContain('aria-label="State or Union Territory"');
    expect(markup).toContain('aria-label="City"');
    expect(markup).toContain('aria-label="Transport operator"');
    expect(markup).toContain('aria-label="Transport type"');
    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain('UNVERIFIED · RULES UNAVAILABLE');
    expect(markup).toContain('Eligibility, fees, validity, routes, application, renewal, and lost-pass procedures are unavailable');
    expect(markup).toContain('Rule source date');
    expect(markup).toContain('Pass renewal date (optional)');
    expect(markup).toContain('Delete this saved checklist');
    expect(markup).toContain('Leave this field empty');
    expect(markup).toContain('role="status"');
  });
});
