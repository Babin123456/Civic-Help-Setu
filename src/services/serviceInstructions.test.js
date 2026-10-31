import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatServiceInstructions } from './plainTextServiceFormatter';
import { MOCK_SERVICES } from '../data/services';

afterEach(() => vi.useRealTimers());

describe('plain-text service instructions', () => {
  const service = {
    name: 'Example permit',
    jurisdiction: { level: 'state', states: ['Karnataka'] },
    steps: [{ title: 'Apply', description: 'Submit the form.' }, { title: 'Visit', description: 'Bring originals.' }],
    documents: ['Application form', 'Guardian consent', 'Extra copy', 'Address proof'],
    documentRequirements: {
      'Application form': { type: 'required' },
      'Guardian consent': { type: 'conditional', condition: 'For minors only.' },
      'Extra copy': { type: 'optional' },
    },
    officialSources: [{ name: 'Department', url: 'https://example.gov.in/apply' }],
  };

  it('includes actual steps, jurisdiction, requirement distinctions and the official source', () => {
    expect(formatServiceInstructions(service)).toBe([
      'Example permit',
      'Jurisdiction: Karnataka',
      'Steps:\n1. Apply: Submit the form.\n2. Visit: Bring originals.',
      'Documents and items:\n- Application form (Official requirement)\n- Guardian consent (Conditional requirement: For minors only.)\n- Extra copy (Optional suggestion)\n- Address proof (Not verified)',
      'Official sources:\n- Department: https://example.gov.in/apply',
      'Verify current steps, requirements and local applicability with the official source before applying.',
    ].join('\n\n'));
  });

  it.each([undefined, null, {}, { name: 'Only a title', documents: [], steps: [], officialSources: [] }])(
    'omits missing sections and never invents requirements for %j', (record) => {
      const text = formatServiceInstructions(record);
      expect(text).not.toMatch(/undefined|null|\[object Object\]|Steps:|Documents and items:|Official sources:|Jurisdiction:/);
      expect(text).not.toMatch(/Aadhaar|identity proof|1912|india.gov.in/);
      expect(text).toContain('Verify current steps');
    },
  );

  it('handles blank and malformed list entries without empty headings', () => {
    const text = formatServiceInstructions({
      name: '  Test  ', steps: [null, {}, ' ', 1], documents: [null, {}, ' '],
      officialSources: [null, {}, { url: 'javascript:alert(1)' }],
    });
    expect(text).toBe(formatServiceInstructions({ name: 'Test' }));
  });

  it('renders stored markup as plain text and rejects unsafe official URLs', () => {
    const text = formatServiceInstructions({
      name: '<b>Permit</b><script>bad()</script>',
      steps: ['<i>Read</i>', { title: 'Pay', description: 'Fee < 500' }],
      officialSources: [{ url: 'data:text/html,bad' }, { name: '<b>Source</b>', url: 'https://example.gov.in' }],
    });
    expect(text).toContain('Permit\n\nSteps:\n1. Read\n2. Pay: Fee < 500');
    expect(text).toContain('Source: https://example.gov.in/');
    expect(text).not.toMatch(/<b>|<i>|script|bad\(\)|data:text/);
  });

  it('uses a legacy official link when no structured source is available', () => {
    expect(formatServiceInstructions({ officialLink: 'https://example.gov.in/apply' }))
      .toContain('Official sources:\n- https://example.gov.in/apply');
  });

  it('does not read or serialize private fields at any depth', () => {
    const fail = () => { throw new Error('Private data must not be read'); };
    const record = { ...service, steps: [{ title: 'Apply', description: 'Public step.' }] };
    for (const key of ['assessmentInputs', 'savedNotes', 'vaultMetadata', 'profile', 'userId']) {
      Object.defineProperty(record, key, { enumerable: true, get: fail });
      Object.defineProperty(record.steps[0], key, { enumerable: true, get: fail });
    }
    expect(formatServiceInstructions(record)).toContain('Public step.');
  });

  it('is independent of clock and locale and does not mutate the service', () => {
    const before = JSON.stringify(service);
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2020-01-01'));
    const first = formatServiceInstructions(service);
    vi.setSystemTime(new Date('2030-07-01'));
    expect(formatServiceInstructions(service)).toBe(first);
    expect(JSON.stringify(service)).toBe(before);
  });

  it('supports the real catalogue shape without object coercion', () => {
    for (const record of MOCK_SERVICES) {
      const text = formatServiceInstructions(record);
      expect(text).toContain(record.name);
      expect(text).not.toMatch(/undefined|\[object Object\]/);
      record.steps.forEach((step) => expect(text).toContain(step.title));
      record.officialSources.forEach((source) => expect(text).toContain(source.url));
    }
  });
});
