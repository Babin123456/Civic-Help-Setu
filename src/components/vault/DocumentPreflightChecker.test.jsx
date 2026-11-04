import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import DocumentPreflightChecker from './DocumentPreflightChecker';
import { validatePreflightFile } from '../../services/documentValidatorService';

describe('DocumentPreflightChecker Component', () => {
  it('renders preflight checker with documented allowed file formats and maximum size', () => {
    const html = renderToStaticMarkup(<DocumentPreflightChecker />);
    expect(html).toContain('Document Pre-flight Readiness Inspector');
    expect(html).toContain('Allowed formats: PDF, JPG, or PNG, up to 2 MB.');
    expect(html).toContain('accept=".pdf,.jpg,.jpeg,.png"');
    expect(html).toContain('aria-describedby="preflight-file-hint"');
  });

  it('rejects empty, oversized, unsupported, and mismatched files via validation', () => {
    // Missing / empty
    expect(validatePreflightFile(null).valid).toBe(false);
    expect(validatePreflightFile({ name: 'empty.pdf', size: 0, type: 'application/pdf' }).valid).toBe(false);

    // Oversized (> 2 MB)
    expect(validatePreflightFile({ name: 'big.pdf', size: 3 * 1024 * 1024, type: 'application/pdf' }).valid).toBe(false);

    // Unsupported format
    expect(validatePreflightFile({ name: 'app.exe', size: 1024, type: 'application/x-msdownload' }).valid).toBe(false);

    // Mismatched extension and MIME type
    expect(validatePreflightFile({ name: 'doc.pdf', size: 1024, type: 'image/png' }).valid).toBe(false);
    expect(validatePreflightFile({ name: 'image.png', size: 1024, type: 'application/pdf' }).valid).toBe(false);

    // Valid file
    expect(validatePreflightFile({ name: 'valid.pdf', size: 500 * 1024, type: 'application/pdf' }).valid).toBe(true);
  });

  it('ensures document file names are rendered as escaped text, not raw HTML', () => {
    const maliciousName = '<img src=x onerror=alert(1)>.pdf';
    const val = validatePreflightFile({ name: maliciousName, size: 500 * 1024, type: 'application/pdf' });
    expect(val.valid).toBe(true);

    const html = renderToStaticMarkup(<span>{maliciousName}</span>);
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;.pdf');
  });
});
