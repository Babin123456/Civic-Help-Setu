import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MOCK_SERVICES } from '../../data/services';
import ServiceQrHandout from './ServiceQrHandout';

afterEach(() => vi.unstubAllGlobals());
describe('ServiceQrHandout', () => {
  it('provides an accessible disclosure and downloadable handout for a public route', () => {
    vi.stubGlobal('window', { location: { origin: 'https://civic.example' } });
    const html = renderToStaticMarkup(<ServiceQrHandout service={MOCK_SERVICES[0]} />);
    expect(html).toContain('<summary');
    expect(html).toContain('Show QR code');
    expect(html).toContain('Download printable handout');
    expect(html).toContain('https://civic.example/services/');
  });
  it('provides no sharing action for draft previews or archived routes', () => {
    vi.stubGlobal('window', { location: { origin: 'https://civic.example' } });
    expect(renderToStaticMarkup(<ServiceQrHandout service={MOCK_SERVICES[0]} preview />)).toBe('');
    expect(renderToStaticMarkup(<ServiceQrHandout service={{ ...MOCK_SERVICES[0], archived: true }} />)).toBe('');
    expect(renderToStaticMarkup(<ServiceQrHandout service={{ ...MOCK_SERVICES[0], id: 'local' }} />)).toBe('');
  });
});
