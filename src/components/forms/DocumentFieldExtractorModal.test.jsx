import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import DocumentFieldExtractorModal from './DocumentFieldExtractorModal';

describe('DocumentFieldExtractorModal Component (#478)', () => {
  it('renders modal with caution warning regarding OCR inaccuracies and user confirmation', () => {
    const html = renderToStaticMarkup(
      <DocumentFieldExtractorModal
        isOpen={true}
        onClose={() => {}}
        targetForm={{}}
      />
    );

    expect(html).toContain('AI Document Field Extractor');
    expect(html).toContain('Citizen Confirmation Required:');
    expect(html).toContain('Optical extraction may misread numbers');
    expect(html).toContain('Paste Document Text or OCR Transcript');
    expect(html).toContain('Extract Candidate Fields');
  });

  it('does not render when isOpen is false', () => {
    const html = renderToStaticMarkup(
      <DocumentFieldExtractorModal
        isOpen={false}
        onClose={() => {}}
        targetForm={{}}
      />
    );

    expect(html).toBe('');
  });
});
