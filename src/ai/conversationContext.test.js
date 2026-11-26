import { describe, it, expect } from 'vitest';
import {
  STARTER_PROMPTS,
  resolveFollowUpQuery,
  getLastUserMessage,
  hasUserMessages,
  trimHistory,
  formatCaseMemoryContext,
} from './conversationContext';

const history = (serviceId) => [
  { role: 'assistant', text: 'hi' },
  { role: 'user', text: 'passport please' },
  { role: 'assistant', serviceId, data: {} },
];

describe('resolveFollowUpQuery', () => {
  it('adds the previous service to a short follow-up', () => {
    expect(resolveFollowUpQuery('How much are the fees?', history('passport')))
      .toBe('How much are the fees for New Passport Application');
  });

  it('leaves queries that name a service alone', () => {
    expect(resolveFollowUpQuery('fees for driving license', history('passport')))
      .toBe('fees for driving license');
    expect(resolveFollowUpQuery('aadhaar', history('passport'))).toBe('aadhaar');
  });

  it('leaves the query alone with no prior service or when too long', () => {
    expect(resolveFollowUpQuery('What are the fees?', [])).toBe('What are the fees?');
    expect(resolveFollowUpQuery('What are the fees?', history(null))).toBe('What are the fees?');
    const long = 'I would like to know about the fees and the time and many other things please';
    expect(resolveFollowUpQuery(long, history('passport'))).toBe(long);
  });
});

describe('helpers', () => {
  it('finds the last user message and detects a fresh session', () => {
    expect(getLastUserMessage(history('passport')).text).toBe('passport please');
    expect(hasUserMessages([{ role: 'assistant' }])).toBe(false);
    expect(hasUserMessages(history('passport'))).toBe(true);
  });

  it('keeps only the most recent messages', () => {
    const msgs = Array.from({ length: 10 }, (_, i) => ({ id: i }));
    expect(trimHistory(msgs, 4).map((m) => m.id)).toEqual([6, 7, 8, 9]);
    expect(trimHistory(msgs, 20)).toHaveLength(10);
  });

  it('starter prompts have labels and prompts', () => {
    expect(STARTER_PROMPTS.length).toBeGreaterThan(3);
    STARTER_PROMPTS.forEach((p) => expect(p.label && p.prompt).toBeTruthy());
  });

  it('formats case memory context into demarcated facts and proposals', () => {
    const memories = [
      {
        entryType: 'FACTUAL_NOTE',
        category: 'DOCUMENT_METADATA',
        payload: { title: 'Aadhaar Card', text: 'Verified proof of identity.' },
      },
      {
        entryType: 'MODEL_PROPOSAL',
        category: 'ACTION_STEP',
        provenance: { confidenceScore: 0.95 },
        payload: { title: 'Next Step', text: 'Visit closest seva kendra.' },
      },
    ];

    const formatted = formatCaseMemoryContext(memories);
    expect(formatted).toContain('[VERIFIED CASE FACTS - GROUND TRUTH]');
    expect(formatted).toContain('- (DOCUMENT_METADATA) Aadhaar Card: Verified proof of identity.');
    expect(formatted).toContain('[UNVERIFIED AI PROPOSALS - REQUIRES CITIZEN CONFIRMATION]');
    expect(formatted).toContain('- (ACTION_STEP) Next Step [conf: 95%]: Visit closest seva kendra.');

    expect(formatCaseMemoryContext([])).toBe('');
    expect(formatCaseMemoryContext(null)).toBe('');
  });
});
