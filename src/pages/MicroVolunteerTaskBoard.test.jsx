import { readFileSync } from 'node:fs';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import MicroVolunteerTaskBoard from './MicroVolunteerTaskBoard';
import {
  createMemoryStorage,
  resetMicroVolunteerStorageToEmpty,
  rollbackMicroVolunteerStorage,
} from '../services/microVolunteerMigrations';
import { setCurrentActor } from '../services/accessControl';

const mockAuthState = { user: null };
const mockNetworkState = { isOnline: true };

vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockAuthState,
}));

vi.mock('../context/NetworkContext', () => ({
  useNetwork: () => mockNetworkState,
}));

vi.mock('../context/ToastContext', () => ({
  useToast: () => ({
    toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
  }),
}));

const signIn = (user) => {
  mockAuthState.user = user;
  setCurrentActor(user);
};

describe('MicroVolunteerTaskBoard UI (#759)', () => {
  let storage;

  beforeEach(() => {
    storage = createMemoryStorage();
    vi.stubGlobal('localStorage', storage);
    rollbackMicroVolunteerStorage({ storage });
    mockAuthState.user = null;
    mockNetworkState.isOnline = true;
    setCurrentActor(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    setCurrentActor(null);
  });

  const renderPage = () =>
    renderToStaticMarkup(
      <MemoryRouter>
        <MicroVolunteerTaskBoard />
      </MemoryRouter>
    );

  it('renders the public board with a semantic tablist, task cards and privacy disclosure', () => {
    const html = renderPage();

    expect(html).toContain('Civic Micro-Volunteer Task Board');
    expect(html).toContain('role="tablist"');
    expect(html).toContain('role="tab"');
    expect(html).toContain('role="tabpanel"');
    expect(html).toContain('Browse tasks');
    expect(html).toContain('Open tasks');
    expect(html).toContain('separate from official government service applications');
    expect(html).toContain('micro-volunteer-match');
    expect(html).toContain('View details and evidence requirements');
    expect(html).not.toContain('Moderation queue');
    expect(html).not.toContain('Audit trail');
    expect(html).not.toContain('Board operations');
  });

  it('never renders internal ids, account ids, idempotency keys or private notes', () => {
    const html = renderPage();

    expect(html).not.toMatch(/mvt_|mvc_|mvs_/);
    expect(html).not.toContain('idempotencyKey');
    expect(html).not.toContain('payloadHash');
    expect(html).not.toContain('createdBy');
    expect(html).not.toContain('citizenId');
    expect(html).not.toContain('Private reviewer note');
  });

  it('gives a citizen contributor the activity and suggestion tabs but not moderation', () => {
    signIn({ id: 'citizen-one', role: 'citizen', username: 'CitizenA' });
    const html = renderPage();

    expect(html).toContain('My activity');
    expect(html).toContain('Suggestions');
    expect(html).not.toContain('Moderation queue');
    expect(html).not.toContain('Audit trail');
    expect(html).toContain('Citizen contributor');
  });

  it('gives a reviewer the moderation queue and audit trail without task creation', () => {
    signIn({
      id: 'reviewer-ward42',
      role: 'staff',
      microVolunteerRole: 'reviewer',
      jurisdictionIds: ['WARD-042'],
    });
    const html = renderPage();

    expect(html).toContain('Moderation queue');
    expect(html).toContain('Audit trail');
    expect(html).toContain('Moderator / reviewer');
    expect(html).not.toContain('Publish a task');
    expect(html).not.toContain('Board operations');
  });

  it('gives a ward operator task creation without moderation or administration', () => {
    signIn({
      id: 'operator-ward42',
      role: 'staff',
      microVolunteerRole: 'operator',
      jurisdictionIds: ['WARD-042'],
    });
    const html = renderPage();

    expect(html).toContain('Ward operator');
    expect(html).toContain('Publish a task');
    expect(html).not.toContain('Moderation queue');
    expect(html).not.toContain('Board operations');
  });

  it('gives an administrator board operations and every moderation control', () => {
    signIn({ id: 'admin-board', role: 'admin', microVolunteerRole: 'admin' });
    const html = renderPage();

    expect(html).toContain('Board administrator');
    expect(html).toContain('Moderation queue');
    expect(html).toContain('Audit trail');
    expect(html).toContain('Board operations');
    expect(html).toContain('Publish a task');
  });

  it('shows a plain-language empty state when the board has no tasks', () => {
    resetMicroVolunteerStorageToEmpty({ storage });
    const html = renderPage();

    expect(html).toContain('No tasks match these filters');
    expect(html).toContain('Try another ward, category or status');
  });

  it('shows an offline banner and a saved timestamp instead of silently failing', () => {
    mockNetworkState.isOnline = false;
    const html = renderPage();

    expect(html).toContain('You are offline');
    expect(html).toContain('saved on this device');
  });

  it('keeps visible text labels for status rather than relying on colour alone', () => {
    const html = renderPage();

    expect(html).toContain('Open for claims');
    expect(html).toContain('aria-label');
    expect(html).toContain('role="tab"');
  });

  it('ships responsive breakpoints, visible focus and reduced-motion rules', () => {
    const css = readFileSync(
      new URL('../components/microVolunteer/microVolunteer.css', import.meta.url),
      'utf8'
    );

    expect(css).toContain('@media (max-width: 860px)');
    expect(css).toContain('@media (max-width: 560px)');
    expect(css).toContain(':focus-visible');
    expect(css).toContain('prefers-reduced-motion');
    expect(css).toContain('overflow-x: auto');
  });
});
