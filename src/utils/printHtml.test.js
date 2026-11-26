import { describe, it, expect } from 'vitest';
import { escapeHtml, buildLetterPrintHtml, fillTextPrintWindow } from './printHtml';

describe('escapeHtml', () => {
  it('escapes & < > " and \'', () => {
    expect(escapeHtml(`a & b < c > d "e" 'f'`)).toBe('a &amp; b &lt; c &gt; d &quot;e&quot; &#39;f&#39;');
  });

  it('escapes the ampersand first so entities are not double-escaped by the later rules', () => {
    expect(escapeHtml('<')).toBe('&lt;');
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });

  it('turns null, undefined and numbers into strings', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
    expect(escapeHtml(42)).toBe('42');
  });
});

describe('buildLetterPrintHtml', () => {
  const text = 'Flat <b>12</b> & Co\nList works < Rs 50,000 <img src=x onerror="window.__pwned=1">';

  it('puts the letter in a <pre> without letting tags through', () => {
    const html = buildLetterPrintHtml('RTI Application Form', text);
    expect(html).toContain('<title>RTI Application Form</title>');
    expect(html).toContain('<pre>Flat &lt;b&gt;12&lt;/b&gt; &amp; Co\nList works &lt; Rs 50,000 &lt;img src=x onerror=&quot;window.__pwned=1&quot;&gt;</pre>');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<b>');
  });

  it('escapes the title too', () => {
    const html = buildLetterPrintHtml('</title><script>x()</script>', 'hi');
    expect(html).not.toContain('<script>');
  });
});

describe('fillTextPrintWindow', () => {
  const makeWindow = () => ({
    document: {
      title: '',
      body: { style: { cssText: '' }, textContent: '' },
      write: () => {
        throw new Error('document.write must not be used');
      },
    },
  });

  it('sets the title and body as plain text and never calls document.write', () => {
    const win = makeWindow();
    fillTextPrintWindow(win, '</title><img src=x onerror=alert(1)>', '<b>Hi</b> & bye', 'color: #000;');
    expect(win.document.title).toBe('</title><img src=x onerror=alert(1)>');
    expect(win.document.body.textContent).toBe('<b>Hi</b> & bye');
    expect(win.document.body.style.cssText).toBe('color: #000;');
  });

  it('turns null and undefined into empty strings and leaves the style alone when none is given', () => {
    const win = makeWindow();
    fillTextPrintWindow(win, undefined, null);
    expect(win.document.title).toBe('');
    expect(win.document.body.textContent).toBe('');
    expect(win.document.body.style.cssText).toBe('');
  });
});
