import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import QRCodeView from './QRCodeView';

const dataParam = (html) => {
  const src = html.match(/src="([^"]+)"/)[1].replace(/&amp;/g, '&');
  return new URL(src).searchParams.get('data');
};

describe('QRCodeView', () => {
  it('sends only origin and path to the QR service', () => {
    const html = renderToStaticMarkup(
      <QRCodeView url="https://civic.example/services/passport?ref=SRV-98234710&phone=9876543210#top" />
    );
    expect(dataParam(html)).toBe('https://civic.example/services/passport');
    expect(html).not.toContain('SRV-98234710');
    expect(html).not.toContain('9876543210');
  });

  it('asks the browser not to send a Referer header with the image request', () => {
    const html = renderToStaticMarkup(<QRCodeView url="https://civic.example/services/passport" />);
    expect(html).toContain('referrerPolicy="no-referrer"');
  });
});
