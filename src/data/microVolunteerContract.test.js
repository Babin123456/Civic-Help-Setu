import { describe, it, expect } from 'vitest';
import {
  CLAIM_STATUS,
  COMPLETION_STATUS,
  MICRO_VOLUNTEER_LIMITS,
  MICRO_VOLUNTEER_RULESET_VERSION,
  MODERATION_ACTIONS,
  RECOMMENDATION_STATUS,
  TASK_STATUS,
  TASK_TRANSITIONS,
  buildTaskRecommendations,
  canTransition,
  findPersonalData,
  findProhibitedTaskContent,
  isSafeHttpsUrl,
  isTaskAcceptingClaims,
  validateEvidenceInput,
  validateModerationInput,
  validatePagination,
  validatePreferenceInput,
  validateTaskInput,
} from './microVolunteerContract.js';

const NOW = new Date('2026-11-20T10:00:00.000Z');

const validTask = (overrides = {}) => ({
  categoryId: 'link_check',
  title: 'Check the ward holiday list link',
  instructions:
    'Open the public holiday-list link from the ward notice board and confirm the page title and year.',
  jurisdictionId: 'WARD-042',
  locality: 'Indiranagar',
  timeEstimateMinutes: 10,
  dueDate: '2026-12-04',
  capacity: 1,
  evidenceRequirements: ['The public link you checked', 'The page title and any error message'],
  safetyAcknowledgements: {
    no_private_data: true,
    no_enforcement: true,
    no_unsafe_activity: true,
    separate_from_official_application: true,
  },
  ...overrides,
});

const fieldsFor = (errors) => errors.map((error) => error.field);

