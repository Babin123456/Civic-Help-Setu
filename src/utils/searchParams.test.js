import { describe, it, expect } from 'vitest';
import {
  MAX_SEARCH_LENGTH,
  MAX_ASSISTANT_QUERY_LENGTH,
  MAX_ID_LENGTH,
  SORT_KEYS,
  normalizeText,
  normalizeSearchQuery,
  pickAllowed,
  parseServiceFilters,
  parseSlugParam,
  parseReferenceParam,
  parseAssistantQuery,
} from './searchParams';

const params = (query) => new URLSearchParams(query);
const known = { categories: ['All', 'Identity', 'Health'], departments: ['Revenue', 'Transport'] };
const chars = (...codes) => String.fromCharCode(...codes);

describe('normalizeSearchQuery', () => {
  it('keeps ordinary text, including one trailing space while typing', () => {
    expect(normalizeSearchQuery('birth certificate')).toBe('birth certificate');
    expect(normalizeSearchQuery('birth ')).toBe('birth ');
  });

  it('collapses runs of whitespace and treats blank input as empty', () => {
    expect(normalizeSearchQuery('a   b\t\tc\n d')).toBe('a b c d');
    expect(normalizeSearchQuery('     ')).toBe('');
    expect(normalizeSearchQuery('')).toBe('');
  });

  it('cuts very long input to the limit', () => {
    const result = normalizeSearchQuery('x'.repeat(50000));
    expect([...result]).toHaveLength(MAX_SEARCH_LENGTH);
  });

  it('never splits a character that takes two code units', () => {
    const smile = String.fromCodePoint(0x1f600);
    const result = normalizeSearchQuery(smile.repeat(MAX_SEARCH_LENGTH + 20));
    expect([...result]).toHaveLength(MAX_SEARCH_LENGTH);
    expect(result.endsWith(smile)).toBe(true);
  });

  it('replaces control and hidden direction characters', () => {
    expect(normalizeSearchQuery(`pass${chars(0)}port${chars(0x202e)}`)).toBe('pass port ');
    expect(normalizeSearchQuery(`${chars(0x200b)}voter${chars(0x2028)}id`)).toBe(' voter id');
  });

  it('handles non-strings', () => {
    expect(normalizeSearchQuery(null)).toBe('');
    expect(normalizeSearchQuery(undefined)).toBe('');
    expect(normalizeSearchQuery(42)).toBe('');
    expect(normalizeSearchQuery({ q: 'x' })).toBe('');
  });

  it('returns markup as plain text, unchanged, for React to escape', () => {
    expect(normalizeSearchQuery('<img src=x onerror=alert(1)>')).toBe('<img src=x onerror=alert(1)>');
  });

  it('normalizes full-width compatibility characters', () => {
    expect(normalizeSearchQuery(`${chars(0xff30, 0xff21, 0xff2e)}`)).toBe('PAN');
  });

  it('keeps Hindi text intact', () => {
    const hindi = String.fromCodePoint(0x091c, 0x0928, 0x094d, 0x092e);
    expect(normalizeSearchQuery(hindi)).toBe(hindi);
  });
});

describe('normalizeText', () => {
  it('trims by default and honours the maximum', () => {
    expect(normalizeText('  hello  ', 3)).toBe('hel');
    expect(normalizeText('  hello  ')).toBe('hello');
  });
});

describe('pickAllowed', () => {
  it('matches ignoring case and returns the canonical spelling', () => {
    expect(pickAllowed('online', ['Online', 'Offline'], 'All')).toBe('Online');
    expect(pickAllowed(' HARD ', ['Easy', 'Hard'], 'All')).toBe('Hard');
  });

  it('falls back for unknown, empty and non-string values', () => {
    expect(pickAllowed('nope', ['Online'], 'All')).toBe('All');
    expect(pickAllowed('', ['Online'], 'All')).toBe('All');
    expect(pickAllowed(null, ['Online'], 'All')).toBe('All');
    expect(pickAllowed(['Online'], ['Online'], 'All')).toBe('All');
  });

  it('is not fooled by prototype keys', () => {
    expect(pickAllowed('__proto__', ['Online'], 'All')).toBe('All');
    expect(pickAllowed('constructor', ['Online'], 'All')).toBe('All');
  });
});

