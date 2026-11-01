import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import DocumentTypeGuidanceModal from './DocumentTypeGuidanceModal.jsx';
import { ToastProvider } from '../../context/ToastContext.jsx';

const mockService = {
  id: 'SRV-TEST-GUIDE',
  name: 'Old Age Social Security Pension',
  documents: [
    'Aadhaar Card',
    'Recent Electricity Bill',
    'Special Welfare Form 99',
  ],
};

const renderModal = (props = {}) => {
  return renderToStaticMarkup(
    <ToastProvider>
      <DocumentTypeGuidanceModal
        isOpen={true}
        onClose={vi.fn()}
        service={mockService}
        {...props}
      />
    </ToastProvider>
  );
};

describe('DocumentTypeGuidanceModal (#405)', () => {
  it('does not render when isOpen is false', () => {
    const html = renderToStaticMarkup(
      <ToastProvider>
        <DocumentTypeGuidanceModal isOpen={false} onClose={vi.fn()} service={mockService} />
      </ToastProvider>
    );
    expect(html).toBe('');
  });

  it('renders modal header, zero ingestion guarantee banner, and service name', () => {
    const html = renderModal();
    expect(html).toContain('Document-Type Requirements Guidance');
    expect(html).toContain('Old Age Social Security Pension');
    expect(html).toContain('Zero Document Ingestion Guarantee:');
    expect(html).toContain('never uploads, inspects, parses, or retains');
  });

  it('renders standard and ambiguous requirements with rules and examples', () => {
    const html = renderModal();
    expect(html).toContain('Aadhaar Card');
    expect(html).toContain('Proof of Identity');
    expect(html).toContain('Official Acceptance Rule:');
    expect(html).toContain('Acceptable Document Examples:');
    expect(html).toContain('Special Welfare Form 99');
    expect(html).toContain('Needs Department Confirmation');
  });
});
