import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import AbuseDashboard from './AbuseDashboard';

vi.mock('../../services/abuseControlPlaneService.js', () => ({
  getSchemaVersion: vi.fn(async () => 1),
  listSignals: vi.fn(async ({ bucket }) => ({ bucket, signals: [] })),
  listAppeals: vi.fn(async () => ({ appeals: [], nextCursor: null })),
  updateAppeal: vi.fn(async () => ({})),
  blocklist: vi.fn(async () => ({ ok: true })),
  allowlist: vi.fn(async () => ({ ok: true })),
  AbuseControlPlaneError: class extends Error {
    constructor(m) { super(m); this.name = 'AbuseControlPlaneError'; }
  },
}));

describe('AbuseDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a labelled region with a heading', () => {
    const html = renderToStaticMarkup(<AbuseDashboard />);
    expect(html).toContain('aria-label="Abuse Control Plane operator dashboard"');
    expect(html).toContain('<h1>Abuse Control Plane</h1>');
  });

  it('renders signals and appeals tabs', () => {
    const html = renderToStaticMarkup(<AbuseDashboard />);
    expect(html).toContain('Signals');
    expect(html).toContain('Appeals');
  });

  it('does not display raw caller addresses, only truncated hashes', () => {
    const html = renderToStaticMarkup(<AbuseDashboard />);
    // No IP-looking strings should appear verbatim.
    expect(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/.test(html)).toBe(false);
  });

  it('renders without crashing and shows the dashboard shell', () => {
    const html = renderToStaticMarkup(<AbuseDashboard />);
    expect(html).toContain('<h1>Abuse Control Plane</h1>');
    expect(html).toContain('Signals');
    expect(html).toContain('Appeals');
  });

  it('does not display raw caller addresses, only truncated hashes', () => {
    const html = renderToStaticMarkup(<AbuseDashboard />);
    // No IP-looking strings should appear verbatim.
    expect(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/.test(html)).toBe(false);
  });
});
