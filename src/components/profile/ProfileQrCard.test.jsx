import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ProfileQrCard from './ProfileQrCard';

describe('ProfileQrCard Component (#456)', () => {
  const mockUrl = 'https://civichelpsetu.gov.in/shared-profile/tok1234567890abcdef';

  it('renders QR code SVG, expiry pill, and action buttons for active share URL', () => {
    const html = renderToStaticMarkup(
      <ProfileQrCard
        shareUrl={mockUrl}
        citizenName="Anjali Sharma"
        expiryDate={Date.now() + 86400000}
      />
    );

    expect(html).toContain('In-Person Verification QR Pass');
    expect(html).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(html).toContain('Download Pass (HTML)');
    expect(html).toContain('Print / PDF');
    expect(html).toContain(mockUrl);
    expect(html).toContain('Payload encodes only the revocable URL');
  });

  it('renders deactivated message when share link is revoked', () => {
    const html = renderToStaticMarkup(
      <ProfileQrCard
        shareUrl={mockUrl}
        citizenName="Anjali Sharma"
        isRevoked={true}
      />
    );

    expect(html).toContain('QR Code Deactivated');
    expect(html).toContain('This profile share link has been revoked');
  });
});
