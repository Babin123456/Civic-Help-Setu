import { describe, it, expect } from 'vitest';
import {
  getEmergencyHelplines,
  searchEmergencyHelplines,
  getEmergencyCategories,
  formatDialerLink,
} from './emergencyHelplineService';

describe('emergencyHelplineService', () => {
  it('returns all verified emergency helplines', () => {
    const list = getEmergencyHelplines();
    expect(list.length).toBeGreaterThanOrEqual(8);
    expect(list.some(h => h.number === '112')).toBe(true);
    expect(list.some(h => h.number === '1930')).toBe(true);
  });

  it('filters helplines by domain category', () => {
    const womenHelplines = getEmergencyHelplines('Women Safety');
    expect(womenHelplines.length).toBeGreaterThan(0);
    expect(womenHelplines.every(h => h.category === 'Women Safety')).toBe(true);
  });

  it('searches helplines by keyword across name, number, and description', () => {
    const cyberResults = searchEmergencyHelplines('fraud');
    expect(cyberResults.some(h => h.number === '1930')).toBe(true);

    const ambulanceResults = searchEmergencyHelplines('108');
    expect(ambulanceResults[0].number).toBe('108');
  });

  it('formats clean tel: dialer URIs without dashes or spaces', () => {
    expect(formatDialerLink('112')).toBe('tel:112');
    expect(formatDialerLink('1800-599-0019')).toBe('tel:18005990019');
    expect(formatDialerLink('+91-11-2338-1234')).toBe('tel:+911123381234');
  });
});
