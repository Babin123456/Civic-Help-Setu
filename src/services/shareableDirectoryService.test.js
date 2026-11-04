import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createShareableDirectoryView,
  resolveSharedDirectoryView,
  revokeSharedDirectoryView,
  applyDirectoryFilters,
  DIRECTORY_EXPIRY_OPTIONS,
} from './shareableDirectoryService';

describe('shareableDirectoryService (#475)', () => {
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
      }),
    });
  });

  const mockServices = [
    { id: '1', title: 'Solar Rooftop Subsidy', category: 'Energy', department: 'MNRE', state: 'National' },
    { id: '2', title: 'Farmer Crop Insurance', category: 'Agriculture', department: 'Ministry of Agriculture', state: 'Punjab' },
    { id: '3', title: 'Old Age Pension', category: 'Social Welfare', department: 'Social Welfare Dept', state: 'Delhi' },
  ];

  it('creates a shareable directory view token and stores filter state', () => {
    const filters = { search: 'Solar', category: 'Energy', department: 'all' };
    const record = createShareableDirectoryView(filters, {
      title: 'Solar Energy Programs',
      expiry: DIRECTORY_EXPIRY_OPTIONS.DAYS_7,
    });

    expect(record.token).toBeDefined();
    expect(record.token.length).toBeGreaterThanOrEqual(16);
    expect(record.filters.search).toBe('Solar');
    expect(record.filters.category).toBe('Energy');
  });

  it('resolves an active shared directory view by token', () => {
    const record = createShareableDirectoryView({ category: 'Agriculture' });
    const resolved = resolveSharedDirectoryView(record.token);

    expect(resolved.status).toBe('ACTIVE');
    expect(resolved.readOnly).toBe(true);
    expect(resolved.view.filters.category).toBe('Agriculture');
  });

  it('filters services according to shared directory criteria', () => {
    const filtered = applyDirectoryFilters(mockServices, { category: 'Agriculture' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].title).toBe('Farmer Crop Insurance');
  });

  it('returns revoked notice when shared view is revoked', () => {
    const record = createShareableDirectoryView({ search: 'Insurance' });
    const revoked = revokeSharedDirectoryView(record.token);
    expect(revoked).toBe(true);

    const check = resolveSharedDirectoryView(record.token);
    expect(check.status).toBe('REVOKED');
    expect(check.error).toContain('revoked');
  });

  it('rejects expired directory views', () => {
    const record = createShareableDirectoryView({ search: 'Pension' });
    record.expiresAt = Date.now() - 5000;
    const all = JSON.parse(localStorage.getItem('civicbridge_shareable_directory_views'));
    all[record.token] = record;
    localStorage.setItem('civicbridge_shareable_directory_views', JSON.stringify(all));

    const check = resolveSharedDirectoryView(record.token);
    expect(check.status).toBe('EXPIRED');
    expect(check.error).toContain('expired');
  });
});
