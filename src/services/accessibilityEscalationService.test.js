import { describe, it, expect, beforeEach } from 'vitest';
import {
  sortEventsChronologically,
  addCaseEvent,
  updateCaseEvent,
  deleteCaseEvent,
  computeFollowUpReminders,
  generateFollowUpDraft,
  generateEscalationPetitionDraft,
  sanitizeCaseForExport,
  EVENT_TYPES,
  CASE_STAGES,
  REMINDER_LEGAL_DISCLAIMER,
} from './accessibilityEscalationService.js';
import {
  saveAccessibilityCase,
} from './accessibilityEscalationStorage.js';

describe('accessibilityEscalationService (#950)', () => {
  let mockStorage;
  let store;

  beforeEach(() => {
    store = new Map();
    mockStorage = {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, val) => store.set(key, String(val)),
      removeItem: (key) => store.delete(key),
    };
  });

  describe('Chronological Event Sequencing', () => {
    it('sorts events chronologically by eventDate ascending', () => {
      const rawEvents = [
        { id: '3', eventDate: '2026-03-01', summary: 'Later event', createdAt: '2026-03-01T12:00:00Z' },
        { id: '1', eventDate: '2026-01-15', summary: 'Earliest event', createdAt: '2026-01-15T12:00:00Z' },
        { id: '2', eventDate: '2026-02-10', summary: 'Middle event', createdAt: '2026-02-10T12:00:00Z' },
      ];

      const sorted = sortEventsChronologically(rawEvents);
      expect(sorted[0].id).toBe('1');
      expect(sorted[1].id).toBe('2');
      expect(sorted[2].id).toBe('3');
    });

    it('breaks ties on eventDate using createdAt ascending', () => {
      const tiedEvents = [
        { id: 'b', eventDate: '2026-02-01', summary: 'Second created', createdAt: '2026-02-01T15:00:00Z' },
        { id: 'a', eventDate: '2026-02-01', summary: 'First created', createdAt: '2026-02-01T09:00:00Z' },
      ];

      const sorted = sortEventsChronologically(tiedEvents);
      expect(sorted[0].id).toBe('a');
      expect(sorted[1].id).toBe('b');
    });
  });

  describe('Event Add, Edit, and Delete', () => {
    let testCaseId;

    beforeEach(async () => {
      const c = await saveAccessibilityCase(
        {
          id: 'case-test-flow',
          title: 'Broken Wheelchair Lift at Post Office',
          facilityName: 'Head Post Office',
          facilityType: 'bank_post_office',
          location: 'Main Bazaar',
          authorityType: 'MUNICIPAL_CORPORATION',
          status: CASE_STAGES.REPORT_FILED,
          events: [],
        },
        mockStorage
      );
      testCaseId = c.id;
    });

    it('adds an event and maintains chronological ordering in case', async () => {
      await addCaseEvent(
        testCaseId,
        {
          eventType: EVENT_TYPES.COMPLAINT_FILED,
          eventDate: '2026-02-01',
          summary: 'Handed complaint letter to Postmaster',
          details: 'Refused ramp access due to steps.',
          evidenceRefs: ['Receipt #991'],
        },
        mockStorage
      );

      // Insert an earlier event
      const updated = await addCaseEvent(
        testCaseId,
        {
          eventType: EVENT_TYPES.NOTE_LOGGED,
          eventDate: '2026-01-20',
          summary: 'Took photographs of obstructed doorway',
          details: 'Photos archived locally.',
        },
        mockStorage
      );

      expect(updated.events.length).toBe(2);
      expect(updated.events[0].eventDate).toBe('2026-01-20');
      expect(updated.events[1].eventDate).toBe('2026-02-01');
    });

    it('edits an existing event and updates its details', async () => {
      const withEvent = await addCaseEvent(
        testCaseId,
        {
          eventType: EVENT_TYPES.COMPLAINT_FILED,
          eventDate: '2026-02-01',
          summary: 'Initial complaint',
          details: 'Draft notes',
        },
        mockStorage
      );

      const eventId = withEvent.events[0].id;
      const edited = await updateCaseEvent(
        testCaseId,
        eventId,
        {
          summary: 'Updated formal complaint headline',
          details: 'Expanded notes with dispatch confirmation',
          followUpDate: '2026-02-20',
        },
        mockStorage
      );

      const ev = edited.events.find((e) => e.id === eventId);
      expect(ev.summary).toBe('Updated formal complaint headline');
      expect(ev.followUpDate).toBe('2026-02-20');
      expect(ev.details).toContain('Expanded notes');
    });

    it('deletes an event from the case timeline', async () => {
      const withEvent = await addCaseEvent(
        testCaseId,
        {
          eventType: EVENT_TYPES.NOTE_LOGGED,
          eventDate: '2026-02-05',
          summary: 'Mistaken entry to delete',
        },
        mockStorage
      );

      const eventId = withEvent.events[0].id;
      const afterDelete = await deleteCaseEvent(testCaseId, eventId, mockStorage);
      expect(afterDelete.events.length).toBe(0);
    });
  });

  describe('Follow-up Reminders & Timeline Milestones', () => {
    it('identifies overdue follow-up dates and includes legal disclaimer', () => {
      const referenceDate = new Date('2026-02-20T00:00:00Z');
      const caseData = {
        status: CASE_STAGES.REPORT_FILED,
        events: [
          {
            id: 'e1',
            eventDate: '2026-02-01',
            summary: 'Initial letter sent',
            followUpDate: '2026-02-15', // 5 days overdue relative to Feb 20
            isReminderDismissed: false,
          },
          {
            id: 'e2',
            eventDate: '2026-02-18',
            summary: 'Speed post reminder',
            followUpDate: '2026-02-25', // Upcoming (5 days remaining)
            isReminderDismissed: false,
          },
        ],
      };

      const result = computeFollowUpReminders(caseData, referenceDate);
      expect(result.hasOverdue).toBe(true);
      expect(result.overdueEvents.length).toBe(1);
      expect(result.overdueEvents[0].overdueDays).toBe(5);

      expect(result.hasUpcoming).toBe(true);
      expect(result.upcomingEvents.length).toBe(1);
      expect(result.upcomingEvents[0].daysRemaining).toBe(5);

      expect(result.daysSinceLastActivity).toBe(2); // Feb 20 - Feb 18 = 2
      expect(result.disclaimer).toBe(REMINDER_LEGAL_DISCLAIMER);
    });
  });

  describe('Follow-up Representation & Escalation Petition Drafter', () => {
    const sampleCase = {
      title: 'Inaccessible Ramp at Primary Health Center',
      facilityName: 'PHC Indira Nagar',
      facilityType: 'healthcare',
      location: 'Sector 4, Indira Nagar',
      authorityType: 'HEALTH_DEPARTMENT',
      authorityContact: 'Chief Medical Officer (CMO)',
      officialComplaintNumber: 'PHC/2026/994',
      status: CASE_STAGES.INSPECTION_REQUESTED,
      events: [
        {
          eventDate: '2026-01-10',
          summary: 'Lodged written complaint citing Section 45 RPwD Act',
          evidenceRefs: ['Receipt #102'],
        },
        {
          eventDate: '2026-01-25',
          summary: 'Requested joint site inspection with PWD engineer',
          evidenceRefs: ['Speed Post #ED123456IN'],
        },
      ],
    };

    it('generates editable follow-up representation without auto-submitting', () => {
      const draft = generateFollowUpDraft(sampleCase, {
        citizenName: 'Devi Sharma',
        citizenAddress: 'Ward 5, Indira Nagar',
      });

      expect(draft).toContain('FORMAL FOLLOW-UP REPRESENTATION');
      expect(draft).toContain('Section 45(1) of the Rights of Persons with Disabilities Act, 2016');
      expect(draft).toContain('Harmonised Guidelines and Space Standards');
      expect(draft).toContain('PHC Indira Nagar');
      expect(draft).toContain('Devi Sharma');
      expect(draft).toContain('2026-01-10: Lodged written complaint');
      expect(draft).toContain('NOT automatically submitted');
    });

    it('generates editable Commissioner escalation petition under Section 75/80', () => {
      const petition = generateEscalationPetitionDraft(sampleCase, {
        citizenName: 'Devi Sharma',
        citizenAddress: 'Ward 5, Indira Nagar',
      });

      expect(petition).toContain('BEFORE THE OFFICE OF THE STATE COMMISSIONER');
      expect(petition).toContain('SECTION 75 / 80 OF THE RIGHTS OF PERSONS WITH DISABILITIES ACT, 2016');
      expect(petition).toContain('Rajive Raturi v. Union of India');
      expect(petition).toContain('PHC Indira Nagar');
      expect(petition).toContain('Section 89');
      expect(petition).toContain('NOT automatically filed');
    });
  });

  describe('Privacy Sanitization for Export', () => {
    it('redacts sensitive personal info (phone, email, Aadhaar) under DPDP Act', () => {
      const caseWithPii = {
        title: 'Complaint by citizen with phone 9876543210 and email test@citizen.org',
        location: 'Near House 12, Contact 8888888888',
        authorityContact: 'Officer contact: officer@gov.in',
        events: [
          {
            summary: 'Aadhaar 1234 5678 9012 provided at counter',
            details: 'Called officer on 9123456789 about case',
            evidenceRefs: ['Photo submitted by citizen@test.com'],
          },
        ],
      };

      const sanitized = sanitizeCaseForExport(caseWithPii);
      expect(sanitized.title).not.toContain('9876543210');
      expect(sanitized.title).not.toContain('test@citizen.org');
      expect(sanitized.events[0].summary).not.toContain('1234 5678 9012');
      expect(sanitized.events[0].summary).toContain('XXXX-XXXX-XXXX');
      expect(sanitized.events[0].details).not.toContain('9123456789');
      expect(sanitized.events[0].details).toContain('XXXXX-XXXXX');
      expect(sanitized.events[0].evidenceRefs[0]).not.toContain('citizen@test.com');
      expect(sanitized.events[0].evidenceRefs[0]).toContain('[REDACTED_EMAIL]');
    });
  });
});
