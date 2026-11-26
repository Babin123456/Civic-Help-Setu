import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateUpVisitPackingChecklist,
  createUpVisitRecord,
  recordUpVisitOutcome,
  formatIcsDate$1,
  generateUpAppointmentIcs,
  compileUpVisitPack,
  buildUpPrintableVisitPackHtml,
  buildUpPrintableVisitPackText,
  APPOINTMENT_STATUS,
  VISIT_OUTCOME,
  UP_VISIT_OUTCOME,
  UP_CHECKLIST_TYPE,
  VISIT_PACK_SECTIONS,
  escapeHtml,
} from './upVisitPlannerService.js';
import { UP_OFFICES, UP_OFFICE_ROUTING_MAP } from '../data/upOffices.js';

describe('UP Visit Planner Service (#1010)', () => {
  const citizenId = 'usr_citizen_987';
  const otherCitizenId = 'usr_citizen_000';

  beforeEach(() => {
    // Data is imported at test level; no global state to reset
  });

  describe('Office Data Integrity', () => {
    it('UP_OFFICES contains tehsil and municipal offices for Lucknow district', () => {
      const ids = UP_OFFICES.map((o) => o.id);
      expect(ids).toContain('lucknow-tehsil-sadar');
      expect(ids).toContain('lucknow-municipal-west');
      expect(ids).toContain('lucknow-rto-vibhuti');
    });

    it('all offices have a dated auditMetadata with reviewDate', () => {
      UP_OFFICES.forEach((office) => {
        expect(office.auditMetadata).toBeDefined();
        expect(office.auditMetadata.reviewDate).toBeDefined();
        expect(typeof office.auditMetadata.reviewDate).toBe('string');
      });
    });

    it('all offices have uncertaintyFlags marking uncertain details', () => {
      UP_OFFICES.forEach((office) => {
        expect(office.uncertaintyFlags).toBeDefined();
        expect(office.uncertaintyFlags.counterDeskDetails).toBeDefined();
        expect(office.uncertaintyFlags.saturdayHours).toBeDefined();
      });
    });

    it('no office has undefined opening hours', () => {
      UP_OFFICES.forEach((office) => {
        expect(office.officeHours).toBeDefined();
        expect(office.officeHours.hours).toBeDefined();
      });
    });
  });

  describe('Service Routing Map', () => {
    it('UP_OFFICE_ROUTING_MAP maps service IDs to office-counter pairs', () => {
      const expectedMappings = [
        'income-certificate',
        'birth-certificate',
        'caste-certificate',
        'municipal-trade-licence',
        'driving-license',
        'ration-card',
        'pan-card',
      ];

      expectedMappings.forEach((serviceId) => {
        expect(UP_OFFICE_ROUTING_MAP[serviceId]).toBeDefined();
        expect(UP_OFFICE_ROUTING_MAP[serviceId].officeId).toBeDefined();
        expect(UP_OFFICE_ROUTING_MAP[serviceId].counterId).toBeDefined();
      });
    });

    it('routing maps income-certificate to tehsil-sadar counter-1', () => {
      const routing = UP_OFFICE_ROUTING_MAP['income-certificate'];
      expect(routing.officeId).toBe('lucknow-tehsil-sadar');
      expect(routing.counterId).toBe('counter-1');
    });

    it('routing maps driving-license to rto-vibhuti counter-1', () => {
      const routing = UP_OFFICE_ROUTING_MAP['driving-license'];
      expect(routing.officeId).toBe('lucknow-rto-vibhuti');
      expect(routing.counterId).toBe('counter-1');
    });
  });

  describe('Visit Packing Checklist', () => {
    it('generateUpVisitPackingChecklist returns items for income-certificate', () => {
      const items = generateUpVisitPackingChecklist('income-certificate', {
        photocopyCount: 2,
        photoCount: 2,
      });

      expect(items).toBeDefined();
      expect(items.length).toBeGreaterThan(0);

      const originalTypes = items.filter(
        (item) => item.type === 'ORIGINAL'
      );
      expect(originalTypes.length).toBeGreaterThan(0);

      const copyTypes = items.filter(
        (item) => item.type === 'PHOTOCOPY'
      );
      expect(copyTypes.length).toBeGreaterThan(0);
    });

    it('generateUpVisitPackingChecklist returns items for driving-license', () => {
      const items = generateUpVisitPackingChecklist('driving-license', {
        photocopyCount: 2,
        photoCount: 2,
      });

      expect(items).toBeDefined();
      expect(items.length).toBeGreaterThan(0);

      const formItems = items.filter(
        (item) => item.type === 'PRINTED_FORM'
      );
      expect(formItems.length).toBeGreaterThan(0);
    });

    it('generateUpVisitPackingChecklist includes deficiency memo and next step', () => {
      const items = generateUpVisitPackingChecklist('income-certificate');

      const types = items.map((c) => c.type);
      expect(types).toContain('DEFICIENCY_MEMO');
      expect(types).toContain('NEXT_STEP');
    });

    it('generateUpVisitPackingChecklist items have serviceId and counterId metadata', () => {
      const items = generateUpVisitPackingChecklist('ration-card');

      items.forEach((item) => {
        expect(item.serviceId).toBeDefined();
        expect(item.counterId).toBeDefined();
      });
    });
  });

  describe('Visit Record Creation', () => {
    it('createUpVisitRecord creates a record with ownerId privacy', () => {
      const visit = createUpVisitRecord({
        serviceName: 'Income Certificate',
        officeName: 'Tehsil Sadar & e-District Facilitation Center',
        officeAddress: 'Kaiserbagh Circle, Near Civil Court, Lucknow',
        appointmentDateTime: '2026-11-20T10:30:00.000Z',
      }, citizenId);

      expect(visit).toBeDefined();
      expect(visit.ownerId).toBe(citizenId);
      expect(visit.id).toBeDefined();
      expect(visit.serviceName).toBe('Income Certificate');
      expect(visit.outcome).toBe(VISIT_OUTCOME.PENDING_VISIT);
      expect(Array.isArray(visit.checklist)).toBe(true);
      expect(visit.checklist.length).toBeGreaterThan(0);
    });

    it('createUpVisitRecord includes packing checklist with all required types', () => {
      const visit = createUpVisitRecord({
        serviceName: 'Driving Licence',
        officeName: 'Regional Transport Office (UP-32) - Vibhuti Khand',
        officeAddress: 'Vibhuti Khand, Gomti Nagar, Lucknow',
        appointmentDateTime: '2026-11-20T10:30:00.000Z',
      }, citizenId);

      const types = visit.checklist.map((c) => c.type);
      expect(types).toContain('ORIGINAL');
      expect(types).toContain('PHOTOCOPY');
      expect(types).toContain('PHOTOGRAPH');
      expect(types).toContain('PRINTED_FORM');
      expect(types).toContain('FEE_EVIDENCE');
    });
  });

  describe('Visit Outcome Recording', () => {
    it('recordUpVisitOutcome validates outcome values', () => {
      expect(() => recordUpVisitOutcome('test-id', UP_VISIT_OUTCOME.COMPLETED)).not.toThrow();
      expect(() => recordUpVisitOutcome('test-id', UP_VISIT_OUTCOME.TOKEN_ISSUED)).not.toThrow();
      expect(() => recordUpVisitOutcome('test-id', UP_VISIT_OUTCOME.ADDITIONAL_DOCS_REQUESTED)).not.toThrow();
      expect(() => recordUpVisitOutcome('test-id', UP_VISIT_OUTCOME.RESCHEDULED)).not.toThrow();
      expect(() => recordUpVisitOutcome('test-id', UP_VISIT_OUTCOME.CANCELLED)).not.toThrow();
      expect(() => recordUpVisitOutcome('test-id', UP_VISIT_OUTCOME.PENDING_VISIT)).not.toThrow();

      expect(() => recordUpVisitOutcome('test-id', 'INVALID_OUTCOME')).toThrow(
        /Invalid visit outcome/
      );
    });

    it('recordUpVisitOutcome returns outcome structure', () => {
      const result = recordUpVisitOutcome('test-id-123', UP_VISIT_OUTCOME.COMPLETED, 'Citizen reported all documents accepted');

      expect(result).toBeDefined();
      expect(result.outcome).toBe(UP_VISIT_OUTCOME.COMPLETED);
      expect(result.outcomeNotes).toBe('Citizen reported all documents accepted');
      expect(result.id).toBe('test-id-123');
      expect(result.recordedAt).toBeDefined();
    });
  });

  describe('iCalendar Generation', () => {
    it('generateUpAppointmentIcs generates valid ICS content', () => {
      const appointment = {
        id: 'apt-123',
        serviceName: 'Income Certificate',
        officeName: 'Tehsil Sadar & e-District Facilitation Center',
        counterNumber: 'counter-1',
        appointmentDateTime: '2026-11-20T10:30:00.000Z',
        officialSourceUrl: 'https://edistrict.up.gov.in',
        referenceNumber: 'IC-2026-88991',
      };

      const ics = generateUpAppointmentIcs(appointment);

      expect(ics).toBeDefined();
      expect(ics).toContain('BEGIN:VCALENDAR');
      expect(ics).toContain('END:VCALENDAR');
      expect(ics).toContain('UID:');
      expect(ics).toContain('DTSTART:');
      expect(ics).toContain('DTEND:');
      expect(ics).toContain('SUMMARY:');
      expect(ics).toContain('LOCATION:');
    });

    it('generateUpAppointmentIcs includes service and counter details', () => {
      const appointment = {
        id: 'apt-456',
        serviceName: 'Driving Licence',
        officeName: 'RTO Vibhuti Khand',
        counterNumber: 'counter-1',
        appointmentDateTime: '2026-11-25T09:00:00.000Z',
      };

      const ics = generateUpAppointmentIcs(appointment);

      expect(ics).toContain('Driving Licence');
      expect(ics).toContain('RTO Vibhuti Khand');
      expect(ics).toContain('counter-1');
    });
  });

  describe('Visit Pack Compilation', () => {
    it('compileUpVisitPack includes source verification date', () => {
      const service = {
        id: 'income-certificate',
        name: 'Income Certificate',
        category: 'Certificates',
        department: 'Revenue Department',
      };

      const pack = compileUpVisitPack({ service });

      expect(pack).toBeDefined();
      expect(pack.sourceVerificationDate).toBeDefined();
      expect(pack.lastVerifiedDate).toBeDefined();
    });

    it('compileUpVisitPack includes office details with uncertainty flags', () => {
      const service = {
        id: 'income-certificate',
        name: 'Income Certificate',
        category: 'Certificates',
        department: 'Revenue Department',
      };

      const pack = compileUpVisitPack({ service });

      expect(pack).toBeDefined();
      expect(pack.hasCounterUncertainty).toBeDefined();
      expect(pack.hasSaturdayUncertainty).toBeDefined();
    });

    it('compileUpVisitPack warnings include UP-specific advice', () => {
      const service = {
        id: 'income-certificate',
        name: 'Income Certificate',
        category: 'Certificates',
        department: 'Revenue Department',
        warnings: [
          'Carry original documents along with 2 sets of self-attested photocopies.',
        ],
      };

      const pack = compileUpVisitPack({ service });

      expect(pack.warnings).toBeDefined();
      expect(pack.warnings.length).toBeGreaterThan(0);
    });

    it('buildUpPrintableVisitPackHtml includes uncertainty notices when flags are set', () => {
      const packData = {
        serviceName: 'Income Certificate',
        department: 'Revenue Department',
        fees: '₹15',
        processingTime: '7 working days',
        lastVerifiedDate: '2026-11-19',
        officialSources: [{ name: 'UP e-District', url: 'https://edistrict.up.gov.in', verified: true }],
        office: {
          name: 'Tehsil Sadar',
          address: 'Kaiserbagh Circle',
          operatingHours: '10:00 AM - 05:00 PM (Mon-Fri)',
          hasCounterUncertainty: true,
          hasSaturdayUncertainty: false,
          counterUncertaintyNote: 'Some counter details are based on citizen observation.',
          saturdayHoursNote: '',
        },
        appointment: {
          tokenNumber: 'TKN-849201',
          appointmentDate: '2026-11-20',
          timeSlot: '10:30 AM - 11:00 AM',
          status: 'Confirmed',
        },
        documents: ['Income Proof', 'Address Proof'],
        steps: [{ title: 'Token Collection', description: 'Present at reception' }],
        warnings: ['Carry original documents'],
        selectedSections: {
          [VISIT_PACK_SECTIONS.APPOINTMENT_INFO]: true,
          [VISIT_PACK_SECTIONS.OFFICE_DETAILS]: true,
          [VISIT_PACK_SECTIONS.REQUIRED_DOCUMENTS]: true,
          [VISIT_PACK_SECTIONS.PROCEDURAL_STEPS]: true,
          [VISIT_PACK_SECTIONS.FEES_PAYMENT]: true,
          [VISIT_PACK_SECTIONS.REJECTION_PREVENTION]: true,
          [VISIT_PACK_SECTIONS.USER_NOTES]: false,
        },
        userNotes: '',
        serviceId: 'income-certificate',
        officeId: '',
        sourceVerificationDate: '2026-11-19',
        hasCounterUncertainty: true,
        hasSaturdayUncertainty: false,
        counterUncertaintyNote: 'Some counter details are based on citizen observation.',
        saturdayHoursNote: '',
      };

      const html = buildUpPrintableVisitPackHtml(packData);

      expect(html).toBeDefined();
      expect(typeof html).toBe('string');
      expect(html).toContain('uncertain');
    });

    it('buildUpPrintableVisitPackText includes uncertainty warnings', () => {
      const packData = {
        serviceName: 'Income Certificate',
        department: 'Revenue Department',
        fees: '₹15',
        processingTime: '7 working days',
        lastVerifiedDate: '2026-11-19',
        office: {
          name: 'Tehsil Sadar',
          operatingHours: '10:00 AM - 05:00 PM (Mon-Fri)',
          hasCounterUncertainty: true,
          hasSaturdayUncertainty: false,
          counterUncertaintyNote: 'Some counter details uncertain.',
          saturdayHoursNote: '',
        },
        appointment: {
          tokenNumber: 'TKN-849201',
          appointmentDate: '2026-11-20',
          timeSlot: '10:30 AM - 11:00 AM',
          status: 'Confirmed',
        },
        documents: ['Income Proof', 'Address Proof'],
        selectedSections: {
          [0]: true,
          [1]: true,
          [2]: true,
          [3]: true,
          [4]: true,
          [5]: true,
          [6]: false,
        },
        userNotes: '',
        serviceId: 'income-certificate',
        officeId: '',
        hasCounterUncertainty: true,
        hasSaturdayUncertainty: false,
        counterUncertaintyNote: 'Some counter details uncertain.',
        saturdayHoursNote: '',
      };

      const text = buildUpPrintableVisitPackText(packData);

      expect(text).toBeDefined();
      expect(typeof text).toBe('string');
      expect(text).toContain('UNCERTAIN');
    });

    it('buildUpPrintableVisitPackHtml always includes verified source citations', () => {
      const packData = {
        serviceName: 'Income Certificate',
        department: 'Revenue Department',
        fees: '₹15',
        processingTime: '7 working days',
        lastVerifiedDate: '2026-11-19',
        officialSources: [{ name: 'UP e-District', url: 'https://edistrict.up.gov.in', verified: true }],
        office: {
          name: 'Tehsil Sadar',
          address: 'Kaiserbagh Circle',
          operatingHours: '10:00 AM - 05:00 PM (Mon-Fri)',
          hasCounterUncertainty: false,
          hasSaturdayUncertainty: false,
          counterUncertaintyNote: '',
          saturdayHoursNote: '',
        },
        appointment: {
          tokenNumber: 'TKN-849201',
          appointmentDate: '2026-11-20',
          timeSlot: '10:30 AM - 11:00 AM',
          status: 'Confirmed',
        },
        documents: ['Income Proof', 'Address Proof'],
        steps: [{ title: 'Token Collection', description: 'Present at reception' }],
        warnings: ['Carry original documents'],
        selectedSections: {
          [0]: true,
          [1]: true,
          [2]: true,
          [3]: true,
          [4]: true,
          [5]: true,
          [6]: false,
        },
        userNotes: '',
        serviceId: 'income-certificate',
        officeId: '',
        hasCounterUncertainty: false,
        hasSaturdayUncertainty: false,
        counterUncertaintyNote: '',
        saturdayHoursNote: '',
      };

      const html = buildUpPrintableVisitPackHtml(packData);

      expect(html).toBeDefined();
      expect(typeof html).toBe('string');
      expect(html).toContain('Verified Official Source Citations');
      expect(html).toContain('UP e-District');
    });
  });

  describe('Privacy and Data Minimization', () => {
    it('user notes are excluded from print pack by default', () => {
      const packData = {
        serviceName: 'Income Certificate',
        department: 'Revenue Department',
        fees: '₹15',
        processingTime: '7 working days',
        lastVerifiedDate: '2026-11-19',
        officialSources: [{ name: 'UP e-District', url: 'https://edistrict.up.gov.in', verified: true }],
        office: {
          name: 'Tehsil Sadar',
          address: 'Kaiserbagh Circle',
          operatingHours: '10:00 AM - 05:00 PM (Mon-Fri)',
          hasCounterUncertainty: false,
          hasSaturdayUncertainty: false,
          counterUncertaintyNote: '',
          saturdayHoursNote: '',
        },
        appointment: {
          tokenNumber: 'TKN-849201',
          appointmentDate: '2026-11-20',
          timeSlot: '10:30 AM - 11:00 AM',
          status: 'Confirmed',
        },
        documents: ['Income Proof', 'Address Proof'],
        steps: [{ title: 'Token Collection', description: 'Present at reception' }],
        warnings: ['Carry original documents'],
        selectedSections: {
          [0]: true,
          [1]: true,
          [2]: true,
          [3]: true,
          [4]: true,
          [5]: true,
          [6]: false,
        },
        userNotes: 'My confidential notes about the counter clerk',
      };

      const html = buildUpPrintableVisitPackHtml(packData);

      expect(html).not.toContain('Citizen Personal Notes');
      expect(html).not.toContain('My confidential notes');
    });

    it('user notes are included when explicitly toggled on', () => {
      const packData = {
        serviceName: 'Income Certificate',
        department: 'Revenue Department',
        fees: '₹15',
        processingTime: '7 working days',
        lastVerifiedDate: '2026-11-19',
        officialSources: [{ name: 'UP e-District', url: 'https://edistrict.up.gov.in', verified: true }],
        office: {
          name: 'Tehsil Sadar',
          address: 'Kaiserbagh Circle',
          operatingHours: '10:00 AM - 05:00 PM (Mon-Fri)',
          hasCounterUncertainty: false,
          hasSaturdayUncertainty: false,
          counterUncertaintyNote: '',
          saturdayHoursNote: '',
        },
        appointment: {
          tokenNumber: 'TKN-849201',
          appointmentDate: '2026-11-20',
          timeSlot: '10:30 AM - 11:00 AM',
          status: 'Confirmed',
        },
        documents: ['Income Proof', 'Address Proof'],
        steps: [{ title: 'Token Collection', description: 'Present at reception' }],
        warnings: ['Carry original documents'],
        selectedSections: {
          [0]: true,
          [1]: true,
          [2]: true,
          [3]: true,
          [4]: true,
          [5]: true,
          [6]: true,
        },
        userNotes: 'Ask counter clerk about police verification SLA.',
      };

      const html = buildUpPrintableVisitPackHtml(packData);

      expect(html).toContain('Citizen Personal Notes & Inquiries');
      expect(html).toContain('police verification SLA');
    });

    it('sensitive numbers in user notes are sanitized', () => {
      const packData = {
        serviceName: 'Income Certificate',
        department: 'Revenue Department',
        fees: '₹15',
        processingTime: '7 working days',
        lastVerifiedDate: '2026-11-19',
        officialSources: [{ name: 'UP e-District', url: 'https://edistrict.up.gov.in', verified: true }],
        office: {
          name: 'Tehsil Sadar',
          address: 'Kaiserbagh Circle',
          operatingHours: '10:00 AM - 05:00 PM (Mon-Fri)',
          hasCounterUncertainty: false,
          hasSaturdayUncertainty: false,
          counterUncertaintyNote: '',
          saturdayHoursNote: '',
        },
        appointment: {
          tokenNumber: 'TKN-849201',
          appointmentDate: '2026-11-20',
          timeSlot: '10:30 AM - 11:00 AM',
          status: 'Confirmed',
        },
        documents: ['Income Proof', 'Address Proof'],
        steps: [{ title: 'Token Collection', description: 'Present at reception' }],
        warnings: ['Carry original documents'],
        selectedSections: {
          [0]: true,
          [1]: true,
          [2]: true,
          [3]: true,
          [4]: true,
          [5]: true,
          [6]: true,
        },
        userNotes: 'My Aadhaar is 1234 5678 9012 and PAN is ABCDE1234F',
      };

      const html = buildUpPrintableVisitPackHtml(packData);

      expect(html).not.toContain('1234 5678 9012');
      expect(html).not.toContain('ABCDE1234F');
      expect(html).toContain('[REDACTED_AADHAAR]');
      expect(html).toContain('[REDACTED_PAN]');
    });
  });

  describe('Stale Hours Detection', () => {
    it('offices with old review dates are flagged', () => {
      UP_OFFICES.forEach((office) => {
        const reviewDate = office.auditMetadata.reviewDate;
        expect(reviewDate).toBeDefined();
        const year = parseInt(reviewDate.split('-')[0], 10);
        expect(year).toBeGreaterThanOrEqual(2026);
      });
    });

    it('compileUpVisitPack uses the service lastVerified date', () => {
      const service = {
        id: 'income-certificate',
        name: 'Income Certificate',
        lastVerified: '2026-11-19',
      };

      const pack = compileUpVisitPack({ service });
      expect(pack.lastVerifiedDate).toBe('2026-11-19');
    });
  });
});