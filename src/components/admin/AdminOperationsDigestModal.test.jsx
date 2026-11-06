import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import AdminOperationsDigestModal from './AdminOperationsDigestModal';

describe('AdminOperationsDigestModal Component (#464)', () => {
  beforeEach(() => {
    const store = {};
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((k) => store[k] || null),
      setItem: vi.fn((k, v) => {
        store[k] = String(v);
      }),
      removeItem: vi.fn((k) => {
        delete store[k];
      }),
      clear: vi.fn(() => {
        Object.keys(store).forEach((k) => delete store[k]);
      })
    });
  });

  it('renders modal when open with operations preview cards and tabs', () => {
    const html = renderToStaticMarkup(
      <AdminOperationsDigestModal
        isOpen={true}
        onClose={() => {}}
      />
    );

    expect(html).toContain('Daily Civic Operations Digest');
    expect(html).toContain('Queue Preview');
    expect(html).toContain('Schedule &amp; Recipients');
    expect(html).toContain('Dispatch Logs');
    expect(html).toContain('Top Pending Service Volumes');
    expect(html).toContain('On-Demand Administrator Test Dispatch');
  });

  it('renders nothing when closed', () => {
    const html = renderToStaticMarkup(
      <AdminOperationsDigestModal
        isOpen={false}
        onClose={() => {}}
      />
    );

    expect(html).toBe('');
  });
});
