import { describe, it, expect, beforeEach } from 'vitest';
import {
  ACKNOWLEDGEMENT_TYPE,
  ATTENDANCE_STATUS,
  COMPLAINT_REGISTRATION_STATUS,
  FOLLOW_UP_STATE,
  FOLLOW_UP_STATUS,
  HEARING_STATUS,
  ISSUE_CATEGORIES,
  RESOLUTION_STATUS,
  UP_HEARING_EVENT_TYPES,
  VERIFICATION_STATUS,
  UpJanSunwaiStore,
  buildAttachmentIndex,
  buildPreparationChecklist,
  buildPreparationPack,
  buildPreparationPackHtml,
  buildPreparationPackText,
  decorateEvent,
  generateHearingNote,
  getDistricts,
  getEventById,
  getEventDateStatus,
  getEventFreshness,
  getFollowUpState,
  isEventExpired,
  listUpcomingEvents,
  queryEvents,
  upJanSunwaiStore,
  validateOfficialEventSource,
} from './upJanSunwaiService';
import {
  UP_JAN_SUNWAI_EVENTS,
  UP_UNVERIFIED_EVENT_SUBMISSIONS,
} from '../data/upJanSunwaiEvents';

describe('upJanSunwaiService source validation', () => {
  it('accepts the seeded official listings with a dated government source', () => {
    UP_JAN_SUNWAI_EVENTS.forEach((event) => {
      const res = validateOfficialEventSource(event, '2026-11-19');
      expect(res.isValid).toBe(true);
      expect(res.isOfficial).toBe(true);
      expect(res.errors).toHaveLength(0);
      expect(res.sourceHost).toMatch(/\.(gov|nic)\.in$/);
    });
  });

  it('rejects missing, insecure, and non-government official source URLs', () => {
    const invalidUrl = {
      ...UP_JAN_SUNWAI_EVENTS[0],
      officialSource: { name: 'Portal', url: 'http://lucknow.nic.in/' },
    };
    expect(validateOfficialEventSource(invalidUrl).isValid).toBe(false);

    const nonGovUrl = {
      ...UP_JAN_SUNWAI_EVENTS[0],
      officialSource: { name: 'Portal', url: 'https://news.example.com/jan-sunwai' },
    };
    expect(validateOfficialEventSource(nonGovUrl).isValid).toBe(false);

    const missingUrl = {
      ...UP_JAN_SUNWAI_EVENTS[0],
      officialSource: { name: 'Portal', url: '' },
    };
    expect(validateOfficialEventSource(missingUrl).isValid).toBe(false);
  });

  it('rejects incomplete eligibility, venue, and registration details', () => {
    const missingVenue = {
      ...UP_JAN_SUNWAI_EVENTS[0],
      venue: { name: '', address: '', mode: 'IN_PERSON' },
    };
    expect(validateOfficialEventSource(missingVenue).isValid).toBe(false);

    const missingEligibility = {
      ...UP_JAN_SUNWAI_EVENTS[0],
      eligibility: [],
    };
    expect(validateOfficialEventSource(missingEligibility).isValid).toBe(false);

    const missingRegistration = {
      ...UP_JAN_SUNWAI_EVENTS[0],
      registration: { instructions: '' },
    };
    expect(validateOfficialEventSource(missingRegistration).isValid).toBe(false);
  });

  it('flags a future last-verified date and an unverified record', () => {
    const futureDate = {
      ...UP_JAN_SUNWAI_EVENTS[0],
      lastVerifiedDate: '2026-12-30',
    };
    const resFuture = validateOfficialEventSource(futureDate, '2026-11-19');
    expect(resFuture.isValid).toBe(false);
    expect(resFuture.errors.some((e) => e.includes('future'))).toBe(true);

    const unverifiedRecord = {
      ...UP_JAN_SUNWAI_EVENTS[0],
      verificationStatus: VERIFICATION_STATUS.PENDING_VERIFICATION,
    };
    const resUnverified = validateOfficialEventSource(unverifiedRecord, '2026-11-19');
    expect(resUnverified.isValid).toBe(false);
    expect(resUnverified.isOfficial).toBe(false);
  });

  it('marks old source checks as stale without silently upgrading data', () => {
    const staleEvent = {
      ...UP_JAN_SUNWAI_EVENTS[0],
      lastVerifiedDate: '2026-09-01',
    };
    const freshness = getEventFreshness(staleEvent, '2026-11-19');
    expect(freshness.isStale).toBe(true);
    expect(freshness.tier).toBe('stale');
    expect(freshness.daysSinceVerified).toBeGreaterThan(45);
  });
});

