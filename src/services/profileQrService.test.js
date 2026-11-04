import { describe, it, expect } from 'vitest';
import {
  buildQrMatrix,
  isSafeShareableQrPayload,
  buildProfileQrHandout,
} from './profileQrService';

describe('profileQrService (#456)', () => {
  const validUrl = 'https://civichelpsetu.gov.in/shared-profile/abc123456789012345678901';

  it('builds SVG path and matrix dimensions for valid payload', () => {
    const { path, size } = buildQrMatrix(validUrl);
    expect(path).toBeDefined();
    expect(path.startsWith('M')).toBe(true);
    expect(size).toBeGreaterThan(20);
  });

  it('throws error when encoding empty or non-string payload', () => {
    expect(() => buildQrMatrix('')).toThrow();
    expect(() => buildQrMatrix(null)).toThrow();
  });

  it('validates safe share URLs and blocks payloads with raw personal data', () => {
    expect(isSafeShareableQrPayload(validUrl)).toBe(true);
    expect(isSafeShareableQrPayload('http://localhost:5173/shared-profile/token')).toBe(true);

    // Should reject non-HTTP schemes and raw sensitive data
    expect(isSafeShareableQrPayload('javascript:alert(1)')).toBe(false);
    expect(isSafeShareableQrPayload('{"aadhaar":"1234-5678"}')).toBe(false);
    expect(isSafeShareableQrPayload('https://example.com/?pan=ABCDE1234F')).toBe(false);
    expect(isSafeShareableQrPayload('')).toBe(false);
  });

  it('generates self-contained printable HTML handout with privacy notices', () => {
    const html = buildProfileQrHandout({
      url: validUrl,
      citizenName: 'Meera Bai',
      expiryText: 'Valid until 10 Nov 2026',
    });

    expect(html).toContain('Meera Bai — Verified Citizen Profile Pass');
    expect(html).toContain('Verified Read-Only Share Pass');
    expect(html).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(html).toContain('Privacy & Security Protection');
    expect(html).toContain('Valid until 10 Nov 2026');
  });

  it('rejects building handout for invalid URLs', () => {
    expect(() =>
      buildProfileQrHandout({
        url: 'invalid-url',
        citizenName: 'Test',
      })
    ).toThrow();
  });
});
