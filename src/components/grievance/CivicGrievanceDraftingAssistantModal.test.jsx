import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import CivicGrievanceDraftingAssistantModal from './CivicGrievanceDraftingAssistantModal.jsx';
import { ToastProvider } from '../../context/ToastContext.jsx';

const renderModal = (props = {}) => {
  return renderToStaticMarkup(
    <ToastProvider>
      <CivicGrievanceDraftingAssistantModal isOpen={true} onClose={vi.fn()} {...props} />
    </ToastProvider>
  );
};

describe('CivicGrievanceDraftingAssistantModal (#404)', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    });
  });

  it('does not render when isOpen is false', () => {
    const html = renderToStaticMarkup(
      <ToastProvider>
        <CivicGrievanceDraftingAssistantModal isOpen={false} onClose={vi.fn()} />
      </ToastProvider>
    );
    expect(html).toBe('');
  });

  it('renders modal header, grounded fact notice, and disclaimer', () => {
    const html = renderModal();
    expect(html).toContain('Civic Grievance Drafting Assistant');
    expect(html).toContain('Structure professional petitions without AI invention or hallucinations');
    expect(html).toContain('Fact-Controlled Drafting:');
    expect(html).toContain('Draft Grievance Petition');
    expect(html).toContain('Saved Drafts');
  });

  it('renders form inputs for category, issue description, and privacy control', () => {
    const html = renderModal();
    expect(html).toContain('Civic Category *');
    expect(html).toContain('Issue Description &amp; Core Facts *');
    expect(html).toContain('Omit personal contact details from draft (Recommended for privacy)');
    expect(html).toContain('Structure Grievance Draft');
  });
});
