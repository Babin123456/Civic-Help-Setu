import { describe, it, expect } from 'vitest';
import {
  validateContact,
  validateContacts,
  getContactHref,
  classifyContact,
  getServiceContacts,
} from './contactDirectoryService';

const NOW = new Date('2026-06-01T00:00:00Z');
const good = {
  type: 'helpdesk',
  method: 'phone',
  value: '+91 11 2345 6789',
  hours: 'Mon-Fri 9:00-17:00',
  sourceUrl: 'https://example.gov.in/contact',
  lastVerified: '2026-03-01',
};

describe('contactDirectoryService (#266)', () => {
  describe('missing contacts', () => {
    it('treats absent, empty and non-array contacts as zero channels', () => {
      for (const svc of [undefined, null, {}, { contacts: [] }, { contacts: 'x' }, { contacts: null }]) {
        const r = getServiceContacts(svc, NOW);
        expect(r.hasContacts).toBe(false);
        expect(r.items).toEqual([]);
        expect(r.hasVerified).toBe(false);
      }
    });

    it('ignores non-object entries', () => {
      expect(getServiceContacts({ contacts: [null, 5, 'a'] }, NOW).items).toEqual([]);
    });
  });

  describe('malformed contacts', () => {
    it('accepts a fully valid contact', () => {
      expect(validateContact(good).valid).toBe(true);
    });

    it('flags bad phone, email and url values', () => {
      expect(validateContact({ ...good, value: 'call me' }).errors.value).toBeTruthy();
      expect(validateContact({ ...good, value: '12' }).errors.value).toBeTruthy();
      expect(validateContact({ ...good, method: 'email', value: 'not-an-email' }).errors.value).toBeTruthy();
      expect(validateContact({ ...good, method: 'web', value: 'javascript:alert(1)' }).errors.value).toBeTruthy();
      expect(validateContact({ ...good, method: 'web', value: 'ftp://x.gov.in' }).errors.value).toBeTruthy();
    });

    it('requires valid type, method, source and date metadata', () => {
      const r = validateContact({ value: '100' });
      expect(r.valid).toBe(false);
      expect(Object.keys(r.errors).sort()).toEqual(['lastVerified', 'method', 'sourceUrl', 'type']);
      expect(validateContact({ ...good, type: 'bogus' }).errors.type).toBeTruthy();
      expect(validateContact({ ...good, sourceUrl: 'nope' }).errors.sourceUrl).toBeTruthy();
      expect(validateContact({ ...good, lastVerified: '2026-02-31' }).errors.lastVerified).toBeTruthy();
      expect(validateContact({ ...good, lastVerified: '01/03/2026' }).errors.lastVerified).toBeTruthy();
    });

    it('never builds an action link for a malformed value', () => {
      expect(getContactHref({ method: 'phone', value: 'abc' })).toBeNull();
      expect(getContactHref({ method: 'email', value: 'x' })).toBeNull();
      expect(getContactHref({ method: 'web', value: 'javascript:alert(1)' })).toBeNull();
      expect(getContactHref(null)).toBeNull();
    });

    it('does not mark an invalid contact as verified', () => {
      const c = classifyContact({ ...good, value: 'bad' }, NOW);
      expect(c.status).toBe('invalid');
      expect(c.needsReview).toBe(true);
      const r = getServiceContacts({ contacts: [{ ...good, value: 'bad' }] }, NOW);
      expect(r.hasVerified).toBe(false);
      expect(r.items[0].href).toBeNull();
    });
  });

  describe('hrefs', () => {
    it('builds tel, mailto and https actions', () => {
      expect(getContactHref(good)).toBe('tel:+911123456789');
      expect(getContactHref({ method: 'email', value: 'help@example.gov.in' })).toBe('mailto:help@example.gov.in');
      expect(getContactHref({ method: 'web', value: 'https://example.gov.in/help' })).toBe('https://example.gov.in/help');
    });
  });

  describe('freshness', () => {
    it('verifies recent contacts and flags old or future-dated ones for review', () => {
      expect(classifyContact(good, NOW).status).toBe('verified');
      const old = classifyContact({ ...good, lastVerified: '2024-01-01' }, NOW);
      expect(old.status).toBe('expired');
      expect(old.needsReview).toBe(true);
      expect(classifyContact({ ...good, lastVerified: '2027-01-01' }, NOW).status).toBe('expired');
    });
  });

  describe('multiple contacts', () => {
    it('keeps every channel and counts those needing review', () => {
      const svc = {
        contacts: [
          good,
          { ...good, type: 'grievance', method: 'email', value: 'grievance@example.gov.in' },
          { ...good, type: 'department', method: 'web', value: 'https://example.gov.in', lastVerified: '2023-01-01' },
          { ...good, value: 'bad' },
        ],
      };
      const r = getServiceContacts(svc, NOW);
      expect(r.items).toHaveLength(4);
      expect(r.items.map((i) => i.status)).toEqual(['verified', 'verified', 'expired', 'invalid']);
      expect(r.needsReviewCount).toBe(2);
      expect(r.hasVerified).toBe(true);
    });

    it('validateContacts reports errors per row', () => {
      const r = validateContacts([good, { ...good, value: '' }]);
      expect(r.valid).toBe(false);
      expect(r.errorsByIndex[0]).toEqual({});
      expect(r.errorsByIndex[1].value).toBeTruthy();
      expect(validateContacts([]).valid).toBe(true);
      expect(validateContacts(undefined).valid).toBe(true);
    });
  });
});
