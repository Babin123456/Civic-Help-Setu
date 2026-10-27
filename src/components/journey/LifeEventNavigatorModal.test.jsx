import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import LifeEventNavigatorModal from './LifeEventNavigatorModal.jsx';
import { ToastProvider } from '../../context/ToastContext.jsx';

const renderModal = (props = {}) => {
  return renderToStaticMarkup(
    <MemoryRouter>
      <ToastProvider>
        <LifeEventNavigatorModal isOpen={true} onClose={vi.fn()} {...props} />
      </ToastProvider>
    </MemoryRouter>
  );
};

describe('LifeEventNavigatorModal (#141)', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    });
  });

  it('does not render markup when isOpen is false', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <ToastProvider>
          <LifeEventNavigatorModal isOpen={false} onClose={vi.fn()} />
        </ToastProvider>
      </MemoryRouter>
    );
    expect(html).toBe('');
  });

  it('renders title, mandatory scope notice, and event options', () => {
    const html = renderModal();

    expect(html).toContain('Civic Life-Event Navigator');
    expect(html).toContain('Civic Help Setu provides an educational roadmap');
    expect(html).toContain('We do not submit applications or change government records on your behalf');
    expect(html).toContain('Moving to a New Home or City');
    expect(html).toContain('Starting College or Higher Education');
    expect(html).toContain('Beginning a First Job or Employment');
    expect(html).toContain('Retirement &amp; Senior Transition');
    expect(html).toContain('Family Change');
  });

  it('displays stage tabs, rationale callouts, and verified source links', () => {
    const html = renderModal();

    expect(html).toContain('Immediate (15-30 Days)');
    expect(html).toContain('Upcoming (30-90 Days)');
    expect(html).toContain('Optional Benefits');
    expect(html).toContain('Why this appears:');
    expect(html).toContain('Verified Source:');
    expect(html).toContain('myAadhaar Self-Service Update Portal');
  });

  it('renders action buttons for export, saving, and reset', () => {
    const html = renderModal();

    expect(html).toContain('Export Summary');
    expect(html).toContain('Save Journey');
    expect(html).toContain('Reset Roadmap');
  });
});
