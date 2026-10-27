import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import AccessibilityNeedsPlannerModal from './AccessibilityNeedsPlannerModal.jsx';
import { ToastProvider } from '../../context/ToastContext.jsx';

const renderModal = (props = {}) => {
  return renderToStaticMarkup(
    <MemoryRouter>
      <ToastProvider>
        <AccessibilityNeedsPlannerModal isOpen={true} onClose={vi.fn()} {...props} />
      </ToastProvider>
    </MemoryRouter>
  );
};

describe('AccessibilityNeedsPlannerModal (#144)', () => {
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
        <ToastProvider>
          <AccessibilityNeedsPlannerModal isOpen={false} onClose={vi.fn()} />
        </ToastProvider>
      </MemoryRouter>
    );
    expect(html).toBe('');
  });

  it('renders modal title, office selector, and feature status labels', () => {
    const html = renderModal({ initialOfficeId: 'delhi-south-collectorate' });

    expect(html).toContain('Public-Service Accessibility Needs Planner');
    expect(html).toContain('Select Public Service Office:');
    expect(html).toContain('Step-Free Entrance &amp; Ramp');
    expect(html).toContain('Verified Available');
    expect(html).toContain('Not Verified');
  });

  it('renders stale warning when office audit is older than 180 days', () => {
    const html = renderModal({ initialOfficeId: 'delhi-rto-sarai-kale-khan' });

    expect(html).toContain('Stale Audit Record Warning:');
    expect(html).toContain('over 180 days ago');
  });

  it('renders personal visit confirmation checklist and contact links', () => {
    const html = renderModal({ initialOfficeId: 'delhi-south-collectorate' });

    expect(html).toContain('Personal Pre-Visit Confirmation Checklist');
    expect(html).toContain('Call Office');
    expect(html).toContain('Export Checklist');
    expect(html).toContain('Save Visit Plan');
  });
});
