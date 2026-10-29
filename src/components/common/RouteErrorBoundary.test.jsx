import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import {
  RouteErrorBoundaryCore,
  RouteErrorNotice,
  isChunkLoadError,
} from './RouteErrorBoundary';

const SECRET = 'TypeError: secret at /src/pages/Vault.jsx:42 apiKey=abc123';

const renderNotice = (props = {}) =>
  renderToStaticMarkup(
    <MemoryRouter>
      <RouteErrorNotice onRetry={() => {}} onHome={() => {}} {...props} />
    </MemoryRouter>
  );

// react-dom/server cannot run error boundaries, so the boundary is driven through its lifecycle.
const makeBoundary = (props = {}) => {
  const boundary = new RouteErrorBoundaryCore({ resetKey: '/a', children: 'page', onReload: vi.fn(), ...props });
  boundary.setState = (patch) => {
    boundary.state = { ...boundary.state, ...patch };
  };
  return boundary;
};

const crash = (boundary, error = new Error(SECRET)) => {
  boundary.state = { ...boundary.state, ...RouteErrorBoundaryCore.getDerivedStateFromError(error) };
  boundary.componentDidCatch(error);
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('RouteErrorNotice', () => {
  it('is an accessible alert with a heading, a retry and a way home', () => {
    const html = renderNotice();
    expect(html).toContain('role="alert"');
    expect(html).toMatch(/<h1[^>]*tabindex="-1"[^>]*>Something went wrong on this page<\/h1>/);
    expect(html).toContain('Try again');
    expect(html).toMatch(/<a[^>]*href="\/"[^>]*>Go to home<\/a>/);
  });

  it('offers a reload instead of a retry when a page file could not be loaded', () => {
    const html = renderNotice({ chunkError: true });
    expect(html).toContain('This page could not be loaded');
    expect(html).toContain('Reload page');
    expect(html).not.toContain('Try again');
  });

  it('never prints stack traces or exception details', () => {
    const html = renderNotice();
    expect(html).not.toMatch(/\bat\s+\S+\.jsx?:\d+/);
    expect(html).not.toContain('TypeError');
    expect(html).not.toContain('<pre');
    expect(html).not.toContain('Unexpected Application Error');
  });
});

describe('isChunkLoadError', () => {
  it.each([
    'Failed to fetch dynamically imported module: https://x.example/assets/Services-abc.js',
    'error loading dynamically imported module',
    'Importing a module script failed.',
    'Loading chunk 12 failed.',
  ])('recognises "%s"', (message) => {
    expect(isChunkLoadError(new Error(message))).toBe(true);
  });

  it('recognises ChunkLoadError by name', () => {
    const error = new Error('x');
    error.name = 'ChunkLoadError';
    expect(isChunkLoadError(error)).toBe(true);
  });

  it('does not treat ordinary errors as load errors', () => {
    expect(isChunkLoadError(new TypeError("Cannot read properties of undefined (reading 'map')"))).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
    expect(isChunkLoadError('string')).toBe(false);
  });
});

describe('RouteErrorBoundaryCore', () => {
  it('shows the page while nothing has failed', () => {
    expect(makeBoundary().render()).toBe('page');
  });

  it('keeps nothing from the error in its state', () => {
    const state = RouteErrorBoundaryCore.getDerivedStateFromError(new Error(SECRET));
    expect(state).toEqual({ hasError: true, chunkError: false });
    expect(JSON.stringify(state)).not.toContain('secret');
  });

  it('shows the notice after a crash, with no error text in what it renders', () => {
    const boundary = makeBoundary();
    crash(boundary);
    const element = boundary.render();
    expect(element.type).toBe(RouteErrorNotice);
    expect(JSON.stringify(element.props)).not.toContain('secret');
    const html = renderToStaticMarkup(<MemoryRouter>{element}</MemoryRouter>);
    expect(html).not.toContain('secret');
    expect(html).not.toContain('abc123');
  });

  it('retry shows the page again', () => {
    const boundary = makeBoundary();
    crash(boundary);
    boundary.render().props.onRetry();
    expect(boundary.render()).toBe('page');
    expect(boundary.props.onReload).not.toHaveBeenCalled();
  });

  it('retry reloads the page when the failure was a page file that did not load', () => {
    const boundary = makeBoundary();
    crash(boundary, new Error('Failed to fetch dynamically imported module: /assets/Services.js'));
    boundary.render().props.onRetry();
    expect(boundary.props.onReload).toHaveBeenCalledTimes(1);
  });

  it('"Go to home" clears the error so the home page can render', () => {
    const boundary = makeBoundary();
    crash(boundary);
    boundary.render().props.onHome();
    expect(boundary.render()).toBe('page');
  });

  it('recovers by itself when the person navigates to another page', () => {
    const boundary = makeBoundary({ resetKey: '/vault' });
    crash(boundary);
    boundary.props = { ...boundary.props, resetKey: '/services' };
    boundary.componentDidUpdate({ ...boundary.props, resetKey: '/vault' });
    expect(boundary.render()).toBe('page');
  });

  it('stays on the notice when the address has not changed', () => {
    const boundary = makeBoundary({ resetKey: '/vault' });
    crash(boundary);
    boundary.componentDidUpdate({ ...boundary.props });
    expect(boundary.render().type).toBe(RouteErrorNotice);
  });

  it('writes diagnostics to the console in development only', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubEnv('DEV', true);
    crash(makeBoundary());
    expect(spy).toHaveBeenCalledTimes(1);

    spy.mockClear();
    vi.stubEnv('DEV', false);
    crash(makeBoundary());
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('wiring', () => {
  const app = readFileSync(new URL('../../App.jsx', import.meta.url), 'utf8');

  it('wraps every page route so the navigation stays available when a page crashes', () => {
    const open = app.indexOf('<RouteErrorBoundary>');
    const routes = app.indexOf('<Routes>');
    const closeRoutes = app.indexOf('</Routes>');
    const close = app.indexOf('</RouteErrorBoundary>');
    expect(open).toBeGreaterThan(-1);
    expect(open).toBeLessThan(routes);
    expect(closeRoutes).toBeLessThan(close);
    // the navigation bar sits outside the boundary
    expect(app.indexOf('<Navbar />')).toBeLessThan(open);
  });

  it('keeps the router-level fallback as the last resort', () => {
    expect(app).toContain('errorElement: <RouteErrorFallback />');
  });
});
