import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  sanitizePlainText,
  sanitizeTextFields,
  safeHttpUrl,
  safeTelHref,
  safeMailtoHref,
} from './safeContent';
import VersionHistoryTimeline from '../components/services/VersionHistoryTimeline';
import { getAllServices, CUSTOM_SERVICES_KEY } from '../services/serviceCatalog';
import { getNotices } from '../services/noticeDigestService';

const chars = (...codes) => String.fromCharCode(...codes);

describe('sanitizePlainText: markup is removed', () => {
  it.each([
    ['a script tag and its code', 'Hello <script>alert(1)</script>world', 'Hello world'],
    ['an uppercase script tag', 'x<SCRIPT SRC=//evil.example/a.js></SCRIPT>y', 'xy'],
    ['an unclosed script tag', 'safe <script>alert(document.cookie)', 'safe'],
    ['an image with an event handler', 'Fees <img src=x onerror=alert(1)> apply', 'Fees  apply'],
    ['an svg payload', 'Map <svg onload=alert(1)><circle r=1></circle></svg> here', 'Map  here'],
    ['an unclosed svg (everything after it is dropped)', '<svg/onload=alert(1)>text', ''],
    ['an iframe', 'See <iframe src="javascript:alert(1)"></iframe>done', 'See done'],
    ['a style block', 'a<style>body{display:none}</style>b', 'ab'],
    ['a link with a javascript: href', '<a href="javascript:alert(1)">click</a>', 'click'],
    ['a comment', 'one<!-- <script>alert(1)</script> -->two', 'onetwo'],
    ['a declaration', '<!DOCTYPE html>text', 'text'],
    ['a processing instruction', '<?xml version="1.0"?>text', 'text'],
    ['tags split to survive one pass', '<scr<script>ipt>alert(1)</scr</script>ipt>', ''],
    ['a closing tag on its own', 'text</div>', 'text'],
    ['math content', 'a<math><mi xlink:href="javascript:alert(1)">x</mi></math>b', 'ab'],
  ])('removes %s', (_name, input, expected) => {
    expect(sanitizePlainText(input)).toBe(expected);
    expect(sanitizePlainText(input)).not.toMatch(/<\s*\/?\s*[a-z]/i);
  });

  it('removes control characters and invisible direction overrides', () => {
    expect(sanitizePlainText(`ab${chars(0)}c${chars(0x202e)}d${chars(0x7f)}e`)).toBe('abcde');
  });

  it('can flatten whitespace for single-line fields and caps the length', () => {
    expect(sanitizePlainText('a\n\n  b', { multiline: false })).toBe('a b');
    expect(sanitizePlainText('x'.repeat(10000))).toHaveLength(5000);
    expect(sanitizePlainText('x'.repeat(50), { max: 10 })).toHaveLength(10);
  });
});

describe('sanitizePlainText: ordinary text with angle brackets is kept', () => {
  it.each([
    'Fee < 500 rupees',
    'Income > 2 lakh and age < 60',
    'Processing takes <= 7 days (>= 3 if urgent)',
    '5 < 10 > 3',
    'Apply at counter 1 -> counter 2',
    'Use the <500 form only when listed',
    'Arrows <- and -> and <=> are fine',
    'Wait: a < b and b > c',
    'Email us <help@example.org>',
    'ratio 1:2 <3',
    'Pay Rs. 100 < Rs. 200',
    'Is 3 < math marks? Yes, and 4 < script length',
  ])('keeps "%s"', (text) => {
    expect(sanitizePlainText(text)).toBe(text);
  });

  it('keeps Hindi, emoji and punctuation', () => {
    const hindi = String.fromCodePoint(0x091c, 0x0928, 0x094d, 0x092e);
    expect(sanitizePlainText(`${hindi} & "quotes" 'single' ₹500`)).toBe(`${hindi} & "quotes" 'single' ₹500`);
  });

  it('is idempotent', () => {
    const once = sanitizePlainText('a <b>bold</b> <script>x</script> c < d');
    expect(sanitizePlainText(once)).toBe(once);
  });

  it('handles non-strings', () => {
    expect(sanitizePlainText(null)).toBe('');
    expect(sanitizePlainText(undefined)).toBe('');
    expect(sanitizePlainText(42)).toBe('42');
  });
});

describe('sanitizeTextFields', () => {
  it('cleans every string in nested data and keeps the shape and other types', () => {
    const input = {
      id: 'x',
      name: 'Guide <script>alert(1)</script>',
      steps: [{ title: '<b>One</b>', done: true, count: 3 }],
      nested: { deeper: ['<img src=x onerror=alert(1)>ok'] },
      nothing: null,
    };
    expect(sanitizeTextFields(input)).toEqual({
      id: 'x',
      name: 'Guide',
      steps: [{ title: 'One', done: true, count: 3 }],
      nested: { deeper: ['ok'] },
      nothing: null,
    });
  });

  it('does not mutate its input and cuts off absurdly deep data', () => {
    const input = { a: '<i>x</i>' };
    sanitizeTextFields(input);
    expect(input.a).toBe('<i>x</i>');
    let deep = { v: '<b>x</b>' };
    for (let i = 0; i < 50; i += 1) deep = { child: deep };
    expect(() => sanitizeTextFields(deep)).not.toThrow();
  });
});

