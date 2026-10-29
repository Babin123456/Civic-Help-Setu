import { requirePermission } from './accessControl';
/**
 * Civic Service Process Bottleneck Feedback Service
 * 
 * Collects structured, non-blocking citizen feedback regarding journey friction points
 * (unclear instructions, missing documents, broken links, accessibility barriers).
 * 
 * Guarantees:
 * - Strictly non-complaint: Clearly disclaims that feedback improves platform guides, not a government grievance
 * - PII avoidance & automated redaction (scrubs Aadhaar, PAN, phone numbers, emails, case reference codes)
 * - Safe aggregation: Aggregated views expose categorical counts and friction averages, withholding free text by default
 * - Admin moderation: Tracks status (pending, reviewed, addressed, dismissed) with audit notes
 */

const STORAGE_KEY = 'civicbridge_bottleneck_feedback_v1';

export const PLATFORM_FEEDBACK_DISCLAIMER =
  'This is anonymous platform improvement feedback for Civic Help Setu guide authors. It is NOT an official government grievance, police complaint, or administrative RTI inquiry. Please do NOT include case numbers, bank details, Aadhaar, or phone numbers.';

export const FEEDBACK_CATEGORIES = [
  { id: 'unclear_instructions', label: 'Unclear Instructions / Terminology' },
  { id: 'missing_information', label: 'Missing Document / Fee Info' },
  { id: 'broken_link', label: 'Broken / Expired Official Link' },
  { id: 'accessibility', label: 'Accessibility / Readability Barrier' },
  { id: 'other', label: 'Other Guide Friction' },
];

export const FEEDBACK_STATUSES = {
  PENDING: 'pending',
  REVIEWED: 'reviewed',
  ADDRESSED: 'addressed',
  DISMISSED: 'dismissed',
};

const DEFAULT_FEEDBACK = [
  {
    id: 'bf_seed_01',
    serviceId: 'driving-licence',
    serviceName: 'Driving Licence',
    stepIndex: 2,
    stepTitle: 'Upload Medical Certificate Form 1A',
    category: 'missing_information',
    rating: 4,
    notes: 'The guide did not specify that doctor seal must include registration number of medical practitioner.',
    piiDetected: false,
    status: FEEDBACK_STATUSES.REVIEWED,
    adminNotes: 'Updated Step 2 document checklist to clarify mandatory practitioner registration number requirement.',
    reviewedBy: 'Moderator Anita',
    reviewedAt: '2026-02-10T12:00:00.000Z',
    createdAt: '2026-02-08T15:20:00.000Z',
    feedbackType: 'platform_improvement',
  },
  {
    id: 'bf_seed_02',
    serviceId: 'income-certificate',
    serviceName: 'Income Certificate',
    stepIndex: 1,
    stepTitle: 'Gather Salary Slips & Affidavit',
    category: 'unclear_instructions',
    rating: 3,
    notes: 'Confusing instructions about self-employed applicants who do not have formal employer salary slips.',
    piiDetected: false,
    status: FEEDBACK_STATUSES.PENDING,
    adminNotes: '',
    reviewedBy: null,
    reviewedAt: null,
    createdAt: '2026-02-14T09:45:00.000Z',
    feedbackType: 'platform_improvement',
  },
  {
    id: 'bf_seed_03',
    serviceId: 'driving-licence',
    serviceName: 'Driving Licence',
    stepIndex: 4,
    stepTitle: 'Book Slot at RTO Testing Track',
    category: 'broken_link',
    rating: 5,
    notes: 'State slot booking portal redirect was pointing to older parivahan endpoint.',
    piiDetected: false,
    status: FEEDBACK_STATUSES.ADDRESSED,
    adminNotes: 'Replaced URL with Sarathi Parivahan slot-booking portal.',
    reviewedBy: 'Admin Dev',
    reviewedAt: '2026-02-12T16:30:00.000Z',
    createdAt: '2026-02-11T11:10:00.000Z',
    feedbackType: 'platform_improvement',
  },
  {
    id: 'bf_seed_04',
    serviceId: 'ration-card',
    serviceName: 'Ration Card',
    stepIndex: 3,
    stepTitle: 'Physical Verification by Food Inspector',
    category: 'accessibility',
    rating: 4,
    notes: 'High contrast text missing in table layout on mobile screen.',
    piiDetected: false,
    status: FEEDBACK_STATUSES.PENDING,
    adminNotes: '',
    reviewedBy: null,
    reviewedAt: null,
    createdAt: '2026-02-16T14:10:00.000Z',
    feedbackType: 'platform_improvement',
  },
];