describe('upJanSunwaiService event expiry and calendar queries', () => {
  it('expires a hearing only after its date has passed', () => {
    const futureEvent = { ...UP_JAN_SUNWAI_EVENTS[0], eventDate: '2026-12-08' };
    expect(isEventExpired(futureEvent, '2026-11-19')).toBe(false);
    expect(getEventDateStatus(futureEvent, '2026-11-19')).toBe(HEARING_STATUS.UPCOMING);

    const todayEvent = { ...UP_JAN_SUNWAI_EVENTS[0], eventDate: '2026-11-19' };
    expect(getEventDateStatus(todayEvent, '2026-11-19')).toBe(HEARING_STATUS.TODAY);
    expect(isEventExpired(todayEvent, '2026-11-19')).toBe(false);

    const pastEvent = { ...UP_JAN_SUNWAI_EVENTS[0], eventDate: '2026-10-15' };
    expect(isEventExpired(pastEvent, '2026-11-19')).toBe(true);
    expect(getEventDateStatus(pastEvent, '2026-11-19')).toBe(HEARING_STATUS.EXPIRED);
  });

  it('keeps expired events out of the default listing and shows them in the archive query', () => {
    const store = new UpJanSunwaiStore({ persist: false });
    const upcoming = store.listEvents({ referenceDate: '2026-11-19' });
    expect(upcoming.every((e) => !e.isExpired)).toBe(true);

    const archive = store.listEvents({ includeExpired: true, referenceDate: '2026-11-19' });
    expect(archive.some((e) => e.isExpired)).toBe(true);
  });

  it('never returns an unverified community report in the official listing', () => {
    const store = new UpJanSunwaiStore({ persist: false });
    const listings = store.listEvents({ referenceDate: '2026-11-19' });
    expect(listings.some((e) => e.id === 'up-js-community-unverified-1')).toBe(false);

    const withUnverified = store.listEvents({
      includeUnverified: true,
      referenceDate: '2026-11-19',
    });
    const found = withUnverified.find((e) => e.id === 'up-js-community-unverified-1');
    expect(found).toBeDefined();
    expect(found.isOfficial).toBe(false);
    expect(found.status).toBe(HEARING_STATUS.PENDING_VERIFICATION);
  });

  it('logs newly expired events once and retains an audit trail', () => {
    const store = new UpJanSunwaiStore({ persist: false });
    const result = store.expireStaleEvents('2026-11-19');
    expect(result.expiredCount).toBeGreaterThan(0);
    expect(result.newlyExpiredCount).toBeGreaterThan(0);

    const secondRun = store.expireStaleEvents('2026-11-19');
    expect(secondRun.newlyExpiredCount).toBe(0);
  });

  it('filters by district, category, and search text without cross-district leakage', () => {
    const lucknowOnly = queryEvents(UP_JAN_SUNWAI_EVENTS, { district: 'Lucknow' });
    expect(lucknowOnly.length).toBeGreaterThan(0);
    expect(lucknowOnly.every((e) => e.jurisdiction.district === 'Lucknow')).toBe(true);

    const varanasiOnly = queryEvents(UP_JAN_SUNWAI_EVENTS, { district: 'Varanasi' });
    expect(varanasiOnly.every((e) => e.jurisdiction.district === 'Varanasi')).toBe(true);

    const searchRes = queryEvents(UP_JAN_SUNWAI_EVENTS, { searchQuery: 'Kaiserbagh' });
    expect(searchRes.length).toBe(1);
    expect(searchRes[0].jurisdiction.district).toBe('Lucknow');
  });
});

