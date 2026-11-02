import { describe, expect, it, vi, afterEach } from 'vitest';
import { MOCK_SERVICES } from '../data/services';
import { buildServiceQrHandout, canShareServiceQr, downloadServiceQrHandout, qrMatrixPath, serviceQrUrl } from './serviceQrHandout';

const service = MOCK_SERVICES[0];
afterEach(() => vi.unstubAllGlobals());

describe('service QR handouts', () => {
  it('uses the stable public route without current query, fragment or origin credentials', () => {
    const url = serviceQrUrl(service, 'https://user:password@civic.example/current?phone=private#secret');
    expect(url).toBe(`https://civic.example/services/${encodeURIComponent(service.id)}`);
    const html = buildServiceQrHandout(service, 'https://civic.example');
    const matrix = qrMatrixPath(url);
    expect(html).toContain(`d="${matrix.path}"`);
    expect(matrix.path).toMatch(/^M\d+,\d+h1v1h-1z/);
    expect(html).not.toContain('<img');
    expect(html).not.toContain('qrserver');
  });

  it('rejects drafts, archived records, unknown and browser-local records', () => {
    expect(canShareServiceQr(service, { preview: true })).toBe(false);
    expect(canShareServiceQr({ ...service, archived: true })).toBe(false);
    expect(canShareServiceQr({ ...service, id: 'local-only-guide' })).toBe(false);
    expect(canShareServiceQr(null)).toBe(false);
    expect(buildServiceQrHandout({ ...service, archived: true }, 'https://civic.example')).toBeNull();
  });

  it('rejects non-web origins', () => {
    expect(() => serviceQrUrl(service, 'javascript:alert(1)')).toThrow('Invalid site origin');
  });

  it('escapes catalogue strings and excludes private fields from the document', () => {
    const html = buildServiceQrHandout({ ...service, name: '<script>alert(1)</script>', department: '<img src=x>', applicant: 'PRIVATE_APPLICANT', token: 'PRIVATE_TOKEN' }, 'https://civic.example');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;img src=x&gt;');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('PRIVATE_');
    expect(html).toContain('color:#000;background:#fff');
  });

  it('downloads an HTML handout and cleans up the temporary URL', () => {
    vi.useFakeTimers();
    const anchor = { click: vi.fn(), remove: vi.fn() };
    const createObjectURL = vi.fn(() => 'blob:handout');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', class extends URL { static createObjectURL = createObjectURL; static revokeObjectURL = revokeObjectURL; });
    vi.stubGlobal('document', { createElement: () => anchor, body: { appendChild: vi.fn() } });
    try {
      expect(downloadServiceQrHandout(service, 'https://civic.example')).toBe(true);
      expect(anchor.download).toBe('civic-service-handout.html');
      expect(anchor.click).toHaveBeenCalledOnce();
      expect(anchor.remove).toHaveBeenCalledOnce();
      expect(createObjectURL.mock.calls[0][0].type).toBe('text/html;charset=utf-8');
      vi.runAllTimers();
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:handout');
    } finally { vi.useRealTimers(); }
  });
});
