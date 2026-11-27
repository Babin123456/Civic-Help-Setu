import { describe, it, expect } from 'vitest';
import {
  filterLibraries,
  getLibraryById,
  getLibraryFreshness,
  formatLibraryInstructions,
  buildLibraryChecklistItems,
} from './libraryService';
import { VERIFIED_LIBRARY_FACILITIES } from '../data/libraryFacilities';

describe('libraryService (#727)', () => {
  it('returns all libraries when no filters are set', () => {
    const res = filterLibraries(VERIFIED_LIBRARY_FACILITIES, {});
    expect(res.length).toBe(VERIFIED_LIBRARY_FACILITIES.length);
  });

  it('filters libraries by state and handles jurisdiction switching', () => {
    const delhiLibraries = filterLibraries(VERIFIED_LIBRARY_FACILITIES, { state: 'Delhi' });
    expect(delhiLibraries.length).toBeGreaterThan(0);
    expect(delhiLibraries.every((l) => l.state === 'Delhi' || l.jurisdiction.states.includes('Delhi'))).toBe(true);

    const tamilNaduLibraries = filterLibraries(VERIFIED_LIBRARY_FACILITIES, { state: 'Tamil Nadu' });
    expect(tamilNaduLibraries.length).toBeGreaterThan(0);
    expect(tamilNaduLibraries.every((l) => l.state === 'Tamil Nadu' || l.jurisdiction.states.includes('Tamil Nadu'))).toBe(true);

    // Switching between states returns mutually exclusive regional facilities
    const overlap = delhiLibraries.filter((d) => tamilNaduLibraries.some((t) => t.id === d.id));
    expect(overlap).toEqual([]);
  });

  it('filters libraries by district correctly', () => {
    const chennaiLibs = filterLibraries(VERIFIED_LIBRARY_FACILITIES, {
      state: 'Tamil Nadu',
      district: 'Chennai',
    });
    expect(chennaiLibs.length).toBe(1);
    expect(chennaiLibs[0].id).toBe('anna-centenary-library-chennai');
  });

  it('filters libraries by facility type', () => {
    const nationalLibs = filterLibraries(VERIFIED_LIBRARY_FACILITIES, {
      libraryType: 'national_library',
    });
    expect(nationalLibs.length).toBe(1);
    expect(nationalLibs[0].id).toBe('national-library-of-india-kolkata');
  });

  it('filters libraries by accessibility options (wheelchair, braille, screen readers)', () => {
    const brailleLibs = filterLibraries(VERIFIED_LIBRARY_FACILITIES, {
      onlyBraille: true,
    });
    expect(brailleLibs.every((l) => l.accessibility.brailleSection === true)).toBe(true);

    const screenReaderLibs = filterLibraries(VERIFIED_LIBRARY_FACILITIES, {
      onlyScreenReaders: true,
    });
    expect(screenReaderLibs.every((l) => l.accessibility.screenReaderWorkstations === true)).toBe(true);
  });

  it('filters libraries offering digital learning resources', () => {
    const digitalLibs = filterLibraries(VERIFIED_LIBRARY_FACILITIES, {
      onlyDigitalResources: true,
    });
    expect(digitalLibs.length).toBeGreaterThan(0);
    expect(digitalLibs.every((l) => l.digitalLearningResources?.length > 0)).toBe(true);
  });

  it('searches across name, locality, authority, and digital repository names', () => {
    const ndliResults = filterLibraries(VERIFIED_LIBRARY_FACILITIES, {
      searchQuery: 'NDLI',
    });
    expect(ndliResults.length).toBeGreaterThan(0);
    expect(ndliResults.some((l) => l.id === 'delhi-public-library-central')).toBe(true);
  });

  it('retrieves library by ID correctly', () => {
    const lib = getLibraryById('delhi-public-library-central');
    expect(lib).not.toBeNull();
    expect(lib.name).toContain('Delhi Public Library');

    expect(getLibraryById('non-existent-id')).toBeNull();
  });

  it('evaluates freshness status and detects stale records (>365 days)', () => {
    const freshLib = VERIFIED_LIBRARY_FACILITIES.find((l) => l.id === 'anna-centenary-library-chennai');
    const freshStatus = getLibraryFreshness(freshLib);
    expect(['recent', 'standard']).toContain(freshStatus.status);

    const staleLib = VERIFIED_LIBRARY_FACILITIES.find((l) => l.id === 'kerala-state-central-library-trivandrum');
    const staleStatus = getLibraryFreshness(staleLib);
    expect(staleStatus.status).toBe('overdue');
  });

  it('formats low-bandwidth plain-text instructions keeping official facts distinct', () => {
    const lib = VERIFIED_LIBRARY_FACILITIES[0];
    const text = formatLibraryInstructions(lib);

    expect(text).toContain(lib.name);
    expect(text).toContain('OFFICIAL CONTACT & CATALOGUES');
    expect(text).toContain(lib.officialContact.portalUrl);
    expect(text).toContain('MEMBERSHIP CATEGORIES & CHARGES');
    expect(text).toContain('RENEWAL & BORROWING RULES');
    expect(text).toContain('OFFICIAL PROVENANCE');
    expect(text).toContain(lib.auditMetadata.sourceUrl);
    expect(text).toContain('Notice: Live seating counts are strictly prohibited');
  });

  it('builds conditional checklist items for students vs general membership', () => {
    const lib = VERIFIED_LIBRARY_FACILITIES.find((l) => l.id === 'delhi-public-library-central');

    const generalItems = buildLibraryChecklistItems(lib, 'general_adult');
    expect(generalItems.some((i) => i.includes('Application fee & caution deposit: ₹350'))).toBe(true);

    const studentItems = buildLibraryChecklistItems(lib, 'student');
    expect(studentItems.some((i) => i.includes('Student ID Card') || i.includes('Bona fide'))).toBe(true);
    expect(studentItems.some((i) => i.includes('Application fee & caution deposit: ₹200'))).toBe(true);
  });
});