describe('microVolunteerContract (#759)', () => {
  it('accepts a valid low-risk task and rejects every missing safety acknowledgement', () => {
    expect(validateTaskInput(validTask(), { now: NOW })).toEqual([]);

    const errors = validateTaskInput(
      validTask({ safetyAcknowledgements: { no_private_data: true } }),
      { now: NOW }
    );
    expect(fieldsFor(errors)).toEqual(
      expect.arrayContaining([
        'safetyAcknowledgements.no_enforcement',
        'safetyAcknowledgements.no_unsafe_activity',
        'safetyAcknowledgements.separate_from_official_application',
      ])
    );
  });

  it('rejects unsafe, private-data and out-of-range task fields', () => {
    const errors = validateTaskInput(
      validTask({
        title: 'Collect Aadhaar numbers from every resident',
        instructions:
          'Climb the ladder and enforce the eviction while collecting phone numbers and home addresses.',
        jurisdictionId: 'not a ward!',
        locality: '',
        timeEstimateMinutes: 500,
        dueDate: '2026-01-01',
        capacity: 99,
        evidenceRequirements: [],
        exactAddress: '12 Main Road',
      }),
      { now: NOW }
    );
    const fields = fieldsFor(errors);
    expect(fields).toEqual(
      expect.arrayContaining([
        'instructions',
        'jurisdictionId',
        'locality',
        'timeEstimateMinutes',
        'dueDate',
        'capacity',
        'evidenceRequirements',
      ])
    );
    expect(errors.some((error) => error.message.includes('identity documents'))).toBe(true);
    expect(errors.some((error) => error.message.includes('enforce a rule'))).toBe(true);
    expect(errors.some((error) => error.message.includes('unsafe physical activity'))).toBe(true);
  });

  it('detects personal data and prohibited task content in free text', () => {
    const findings = findPersonalData(
      'Email me at resident@example.org or call 98765 43210. Aadhaar 1234 5678 9012, PAN ABCDE1234F, OTP 123456, flat no. 12B, coordinates 12.9716, 77.5946.'
    );
    expect(findings).toEqual(
      expect.arrayContaining([
        'an email address',
        'a personal phone number',
        'an Aadhaar number',
        'a PAN number',
        'a password, OTP or access token',
        'an exact flat, door or house number',
        'exact decimal coordinates',
      ])
    );

    const prohibited = findProhibitedTaskContent(
      'Collect voter identity documents, enforce the eviction, and climb a ladder onto the roof.'
    );
    expect(prohibited.map((item) => item.id)).toEqual(
      expect.arrayContaining(['private_data', 'enforcement', 'unsafe_physical'])
    );
  });

  it('only accepts public https links for evidence', () => {
    expect(isSafeHttpsUrl('https://example.gov.in/notice')).toBe(true);
    expect(isSafeHttpsUrl('http://example.gov.in/notice')).toBe(false);
    expect(isSafeHttpsUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeHttpsUrl('https://user:pass@example.gov.in/notice')).toBe(false);
    expect(isSafeHttpsUrl('https://localhost/notice')).toBe(false);
    expect(isSafeHttpsUrl('https://127.0.0.1/notice')).toBe(false);
  });

  it('validates evidence notes, links and file metadata without accepting file contents', () => {
    expect(
      validateEvidenceInput({
        note: 'I opened the public link and confirmed the page title and year.',
        link: 'https://example.gov.in/notice',
        files: [
          {
            name: 'notice.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 1200,
            sha256: 'a'.repeat(64),
          },
        ],
      })
    ).toEqual([]);

    const errors = validateEvidenceInput({
      note: 'short',
      link: 'http://example.gov.in/notice',
      files: [
        {
          name: 'notice.exe',
          mimeType: 'application/x-msdownload',
          sizeBytes: MICRO_VOLUNTEER_LIMITS.MAX_EVIDENCE_FILE_BYTES + 1,
          data: 'base64-content',
        },
      ],
    });
    const fields = fieldsFor(errors);
    expect(fields).toEqual(
      expect.arrayContaining([
        'note',
        'link',
        'evidenceFiles[0].mimeType',
        'evidenceFiles[0].sizeBytes',
        'evidenceFiles[0]',
      ])
    );
  });

  it('requires a reason for rejections and requests for changes', () => {
    expect(
      validateModerationInput({
        decision: MODERATION_ACTIONS.REJECT,
        reason: 'The linked page is for another ward.',
      })
    ).toEqual([]);
    expect(
      fieldsFor(validateModerationInput({ decision: MODERATION_ACTIONS.REJECT, reason: '' }))
    ).toContain('reason');
    expect(
      validateModerationInput({
        decision: MODERATION_ACTIONS.APPROVE,
        reason: '',
        publicOutcomeNote: 'The public link is current.',
      })
    ).toEqual([]);
  });

  it('bounds pagination and suggestion preferences', () => {
    expect(validatePagination({ page: 0, pageSize: 999 })).toEqual({
      page: 1,
      pageSize: MICRO_VOLUNTEER_LIMITS.MAX_PAGE_SIZE,
    });
    expect(validatePagination({ page: 3, pageSize: 5 })).toEqual({ page: 3, pageSize: 5 });
    expect(
      fieldsFor(validatePreferenceInput({ categoryIds: ['not-a-category'], availableMinutes: 2 }))
    ).toEqual(expect.arrayContaining(['categoryIds', 'availableMinutes']));
  });

  it('enforces the documented task and claim state machines', () => {
    expect(canTransition(TASK_TRANSITIONS, TASK_STATUS.OPEN, TASK_STATUS.ASSIGNED)).toBe(true);
    expect(canTransition(TASK_TRANSITIONS, TASK_STATUS.DRAFT, TASK_STATUS.COMPLETED)).toBe(false);
    expect(canTransition(TASK_TRANSITIONS, TASK_STATUS.ARCHIVED, TASK_STATUS.OPEN)).toBe(false);
    expect(
      isTaskAcceptingClaims({ status: TASK_STATUS.OPEN, dueDate: '2026-12-04' }, { now: NOW })
    ).toBe(true);
    expect(
      isTaskAcceptingClaims({ status: TASK_STATUS.COMPLETED, dueDate: '2026-12-04' }, { now: NOW })
    ).toBe(false);
    expect(
      isTaskAcceptingClaims({ status: TASK_STATUS.OPEN, dueDate: '2026-11-01' }, { now: NOW })
    ).toBe(false);
  });

  it('builds deterministic, explainable suggestions without a volunteer ranking', () => {
    const tasks = [
      {
        id: 't1',
        publicRef: 'MVT-2026-001',
        title: 'Check the ward link',
        categoryId: 'link_check',
        jurisdictionId: 'WARD-042',
        timeEstimateMinutes: 10,
        dueDate: '2026-11-25',
        status: TASK_STATUS.OPEN,
      },
      {
        id: 't2',
        publicRef: 'MVT-2026-002',
        title: 'Translate a notice',
        categoryId: 'notice_translation',
        jurisdictionId: 'WARD-084',
        timeEstimateMinutes: 40,
        dueDate: '2026-12-10',
        status: TASK_STATUS.OPEN,
      },
    ];
    const preferences = {
      categoryIds: ['link_check'],
      jurisdictionId: 'WARD-042',
      availableMinutes: 15,
    };
    const first = buildTaskRecommendations(tasks, preferences, { now: NOW });
    const second = buildTaskRecommendations(tasks, preferences, { now: NOW });

    expect(first.rulesetVersion).toBe(MICRO_VOLUNTEER_RULESET_VERSION);
    expect(first.generatedAt).toBe(NOW.toISOString());
    expect(first.inputWindow).toMatchObject({
      evaluatedAt: NOW.toISOString(),
      dueOnOrAfter: '2026-11-20',
      categoryIds: ['link_check'],
      jurisdictionId: 'WARD-042',
      availableMinutes: 15,
    });
    expect(first.recommendations.map((item) => item.taskPublicRef)).toEqual(
      second.recommendations.map((item) => item.taskPublicRef)
    );
    expect(first.recommendations[0].reasons.map((reason) => reason.code)).toEqual(
      expect.arrayContaining(['category_match', 'same_jurisdiction', 'fits_time', 'due_soon'])
    );
    expect(first.recommendations[0].statusOfSuggestion).toBe(RECOMMENDATION_STATUS.PENDING);
    expect(first).not.toHaveProperty('volunteerScore');
    expect(first).not.toHaveProperty('ranking');
  });

  it('keeps claim and completion status values explicit', () => {
    expect(CLAIM_STATUS.ACTIVE).toBe('active');
    expect(COMPLETION_STATUS.SUBMITTED).toBe('submitted');
    expect(Object.values(CLAIM_STATUS)).toEqual(expect.arrayContaining(['changes_requested', 'reopened']));
    expect(Object.values(COMPLETION_STATUS)).toEqual(
      expect.arrayContaining(['under_review', 'changes_requested', 'reopened'])
    );
  });
});
