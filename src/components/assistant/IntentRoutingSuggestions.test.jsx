import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import IntentRoutingSuggestions from './IntentRoutingSuggestions';

describe('IntentRoutingSuggestions component', () => {
  it('exports a valid React functional component', () => {
    expect(typeof IntentRoutingSuggestions).toBe('function');
  });

  it('renders null when query is empty', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <IntentRoutingSuggestions query="" />
      </MemoryRouter>
    );
    expect(html).toBe('');
  });

  it('renders confident destination button when query matches intent', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <IntentRoutingSuggestions query="where can i apply for a new driving license online" />
      </MemoryRouter>
    );

    expect(html).toContain('Suggested Civic Destination');
    expect(html).toContain('Find a Service / Apply');
    expect(html).toContain('Browse Service Catalogue');
    expect(html).toContain('href="/services"');
  });

  it('renders clarifying options when query confidence is low', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <IntentRoutingSuggestions query="hi" />
      </MemoryRouter>
    );

    expect(html).toContain('We could not determine your exact civic request');
    expect(html).toContain('Find a Service / Apply');
    expect(html).toContain('Check Eligibility Criteria');
  });
});
