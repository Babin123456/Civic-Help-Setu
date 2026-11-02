import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import Acronyms from './Acronyms';

describe('Acronyms Page Component (#263, #430)', () => {
  it('renders the directory heading and descriptive copy', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/acronyms']}>
        <Acronyms />
      </MemoryRouter>
    );

    expect(html).toContain('Civic Acronym Directory');
    expect(html).toContain('Verified definitions, categories, and service mappings');
  });

  it('renders all categories with filter buttons and counts', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/acronyms']}>
        <Acronyms />
      </MemoryRouter>
    );

    expect(html).toContain('All Categories');
    expect(html).toContain('Identity &amp; KYC');
    expect(html).toContain('Social Welfare &amp; Benefits');
    expect(html).toContain('Finance &amp; Employment');
    expect(html).toContain('Governance &amp; Transport');
  });

  it('renders alphabetical index buttons for quick lookup', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/acronyms']}>
        <Acronyms />
      </MemoryRouter>
    );

    expect(html).toContain('Alphabetical Index');
    expect(html).toContain('>All</button>');
    expect(html).toContain('>B</button>');
    expect(html).toContain('>E</button>');
  });

  it('renders acronym list cards with tags and definitions', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/acronyms']}>
        <Acronyms />
      </MemoryRouter>
    );

    expect(html).toContain('BPL');
    expect(html).toContain('Below Poverty Line');
    expect(html).toContain('UIDAI');
    expect(html).toContain('Unique Identification Authority of India');
    expect(html).toContain('Copy');
  });

  it('links to related citizen service guides', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/acronyms']}>
        <Acronyms />
      </MemoryRouter>
    );

    expect(html).toContain('Related Citizen Services');
    expect(html).toContain('href="/services/ration-card"');
    expect(html).toContain('href="/services/aadhaar-card"');
  });

  it('pre-filters results when query parameter is provided', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/acronyms?q=poverty']}>
        <Acronyms />
      </MemoryRouter>
    );

    expect(html).toContain('BPL');
    expect(html).toContain('Active filters applied');
    expect(html).toContain('Reset filters');
    expect(html).not.toContain('UIDAI');
  });

  it('displays empty state alert when query has no matching acronyms', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/acronyms?q=nonexistent_acronym_12345']}>
        <Acronyms />
      </MemoryRouter>
    );

    expect(html).toContain('No acronym entries found');
    expect(html).toContain('Civic Help Setu does not expand unknown acronyms by guessing');
    expect(html).toContain('Clear filters and view all');
  });
});