describe('parseServiceFilters', () => {
  const defaults = {
    searchQuery: '',
    category: 'All',
    department: 'All',
    mode: 'All',
    difficulty: 'All',
    fee: 'All',
    speed: 'All',
    sortBy: 'relevance',
  };

  it('returns the defaults for an empty query string', () => {
    expect(parseServiceFilters(params(''), known)).toEqual(defaults);
  });

  it('accepts every supported value', () => {
    const result = parseServiceFilters(
      params('q=ration&cat=Health&dept=Revenue&mode=Hybrid&diff=Easy&fee=Free&speed=Urgent&sort=speed-asc'),
      known
    );
    expect(result).toEqual({
      searchQuery: 'ration',
      category: 'Health',
      department: 'Revenue',
      mode: 'Hybrid',
      difficulty: 'Easy',
      fee: 'Free',
      speed: 'Urgent',
      sortBy: 'speed-asc',
    });
  });

  it.each(SORT_KEYS)('accepts the sort key %s', (key) => {
    expect(parseServiceFilters(params(`sort=${key}`), known).sortBy).toBe(key);
  });

  it('ignores unsupported sort keys and filters', () => {
    const result = parseServiceFilters(
      params('sort=__proto__&cat=Nope&dept=%3Cscript%3E&mode=Teleport&diff=Impossible&fee=Bribe&speed=Instant'),
      known
    );
    expect(result).toEqual(defaults);
  });

  it('uses the first of a repeated parameter and ignores empty values', () => {
    expect(parseServiceFilters(params('sort=name-asc&sort=name-desc'), known).sortBy).toBe('name-asc');
    expect(parseServiceFilters(params('sort=&fee='), known)).toMatchObject({ sortBy: 'relevance', fee: 'All' });
  });

  it('decodes once and bounds the search text', () => {
    const encoded = encodeURIComponent('%3Cb%3Ebold%3C%2Fb%3E');
    expect(parseServiceFilters(params(`q=${encoded}`), known).searchQuery).toBe('%3Cb%3Ebold%3C%2Fb%3E');
    expect(parseServiceFilters(params(`q=${'a'.repeat(100000)}`), known).searchQuery).toHaveLength(MAX_SEARCH_LENGTH);
  });

  it('handles malformed percent sequences without throwing', () => {
    expect(() => parseServiceFilters(params('q=%E0%A4%A&cat=%'), known)).not.toThrow();
  });

  it('works when the catalogue lists are not given', () => {
    expect(parseServiceFilters(params('cat=Health&dept=Revenue'))).toMatchObject({ category: 'All', department: 'All' });
  });
});

describe('parseSlugParam', () => {
  it('accepts service slugs', () => {
    expect(parseSlugParam('ration-card')).toBe('ration-card');
    expect(parseSlugParam(' pan_card.v2 ')).toBe('pan_card.v2');
  });

  it('rejects markup, paths, spaces and over-long values', () => {
    for (const bad of ['<script>', '../etc/passwd', 'a b', 'a/b', '-leading', '', '   ', null, undefined, 5]) {
      expect(parseSlugParam(bad)).toBe('');
    }
    expect(parseSlugParam('a'.repeat(MAX_ID_LENGTH + 1))).toBe('');
    expect(parseSlugParam('a'.repeat(MAX_ID_LENGTH))).toHaveLength(MAX_ID_LENGTH);
  });
});

describe('parseReferenceParam', () => {
  it('keeps application references as typed', () => {
    expect(parseReferenceParam('SRV-98234710')).toBe('SRV-98234710');
    expect(parseReferenceParam('  srv/2024/17  ')).toBe('srv/2024/17');
  });

  it('bounds the length and drops control characters', () => {
    expect(parseReferenceParam('9'.repeat(5000))).toHaveLength(MAX_ID_LENGTH);
    expect(parseReferenceParam(`A${chars(0)}B`)).toBe('A B');
    expect(parseReferenceParam(null)).toBe('');
  });
});

describe('parseAssistantQuery', () => {
  it('keeps normal questions and cuts very long ones', () => {
    expect(parseAssistantQuery('How do I apply for a passport?')).toBe('How do I apply for a passport?');
    expect([...parseAssistantQuery('q'.repeat(100000))]).toHaveLength(MAX_ASSISTANT_QUERY_LENGTH);
  });

  it('returns an empty string for blank or hidden-character input', () => {
    expect(parseAssistantQuery('   ')).toBe('');
    expect(parseAssistantQuery(chars(0x200b, 0x200b))).toBe('');
    expect(parseAssistantQuery(null)).toBe('');
  });
});
