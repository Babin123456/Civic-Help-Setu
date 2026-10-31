import { describe, it, expect } from 'vitest';
import {
  ATTESTATION_PURPOSE_PRESETS,
  resolveWatermarkText,
  formatWatermarkDate,
  generateAttestationPayload,
} from './documentWatermarkService';

describe('documentWatermarkService', () => {
  it('exposes standard purpose presets including passport, KYC, and SIM registration', () => {
    expect(ATTESTATION_PURPOSE_PRESETS.length).toBeGreaterThanOrEqual(5);
    const ids = ATTESTATION_PURPOSE_PRESETS.map((p) => p.id);
    expect(ids).toContain('PASSPORT');
    expect(ids).toContain('BANK_KYC');
    expect(ids).toContain('SIM_REGISTRATION');
    expect(ids).toContain('CUSTOM');
  });

  it('resolves standard preset watermark texts correctly', () => {
    const text = resolveWatermarkText('PASSPORT');
    expect(text).toContain('ONLY FOR PASSPORT SEVA APPLICATION');

    const bankText = resolveWatermarkText('BANK_KYC');
    expect(bankText).toContain('EXCLUSIVELY FOR BANK KYC VERIFICATION');
  });

  it('handles custom purpose with uppercase conversion and fallback', () => {
    const custom = resolveWatermarkText('CUSTOM', 'Electricity connection meter application');
    expect(custom).toContain('ELECTRICITY CONNECTION METER APPLICATION');

    const emptyCustom = resolveWatermarkText('CUSTOM', '');
    expect(emptyCustom).toContain('CONFIDENTIAL USE ONLY');
  });

  it('formats dates consistently', () => {
    const dateStr = formatWatermarkDate(new Date('2026-10-30T10:00:00Z'));
    expect(dateStr).toContain('2026');
  });

  it('generates complete attestation summary payload with self-attestation disclaimer', () => {
    const doc = {
      id: 'doc-1234',
      name: 'Aadhaar Card',
      type: 'Aadhaar',
    };
    const payload = generateAttestationPayload(doc, {
      purposeId: 'PASSPORT',
      recipientOrganization: 'Regional Passport Office, Bengaluru',
      selfAttested: true,
      attestationName: 'Aarav Sharma',
    });

    expect(payload.referenceId).toBe('doc-1234');
    expect(payload.watermarkText).toContain('PASSPORT SEVA');
    expect(payload.recipient).toBe('Regional Passport Office, Bengaluru');
    expect(payload.citizenName).toBe('Aarav Sharma');
    expect(payload.isSelfAttested).toBe(true);
    expect(payload.formattedSummary).toContain('Aadhaar Card');
    expect(payload.formattedSummary).toContain('Regional Passport Office');
    expect(payload.formattedSummary).toContain('Aarav Sharma');
    expect(payload.formattedSummary).toContain('SELF-ATTESTATION: Certified that this is a true, authentic copy');
  });
});
