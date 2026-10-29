import { describe, it, expect } from 'vitest';
import {
  formatForWhatsApp,
  formatForSms,
  formatForPlainTextCard,
} from './plainTextServiceFormatter';

describe('Plain-Text Service Formatter (#275)', () => {
  const sampleService = {
    id: 'passport',
    name: 'New Passport (Normal / Tatkaal)',
    category: 'Identity & Travel',
    department: 'Ministry of External Affairs',
    processingTime: '15-21 working days',
    fees: '₹1,500 (Normal), ₹3,500 (Tatkaal)',
    officialLink: 'https://passportindia.gov.in',
    helpline: '1800-258-1800',
    documents: [
      'Proof of Date of Birth (Birth Certificate or 10th Marksheet)',
      'Proof of Present Address (Aadhaar or Utility Bill)',
      'Non-ECR Proof (Matriculation Certificate)',
    ],
    warnings: ['Mandatory police verification will be conducted at registered residence.'],
    steps: [
      'Register on Passport Seva Portal',
      'Pay statutory application fee online',
      'Book appointment at nearest Passport Seva Kendra (PSK)',
      'Visit PSK with original documents for biometrics',
    ],
  };

  it('formats clean WhatsApp message with emojis and asterisk formatting', () => {
    const formatted = formatForWhatsApp(sampleService);
    expect(formatted).toContain('🏛️ *NEW PASSPORT (NORMAL / TATKAAL)*');
    expect(formatted).toContain('⏱️ Timeline: 15-21 working days');
    expect(formatted).toContain('💰 Fee: ₹1,500 (Normal), ₹3,500 (Tatkaal)');
    expect(formatted).toContain('📋 *MANDATORY DOCUMENTS:*');
    expect(formatted).toContain('• Proof of Date of Birth');
    expect(formatted).toContain('⚠️ *KEY NOTES:*');
    expect(formatted).toContain('📞 Helpline: 1800-258-1800');
  });

  it('chunks SMS strictly within 160 character bounds', () => {
    const smsChunks = formatForSms(sampleService, 160);
    expect(smsChunks).toHaveLength(2);

    for (const chunk of smsChunks) {
      expect(chunk.length).toBeLessThanOrEqual(160);
    }

    expect(smsChunks[0]).toMatch(/^\[1\/2\]/);
    expect(smsChunks[1]).toMatch(/^\[2\/2\]/);
    expect(smsChunks[1]).toContain('passportindia.gov.in');
  });

  it('formats comprehensive plain text card for offline viewing and printing', () => {
    const card = formatForPlainTextCard(sampleService);
    expect(card).toContain('CIVIC SERVICE FACILITATION GUIDE (OFFLINE COPY)');
    expect(card).toContain('Service: New Passport (Normal / Tatkaal)');
    expect(card).toContain('1. OVERVIEW & TIMELINES');
    expect(card).toContain('2. MANDATORY CHECKLIST & DOCUMENTS');
    expect(card).toContain('3. APPLICATION PROCEDURE');
    expect(card).toContain('4. GRIEVANCE & CITIZEN HELPLINE');
  });

  it('handles empty or missing service fields safely with graceful defaults', () => {
    const emptyService = {};
    const wa = formatForWhatsApp(emptyService);
    expect(wa).toContain('CIVIC SERVICE');

    const sms = formatForSms(emptyService, 160);
    expect(sms).toHaveLength(2);
    expect(sms[0].length).toBeLessThanOrEqual(160);

    const card = formatForPlainTextCard(emptyService);
    expect(card).toContain('Civic Service');
  });
});
