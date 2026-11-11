/**
 * Public Consultation and Local Civic Hearing Calendar Service
 *
 * Implements a jurisdiction-aware calendar and public participation workspace for
 * local body meetings, public hearings, draft-policy consultations, and urban planning sabhas:
 *
 * 1. Comprehensive Participation Types:
 *    - WARD_COMMITTEE_MEETING: Ward committees and Area Sabha civic meetings.
 *    - PUBLIC_HEARING: Statutory public hearings (Environment, Tariff, Infrastructure).
 *    - DRAFT_RULE_CONSULTATION: Public comment periods for draft municipal bylaws and policies.
 *    - PLANNING_CONSULTATION: City Master Plan and zoning development consultations.
 * 2. Multi-Tiered Verification & Community Moderation:
 *    - Official gazette and authority notices are published directly as VERIFIED.
 *    - Community submissions remain in an unverified moderation queue until approved by an administrator.
 * 3. Duplicate & Conflict Detection:
 *    - Flags duplicate submissions matching the same organizer, date, and venue to prevent duplicate spam.
 * 4. Rich Search & Archival Access:
 *    - Search and filter by district, municipality, topic, and participation mode (IN_PERSON, VIRTUAL, HYBRID).
 *    - Expired/past hearings remain fully searchable in an archive for historical accountability.
 * 5. Private Preparation & Opt-In Reminders:
 *    - Allows citizens to keep private preparation notes and configure opt-in calendar reminders.
 */

export const HEARING_EVENT_TYPE = {
  WARD_COMMITTEE_MEETING: 'WARD_COMMITTEE_MEETING',
  PUBLIC_HEARING: 'PUBLIC_HEARING',
  DRAFT_RULE_CONSULTATION: 'DRAFT_RULE_CONSULTATION',
  PLANNING_CONSULTATION: 'PLANNING_CONSULTATION',
};

export const PARTICIPATION_MODE = {
  IN_PERSON: 'IN_PERSON',
  VIRTUAL: 'VIRTUAL',
  HYBRID: 'HYBRID',
  WRITTEN_SUBMISSION: 'WRITTEN_SUBMISSION',
};

export const HEARING_STATUS = {
  UPCOMING: 'UPCOMING',
  ACTIVE_CONSULTATION: 'ACTIVE_CONSULTATION',
  PENDING_MODERATION: 'PENDING_MODERATION',
  EXPIRED: 'EXPIRED',
  ARCHIVED: 'ARCHIVED',
};

export const PARTICIPATION_TOPIC = {
  SOLID_WASTE: 'SOLID_WASTE',
  URBAN_PLANNING: 'URBAN_PLANNING',
  ENVIRONMENT: 'ENVIRONMENT',
  TRANSIT_ROADS: 'TRANSIT_ROADS',
  BUDGET_FINANCE: 'BUDGET_FINANCE',
  WATER_SANITATION: 'WATER_SANITATION',
  GENERAL_CIVIC: 'GENERAL_CIVIC',
};

/**
 * Normalizes title string for duplicate comparison.
 */
function normalizeString(str = '') {
  return String(str)
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .trim();
}

/**
 * In-memory hearing calendar store.
 */
class CivicHearingStore {
  constructor() {
    this.hearings = new Map();
    this.userNotes = new Map(); // key: `${userId}_${hearingId}`
    this.userReminders = new Map(); // key: `${userId}_${hearingId}`
  }

  reset() {
    this.hearings.clear();
    this.userNotes.clear();
    this.userReminders.clear();
  }

  /**
   * Checks for duplicate or conflicting event submissions.
   */
  findDuplicateCandidate(eventData) {
    const targetDate = eventData.eventDate ? new Date(eventData.eventDate).toISOString().slice(0, 10) : null;
    const targetOrganizer = normalizeString(eventData.organizer);
    const targetTitle = normalizeString(eventData.title);

    for (const h of this.hearings.values()) {
      if (h.status === HEARING_STATUS.ARCHIVED) continue;
      const hDate = h.eventDate ? new Date(h.eventDate).toISOString().slice(0, 10) : null;
      const hOrganizer = normalizeString(h.organizer);
      const hTitle = normalizeString(h.title);

      const dateMatches = targetDate && hDate && targetDate === hDate;
      const organizerMatches = targetOrganizer && hOrganizer && targetOrganizer === hOrganizer;
      const titleMatches = targetTitle && hTitle && (hTitle.includes(targetTitle) || targetTitle.includes(hTitle));

      if (dateMatches && (organizerMatches || titleMatches)) {
        return h;
      }
    }
    return null;
  }

