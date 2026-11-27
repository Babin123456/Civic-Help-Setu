import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadSurveys,
  saveSurvey,
  getSurveyById,
  loadResponses,
  saveResponse,
  recordConsentEvent,
  revokeConsent,
  recordAuditEvent,
  loadAuditEvents,
  clearSurveyStorage,
} from './surveyStorage.js';

describe('surveyStorage persistent service', () => {
  beforeEach(() => {
    clearSurveyStorage();
  });

  it('loads seed surveys when storage is clean', () => {
    const surveys = loadSurveys();
    expect(surveys.length).toBeGreaterThan(0);
    expect(surveys[0].id).toBe('srv-water-sanitation-2026');
  });

  it('saves and retrieves a new survey project', () => {
    const newSurvey = {
      id: 'srv-test-1',
      title: 'Community Sanitation Survey',
      department: 'Department of Health',
      status: 'draft',
    };
    saveSurvey(newSurvey);
    const retrieved = getSurveyById('srv-test-1');
    expect(retrieved).not.toBeNull();
    expect(retrieved.title).toBe('Community Sanitation Survey');
    expect(retrieved.updatedAt).toBeDefined();
  });

  it('prevents duplicate responses via idempotency key', () => {
    const resp1 = {
      surveyId: 'srv-water-sanitation-2026',
      idempotencyKey: 'key-abc-123',
      consentGiven: true,
      answers: { q_resident_type: 'individual_household' },
    };

    const saved1 = saveResponse(resp1);
    expect(saved1.isDuplicate).toBeUndefined();

    // Re-submission with same idempotency key
    const saved2 = saveResponse(resp1);
    expect(saved2.isDuplicate).toBe(true);

    const responses = loadResponses('srv-water-sanitation-2026');
    expect(responses.filter((r) => r.idempotencyKey === 'key-abc-123')).toHaveLength(1);
  });

  it('records consent events separately and supports consent withdrawal', () => {
    const consentToken = 'token-anon-999';
    recordConsentEvent({
      surveyId: 'srv-water-sanitation-2026',
      consentToken,
      eventType: 'granted',
    });

    saveResponse({
      surveyId: 'srv-water-sanitation-2026',
      idempotencyKey: 'idemp-resp-999',
      consentToken,
      consentGiven: true,
      answers: { q_supply_pressure_rating: 4 },
    });

    expect(loadResponses('srv-water-sanitation-2026').some((r) => r.consentToken === consentToken)).toBe(true);

    // Withdraw consent
    const revoked = revokeConsent('srv-water-sanitation-2026', consentToken);
    expect(revoked).toBe(true);

    // Response must be removed
    expect(loadResponses('srv-water-sanitation-2026').some((r) => r.consentToken === consentToken)).toBe(false);
  });

  it('records and retrieves append-only audit events', () => {
    recordAuditEvent({
      surveyId: 'srv-water-sanitation-2026',
      action: 'PUBLISH_SURVEY',
      actorRole: 'admin',
      reason: 'Approved by Ward Scrutiny Board',
    });

    const audits = loadAuditEvents('srv-water-sanitation-2026');
    expect(audits).toHaveLength(1);
    expect(audits[0].action).toBe('PUBLISH_SURVEY');
    expect(audits[0].timestamp).toBeDefined();
  });
});