/**
 * Local storage abstraction
 */
const getStorage = (customStorage) => {
  if (customStorage) return customStorage;
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return null;
};

/**
 * PII Scrubber
 * Automatically masks 12-digit Aadhaar, 10-digit PAN, 10-digit phone, emails, and grievance case IDs.
 */
export const scrubPII = (input) => {
  if (!input || typeof input !== 'string') return { text: '', piiDetected: false };

  let text = input;
  let piiDetected = false;

  // 1. Email pattern
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  if (emailRegex.test(text)) {
    text = text.replace(emailRegex, '[EMAIL_REDACTED]');
    piiDetected = true;
  }

  // 2. 12-digit Aadhaar (continuous or spaced 4-4-4)
  const aadhaarRegex = /\b\d{4}[ -]?\d{4}[ -]?\d{4}\b/g;
  if (aadhaarRegex.test(text)) {
    text = text.replace(aadhaarRegex, '[AADHAAR_REDACTED]');
    piiDetected = true;
  }

  // 3. 10-character PAN card format (5 uppercase letters, 4 digits, 1 letter)
  const panRegex = /\b[A-Za-z]{5}\d{4}[A-Za-z]\b/g;
  if (panRegex.test(text)) {
    text = text.replace(panRegex, '[PAN_REDACTED]');
    piiDetected = true;
  }

  // 4. 10-digit Indian phone number
  const phoneRegex = /\b[6-9]\d{9}\b/g;
  if (phoneRegex.test(text)) {
    text = text.replace(phoneRegex, '[PHONE_REDACTED]');
    piiDetected = true;
  }

  // 5. Case / Application / Token ID patterns (e.g. APP-123456, CASE#98765, GRV/2026/001)
  const caseRegex = /\b(APP|CASE|GRV|COMPLAINT|REF|TICKET)[-_/#:]?\d{4,}\b/gi;
  if (caseRegex.test(text)) {
    text = text.replace(caseRegex, '[CASE_ID_REDACTED]');
    piiDetected = true;
  }

  return { text, piiDetected };
};

/**
 * Fetches all feedback entries from storage
 */
export const getAllFeedback = (customStorage) => {
  const storage = getStorage(customStorage);
  if (!storage) return [...DEFAULT_FEEDBACK];

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) {
      storage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_FEEDBACK));
      return [...DEFAULT_FEEDBACK];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [...DEFAULT_FEEDBACK];
  } catch {
    return [...DEFAULT_FEEDBACK];
  }
};

/**
 * Saves feedback list to storage
 */
export const saveFeedback = (list, customStorage) => {
  const storage = getStorage(customStorage);
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
};

/**
 * Validates feedback input before submission
 */
