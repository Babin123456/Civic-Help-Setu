import { AlertTriangle, CheckCircle2, Clock, Loader2, LockKeyhole, SearchX, ShieldAlert, WifiOff } from 'lucide-react';
import { formatVisualQaDate } from '../../utils/visualQaFormat';

const shell = {
  padding: '1.5rem',
  borderRadius: '1rem',
  border: '1px solid var(--border-main)',
  background: 'var(--glass-bg)',
};

export function VisualQaLoadingState({ label = 'Running the deterministic layout scan…' }) {
  return (
    <div className="qa-state" role="status" aria-live="polite" aria-busy="true" style={shell}>
      <Loader2 size={26} className="qa-spin" aria-hidden="true" />
      <div>
        <h2>Preparing the visual QA workspace</h2>
        <p>{label}</p>
      </div>
    </div>
  );
}

export function VisualQaSkeleton({ cards = 3 }) {
  return (
    <div className="qa-skeleton" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading synthetic card previews…</span>
      {Array.from({ length: cards }, (_, index) => (
        <div key={index} className="qa-skeleton-card" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>
      ))}
    </div>
  );
}

export function VisualQaEmptyState({ onReset, page, totalPages }) {
  return (
    <div className="qa-state" role="status" style={shell}>
      <SearchX size={28} aria-hidden="true" />
      <div>
        <h2>No fixtures on this page</h2>
        <p>
          {page && totalPages
            ? `Page ${page} is outside this scan (${totalPages} page${totalPages === 1 ? '' : 's'} available). No production or citizen data is involved.`
            : 'No synthetic fixtures match these filters. Nothing was loaded from the production catalogue.'}
        </p>
        {onReset && (
          <button type="button" className="qa-button qa-button--primary" onClick={onReset}>
            Return to page 1
          </button>
        )}
      </div>
    </div>
  );
}

export function VisualQaErrorState({ error, onRetry }) {
  const code = error?.code || 'ERR_VISUAL_QA';
  const message = error?.message || 'The visual QA service could not complete the request.';
  return (
    <div className="qa-state qa-state--error" role="alert" style={shell}>
      <AlertTriangle size={28} aria-hidden="true" />
      <div>
        <h2>The visual QA request failed</h2>
        <p>{message}</p>
        <p>
          <strong>Error code:</strong> <code>{code}</code>
        </p>
        {Array.isArray(error?.fields) && error.fields.length > 0 && (
          <ul className="qa-error-fields">
            {error.fields.map((field, index) => (
              <li key={`${field.field}-${index}`}>
                <code>{field.field}</code>: {field.reason}
              </li>
            ))}
          </ul>
        )}
        {onRetry && (
          <button type="button" className="qa-button qa-button--primary" onClick={onRetry}>
            Try the server scan again
          </button>
        )}
      </div>
    </div>
  );
}

export function VisualQaPermissionDenied({ signedIn = false }) {
  return (
    <div className="qa-state qa-state--denied" role="alert" style={shell}>
      <ShieldAlert size={30} aria-hidden="true" />
      <div>
        <h2>Reviewer permission required</h2>
        <p>
          {signedIn
            ? 'Your account is signed in, but it does not have the admin permission required for this reviewer workspace.'
            : 'Sign in with an authorized reviewer account to open the synthetic catalogue visual QA workspace.'}
        </p>
        <p>
          No catalogue content, citizen record or draft was loaded. The server enforces the same permission
          independently of this page.
        </p>
        <a className="qa-button qa-button--primary" href="/login?from=/services/catalogue-visual-qa">
          Go to sign in
        </a>
      </div>
    </div>
  );
}

export function VisualQaStaleNotice({ savedAt, onRefresh, label = 'Saved scan' }) {
  return (
    <div className="qa-state qa-state--stale" role="status" style={shell}>
      <Clock size={22} aria-hidden="true" />
      <div>
        <h2>{label} may be stale</h2>
        <p>
          This review was saved on {formatVisualQaDate(savedAt)}. Layout measurements are deterministic, but the
          component or catalogue schema may have changed since then. Rerun the scan before exporting a
          final review.
        </p>
        {onRefresh && (
          <button type="button" className="qa-button" onClick={onRefresh}>
            Rerun deterministic scan
          </button>
        )}
      </div>
    </div>
  );
}

export function VisualQaResumedNotice({ savedAt, onDiscard }) {
  return (
    <div className="qa-state qa-state--resumed" role="status" style={shell}>
      <CheckCircle2 size={22} aria-hidden="true" />
      <div>
        <h2>Saved review resumed</h2>
        <p>
          Confirmed non-sensitive inputs were restored from this browser on {formatVisualQaDate(savedAt)}. No citizen
          data is stored in the draft.
        </p>
        {onDiscard && (
          <button type="button" className="qa-button" onClick={onDiscard}>
            Discard saved review and start fresh
          </button>
        )}
      </div>
    </div>
  );
}

export function VisualQaOfflineNotice() {
  return (
    <div className="qa-state qa-state--offline" role="status" style={shell}>
      <WifiOff size={22} aria-hidden="true" />
      <div>
        <h2>Offline: local scan only</h2>
        <p>
          The deterministic scan still works in this browser. Server verification and export audit receipts
          are unavailable until the connection returns.
        </p>
      </div>
    </div>
  );
}

export function VisualQaServerVerified({ verification }) {
  if (!verification) return null;
  const { status, matchesLocal, dataVersion, componentVersion, verifiedAt, multiRegion } = verification;
  if (status === 'ready') {
    return (
      <div className="qa-state qa-state--verified" role="status" style={shell}>
        <CheckCircle2 size={22} aria-hidden="true" />
        <div>
          <h2>Server scan agrees with the local scan</h2>
          <p>
            Verified at {formatVisualQaDate(verifiedAt)} with {dataVersion} and {componentVersion}.{' '}
            {matchesLocal === false
              ? 'The warning totals differ, so treat this as a review item before exporting.'
              : 'The synthetic warning totals match.'}
          </p>
          {multiRegion?.servedBy && (
            <div className="qa-hero-badges" style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span className="qa-badge qa-badge--synthetic" style={{ fontSize: '0.75rem' }}>
                Served by: <code>{multiRegion.servedBy}</code> ({multiRegion.consistencyLevel || 'bounded_stale'})
              </span>
              {multiRegion.staleRead && (
                <span className="qa-badge qa-badge--private" style={{ fontSize: '0.75rem', background: '#fef3c7', color: '#92400e' }}>
                  Stale read disclosed (lag: {multiRegion.replicaLagMs}ms)
                </span>
              )}
              {multiRegion.failover && (
                <span className="qa-badge" style={{ fontSize: '0.75rem', background: '#fee2e2', color: '#991b1b' }}>
                  Primary failover
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
  if (status === 'permission-denied') {
    return (
      <div className="qa-state qa-state--denied" role="alert" style={shell}>
        <LockKeyhole size={22} aria-hidden="true" />
        <div>
          <h2>Server refused the scan</h2>
          <p>The API denied this reviewer role. No synthetic scan data was returned.</p>
        </div>
      </div>
    );
  }
  return null;
}