  /**
   * Publishes an official verified civic hearing or consultation notice.
   */
  publishOfficialHearing(data, publisherRole = 'ADMIN') {
    if (publisherRole !== 'ADMIN' && publisherRole !== 'OFFICIAL_EDITOR') {
      throw new Error('Authorization Error: Official hearings can only be published by administrators');
    }

    if (!data.title || !data.organizer || !data.officialSource) {
      throw new Error('Valid title, organizer, and officialSource are required');
    }

    const duplicate = this.findDuplicateCandidate(data);
    if (duplicate) {
      throw new Error(`Duplicate Event Detected: A similar event already exists (#${duplicate.id}: "${duplicate.title}")`);
    }

    const id = data.id || `hrg_off_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const eventDate = data.eventDate ? new Date(data.eventDate).toISOString() : null;
    const responseDeadline = data.responseDeadline ? new Date(data.responseDeadline).toISOString() : null;

    const hearing = {
      id,
      title: data.title.trim(),
      eventType: data.eventType || HEARING_EVENT_TYPE.PUBLIC_HEARING,
      organizer: data.organizer.trim(),
      jurisdiction: {
        state: data.jurisdiction?.state || 'ALL_INDIA',
        district: data.jurisdiction?.district || 'CENTRAL',
        municipality: data.jurisdiction?.municipality || 'GENERAL',
        ward: data.jurisdiction?.ward || null,
      },
      topic: data.topic || PARTICIPATION_TOPIC.GENERAL_CIVIC,
      participationMode: data.participationMode || PARTICIPATION_MODE.IN_PERSON,
      venueOrLink: data.venueOrLink ? data.venueOrLink.trim() : 'Local Municipal Hall',
      eventDate,
      responseDeadline,
      publicationDate: data.publicationDate ? new Date(data.publicationDate).toISOString() : new Date().toISOString(),
      officialSource: data.officialSource.trim(),
      officialSourceUrl: data.officialSourceUrl || null,
      instructions: data.instructions ? data.instructions.trim() : 'Carry government photo ID for participation.',
      isVerified: true,
      status: this.computeStatus(eventDate, responseDeadline),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.hearings.set(id, hearing);
    return hearing;
  }

  /**
   * Submits a community-contributed civic hearing (pending moderation).
   */
  submitCommunityHearing(data) {
    if (!data.title || !data.organizer || !data.officialSource) {
      throw new Error('Valid title, organizer, and officialSource are required');
    }

    const duplicate = this.findDuplicateCandidate(data);
    if (duplicate) {
      throw new Error(`Duplicate Event Detected: A similar event already exists (#${duplicate.id})`);
    }

    const id = `hrg_comm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const eventDate = data.eventDate ? new Date(data.eventDate).toISOString() : null;
    const responseDeadline = data.responseDeadline ? new Date(data.responseDeadline).toISOString() : null;

    const hearing = {
      id,
      title: data.title.trim(),
      eventType: data.eventType || HEARING_EVENT_TYPE.WARD_COMMITTEE_MEETING,
      organizer: data.organizer.trim(),
      jurisdiction: {
        state: data.jurisdiction?.state || 'ALL_INDIA',
        district: data.jurisdiction?.district || 'GENERAL',
        municipality: data.jurisdiction?.municipality || 'GENERAL',
        ward: data.jurisdiction?.ward || null,
      },
      topic: data.topic || PARTICIPATION_TOPIC.GENERAL_CIVIC,
      participationMode: data.participationMode || PARTICIPATION_MODE.IN_PERSON,
      venueOrLink: data.venueOrLink ? data.venueOrLink.trim() : 'Local Counter',
      eventDate,
      responseDeadline,
      publicationDate: new Date().toISOString(),
      officialSource: data.officialSource.trim(),
      officialSourceUrl: data.officialSourceUrl || null,
      instructions: data.instructions ? data.instructions.trim() : '',
      isVerified: false,
      status: HEARING_STATUS.PENDING_MODERATION,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.hearings.set(id, hearing);
    return hearing;
  }

  /**
   * Moderates a community submission into verified status or archives it.
   */
  moderateHearing(id, approved = true, notes = '', moderatorRole = 'ADMIN') {
    if (moderatorRole !== 'ADMIN') throw new Error('Authorization required');
    const existing = this.hearings.get(id);
    if (!existing) throw new Error('Hearing not found');

    if (approved) {
      existing.isVerified = true;
      existing.status = this.computeStatus(existing.eventDate, existing.responseDeadline);
      existing.moderatedBy = 'CIVIC_MODERATOR';
    } else {
      existing.status = HEARING_STATUS.ARCHIVED;
      existing.moderationNote = notes || 'Rejected by moderator';
    }
    existing.updatedAt = new Date().toISOString();
    this.hearings.set(id, existing);
    return existing;
  }

  computeStatus(eventDateStr, responseDeadlineStr) {
    const now = new Date();
    if (responseDeadlineStr) {
      const deadline = new Date(responseDeadlineStr);
      if (now > deadline) return HEARING_STATUS.EXPIRED;
      return HEARING_STATUS.ACTIVE_CONSULTATION;
    }
    if (eventDateStr) {
      const eventDate = new Date(eventDateStr);
      if (now > eventDate) return HEARING_STATUS.EXPIRED;
      return HEARING_STATUS.UPCOMING;
    }
    return HEARING_STATUS.UPCOMING;
  }

  /**
   * Search and filter hearings.
   */
  filterHearings(filters = {}) {
    const {
      state,
      district,
      municipality,
      topic,
      participationMode,
      eventType,
      includeArchived = false,
      onlyVerified = true,
    } = filters;

    const results = [];
    for (const h of this.hearings.values()) {
      if (onlyVerified && !h.isVerified) continue;
      if (!includeArchived && (h.status === HEARING_STATUS.EXPIRED || h.status === HEARING_STATUS.ARCHIVED)) {
        continue;
      }
      if (state && h.jurisdiction.state.toUpperCase() !== state.toUpperCase()) continue;
      if (district && h.jurisdiction.district.toUpperCase() !== district.toUpperCase()) continue;
      if (municipality && h.jurisdiction.municipality.toUpperCase() !== municipality.toUpperCase()) continue;
      if (topic && h.topic !== topic) continue;
      if (participationMode && h.participationMode !== participationMode) continue;
      if (eventType && h.eventType !== eventType) continue;

      results.push(h);
    }

    return results;
  }

  /**
   * Saves private personal preparation notes for an event.
   */
  saveUserPreparationNotes(userId, hearingId, notes) {
    if (!userId || !hearingId) throw new Error('Valid userId and hearingId are required');
    const key = `${userId}_${hearingId}`;
    this.userNotes.set(key, {
      notes: String(notes || '').trim(),
      updatedAt: new Date().toISOString(),
    });
    return true;
  }

  getUserPreparationNotes(userId, hearingId) {
    const key = `${userId}_${hearingId}`;
    return this.userNotes.get(key)?.notes || '';
  }

  /**
   * Sets opt-in private reminders.
   */
  setPrivateReminder(userId, hearingId, reminderConfig = {}) {
    if (!userId || !hearingId) throw new Error('Valid userId and hearingId are required');
    const key = `${userId}_${hearingId}`;
    const entry = {
      hearingId,
      userId,
      optIn: Boolean(reminderConfig.optIn),
      advanceDays: reminderConfig.advanceDays || 2,
      timezone: reminderConfig.timezone || 'Asia/Kolkata',
      createdAt: new Date().toISOString(),
    };
    this.userReminders.set(key, entry);
    return entry;
  }

  getPrivateReminder(userId, hearingId) {
    const key = `${userId}_${hearingId}`;
    return this.userReminders.get(key) || null;
  }
}

export const civicHearingStore = new CivicHearingStore();
