import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import Profile from './Profile';

// Polyfill localStorage for node SSR test
if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  };
}

// Mock useAuth directly
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'user_123',
      username: 'citizen_rajesh',
      email: 'rajesh.kumar@example.com',
      role: 'citizen',
      isClerk: true,
      imageUrl: null,
      raw: {
        firstName: 'Rajesh',
        lastName: 'Kumar',
        createdAt: '2026-01-15T00:00:00.000Z',
        unsafeMetadata: {
          phone: '+91 98765 43210',
          city: 'Bengaluru',
          state: 'Karnataka',
          occupation: 'Self-Employed',
          bio: 'Civil rights volunteer',
        },
      },
    },
    logout: vi.fn(),
    clerk: null,
  }),
}));

// Mock child modals and panels
vi.mock('../components/profile/NotificationPreferenceCenter', () => ({
  default: () => null,
}));
vi.mock('../components/profile/DataPortabilityModal', () => ({
  default: () => null,
}));
vi.mock('../components/profile/ShareableProfileModal', () => ({
  default: () => null,
}));
vi.mock('../components/profile/CivicEntitlementReadinessCard', () => ({
  default: () => <div data-testid="entitlement-readiness-card">Readiness Card</div>,
}));
vi.mock('../components/profile/VoluntaryProfileRecommendationPanel', () => ({
  default: () => null,
}));
vi.mock('../components/privacy/ClearMyDataPanel', () => ({
  default: () => null,
}));

describe('Profile page form grouping and feedback (#586)', () => {
  it('renders categorized field headings, avatar area, and action buttons', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/profile']}>
        <Profile />
      </MemoryRouter>
    );

    expect(html).toContain('Citizen Profile &amp; Preferences');
    expect(html).toContain('Personal Information');
    expect(html).toContain('Jurisdiction &amp; Demographics');
    expect(html).toContain('Private Notes &amp; Bio');
    expect(html).toContain('Notification Preferences');
    expect(html).toContain('Citizen Data Portability');
    expect(html).toContain('Share Profile');
    expect(html).toContain('Edit Profile');
  });

  it('renders stat cards for saved guides and auth status', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/profile']}>
        <Profile />
      </MemoryRouter>
    );

    expect(html).toContain('Saved Guides');
    expect(html).toContain('Auth Status');
    expect(html).toContain('Active');
  });
});
