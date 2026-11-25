import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import PublicToiletReviewQueue from './PublicToiletReviewQueue.jsx';
import { ToastProvider } from '../../context/ToastContext';

vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: null, getSessionToken: async () => null }) }));

describe('PublicToiletReviewQueue (#758)', () => {
  it('renders a loading state without fabricated reports before authentication', () => {
    const html = renderToStaticMarkup(
      <ToastProvider>
        <PublicToiletReviewQueue />
      </ToastProvider>
    );

    expect(html).toContain('Public Toilet Moderation &amp; Maintenance Review Queue');
    expect(html).toContain('Loading reports');
    expect(html).toContain('0 Reports Loaded');
    expect(html).not.toContain('PT-SEAL-8B12-4F91');
    expect(html).not.toContain('Approve &amp; Dispatch');
  });
});
