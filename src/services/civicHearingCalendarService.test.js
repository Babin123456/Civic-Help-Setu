import { describe, it, expect, beforeEach } from 'vitest';
import {
  HEARING_EVENT_TYPE,
  HEARING_STATUS,
  PARTICIPATION_MODE,
  PARTICIPATION_TOPIC,
  civicHearingStore,
} from './civicHearingCalendarService.js';

describe('civicHearingCalendarService', () => {
  beforeEach(() => {
    civicHearingStore.reset();
  });

  it('publishes an official verified hearing with full jurisdiction and deadline metadata', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 15);

    const hearing = civicHearingStore.publishOfficialHearing(
      {
        title: 'Master Plan 2046 Public Consultation Hearing',
        eventType: HEARING_EVENT_TYPE.PLANNING_CONSULTATION,
        organizer: 'Chennai Metropolitan Development Authority (CMDA)',
        jurisdiction: {
          state: 'TAMIL_NADU',
          district: 'CHENNAI',
          municipality: 'GREATER_CHENNAI_CORPORATION',
          ward: 'Zone 5',
        },
        topic: PARTICIPATION_TOPIC.URBAN_PLANNING,
        participationMode: PARTICIPATION_MODE.HYBRID,
        venueOrLink: 'Kalaivanar Arangam & Online Livestream',
        eventDate: futureDate.toISOString(),
        responseDeadline: futureDate.toISOString(),
        officialSource: 'CMDA Gazette Notification No. 128/2026',
        officialSourceUrl: 'https://cmdachennai.gov.in/notices',
      },
      'ADMIN'
    );

    expect(hearing.id).toBeDefined();
    expect(hearing.isVerified).toBe(true);
    expect(hearing.status).toBe(HEARING_STATUS.ACTIVE_CONSULTATION);
    expect(hearing.jurisdiction.district).toBe('CHENNAI');
    expect(hearing.officialSource).toContain('CMDA Gazette Notification');
  });

  it('detects and flags duplicate event submissions across same organizer and date', () => {
    const futureDate = '2026-06-15T10:00:00.000Z';

    civicHearingStore.publishOfficialHearing(
      {
        title: 'Ward Committee Meeting Ward 120',
        eventType: HEARING_EVENT_TYPE.WARD_COMMITTEE_MEETING,
        organizer: 'Greater Chennai Corporation',
        eventDate: futureDate,
        officialSource: 'GCC Public Bulletin',
      },
      'ADMIN'
    );

    // Attempt to publish duplicate with same organizer and date
    expect(() =>
      civicHearingStore.publishOfficialHearing(
        {
          title: 'Ward Committee Meeting Ward 120 (Duplicate)',
          organizer: 'Greater Chennai Corporation',
          eventDate: futureDate,
          officialSource: 'GCC Public Notice',
        },
        'ADMIN'
      )
    ).toThrow(/Duplicate Event Detected/);
  });

  it('keeps community-submitted hearings unverified until approved in moderation queue', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 20);

    const submission = civicHearingStore.submitCommunityHearing({
      title: 'Local Lake Restoration Public Feedback Meeting',
      organizer: 'Citizens for Clean Water Coalition',
      officialSource: 'Area Sabha WhatsApp Announcement & Circular',
      eventDate: futureDate.toISOString(),
    });

    expect(submission.isVerified).toBe(false);
    expect(submission.status).toBe(HEARING_STATUS.PENDING_MODERATION);

    // Verified filters must not show unverified submission by default
    const verifiedOnly = civicHearingStore.filterHearings({ onlyVerified: true });
    expect(verifiedOnly.find((h) => h.id === submission.id)).toBeUndefined();

    // Admin approves community submission
    const approved = civicHearingStore.moderateHearing(submission.id, true, 'Approved', 'ADMIN');
    expect(approved.isVerified).toBe(true);
    expect(approved.status).toBe(HEARING_STATUS.UPCOMING);

    const recheck = civicHearingStore.filterHearings({ onlyVerified: true });
    expect(recheck.find((h) => h.id === submission.id)).toBeDefined();
  });

  it('supports filtering by district, municipality, topic, and participation mode', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);

    civicHearingStore.publishOfficialHearing(
      {
        title: 'Solid Waste By-Laws Consultation',
        organizer: 'Pune Municipal Corporation',
        jurisdiction: { state: 'MAHARASHTRA', district: 'PUNE', municipality: 'PMC' },
        topic: PARTICIPATION_TOPIC.SOLID_WASTE,
        participationMode: PARTICIPATION_MODE.IN_PERSON,
        eventDate: futureDate.toISOString(),
        officialSource: 'PMC Gazette',
      },
      'ADMIN'
    );

    civicHearingStore.publishOfficialHearing(
      {
        title: 'Water Supply Restructuring Hearing',
        organizer: 'Bengaluru Water Supply Board',
        jurisdiction: { state: 'KARNATAKA', district: 'BENGALURU', municipality: 'BBMP' },
        topic: PARTICIPATION_TOPIC.WATER_SANITATION,
        participationMode: PARTICIPATION_MODE.VIRTUAL,
        eventDate: futureDate.toISOString(),
        officialSource: 'BWSSB Bulletin',
      },
      'ADMIN'
    );

    const puneFiltered = civicHearingStore.filterHearings({ district: 'PUNE' });
    expect(puneFiltered.length).toBe(1);
    expect(puneFiltered[0].topic).toBe(PARTICIPATION_TOPIC.SOLID_WASTE);

    const virtualFiltered = civicHearingStore.filterHearings({ participationMode: PARTICIPATION_MODE.VIRTUAL });
    expect(virtualFiltered.length).toBe(1);
    expect(virtualFiltered[0].jurisdiction.district).toBe('BENGALURU');
  });

  it('keeps expired past hearings searchable in the archive for accountability', () => {
    const pastDate = '2025-01-10T10:00:00.000Z'; // Past event

    const expired = civicHearingStore.publishOfficialHearing(
      {
        title: 'Historical Road Widening Objection Hearing',
        organizer: 'Highways Department',
        eventDate: pastDate,
        responseDeadline: pastDate,
        officialSource: 'State Gazette 2025',
      },
      'ADMIN'
    );

    expect(expired.status).toBe(HEARING_STATUS.EXPIRED);

    // Standard query excludes expired
    const standardQuery = civicHearingStore.filterHearings({ includeArchived: false });
    expect(standardQuery.find((h) => h.id === expired.id)).toBeUndefined();

    // Archive query includes expired
    const archiveQuery = civicHearingStore.filterHearings({ includeArchived: true });
    expect(archiveQuery.find((h) => h.id === expired.id)).toBeDefined();
  });

  it('allows citizens to save private preparation notes and configure opt-in reminders', () => {
    const hearing = civicHearingStore.publishOfficialHearing(
      {
        title: 'Area Sabha Monthly Public Meeting',
        organizer: 'Ward 85 Councillor Office',
        officialSource: 'Notice Board',
      },
      'ADMIN'
    );

    const citizenId = 'citizen_789';

    // Save prep notes
    civicHearingStore.saveUserPreparationNotes(
      citizenId,
      hearing.id,
      'Raise question regarding storm water drain desilting timeline.'
    );
    const notes = civicHearingStore.getUserPreparationNotes(citizenId, hearing.id);
    expect(notes).toContain('storm water drain');

    // Configure opt-in reminder with timezone
    const reminder = civicHearingStore.setPrivateReminder(citizenId, hearing.id, {
      optIn: true,
      advanceDays: 3,
      timezone: 'Asia/Kolkata',
    });
    expect(reminder.optIn).toBe(true);
    expect(reminder.timezone).toBe('Asia/Kolkata');
  });
});
