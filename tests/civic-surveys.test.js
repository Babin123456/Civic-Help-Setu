import { describe, it, expect, beforeEach } from 'vitest';
import handler, {
  validateSurveySubmissionPayload,
  generateSurveyReceiptSeal,
  SURVEY_SUBMISSION_QUEUE,
} from '../api/_lib/handlers/civic-surveys.js';

describe('api/civic-surveys handler (#767)', () => {
  beforeEach(() => {
    SURVEY_SUBMISSION_QUEUE.length = 0;
  });

  const createMockRes = () => {
    const res = {
      statusCode: 200,
      headers: {},
      body: null,
      writableEnded: false,
      setHeader(k, v) {
        this.headers[k] = v;
      },
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.body = data;
        this.writableEnded = true;
        return this;
      },
    };
    return res;
  };

  it('generates consistent verification receipt seals', () => {
    const seal = generateSurveyReceiptSeal('srv-1', '2026-11-15T00:00:00.000Z');
    expect(seal).toMatch(/^SRV-SEAL-[0-9A-F]{4}-[0-9A-F]{4}$/);
  });

  it('rejects submissions with missing fields or missing consent', () => {
    const errs = validateSurveySubmissionPayload({ surveyId: 'srv-1', consentGiven: false });
    expect(errs.length).toBeGreaterThan(0);
    expect(errs.some((e) => e.includes('consent'))).toBe(true);
  });

  it('rejects submissions containing PII like Aadhaar or phone numbers', () => {
    const errs = validateSurveySubmissionPayload({
      surveyId: 'srv-1',
      consentGiven: true,
      idempotencyKey: 'idemp-1',
      answers: { notes: 'My Aadhaar is 2345 6789 0123' },
    });
    expect(errs.some((e) => e.includes('Aadhaar'))).toBe(true);
  });

  it('handles GET requests and returns queue status', async () => {
    const req = { method: 'GET', headers: {} };
    const res = createMockRes();

    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.pendingCount).toBe(0);
  });

  it('handles valid POST submissions and returns cryptographic seal', async () => {
    const req = {
      method: 'POST',
      headers: { 'x-vercel-forwarded-for': '127.0.0.1' },
      body: {
        surveyId: 'srv-water-sanitation-2026',
        idempotencyKey: 'key-test-999',
        consentGiven: true,
        answers: {
          q_resident_type: 'individual_household',
          q_primary_source: 'piped_municipal',
          q_supply_pressure_rating: 4,
        },
      },
    };
    const res = createMockRes();

    await handler(req, res);
    expect(res.statusCode).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.receiptSeal).toBeDefined();
    expect(res.body.consentToken).toBeDefined();
    expect(SURVEY_SUBMISSION_QUEUE.length).toBe(1);
  });
});

