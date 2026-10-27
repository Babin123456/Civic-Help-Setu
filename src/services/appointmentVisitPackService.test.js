import { describe, it, expect } from 'vitest';
import {
  VISIT_PACK_SECTIONS,
  DEFAULT_SECTION_SELECTION,
  compileVisitPackData,
  buildPrintableVisitPackHtml,
  buildPrintableVisitPackText,
} from './appointmentVisitPackService';

describe('Civic Appointment Preparation and Visit Pack Service (#150)', () => {
  const mockService = {
    id: 'passport-renewal',
    name: 'Passport Renewal',
    category: 'Travel & Identity',
    department: 'Ministry of External Affairs',
    fees: '₹1,500 for standard 36 pages',
    processingTime: '10 - 20 working days',
    lastVerified: '2026-03-01',
    officialSources: [
      { name: 'Passport Seva Portal', url: 'https://passportindia.gov.in', verified: true },
    ],
    documents: [
      'Original old passport',
      'Self-attested copy of first two and last two pages of old passport',
      'Proof of current address',
    ],
    steps: [
      { title: 'Online Registration', description: 'Fill Form on portal.' },
      { title: 'PSK Visit', description: 'Arrive at counter 15 mins prior.' },
    ],
    warnings: ['Late arrival leads to cancellation of appointment token.'],
  };

  const mockOffice = {
    id: 'psk-ito',
    name: 'Passport Seva Kendra - ITO Herald House',
    address: '5A Bahadur Shah Zafar Marg, ITO',
    city: 'New Delhi',
    state: 'Delhi',
    pincode: '110002',
    landmark: 'Opposite Times of India building',
    officeHours: { hours: '09:00 AM - 05:00 PM (Mon-Fri)' },
    contact: { helpline: '1800 258 1800' },
    directionsUrl: 'https://maps.google.com/?q=28.6328,77.2415',
  };

  const mockAppointment = {
    tokenNumber: 'TKN-849201',
    appointmentDate: '2026-11-15',
    timeSlot: '10:30 AM - 11:00 AM',
    applicantName: 'Rahul Verma',
    status: 'Confirmed',
  };

  describe('Section Selection and User Notes Exclusion Rule', () => {
    it('strictly excludes user notes by default even if user notes text is provided', () => {
      const pack = compileVisitPackData({
        service: mockService,
        office: mockOffice,
        appointment: mockAppointment,
        userNotes: 'My confidential notes for counter inquiry',
        // includeUserNotes is NOT passed (defaults to false)
      });

      expect(pack.selectedSections[VISIT_PACK_SECTIONS.USER_NOTES]).toBe(false);
      expect(pack.userNotes).toBe('');

      const html = buildPrintableVisitPackHtml(pack);
      expect(html).not.toContain('Citizen Personal Notes');
      expect(html).not.toContain('My confidential notes');
    });

    it('includes user notes only when both section toggle and includeUserNotes flag are true', () => {
      const pack = compileVisitPackData({
        service: mockService,
        office: mockOffice,
        appointment: mockAppointment,
        sectionSelection: {
          ...DEFAULT_SECTION_SELECTION,
          [VISIT_PACK_SECTIONS.USER_NOTES]: true,
        },
        includeUserNotes: true,
        userNotes: 'Ask counter clerk about police verification SLA.',
      });

      expect(pack.selectedSections[VISIT_PACK_SECTIONS.USER_NOTES]).toBe(true);
      expect(pack.userNotes).toContain('police verification SLA');

      const html = buildPrintableVisitPackHtml(pack);
      expect(html).toContain('Citizen Personal Notes &amp; Inquiries');
      expect(html).toContain('police verification SLA');
    });

    it('allows selective inclusion and exclusion of individual pack sections', () => {
      const packWithoutFees = compileVisitPackData({
        service: mockService,
        sectionSelection: {
          ...DEFAULT_SECTION_SELECTION,
          [VISIT_PACK_SECTIONS.FEES_PAYMENT]: false,
          [VISIT_PACK_SECTIONS.REJECTION_PREVENTION]: false,
        },
      });

      expect(packWithoutFees.selectedSections[VISIT_PACK_SECTIONS.FEES_PAYMENT]).toBe(false);
      expect(packWithoutFees.selectedSections[VISIT_PACK_SECTIONS.REJECTION_PREVENTION]).toBe(false);

      const html = buildPrintableVisitPackHtml(packWithoutFees);
      expect(html).not.toContain('5. Statutory Government Fees');
      expect(html).not.toContain('6. Rejection Prevention');
      expect(html).toContain('3. Required Documents to Carry');
    });
  });

  describe('Clear Labeling of Missing Information', () => {
    it('clearly labels missing office information instead of rendering blank or broken elements', () => {
      const packWithoutOffice = compileVisitPackData({
        service: mockService,
        office: null, // No office selected
      });

      expect(packWithoutOffice.office.isAvailable).toBe(false);
      expect(packWithoutOffice.office.name).toContain('[Public Office Not Selected');
      expect(packWithoutOffice.office.address).toContain('[Location details not on file');

      const html = buildPrintableVisitPackHtml(packWithoutOffice);
      expect(html).toContain('[Location details not on file');
    });

    it('clearly labels missing appointment information as walk-in mode', () => {
      const packWithoutAppointment = compileVisitPackData({
        service: mockService,
        appointment: null, // No appointment booked
      });

      expect(packWithoutAppointment.appointment.isBooked).toBe(false);
      expect(packWithoutAppointment.appointment.tokenNumber).toContain('[No Online Token Booked');
      expect(packWithoutAppointment.appointment.status).toBe('Unbooked / Walk-in Mode');

      const html = buildPrintableVisitPackHtml(packWithoutAppointment);
      expect(html).toContain('Unbooked / Walk-in Mode');
    });
  });

  describe('Verified Sources and Review Dates Inclusion', () => {
    it('includes official source URLs and verification review dates in the dossier', () => {
      const pack = compileVisitPackData({
        service: mockService,
        office: mockOffice,
        appointment: mockAppointment,
      });

      expect(pack.lastVerifiedDate).toBe('2026-03-01');
      expect(pack.officialSources[0].url).toBe('https://passportindia.gov.in');

      const html = buildPrintableVisitPackHtml(pack);
      expect(html).toContain('Source Verified: 2026-03-01');
      expect(html).toContain('https://passportindia.gov.in');
      expect(html).toContain('Passport Seva Portal');
    });
  });

  describe('Data Protection: Strict Exclusion of Vault Files & Sensitive PII', () => {
    it('does not include any vault files, biometric blobs, or sensitive profile credentials', () => {
      const pack = compileVisitPackData({
        service: {
          ...mockService,
          // Attaching vault object simulating user state
          vaultFiles: ['/vault/aadhaar_original.pdf', '/vault/bank_passbook.pdf'],
          userCredentials: { passwordHash: 'secret123', pin: 9999 },
        },
        office: mockOffice,
      });

      // Assert data model does not map vaultFiles or userCredentials
      expect(pack.vaultFiles).toBeUndefined();
      expect(pack.userCredentials).toBeUndefined();

      const html = buildPrintableVisitPackHtml(pack);
      expect(html).not.toContain('aadhaar_original.pdf');
      expect(html).not.toContain('secret123');
    });

    it('sanitizes accidental Aadhaar and PAN numbers in user notes', () => {
      const pack = compileVisitPackData({
        service: mockService,
        sectionSelection: {
          ...DEFAULT_SECTION_SELECTION,
          [VISIT_PACK_SECTIONS.USER_NOTES]: true,
        },
        includeUserNotes: true,
        userNotes: 'My Aadhaar is 1122 3344 5566 and my PAN is ABCDE1234F. Inquire about fee waiver.',
      });

      expect(pack.userNotes).not.toContain('1122 3344 5566');
      expect(pack.userNotes).not.toContain('ABCDE1234F');
      expect(pack.userNotes).toContain('[REDACTED_AADHAAR]');
      expect(pack.userNotes).toContain('[REDACTED_PAN]');
    });
  });

  describe('Ink-Friendly Monochrome HTML and Plain Text Outputs', () => {
    it('generates ink-friendly HTML with high contrast styles and print page rules', () => {
      const pack = compileVisitPackData({
        service: mockService,
        office: mockOffice,
        appointment: mockAppointment,
      });

      const html = buildPrintableVisitPackHtml(pack);
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('@media print');
      expect(html).toContain('page-break-inside: avoid');
      expect(html).toContain('background: #ffffff');
      expect(html).toContain('TKN-849201');
      expect(html).toContain('Passport Seva Kendra - ITO Herald House');
    });

    it('generates plain text visit pack for mobile messaging', () => {
      const pack = compileVisitPackData({
        service: mockService,
        office: mockOffice,
        appointment: mockAppointment,
      });

      const text = buildPrintableVisitPackText(pack);
      expect(text).toContain('CIVIC APPOINTMENT & VISIT PACK');
      expect(text).toContain('Token Number: TKN-849201');
      expect(text).toContain('Original old passport');
      expect(text).toContain('1800 258 1800');
    });
  });
});