export const validateFeedbackInput = (data) => {
  const errors = [];

  if (!data || typeof data !== 'object') {
    errors.push('Feedback data must be provided.');
    return { isValid: false, errors };
  }

  if (!data.serviceId || typeof data.serviceId !== 'string') {
    errors.push('Service ID is mandatory.');
  }

  const validCategoryIds = FEEDBACK_CATEGORIES.map((c) => c.id);
  if (!data.category || !validCategoryIds.includes(data.category)) {
    errors.push(
      `Category must be one of: ${validCategoryIds.join(', ')}`
    );
  }

  const rating = Number(data.rating);
  if (isNaN(rating) || rating < 1 || rating > 5) {
    errors.push('Friction rating must be an integer between 1 (minor) and 5 (severe roadblock).');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Submits optional bottleneck feedback
 */
export const submitBottleneckFeedback = (data, customStorage) => {
  const validation = validateFeedbackInput(data);
  if (!validation.isValid) {
    throw new Error(validation.errors.join(' '));
  }

  const { text: cleanNotes, piiDetected } = scrubPII(data.notes || '');

  const newEntry = {
    id: `bf_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    serviceId: data.serviceId,
    serviceName: data.serviceName || data.serviceId,
    stepIndex: typeof data.stepIndex === 'number' ? data.stepIndex : null,
    stepTitle: data.stepTitle ? String(data.stepTitle).trim() : null,
    category: data.category,
    rating: Math.round(Number(data.rating)),
    notes: cleanNotes,
    piiDetected,
    status: FEEDBACK_STATUSES.PENDING,
    adminNotes: '',
    reviewedBy: null,
    reviewedAt: null,
    createdAt: new Date().toISOString(),
    feedbackType: 'platform_improvement',
  };

  const list = getAllFeedback(customStorage);
  list.unshift(newEntry);
  saveFeedback(list, customStorage);
  return newEntry;
};

/**
 * Aggregates friction metrics without exposing individual free-text reports
 */
export const getAggregateFrictionMetrics = (customStorage, filterServiceId = null) => {
  let list = getAllFeedback(customStorage);

  if (filterServiceId && filterServiceId !== 'all') {
    list = list.filter((f) => f.serviceId === filterServiceId);
  }

  const totalReports = list.length;
  if (totalReports === 0) {
    return {
      totalReports: 0,
      averageFrictionScore: 0,
      categoryCounts: FEEDBACK_CATEGORIES.reduce((acc, cat) => ({ ...acc, [cat.id]: 0 }), {}),
      stepBreakdown: [],
      severityDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      pendingCount: 0,
      reviewedCount: 0,
    };
  }

  // Category counts
  const categoryCounts = FEEDBACK_CATEGORIES.reduce((acc, cat) => {
    acc[cat.id] = list.filter((f) => f.category === cat.id).length;
    return acc;
  }, {});

  // Severity rating counts & avg
  const severityDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sumScore = 0;
  list.forEach((f) => {
    const r = f.rating || 3;
    if (severityDistribution[r] !== undefined) {
      severityDistribution[r] += 1;
    }
    sumScore += r;
  });
  const averageFrictionScore = Number((sumScore / totalReports).toFixed(1));

  // Friction by step
  const stepMap = new Map();
  list.forEach((f) => {
    if (f.stepTitle || typeof f.stepIndex === 'number') {
      const stepKey = f.stepTitle || `Step ${(f.stepIndex || 0) + 1}`;
      const existing = stepMap.get(stepKey) || { step: stepKey, count: 0, totalScore: 0 };
      existing.count += 1;
      existing.totalScore += f.rating || 3;
      stepMap.set(stepKey, existing);
    }
  });

  const stepBreakdown = Array.from(stepMap.values())
    .map((s) => ({
      step: s.step,
      count: s.count,
      averageFriction: Number((s.totalScore / s.count).toFixed(1)),
    }))
    .sort((a, b) => b.count - a.count);

  const pendingCount = list.filter((f) => f.status === FEEDBACK_STATUSES.PENDING).length;
  const reviewedCount = list.filter((f) => f.status !== FEEDBACK_STATUSES.PENDING).length;

  return {
    totalReports,
    averageFrictionScore,
    categoryCounts,
    stepBreakdown,
    severityDistribution,
    pendingCount,
    reviewedCount,
  };
};

/**
 * Admin action: Marks feedback entry as reviewed / addressed with moderator notes
 */
export const reviewBottleneckFeedback = (
  id,
  newStatus = FEEDBACK_STATUSES.REVIEWED,
  reviewer = 'Moderator',
  adminNotes = '',
  customStorage
) => {
  requirePermission('feedback.moderate');
  const list = getAllFeedback(customStorage);
  const index = list.findIndex((f) => f.id === id);
  if (index === -1) {
    throw new Error(`Feedback item with ID "${id}" not found.`);
  }

  list[index] = {
    ...list[index],
    status: newStatus,
    adminNotes: (adminNotes || '').trim(),
    reviewedBy: reviewer,
    reviewedAt: new Date().toISOString(),
  };

  saveFeedback(list, customStorage);
  return list[index];
};

/**
 * Queries feedback list with moderation filters
 */
export const queryFeedbackForModeration = (customStorage, options = {}) => {
  requirePermission('feedback.moderate');
  const { status, category, serviceId, searchQuery } = options;
  let list = getAllFeedback(customStorage);

  if (status && status !== 'all') {
    list = list.filter((f) => f.status === status);
  }

  if (category && category !== 'all') {
    list = list.filter((f) => f.category === category);
  }

  if (serviceId && serviceId !== 'all') {
    list = list.filter((f) => f.serviceId === serviceId);
  }

  if (searchQuery && searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    list = list.filter(
      (f) =>
        f.serviceName.toLowerCase().includes(q) ||
        (f.stepTitle && f.stepTitle.toLowerCase().includes(q)) ||
        (f.notes && f.notes.toLowerCase().includes(q))
    );
  }

  return list;
};

/**
 * Resets feedback to defaults
 */
export const resetFeedbackDefaults = (customStorage) => {
  requirePermission('feedback.moderate');
  const storage = getStorage(customStorage);
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_FEEDBACK));
    return true;
  } catch {
    return false;
  }
};
