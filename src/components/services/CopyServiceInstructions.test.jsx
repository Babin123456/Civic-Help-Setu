import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import CopyServiceInstructions from './CopyServiceInstructions';

describe('copy instructions action', () => {
  it('provides a native keyboard-accessible button and a live feedback region', () => {
    const html = renderToStaticMarkup(<CopyServiceInstructions service={{ name: 'Permit' }} />);
    expect(html).toMatch(/<button[^>]*type="button"[^>]*>Copy instructions<\/button>/);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).not.toContain('disabled');
  });
});
