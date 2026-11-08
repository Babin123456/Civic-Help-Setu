import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../context/LanguageContext';
import { ThemeProvider } from '../context/ThemeContext';
import { NetworkProvider } from '../context/NetworkContext';
import { ToastProvider } from '../context/ToastContext';
import Navbar from './Navbar';

const mockAuthState = {
  user: null,
  logout: vi.fn(),
};

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(() => mockAuthState),
  AuthProvider: ({ children }) => children,
}));

describe('Navbar active navigation and current-page cues (#575)', () => {
  beforeEach(() => {
    mockAuthState.user = null;
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
    });
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: false,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })));
  });

  const renderNav = (initialPath = '/', props = { initialOpen: true }) => {
    return renderToStaticMarkup(
      <MemoryRouter initialEntries={[initialPath]}>
        <ToastProvider>
          <ThemeProvider>
            <NetworkProvider>
              <LanguageProvider>
                <Navbar {...props} />
              </LanguageProvider>
            </NetworkProvider>
          </ThemeProvider>
        </ToastProvider>
      </MemoryRouter>
    );
  };

  const getLinkByHref = (html, href) => {
    // Matches the anchor tag corresponding to exact href attribute
    const escapedHref = href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`<a\\b[^>]*href="${escapedHref}"[^>]*>[\\s\\S]*?<\\/a>`);
    const match = html.match(regex);
    return match ? match[0] : null;
  };

  it('drawer is closed by default when initialOpen is not specified', () => {
    const html = renderNav('/', { initialOpen: false });
    expect(html).not.toContain('class="mobile-drawer-dropdown"');
    expect(html).not.toContain('href="/services"');
  });

  it('renders all public navigation destinations when drawer is open', () => {
    const html = renderNav('/');
    const publicRoutes = [
      '/services',
      '/acronyms',
      '/eligibility',
      '/nearby',
      '/track',
      '/assistant',
      '/login',
    ];

    publicRoutes.forEach((route) => {
      const link = getLinkByHref(html, route);
      expect(link, `expected link for ${route} to be present`).not.toBeNull();
    });
  });

  it('marks /services as active on /services', () => {
    const html = renderNav('/services');
    const servicesLink = getLinkByHref(html, '/services');

    expect(servicesLink).not.toBeNull();
    expect(servicesLink).toContain('aria-current="page"');
    expect(servicesLink).toContain('is-active');
    expect(servicesLink).toContain('nav-drawer-indicator');
  });

  it('marks /services as active on nested service detail route /services/:id', () => {
    const html = renderNav('/services/pan-card');
    const servicesLink = getLinkByHref(html, '/services');

    expect(servicesLink).not.toBeNull();
    expect(servicesLink).toContain('aria-current="page"');
    expect(servicesLink).toContain('is-active');
    expect(servicesLink).toContain('nav-drawer-indicator');

    // Inactive link should not receive active cues
    const acronymsLink = getLinkByHref(html, '/acronyms');
    expect(acronymsLink).not.toContain('aria-current');
    expect(acronymsLink).not.toContain('is-active');
    expect(acronymsLink).not.toContain('nav-drawer-indicator');
  });

  it('marks /eligibility as active on /eligibility', () => {
    const html = renderNav('/eligibility');
    const eligibilityLink = getLinkByHref(html, '/eligibility');

    expect(eligibilityLink).not.toBeNull();
    expect(eligibilityLink).toContain('aria-current="page"');
    expect(eligibilityLink).toContain('is-active');
    expect(eligibilityLink).toContain('nav-drawer-indicator');
  });

  it('marks /acronyms as active on /acronyms', () => {
    const html = renderNav('/acronyms');
    const acronymsLink = getLinkByHref(html, '/acronyms');

    expect(acronymsLink).not.toBeNull();
    expect(acronymsLink).toContain('aria-current="page"');
    expect(acronymsLink).toContain('is-active');
    expect(acronymsLink).toContain('nav-drawer-indicator');
  });

  it('marks /nearby as active on /nearby', () => {
    const html = renderNav('/nearby');
    const nearbyLink = getLinkByHref(html, '/nearby');

    expect(nearbyLink).not.toBeNull();
    expect(nearbyLink).toContain('aria-current="page"');
    expect(nearbyLink).toContain('is-active');
    expect(nearbyLink).toContain('nav-drawer-indicator');
  });

  it('marks /nearby as active on /nearby-offices alias route', () => {
    const html = renderNav('/nearby-offices');
    const nearbyLink = getLinkByHref(html, '/nearby');

    expect(nearbyLink).not.toBeNull();
    expect(nearbyLink).toContain('aria-current="page"');
    expect(nearbyLink).toContain('is-active');
    expect(nearbyLink).toContain('nav-drawer-indicator');
  });

  it('marks /track as active on /track', () => {
    const html = renderNav('/track');
    const trackLink = getLinkByHref(html, '/track');

    expect(trackLink).not.toBeNull();
    expect(trackLink).toContain('aria-current="page"');
    expect(trackLink).toContain('is-active');
    expect(trackLink).toContain('nav-drawer-indicator');
  });

  it('marks /assistant as active on /assistant', () => {
    const html = renderNav('/assistant');
    const assistantLink = getLinkByHref(html, '/assistant');

    expect(assistantLink).not.toBeNull();
    expect(assistantLink).toContain('aria-current="page"');
    expect(assistantLink).toContain('is-active');
    expect(assistantLink).toContain('nav-drawer-indicator');
  });

  it('does not incorrectly mark inactive links with aria-current or is-active', () => {
    const html = renderNav('/services');
    const otherRoutes = ['/acronyms', '/eligibility', '/nearby', '/track', '/assistant'];

    otherRoutes.forEach((route) => {
      const link = getLinkByHref(html, route);
      expect(link).not.toBeNull();
      expect(link).not.toContain('aria-current');
      expect(link).not.toContain('is-active');
      expect(link).not.toContain('nav-drawer-indicator');
    });
  });

  it('handles trailing slash paths gracefully', () => {
    const html = renderNav('/services/');
    const servicesLink = getLinkByHref(html, '/services');

    expect(servicesLink).not.toBeNull();
    expect(servicesLink).toContain('aria-current="page"');
    expect(servicesLink).toContain('is-active');
  });

  it('shows authenticated links when user is authenticated, and does not show sign in', () => {
    mockAuthState.user = { id: 'u1', username: 'TestCitizen', role: 'citizen' };
    const html = renderNav('/vault');

    const vaultLink = getLinkByHref(html, '/vault');
    const savedLink = getLinkByHref(html, '/saved');
    const profileLink = getLinkByHref(html, '/profile');

    expect(vaultLink).not.toBeNull();
    expect(vaultLink).toContain('aria-current="page"');
    expect(vaultLink).toContain('is-active');

    expect(savedLink).not.toBeNull();
    expect(profileLink).not.toBeNull();

    // Citizen does not have admin link
    expect(getLinkByHref(html, '/admin')).toBeNull();

    // Sign in link is not rendered; Sign out button is present
    expect(getLinkByHref(html, '/login')).toBeNull();
    expect(html).toContain('Sign Out');
  });

  it('shows admin portal only when user has admin role and marks it active on /admin and /admin/*', () => {
    mockAuthState.user = { id: 'a1', username: 'AdminUser', role: 'admin' };
    const html = renderNav('/admin');

    const adminLink = getLinkByHref(html, '/admin');
    expect(adminLink).not.toBeNull();
    expect(adminLink).toContain('aria-current="page"');
    expect(adminLink).toContain('is-active');
    expect(adminLink).toContain('nav-drawer-link--admin');

    const subHtml = renderNav('/admin/users');
    const subAdminLink = getLinkByHref(subHtml, '/admin');
    expect(subAdminLink).not.toBeNull();
    expect(subAdminLink).toContain('aria-current="page"');
    expect(subAdminLink).toContain('is-active');
  });

  it('marks /login as active on /login for unauthenticated users', () => {
    const html = renderNav('/login');
    const loginLink = getLinkByHref(html, '/login');

    expect(loginLink).not.toBeNull();
    expect(loginLink).toContain('aria-current="page"');
  });
});

