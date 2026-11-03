import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import DocumentQualityOcrInspectorModal from './DocumentQualityOcrInspectorModal';

const mockDocs = [
  { id: 'doc-aadhaar-1', name: 'My Aadhaar Card', type: 'image/jpeg' },
  { id: 'doc-pan-2', name: 'PAN Card Copy', type: 'image/png' },
];

describe('DocumentQualityOcrInspectorModal', () => {
  it('does not render when isOpen is false', () => {
    const html = renderToStaticMarkup(
      <DocumentQualityOcrInspectorModal isOpen={false} documents={mockDocs} onClose={() => {}} />
    );
    expect(html).toBe('');
  });

  it('renders modal with consent requirement and disclaimer when open', () => {
    const html = renderToStaticMarkup(
      <DocumentQualityOcrInspectorModal isOpen={true} documents={mockDocs} onClose={() => {}} />
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain('Consent-Based Document Quality &amp; OCR Inspector');
    expect(html).toContain('Voluntary Client-Side Inspection Consent');
    expect(html).toContain('I give consent to inspect this document locally');
    expect(html).toContain('Bypass &amp; Accept Document Anyway');
    expect(html).toContain('My Aadhaar Card');
  });
});
