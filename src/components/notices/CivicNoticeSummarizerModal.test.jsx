import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import CivicNoticeSummarizerModal from './CivicNoticeSummarizerModal';

describe('CivicNoticeSummarizerModal component', () => {
  it('exports a valid React functional component', () => {
    expect(typeof CivicNoticeSummarizerModal).toBe('function');
  });

  it('renders nothing when isOpen is false', () => {
    const html = renderToStaticMarkup(<CivicNoticeSummarizerModal isOpen={false} onClose={() => {}} />);
    expect(html).toBe('');
  });

  it('renders modal dialog with input form when open', () => {
    const html = renderToStaticMarkup(
      <CivicNoticeSummarizerModal
        isOpen={true}
        onClose={() => {}}
        initialNotice={{
          title: 'Special Pension Revision Circular',
          description: 'Pensioners must verify life certificates before 31/12/2026.'
        }}
      />
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain('Civic Notice Summarizer &amp; Deadline Extractor');
    expect(html).toContain('Special Pension Revision Circular');
    expect(html).toContain('Summarize &amp; Extract Deadlines');
  });
});