describe('upJanSunwaiService preparation and hearing notes', () => {
  it('builds the required preparation sections for an issue category', () => {
    const event = UP_JAN_SUNWAI_EVENTS[0];
    const checklist = buildPreparationChecklist(event, {
      issueCategory: 'revenue_land',
      priorComplaints: ['IGRS/2026/88129'],
    });

    expect(checklist.groups.length).toBeGreaterThanOrEqual(5);
    expect(checklist.groups.some((g) => g.id === 'facts_and_chronology')).toBe(true);
    expect(checklist.groups.some((g) => g.id === 'prior_references')).toBe(true);
    expect(checklist.groups.some((g) => g.id === 'requested_remedy')).toBe(true);
  });

  it('numbers attachments consistently and survives missing pages', () => {
    const index = buildAttachmentIndex([
      { label: 'Khatauni Extract', date: '2026-10-01', pages: 2 },
      'Mutation Challan Copy',
      { label: 'Prior Complaint Slip', pages: 'invalid' },
    ]);

    expect(index.items).toHaveLength(3);
    expect(index.items[0].id).toBe('A1');
    expect(index.items[1].id).toBe('A2');
    expect(index.items[2].id).toBe('A3');
    expect(index.items[0].pages).toBe(2);
    expect(index.items[2].pages).toBeNull();
  });

  it('generates an editable note with placeholders and no invented citations', () => {
    const event = UP_JAN_SUNWAI_EVENTS[0];
    const note = generateHearingNote({
      event,
      issueCategory: 'revenue_land',
      citizenName: 'Rameshwar Prasad',
      chronology: '2026-08-10 — Demarcation application filed at Tehsil desk',
      requestedRemedy: 'Demarcation report to be issued as per rules',
      attachments: ['Khatauni extract copy'],
    });

    expect(note.text).toContain('Rameshwar Prasad');
    expect(note.text).toContain('Demarcation application filed at Tehsil desk');
    expect(note.text).toContain('Demarcation report to be issued as per rules');
    expect(note.disclaimer).toBeDefined();
    expect(note.text).not.toContain('Section 144');
    expect(note.text).not.toContain('Article 226');
  });
});

