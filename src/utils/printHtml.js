/**
 * Helpers for the print windows (RTI draft, first appeal notice, form templates).
 * Those windows are written with document.write, so anything the user typed has to be
 * escaped before it goes into the markup. Otherwise "<" and "&" get eaten and tags run.
 */

const HTML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);

/**
 * Full HTML document for a plain-text letter, shown in a <pre>.
 */
export const buildLetterPrintHtml = (title, text) =>
  `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{font-family:serif;font-size:13pt;line-height:1.6;padding:40px;}pre{font-family:inherit;white-space:pre-wrap;}</style></head><body><pre>${escapeHtml(text)}</pre></body></html>`;

/**
 * Fills a window opened with window.open('', '_blank') using DOM properties instead of
 * document.write, so the title and the text are never parsed as markup. Used by the
 * petition drafters, where the title carries a name the user typed.
 */
export const fillTextPrintWindow = (printWindow, title, text, bodyStyle = '') => {
  const doc = printWindow.document;
  doc.title = String(title ?? '');
  if (bodyStyle) doc.body.style.cssText = bodyStyle;
  doc.body.textContent = String(text ?? '');
};

export const PETITION_PRINT_BODY_STYLE =
  'font-family: monospace; padding: 2rem; white-space: pre-wrap; font-size: 12px; line-height: 1.5; color: #000;';