describe('safeHttpUrl', () => {
  it('accepts http and https URLs', () => {
    expect(safeHttpUrl('https://www.india.gov.in/services?id=1#top')).toBe('https://www.india.gov.in/services?id=1#top');
    expect(safeHttpUrl('  http://example.org  ')).toBe('http://example.org/');
  });

  it.each([
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    `java${chars(9)}script:alert(1)`,
    `${chars(1)}javascript:alert(1)`,
    ' javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    'blob:https://example.org/x',
    'ftp://example.org/file',
    '//evil.example/path',
    '/relative/path',
    'example.org',
    'https://user:pass@example.org/',
    'https://',
    '',
    '   ',
    null,
    undefined,
    42,
    { href: 'https://example.org' },
    `https://example.org/${'a'.repeat(3000)}`,
  ])('rejects %j', (value) => {
    expect(safeHttpUrl(value)).toBe('');
  });
});

describe('safeTelHref and safeMailtoHref', () => {
  it('build links from phone-like and email-like values only', () => {
    expect(safeTelHref('+91 98765-43210')).toBe('tel:+919876543210');
    expect(safeTelHref('1800 11 2345')).toBe('tel:1800112345');
    expect(safeTelHref('112;ext=<script>')).toBe('');
    expect(safeTelHref('javascript:alert(1)')).toBe('');
    expect(safeMailtoHref('help@example.org')).toBe('mailto:help@example.org');
    expect(safeMailtoHref('a@b.co?subject=x&bcc=evil@example.org')).toBe('');
    expect(safeMailtoHref('javascript:alert(1)')).toBe('');
  });
});

describe('stored content is cleaned where the app reads it', () => {
  let store;
  beforeEach(() => {
    store = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, String(value)),
      removeItem: (key) => store.delete(key),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('service guides saved with markup come back as plain text', () => {
    store.set(
      CUSTOM_SERVICES_KEY,
      JSON.stringify([
        {
          id: 'evil-guide',
          name: 'Ration <img src=x onerror=alert(1)>Card',
          shortDescription: 'Apply <script>alert(document.cookie)</script>online. Fee < 500.',
          steps: [{ title: '<b onmouseover=alert(1)>Step</b>', description: 'Visit <a href="javascript:alert(1)">here</a>' }],
        },
      ])
    );
    const guide = getAllServices().find((s) => s.id === 'evil-guide');
    expect(guide.name).toBe('Ration Card');
    expect(guide.shortDescription).toBe('Apply online. Fee < 500.');
    expect(guide.steps[0]).toEqual({ title: 'Step', description: 'Visit here' });
  });

  it('notices saved with markup come back as plain text', () => {
    store.set(
      'civicbridge_public_notices_digest_v1',
      JSON.stringify([{ id: 'n1', title: '<script>alert(1)</script>Fee change', summary: 'See <b onmouseover=alert(1)>order</b>' }])
    );
    const customStorage = { getItem: (key) => store.get(key) ?? null, setItem: () => {} };
    const evil = getNotices(customStorage).find((n) => n.id === 'n1');
    expect(evil.title).toBe('Fee change');
    expect(evil.summary).toBe('See order');
  });
});

describe('components that show data render it as text and drop unsafe links', () => {
  const revision = {
    version: 'v2',
    title: '<img src=x onerror=alert(1)>Fee order',
    effectiveDate: '2024-04-01',
    summary: '<script>alert(1)</script>Revised',
    sourceUrl: 'javascript:alert(document.cookie)',
    circularNumber: 'GO-1',
    changes: [],
  };

  it('escapes markup in text and omits a javascript: link', () => {
    const html = renderToStaticMarkup(<VersionHistoryTimeline revisions={[revision]} />);
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('href="javascript:');
    expect(html).toContain('&lt;img');
  });

  it('still links a normal https source', () => {
    const html = renderToStaticMarkup(
      <VersionHistoryTimeline revisions={[{ ...revision, sourceUrl: 'https://egazette.gov.in/order.pdf' }]} />
    );
    expect(html).toContain('href="https://egazette.gov.in/order.pdf"');
  });
});

describe('inventory: raw HTML sinks in the source', () => {
  const SRC = fileURLToPath(new URL('..', import.meta.url));
  const files = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(js|jsx)$/.test(name) && !/\.test\./.test(name)) files.push(full);
    }
  };
  walk(SRC);
  const rel = (file) => relative(SRC, file).replace(/\\/g, '/');
  const hits = (pattern) => files.filter((file) => pattern.test(readFileSync(file, 'utf8'))).map(rel).sort();

  it('React is never told to insert markup', () => {
    expect(hits(/dangerouslySetInnerHTML/)).toEqual([]);
  });

  it('no element has its markup set directly, and nothing is inserted as HTML', () => {
    expect(hits(/\.innerHTML\s*=|\.outerHTML\s*=|insertAdjacentHTML|createContextualFragment|DOMParser/)).toEqual([]);
  });

  it('document.write exists only in the three print windows, which escape their text (printHtml.js)', () => {
    expect(hits(/document\.write\(/)).toEqual([
      'components/services/FormTemplatePreview.jsx',
      'components/services/RtiPreviewLetter.jsx',
      'components/tracking/AppellateEscalationModal.jsx',
    ]);
  });

  it('nothing evaluates strings as code', () => {
    expect(hits(/\beval\(|new Function\(|setTimeout\(\s*['"`]|setInterval\(\s*['"`]/)).toEqual([]);
  });

  it('every link built from a source or notice URL goes through safeHttpUrl', () => {
    const offenders = hits(/href=\{(?!safeHttpUrl|`|helplineService|calendarExportService|checklistExportService|appointment\.|office\.|currentActive|inspected\.|src\.cleanUrl|url\}|target\.id)[^}]*(?:sourceUrl|officialUrl|\.url|officialSource)[^}]*\}/);
    expect(offenders).toEqual([]);
  });
});