describe('upJanSunwaiService private preparation and follow-up records', () => {
  let store;
  beforeEach(() => {
    store = new UpJanSunwaiStore({ persist: false });
  });

  it('scopes preparation drafts to the signed-in citizen', () => {
    const draft = store.savePreparationDraft('citizen_1', 'up-js-2026-12-08-lucknow', {
      citizenName: 'Citizen One',
      chronology: 'Facts from citizen 1',
    });

    expect(draft.ownerId).toBe('citizen_1');
    expect(store.getPreparationDraft('citizen_1', 'up-js-2026-12-08-lucknow')).toBeDefined();
    expect(store.getPreparationDraft('citizen_2', 'up-js-2026-12-08-lucknow')).toBeNull();
  });

  it('records attendance and acknowledgement privately without exposing them to another citizen', () => {
    const rec = store.recordFollowUp('citizen_1', 'up-js-2026-12-08-lucknow', {
      attendanceStatus: ATTENDANCE_STATUS.ATTENDED,
      acknowledgementType: ACKNOWLEDGEMENT_TYPE.HEARING_SLIP,
      acknowledgementNumber: 'SLIP-902',
    });

    expect(rec.ownerId).toBe('citizen_1');
    expect(store.listFollowUpRecords('citizen_1')).toHaveLength(1);
    expect(store.listFollowUpRecords('citizen_2')).toHaveLength(0);
    expect(() => store.getFollowUpRecord(rec.id, 'citizen_2')).toThrow(/Access Denied/);
  });

  it('keeps attendance separate from complaint registration and resolution', () => {
    const rec = store.recordFollowUp('citizen_1', 'up-js-2026-12-08-lucknow', {
      attendanceStatus: ATTENDANCE_STATUS.ATTENDED,
      acknowledgementType: ACKNOWLEDGEMENT_TYPE.HEARING_SLIP,
    });

    expect(rec.attendanceStatus).toBe(ATTENDANCE_STATUS.ATTENDED);
    expect(rec.complaintRegistrationStatus).toBe(COMPLAINT_REGISTRATION_STATUS.NOT_RECORDED);
    expect(rec.resolutionStatus).toBe(RESOLUTION_STATUS.NOT_CONFIRMED);
    expect(rec.followUpStatus).toBe(FOLLOW_UP_STATUS.ATTENDED_AWAITING_ACKNOWLEDGEMENT);
  });

  it('refuses to mark a complaint registered without a written acknowledgement type', () => {
    expect(() =>
      store.recordFollowUp('citizen_1', 'up-js-2026-12-08-lucknow', {
        attendanceStatus: ATTENDANCE_STATUS.ATTENDED,
        acknowledgementType: ACKNOWLEDGEMENT_TYPE.NONE,
        complaintRegistrationStatus: COMPLAINT_REGISTRATION_STATUS.RECORDED,
      }),
    ).toThrow(/without a complaint acknowledgement type/);
  });

  it('requires an explicit written reference and date before confirming resolution', () => {
    const rec = store.recordFollowUp('citizen_1', 'up-js-2026-12-08-lucknow', {
      attendanceStatus: ATTENDANCE_STATUS.ATTENDED,
      acknowledgementType: ACKNOWLEDGEMENT_TYPE.COMPLAINT_NUMBER,
      acknowledgementNumber: 'IGRS-991',
    });

    expect(() =>
      store.recordResolution(rec.id, 'citizen_1', {
        resolutionReference: '',
        resolvedDate: '2026-11-19',
      }),
    ).toThrow(/written resolution reference is required/);

    expect(() =>
      store.recordResolution(rec.id, 'citizen_1', {
        resolutionReference: 'ORDER/REV/2026/102',
        resolvedDate: 'invalid-date',
      }),
    ).toThrow(/valid resolution date is required/);

    const resolved = store.recordResolution(rec.id, 'citizen_1', {
      resolutionReference: 'ORDER/REV/2026/102',
      resolvedDate: '2026-11-19',
    });
    expect(resolved.resolutionStatus).toBe(RESOLUTION_STATUS.RESOLVED_CONFIRMED);
    expect(resolved.followUpStatus).toBe(FOLLOW_UP_STATUS.RESOLVED_CONFIRMED);
  });

  it('supports missed hearings and updates without inventing a resolution', () => {
    const rec = store.recordFollowUp('citizen_1', 'up-js-2026-12-08-lucknow', {
      attendanceStatus: ATTENDANCE_STATUS.NOT_ATTENDED,
    });
    expect(rec.followUpStatus).toBe(FOLLOW_UP_STATUS.MISSED_HEARING);
    expect(rec.resolutionStatus).toBe(RESOLUTION_STATUS.NOT_CONFIRMED);
  });

  it('derives follow-up date states for overdue, today, soon, upcoming, and completed', () => {
    const ref = '2026-11-19';
    expect(getFollowUpState({ followUpDate: '2026-11-10' }, ref).state).toBe(FOLLOW_UP_STATE.OVERDUE);
    expect(getFollowUpState({ followUpDate: '2026-11-19' }, ref).state).toBe(FOLLOW_UP_STATE.DUE_TODAY);
    expect(getFollowUpState({ followUpDate: '2026-11-22' }, ref).state).toBe(FOLLOW_UP_STATE.DUE_SOON);
    expect(getFollowUpState({ followUpDate: '2026-12-10' }, ref).state).toBe(FOLLOW_UP_STATE.UPCOMING);
    expect(
      getFollowUpState({ followUpStatus: FOLLOW_UP_STATUS.RESOLVED_CONFIRMED }, ref).state,
    ).toBe(FOLLOW_UP_STATE.COMPLETED);
  });

  it('builds a private follow-up summary only from the owner records', () => {
    store.recordFollowUp('citizen_1', 'up-js-2026-12-08-lucknow', {
      attendanceStatus: ATTENDANCE_STATUS.ATTENDED,
      acknowledgementType: ACKNOWLEDGEMENT_TYPE.HEARING_SLIP,
      followUpDate: '2026-11-20',
    });

    const summary = store.getFollowUpSummary('citizen_1', { referenceDate: '2026-11-19' });
    expect(summary.total).toBe(1);
    expect(summary.counts[FOLLOW_UP_STATE.DUE_SOON]).toBe(1);

    const summaryOther = store.getFollowUpSummary('citizen_2');
    expect(summaryOther.total).toBe(0);
  });
});

