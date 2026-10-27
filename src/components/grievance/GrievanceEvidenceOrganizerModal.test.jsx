import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import GrievanceEvidenceOrganizerModal from './GrievanceEvidenceOrganizerModal.jsx';
import { ToastProvider } from '../../context/ToastContext.jsx';
import { AuthProvider } from '../../context/AuthContext.jsx';

const renderModal = (props = {}) => {
  return renderToStaticMarkup(
    <MemoryRouter>
      <AuthProvider>
        <ToastProvider>
          <GrievanceEvidenceOrganizerModal isOpen={true} onClose={vi.fn()} {...props} />
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>
  );
};

describe('GrievanceEvidenceOrganizerModal (#143)', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    });
  });

  it('does not render when isOpen is false', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <AuthProvider>
          <ToastProvider>
            <GrievanceEvidenceOrganizerModal isOpen={false} onClose={vi.fn()} />
          </ToastProvider>
        </AuthProvider>
      </MemoryRouter>
    );
    expect(html).toBe('');
  });

  it('renders modal title, disclaimer banner distinguishing preparation from filing', () => {
    const html = renderModal();

    expect(html).toContain('Civic Grievance Evidence Organizer');
    expect(html).toContain('Preparation Workspace Notice:');
    expect(html).toContain('DOES NOT officially file, submit, or adjudicate grievances');
    expect(html).toContain('CPGRAMS (pgportal.gov.in)');
  });

  it('renders empty drafts view with New Draft button when no drafts exist', () => {
    const html = renderModal();

    expect(html).toContain('No drafts yet. Click &quot;New Draft&quot; to begin preparing your complaint.');
    expect(html).toContain('No Grievance Draft Selected');
    expect(html).toContain('Create Preparation Draft');
  });
});
