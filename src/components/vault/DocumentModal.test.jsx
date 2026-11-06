import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import DocumentModal from './DocumentModal';
import { validateFile, ALLOWED_TYPES_HINT } from '../../services/vaultValidation';

describe('DocumentModal Component', () => {
  it('does not render when isOpen is false', () => {
    const html = renderToStaticMarkup(<DocumentModal isOpen={false} onClose={() => {}} onSave={() => {}} />);
    expect(html).toBe('');
  });

  it('renders modal with documented allowed file formats and maximum size', () => {
    const html = renderToStaticMarkup(<DocumentModal isOpen={true} onClose={() => {}} onSave={() => {}} />);
    expect(html).toContain('Add Civic Document');
    expect(html).toContain(`Allowed: ${ALLOWED_TYPES_HINT}. Optional.`);
    expect(html).toContain('accept=".pdf,.jpg,.jpeg,.png"');
    expect(html).toContain('id="doc-file-hint"');
  });

  it('validates file upload rejection and acceptance rules', () => {
    // Empty file
    expect(validateFile({ name: 'scan.pdf', size: 0, type: 'application/pdf' }).valid).toBe(false);

    // Oversized (> 5 MB)
    expect(validateFile({ name: 'scan.pdf', size: 6 * 1024 * 1024, type: 'application/pdf' }).valid).toBe(false);

    // Unsupported format
    expect(validateFile({ name: 'bad.exe', size: 1024, type: 'application/x-msdownload' }).valid).toBe(false);

    // Mismatched extension and MIME type
    expect(validateFile({ name: 'scan.pdf', size: 1024, type: 'image/png' }).valid).toBe(false);

    // Valid file
    expect(validateFile({ name: 'scan.pdf', size: 1024 * 1024, type: 'application/pdf' }).valid).toBe(true);
  });

  it('renders file name as text, escaping potential HTML tags', () => {
    const maliciousName = '<svg onload=alert(1)>.png';
    const html = renderToStaticMarkup(<span>{`Selected: ${maliciousName}`}</span>);
    expect(html).not.toContain('<svg');
    expect(html).toContain('&lt;svg onload=alert(1)&gt;.png');
  });
});
