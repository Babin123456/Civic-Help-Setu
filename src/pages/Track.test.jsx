import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import Track from './Track';
import { ToastProvider } from '../context/ToastContext';
import { AuthProvider } from '../context/AuthContext';

// Polyfill localStorage for node SSR test
if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  };
}

// Mock child modals that require external authentication or router contexts
vi.mock('../components/grievance/GrievanceEvidenceOrganizerModal', () => ({
  default: () => null,
}));
vi.mock('../components/grievance/CivicGrievanceDraftingAssistantModal', () => ({
  default: () => null,
}));

describe('Track page integration (#582)', () => {
  it('renders application tracking title, search controls, and timeline components', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/track']}>
        <AuthProvider>
          <ToastProvider>
            <Track />
          </ToastProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    expect(html).toContain('Track your civic service status');
    expect(html).toContain('Application reference ID');
    expect(html).toContain('Grievance Drafter');
    expect(html).toContain('Grievance Organizer');
    expect(html).toContain('Track application');
  });

  it('renders application search section with reference input', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/track']}>
        <AuthProvider>
          <ToastProvider>
            <Track />
          </ToastProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    expect(html).toContain('Application reference ID');
    expect(html).toContain('track-reference-help');
    expect(html).toContain('Journey Planner');
  });
});
