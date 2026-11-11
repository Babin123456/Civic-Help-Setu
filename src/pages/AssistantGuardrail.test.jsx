import { describe, it, expect, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import Assistant from './Assistant';
import { ToastProvider } from '../context/ToastContext';
import { saveChatHistory } from '../services/chatStorage';

const originalLocalStorage = globalThis.localStorage;

const installMemoryStorage = () => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, val) => store.set(key, String(val)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  };
  return store;
};

describe('Assistant Guardrail UI Notices', () => {
  afterEach(() => {
    if (originalLocalStorage === undefined) {
      delete globalThis.localStorage;
    } else {
      globalThis.localStorage = originalLocalStorage;
    }
  });

  it('renders PII redaction, blocked injection, and entailment notices without exposing raw PII', () => {
    const store = installMemoryStorage();

    saveChatHistory([
      {
        id: 'user-1',
        role: 'user',
        text: 'Fees for Birth Certificate with [REDACTED_AADHAAR]',
        guardrailPii: {
          wasRedacted: true,
          categories: ['AADHAAR'],
          notice: 'Privacy guardrail active: sensitive personal or financial details (AADHAAR) were redacted locally before processing or storing your message.',
        },
        timestamp: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'asst-1',
        role: 'assistant',
        grounded: true,
        confidenceScore: 0.9,
        serviceId: 'birth-certificate',
        entailment: {
          overallSupported: true,
          verifiedCount: 2,
          unsupportedCount: 0,
          contradictedCount: 0,
        },
        data: {
          title: 'Birth Certificate (Verified Civic Guidance)',
          summary: 'Normal registration within 21 days is free.',
          officialSources: [{ name: 'CRS TN', url: 'https://crstn.org', verified: true }],
        },
        timestamp: '2026-01-01T00:00:01.000Z',
      },
      {
        id: 'asst-2',
        role: 'assistant',
        status: 'blocked',
        grounded: false,
        confidenceScore: 0,
        serviceId: null,
        guardrail: {
          decision: 'block',
          injection: { blocked: true, category: 'instruction_override' },
        },
        data: {
          title: 'Request Blocked by AI Safety Guardrail',
          summary: 'Civic-Help-Setu cannot bypass verification rules.',
          missingInformationNotice: 'Safety Guardrail (instruction_override): blocked.',
          officialSources: [{ name: 'National Portal', url: 'https://services.india.gov.in', verified: true }],
        },
        timestamp: '2026-01-01T00:00:02.000Z',
      },
    ]);

    const rawStored = store.get('civicbridge_chat_history');
    expect(rawStored).toContain('Privacy guardrail active');
    expect(rawStored).toContain('[REDACTED_AADHAAR]');

    const html = renderToStaticMarkup(
      <ToastProvider>
        <MemoryRouter initialEntries={['/assistant']}>
          <Assistant />
        </MemoryRouter>
      </ToastProvider>
    );

    expect(html).toContain('Privacy guardrail active');
    expect(html).toContain('Entailment Check: Verified (2 claims)');
    expect(html).toContain('AI Safety Guardrail: Request blocked before inference');
    expect(html).not.toContain('role="alertdialog"');
  });
});
