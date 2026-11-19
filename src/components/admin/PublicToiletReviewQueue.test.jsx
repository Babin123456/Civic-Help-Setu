import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import PublicToiletReviewQueue from './PublicToiletReviewQueue.jsx';
import { ToastProvider } from '../../context/ToastContext';

describe('PublicToiletReviewQueue (#758)', () => {
  it('renders public toilet moderation queue with initial items and receipt seals', () => {
    const html = renderToStaticMarkup(
      <ToastProvider>
        <PublicToiletReviewQueue />
      </ToastProvider>
    );

    expect(html).toContain('Public Toilet Moderation &amp; Maintenance Review Queue');
    expect(html).toContain('Koramangala 5th Block Community Sanitation Complex');
    expect(html).toContain('Flush valve leaking in cabin 2');
    expect(html).toContain('PT-SEAL-8B12-4F91');
    expect(html).toContain('Approve &amp; Dispatch');
    expect(html).toContain('Dismiss');
  });
});