describe('upJanSunwaiService source correction workflow', () => {
  let store;
  beforeEach(() => {
    store = new UpJanSunwaiStore({ persist: false });
  });

  it('validates correction fields, reasons, and government source URLs', () => {
    expect(() =>
      store.submitSourceCorrection('citizen_1', 'up-js-2026-12-08-lucknow', {
        field: 'unsupported_field',
        proposedValue: 'Test',
        reason: 'Reason description is long enough',
      }),
    ).toThrow(/Unsupported correction field/);

    expect(() =>
      store.submitSourceCorrection('citizen_1', 'up-js-2026-12-08-lucknow', {
        field: 'officialSourceUrl',
        proposedValue: 'https://news.com/notice',
        reason: 'Updated notice URL',
      }),
    ).toThrow(/official source must be an https:\/\/ \*\.gov\.in or \*\.nic\.in URL/);
  });

  it('queues a correction and requires an editor to accept it', () => {
    const correction = store.submitSourceCorrection('citizen_1', 'up-js-2026-12-08-lucknow', {
      field: 'startTime',
      proposedValue: '11:00',
      reason: 'Notice states time changed to 11:00 AM',
    });

    expect(correction.status).toBe('PENDING_REVIEW');
    expect(store.listSourceCorrections()).toHaveLength(1);

    expect(() =>
      store.reviewSourceCorrection(correction.id, {
        reviewerRole: 'CITIZEN',
        decision: 'ACCEPT',
      }),
    ).toThrow(/editor role is required/);

    const result = store.reviewSourceCorrection(correction.id, {
      reviewerRole: 'EDITOR',
      reviewerId: 'editor_1',
      decision: 'ACCEPT',
    });

    expect(result.correction.status).toBe('ACCEPTED');
    expect(result.event.startTime).toBe('11:00');
  });

  it('marks a correction rejected without altering the event', () => {
    const correction = store.submitSourceCorrection('citizen_1', 'up-js-2026-12-08-lucknow', {
      field: 'startTime',
      proposedValue: '08:00',
      reason: 'Heard rumors it starts early',
    });

    const result = store.reviewSourceCorrection(correction.id, {
      reviewerRole: 'ADMIN',
      decision: 'REJECT',
      note: 'Not verified on district portal',
    });

    expect(result.correction.status).toBe('REJECTED');
    expect(result.event.startTime).toBe('10:30');
  });
});

describe('upJanSunwaiService printable pack', () => {
  it('excludes private follow-up details unless explicitly included', () => {
    const event = UP_JAN_SUNWAI_EVENTS[0];
    const pack = buildPreparationPack({
      event,
      issueCategory: 'revenue_land',
      citizenName: 'Ramesh',
      followUpRecord: {
        attendanceStatus: ATTENDANCE_STATUS.ATTENDED,
        acknowledgementNumber: 'SECRET-999',
      },
      includePrivateDetails: false,
    });

    expect(pack.includePrivateDetails).toBe(false);
    expect(pack.followUpRecord).toBeNull();

    const html = buildPreparationPackHtml(pack);
    expect(html).not.toContain('SECRET-999');
  });

  it('escapes citizen-provided text in printable HTML and includes source metadata', () => {
    const event = UP_JAN_SUNWAI_EVENTS[0];
    const pack = buildPreparationPack({
      event,
      citizenName: '<script>alert("xss")</script>',
      requestedRemedy: 'Remedy with <tags> & "quotes"',
      includePrivateDetails: true,
      followUpRecord: {
        attendanceStatus: ATTENDANCE_STATUS.ATTENDED,
        acknowledgementNumber: 'SLIP<123>',
      },
    });

    const html = buildPreparationPackHtml(pack);
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;tags&gt;');
    expect(html).toContain(event.officialSource.url);
  });

  it('produces a plain-text pack with disclaimers and the official source', () => {
    const event = UP_JAN_SUNWAI_EVENTS[0];
    const pack = buildPreparationPack({
      event,
      citizenName: 'Suresh Kumar',
      requestedRemedy: 'Status report',
    });

    const textPack = buildPreparationPackText(pack);
    expect(textPack).toContain('UP PUBLIC HEARING PREPARATION PACK');
    expect(textPack).toContain(event.officialSource.url);
    expect(textPack).toContain('DISCLAIMER:');
    expect(textPack).toContain('NOTICE:');
  });
});
