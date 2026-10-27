import { describe, it, expect } from 'vitest';
import {
  minimizeForExternal,
  redactPersonalData,
  redactSecrets,
  stripUrlForSharing,
} from './dataMinimization';
import { sanitizeForPrivacy } from '../ai/contextRecommender';

describe('redactPersonalData', () => {
  it('removes Aadhaar numbers with and without spaces', () => {
    expect(redactPersonalData('my aadhaar is 1234 5678 9012')).toBe('my aadhaar is [REDACTED_AADHAAR]');
    expect(redactPersonalData('123456789012')).toBe('[REDACTED_AADHAAR]');
    expect(redactPersonalData('1234-5678-9012')).toBe('[REDACTED_AADHAAR]');
  });

  it('removes PAN, voter id and passport numbers', () => {
    expect(redactPersonalData('PAN ABCDE1234F')).toBe('PAN [REDACTED_PAN]');
    expect(redactPersonalData('abcde1234f')).toBe('[REDACTED_PAN]');
    expect(redactPersonalData('EPIC XYZ1234567')).toBe('EPIC [REDACTED_ID]');
    expect(redactPersonalData('passport K1234567')).toBe('passport [REDACTED_ID]');
  });

  it('removes Indian mobile numbers in common spellings', () => {
    ['9876543210', '+91 9876543210', '+919876543210', '098765 43210', '98765-43210'].forEach((phone) => {
      expect(redactPersonalData(`call ${phone} now`)).toBe('call [REDACTED_PHONE] now');
    });
  });

  it('removes emails', () => {
    expect(redactPersonalData('mail asha.k+gov@example.co.in please')).toBe('mail [REDACTED_EMAIL] please');
  });

  it('removes app reference ids (service request, grievance, appointment token)', () => {
    expect(redactPersonalData('status of SRV-98234710?')).toBe('status of [REDACTED_REF]?');
    expect(redactPersonalData('GRV-2026-123456 is open')).toBe('[REDACTED_REF] is open');
    expect(redactPersonalData('token TKN-123456')).toBe('token [REDACTED_REF]');
  });

  it('removes precise coordinates but leaves ordinary numbers', () => {
    expect(redactPersonalData('I am at 28.613939, 77.209021 near the park')).toBe(
      'I am at [REDACTED_LOCATION] near the park'
    );
    expect(redactPersonalData('The fee is Rs 1500 and takes 15 working days')).toBe(
      'The fee is Rs 1500 and takes 15 working days'
    );
  });

  it('leaves a plain civic question untouched', () => {
    const q = 'How do I apply for an income certificate in Jaipur?';
    expect(redactPersonalData(q)).toBe(q);
  });

  it('handles empty and missing values', () => {
    expect(redactPersonalData()).toBe('');
    expect(redactPersonalData(null)).toBe('');
    expect(redactPersonalData(undefined)).toBe('');
    expect(redactPersonalData(12345)).toBe('12345');
  });

  it('is what sanitizeForPrivacy uses', () => {
    expect(sanitizeForPrivacy('PAN ABCDE1234F, phone 9876543210')).toBe('PAN [REDACTED_PAN], phone [REDACTED_PHONE]');
  });
});

describe('redactSecrets', () => {
  it('removes JWTs, Clerk ids and secret keys', () => {
    const out = redactSecrets(
      'failed sess_2abcSECRET1 user_29xyzAB12 eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig sk_live_abc123 pk_test_Zm9v'
    );
    ['sess_', 'user_29', 'eyJ', 'sk_live', 'pk_test', 'SECRET1'].forEach((bit) => expect(out).not.toContain(bit));
    expect(out).toContain('[REDACTED_SECRET]');
  });

  it('removes bearer headers and key=value credentials', () => {
    expect(redactSecrets('Authorization: Bearer abc.def-ghi')).not.toContain('abc.def-ghi');
    expect(redactSecrets('GET /x?api_key=hunter2&q=1')).not.toContain('hunter2');
    expect(redactSecrets('password: "hunter2"')).not.toContain('hunter2');
    expect(redactSecrets('token=abcdef123456')).not.toContain('abcdef123456');
  });

  it('removes OpenAI and Google style keys', () => {
    expect(redactSecrets('key sk-abcdefghijklmnopqrstuv')).not.toContain('abcdefghijkl');
    expect(redactSecrets('key AIzaSyA1234567890abcdefghij')).not.toContain('AIzaSy');
  });

  it('leaves normal text untouched', () => {
    expect(redactSecrets('Passport fee is 1500 rupees')).toBe('Passport fee is 1500 rupees');
  });
});

describe('minimizeForExternal', () => {
  it('applies both passes', () => {
    const out = minimizeForExternal('user_29xyzAB12 called 9876543210 about SRV-98234710');
    expect(out).toBe('[REDACTED_SECRET] called [REDACTED_PHONE] about [REDACTED_REF]');
  });
});

describe('stripUrlForSharing', () => {
  it('keeps origin and path only', () => {
    expect(stripUrlForSharing('https://civic.example/services/passport?ref=SRV-1&q=abc#section')).toBe(
      'https://civic.example/services/passport'
    );
  });

  it('returns an empty string for something that is not a url', () => {
    expect(stripUrlForSharing('not a url')).toBe('');
    expect(stripUrlForSharing(undefined)).toBe('');
  });
});
