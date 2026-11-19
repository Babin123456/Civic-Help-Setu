/**
 * Civic Survey Persistent Storage Service (#767)
 * Implements normalized storage for survey projects, versions, responses,
 * consent events, and audit logs with in-memory fallback and idempotency protection.
 */

import { SEED_SURVEYS } from '../data/surveys.js';

const STORAGE_KEYS = Object.freeze({
  SURVEYS: 'civic_surveys_v1',
  RESPONSES: 'civic_survey_responses_v1',
  CONSENT_EVENTS: 'civic_survey_consent_events_v1',
  AUDIT_EVENTS: 'civic_survey_audit_events_v1',
});

// In-memory fallback if localStorage is unavailable
const memoryStore = new Map();

const safeGetItem = (key) => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
  } catch {
    // Fall back to memoryStore
  }
  return memoryStore.get(key) || null;
};

const safeSetItem = (key, value) => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
      return;
    }
  } catch {
    // Fall back to memoryStore
  }
  memoryStore.set(key, value);
};

/**
 * Loads all survey projects. Seeds with SEED_SURVEYS if storage is blank.
 */
export const loadSurveys = () => {
  const raw = safeGetItem(STORAGE_KEYS.SURVEYS);
  if (!raw) {
    saveAllSurveys(SEED_SURVEYS);
    return JSON.parse(JSON.stringify(SEED_SURVEYS));
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

/**
 * Persists all survey projects
 */
export const saveAllSurveys = (surveys) => {
  safeSetItem(STORAGE_KEYS.SURVEYS, JSON.stringify(surveys || []));
};

/**
 * Saves or updates a single survey project
 */
export const saveSurvey = (survey) => {
  if (!survey || !survey.id) {
    throw new Error('Survey must have a valid ID');
  }

  const surveys = loadSurveys();
  const existingIdx = surveys.findIndex((s) => s.id === survey.id);

  const updatedSurvey = {
    ...survey,
    updatedAt: new Date().toISOString(),
  };

  if (existingIdx >= 0) {
    surveys[existingIdx] = updatedSurvey;
  } else {
    updatedSurvey.createdAt = updatedSurvey.createdAt || new Date().toISOString();
    surveys.unshift(updatedSurvey);
  }

  saveAllSurveys(surveys);
  return updatedSurvey;
};

/**
 * Retrieves a survey by ID
 */
export const getSurveyById = (id) => {
  if (!id) return null;
  const surveys = loadSurveys();
  return surveys.find((s) => s.id === id) || null;
};

/**
 * Loads all responses, optionally filtered by surveyId
 */
export const loadResponses = (surveyId = null) => {
  const raw = safeGetItem(STORAGE_KEYS.RESPONSES);
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    if (surveyId) {
      return list.filter((r) => r.surveyId === surveyId);
    }
    return list;
  } catch {
    return [];
  }
};

/**
 * Saves a survey response with idempotency check
 */
export const saveResponse = (response) => {
  if (!response || !response.surveyId || !response.idempotencyKey) {
    throw new Error('Response requires surveyId and idempotencyKey');
  }

  const responses = loadResponses();
  const existing = responses.find(
    (r) => r.surveyId === response.surveyId && r.idempotencyKey === response.idempotencyKey
  );

  if (existing) {
    // Idempotent duplicate: return existing without double-counting
    return { ...existing, isDuplicate: true };
  }

  const newResponse = {
    ...response,
    id: response.id || `resp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    submittedAt: response.submittedAt || new Date().toISOString(),
  };

  responses.push(newResponse);
  safeSetItem(STORAGE_KEYS.RESPONSES, JSON.stringify(responses));
  return newResponse;
};

/**
 * Records a consent event in a separate storage collection
 */
export const recordConsentEvent = (event) => {
  if (!event || !event.surveyId || !event.consentToken) {
    throw new Error('Consent event requires surveyId and consentToken');
  }

  const raw = safeGetItem(STORAGE_KEYS.CONSENT_EVENTS);
  const events = raw ? JSON.parse(raw) : [];

  const newEvent = {
    ...event,
    id: event.id || `consent_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    timestamp: new Date().toISOString(),
  };

  events.push(newEvent);
  safeSetItem(STORAGE_KEYS.CONSENT_EVENTS, JSON.stringify(events));
  return newEvent;
};

/**
 * Revokes consent and purges associated responses matching consentToken
 */
export const revokeConsent = (surveyId, consentToken) => {
  if (!surveyId || !consentToken) return false;

  // Record revocation event
  recordConsentEvent({
    surveyId,
    consentToken,
    eventType: 'withdrawn',
  });

  // Purge response if token matches
  const responses = loadResponses();
  const filtered = responses.filter((r) => !(r.surveyId === surveyId && r.consentToken === consentToken));
  safeSetItem(STORAGE_KEYS.RESPONSES, JSON.stringify(filtered));
  return true;
};

/**
 * Records an append-only audit event for sensitive operations
 */
export const recordAuditEvent = (auditEvent) => {
  if (!auditEvent || !auditEvent.action) {
    throw new Error('Audit event must specify an action');
  }

  const raw = safeGetItem(STORAGE_KEYS.AUDIT_EVENTS);
  const audits = raw ? JSON.parse(raw) : [];

  const entry = {
    ...auditEvent,
    id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    timestamp: new Date().toISOString(),
  };

  audits.push(entry);
  safeSetItem(STORAGE_KEYS.AUDIT_EVENTS, JSON.stringify(audits));
  return entry;
};

/**
 * Loads audit events for a survey or across all surveys
 */
export const loadAuditEvents = (surveyId = null) => {
  const raw = safeGetItem(STORAGE_KEYS.AUDIT_EVENTS);
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    if (surveyId) {
      return list.filter((a) => a.surveyId === surveyId);
    }
    return list;
  } catch {
    return [];
  }
};

/**
 * Resets storage (primarily for test harness isolation)
 */
export const clearSurveyStorage = () => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(STORAGE_KEYS.SURVEYS);
      window.localStorage.removeItem(STORAGE_KEYS.RESPONSES);
      window.localStorage.removeItem(STORAGE_KEYS.CONSENT_EVENTS);
      window.localStorage.removeItem(STORAGE_KEYS.AUDIT_EVENTS);
    }
  } catch {
    // Ignore
  }
  memoryStore.clear();
};

