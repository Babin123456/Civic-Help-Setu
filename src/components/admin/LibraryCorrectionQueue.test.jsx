import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import LibraryCorrectionQueue from './LibraryCorrectionQueue';
import { ToastProvider } from '../../context/ToastContext';

describe('LibraryCorrectionQueue Component (#727)', () => {
  it('renders queue items with verification seals, role badges, and actions', () => {
    const html = renderToStaticMarkup(
      <ToastProvider>
        <LibraryCorrectionQueue />
      </ToastProvider>
    );

    expect(html).toContain('Public Library &amp; Learning Resource Corrections Queue');
    expect(html).toContain('LIB-CORR-A421-99B0');
    expect(html).toContain('Delhi Public Library - Central Library');
    expect(html).toContain('Role: librarian');
    expect(html).toContain('Verify Official Source');
    expect(html).toContain('Approve &amp; Verify');
    expect(html).toContain('Reject');
  });
});

