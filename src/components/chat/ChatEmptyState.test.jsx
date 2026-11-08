import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ChatEmptyState, { CATEGORIZED_STARTER_PROMPTS } from './ChatEmptyState';

describe('ChatEmptyState Component (#584)', () => {
  it('renders guidance title, scope notice, and categorized prompt groups', () => {
    const html = renderToStaticMarkup(<ChatEmptyState onSelectPrompt={vi.fn()} />);

    expect(html).toContain('How can Civic Help Setu assist you today?');
    expect(html).toContain('Civic Consultation Notice:');
    expect(html).toContain('Popular Civic Consultation Scenarios');
    expect(html).toContain('Identity &amp; Vital Records');
    expect(html).toContain('Licences &amp; Transport');
    expect(html).toContain('Welfare &amp; Grievances');

    CATEGORIZED_STARTER_PROMPTS.forEach((group) => {
      group.prompts.forEach((p) => {
        expect(html).toContain(p.label);
      });
    });
  });

  it('renders interactive button cards with disabled attribute when disabled is true', () => {
    const html = renderToStaticMarkup(<ChatEmptyState onSelectPrompt={vi.fn()} disabled={true} />);
    expect(html).toContain('disabled');
  });
});
