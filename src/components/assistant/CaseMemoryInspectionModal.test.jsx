import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import CaseMemoryInspectionModal from './CaseMemoryInspectionModal';

describe('CaseMemoryInspectionModal component', () => {
  it('exports a valid React component', () => {
    expect(typeof CaseMemoryInspectionModal).toBe('function');
  });

  it('renders nothing when isOpen is false', () => {
    const html = renderToStaticMarkup(
      <CaseMemoryInspectionModal isOpen={false} onClose={() => {}} />
    );
    expect(html).toBe('');
  });

  it('renders accessible dialog with title, tabs, and case identifier when isOpen is true', () => {
    const html = renderToStaticMarkup(
      <CaseMemoryInspectionModal
        isOpen={true}
        onClose={() => {}}
        caseId="case-birth-cert-99"
      />
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('Case Memory &amp; Isolation Control');
    expect(html).toContain('case-birth-cert-99');
    expect(html).toContain('Verified Facts');
    expect(html).toContain('AI Proposals');
    expect(html).toContain('Purge Case Memory');
  });

  it('renders accessible action buttons with proper type="button"', () => {
    const html = renderToStaticMarkup(
      <CaseMemoryInspectionModal
        isOpen={true}
        onClose={() => {}}
        caseId="case-test-1"
      />
    );

    const buttons = html.match(/<button[^>]*>/g) || [];
    expect(buttons.length).toBeGreaterThanOrEqual(4);

    buttons.forEach((btn) => {
      expect(btn).toContain('type="button"');
    });
  });
});
