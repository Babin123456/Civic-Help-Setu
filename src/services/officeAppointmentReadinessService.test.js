import { describe, it, expect, beforeEach } from 'vitest';
import {
  APPOINTMENT_STATUS,
  CHECKLIST_TYPE,
  VISIT_OUTCOME,
  appointmentStore,
  formatIcsDate,
  generateAppointmentIcs,
  generateVisitPackingChecklist,
} from './officeAppointmentReadinessService.js';

describe('officeAppointmentReadinessService', () => {
  const citizenId = 'usr_citizen_987';
  const otherCitizenId = 'usr_citizen_000';

  beforeEach(() => {
    appointmentStore.reset();
  });

  it('creates an appointment record with a structured packing checklist', () => {
    const appointment = appointmentStore.create(
      {
        serviceName: 'Passport Application Reissue',
        officeName: 'Passport Seva Kendra (PSK) Saligramam',
        officeAddress: '100 Feet Road, Chennai',
        counterNumber: 'Counter B-4',
        appointmentDateTime: '2026-04-10T10:30:00.000Z',
        referenceNumber: 'ARN-2026-88991',
        requirementsConfig: {
          documentNames: ['Old Passport', 'Aadhaar Card', 'Proof of Address'],
          photocopyCount: 2,
          photoCount: 2,
        },
      },
      citizenId
    );

    expect(appointment.id).toBeDefined();
    expect(appointment.ownerId).toBe(citizenId);
    expect(appointment.status).toBe(APPOINTMENT_STATUS.CONFIRMED);
    expect(appointment.outcome).toBe(VISIT_OUTCOME.PENDING_VISIT);

    // Checklist has distinct types
    const types = appointment.checklist.map((c) => c.type);
    expect(types).toContain(CHECKLIST_TYPE.ORIGINAL);
    expect(types).toContain(CHECKLIST_TYPE.PHOTOCOPY);
    expect(types).toContain(CHECKLIST_TYPE.PHOTOGRAPH);
    expect(types).toContain(CHECKLIST_TYPE.PRINTED_FORM);
    expect(types).toContain(CHECKLIST_TYPE.FEE_EVIDENCE);
  });

  it('enforces strict privacy and rejects access attempts by non-owners', () => {
    const appointment = appointmentStore.create(
      {
        serviceName: 'Property Registration',
        officeName: 'Sub-Registrar Office, T. Nagar',
        appointmentDateTime: '2026-04-15T11:00:00.000Z',
      },
      citizenId
    );

    // Owner can access
    expect(appointmentStore.get(appointment.id, citizenId)).toBeDefined();

    // Non-owner receives access denied
    expect(() => appointmentStore.get(appointment.id, otherCitizenId)).toThrow(/Access Denied/);
  });

  it('supports appointment rescheduling and increments calendar sequence numbers', () => {
    const appointment = appointmentStore.create(
      {
        serviceName: 'Driving Licence Renewal',
        officeName: 'Regional Transport Office (RTO)',
        appointmentDateTime: '2026-04-05T09:00:00.000Z',
      },
      citizenId
    );

    expect(appointment.sequence).toBe(0);

    const rescheduled = appointmentStore.reschedule(
      appointment.id,
      '2026-04-12T14:00:00.000Z',
      citizenId
    );

    expect(rescheduled.status).toBe(APPOINTMENT_STATUS.RESCHEDULED);
    expect(rescheduled.appointmentDateTime).toBe('2026-04-12T14:00:00.000Z');
    expect(rescheduled.sequence).toBe(1);
  });

  it('tracks appointment cancellation with reason and sequence increment', () => {
    const appointment = appointmentStore.create(
      {
        serviceName: 'Income Certificate Verification',
        officeName: 'Taluk Office',
        appointmentDateTime: '2026-04-08T15:00:00.000Z',
      },
      citizenId
    );

    const cancelled = appointmentStore.cancel(appointment.id, 'Unable to travel', citizenId);
    expect(cancelled.status).toBe(APPOINTMENT_STATUS.CANCELLED);
    expect(cancelled.outcome).toBe(VISIT_OUTCOME.CANCELLED);
    expect(cancelled.outcomeNotes).toBe('Unable to travel');
    expect(cancelled.sequence).toBe(1);
  });

  it('records physical visit outcomes including tokens issued or additional docs requested', () => {
    const appointment = appointmentStore.create(
      {
        serviceName: 'Caste Certificate Attestation',
        officeName: 'Revenue Office',
        appointmentDateTime: '2026-04-02T10:00:00.000Z',
      },
      citizenId
    );

    const updated = appointmentStore.recordOutcome(
      appointment.id,
      VISIT_OUTCOME.ADDITIONAL_DOCS_REQUESTED,
      'Required grandfather ancestry certificate',
      citizenId
    );

    expect(updated.outcome).toBe(VISIT_OUTCOME.ADDITIONAL_DOCS_REQUESTED);
    expect(updated.outcomeNotes).toContain('grandfather ancestry certificate');
  });

  it('generates an RFC 5545 compliant iCalendar export with timezone formatting', () => {
    const appointment = appointmentStore.create(
      {
        serviceName: 'Voter ID Verification',
        officeName: 'Election Facilitation Center',
        officeAddress: 'Main Road, Ward 12',
        counterNumber: 'Counter 3',
        appointmentDateTime: '2026-05-01T04:30:00.000Z', // UTC boundary
        referenceNumber: 'VOT-2026-112',
      },
      citizenId
    );

    const icsContent = generateAppointmentIcs(appointment);

    expect(icsContent).toContain('BEGIN:VCALENDAR');
    expect(icsContent).toContain('BEGIN:VEVENT');
    expect(icsContent).toContain('UID:apt_' + appointment.id);
    expect(icsContent).toContain('DTSTART:20260501T043000Z');
    expect(icsContent).toContain('DTEND:20260501T053000Z');
    expect(icsContent).toContain('STATUS:CONFIRMED');
    expect(icsContent).toContain('SEQUENCE:0');
    expect(icsContent).toContain('LOCATION:Election Facilitation Center');
    expect(icsContent).toContain('END:VEVENT');
    expect(icsContent).toContain('END:VCALENDAR');

    // Cancelling updates the calendar ICS
    const cancelled = appointmentStore.cancel(appointment.id, 'Medical emergency', citizenId);
    const cancelIcs = generateAppointmentIcs(cancelled);
    expect(cancelIcs).toContain('STATUS:CANCELLED');
    expect(cancelIcs).toContain('SEQUENCE:1');
  });
});
