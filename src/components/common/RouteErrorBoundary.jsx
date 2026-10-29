/* eslint-disable react-refresh/only-export-components */
import { Component, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { logDiagnostic, reportError } from '../../utils/diagnostics';

/**
 * Catches a crash inside one page and shows a short, safe message in its place, so the navigation
 * bar, footer and accessibility tools keep working and the person can go somewhere else.
 *
 * The message never contains the error, its message or its stack: those can reveal file names,
 * library versions or data. They go to the browser console in development only.
 * RouteErrorFallback (the router's errorElement) stays as the last resort for crashes outside a page.
 */

/** Messages browsers give when a lazily loaded page file cannot be fetched (offline, new deploy). */
const CHUNK_ERROR = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk [\w-]+ failed|ChunkLoadError/i;

export const isChunkLoadError = (error) => {
  if (!error) return false;
  return CHUNK_ERROR.test(`${error.name || ''} ${error.message || ''}`);
};

/** What the person sees. Takes no error object on purpose. */
export const RouteErrorNotice = ({ chunkError = false, onRetry, onHome }) => {
  const headingRef = useRef(null);

  // Move keyboard and screen reader focus to the message when it appears.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div className="section flex-center" style={{ minHeight: '60vh', textAlign: 'center' }}>
      <div
        className="glass-panel"
        role="alert"
        style={{ padding: '2.5rem', maxWidth: '460px', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}
      >
        <AlertTriangle size={36} color="var(--accent-main)" aria-hidden="true" />
        <h1 ref={headingRef} tabIndex={-1} style={{ fontSize: '1.5rem', fontWeight: '800', outline: 'none' }}>
          {chunkError ? 'This page could not be loaded' : 'Something went wrong on this page'}
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.5' }}>
          {chunkError
            ? 'Check your internet connection and try again. If the site was just updated, reloading gets the latest version.'
            : 'The page ran into a problem and could not be shown. Your saved services and documents are not affected. You can try again or go back to the home page.'}
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button type="button" className="btn btn-primary" onClick={onRetry}>
            {chunkError ? 'Reload page' : 'Try again'}
          </button>
          <Link to="/" className="btn btn-secondary" onClick={onHome}>
            Go to home
          </Link>
        </div>
      </div>
    </div>
  );
};

export class RouteErrorBoundaryCore extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, chunkError: false };
    this.retry = this.retry.bind(this);
    this.reset = this.reset.bind(this);
  }

  static getDerivedStateFromError(error) {
    // Keep only what is needed to choose the message, never the error itself.
    return { hasError: true, chunkError: isChunkLoadError(error) };
  }

  componentDidCatch(error) {
    if (import.meta.env.DEV) {
      // Development only: the console is the right place for the details, the page is not.
      reportError(error, { route: typeof window !== 'undefined' ? window.location?.pathname : '/' });
      logDiagnostic('[RouteErrorBoundary]', error);
    }
  }

  componentDidUpdate(prevProps) {
    // Going to another page (or another URL) gives it a fresh start.
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) this.reset();
  }

  reset() {
    this.setState({ hasError: false, chunkError: false });
  }

  retry() {
    // A page file that failed to load is cached as failed by the browser, so only a reload helps.
    if (this.state.chunkError) {
      this.props.onReload();
      return;
    }
    this.reset();
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return <RouteErrorNotice chunkError={this.state.chunkError} onRetry={this.retry} onHome={this.reset} />;
  }
}

RouteErrorBoundaryCore.defaultProps = {
  onReload: () => window.location.reload(),
};

/** Resets itself whenever the address changes. Use inside the router, around the page routes. */
const RouteErrorBoundary = ({ children }) => {
  const { pathname, search } = useLocation();
  return <RouteErrorBoundaryCore resetKey={`${pathname}${search}`}>{children}</RouteErrorBoundaryCore>;
};

export default RouteErrorBoundary;
