/**
 * src/components/serviceChangeSandbox/ServiceChangeStates.jsx
 *
 * Shared loading, empty, error, blocked and permission-denied states for the
 * service change sandbox workspace. Accessible, mobile-first, no PII.
 */

export function ServiceChangeLoading() {
  return (
    <div className="section" role="status" aria-live="polite">
      <div className="container">
        <div className="scs-state scs-state-loading">
          <span aria-hidden="true">⟳</span>
          <p>Preparing shadow-traffic run…</p>
        </div>
      </div>
    </div>
  );
}

export function ServiceChangeEmpty() {
  return (
    <div className="section">
      <div className="container">
        <div className="scs-state scs-state-empty">
          <h3>No snapshot selected</h3>
          <p>Choose a staging snapshot to run a shadow-traffic comparison.</p>
        </div>
      </div>
    </div>
  );
}

export function ServiceChangeError({ message, onRetry }) {
  return (
    <div className="section" role="alert" aria-live="polite">
      <div className="container">
        <div className="scs-state scs-state-error">
          <h3>Sandbox error</h3>
          <p>{message}</p>
          {onRetry && (
            <button className="btn" onClick={onRetry}>
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function ServiceChangeBlocked({ message, onRetry }) {
  return (
    <div className="section" role="alert" aria-live="polite">
      <div className="container">
        <div className="scs-state scs-state-blocked">
          <h3>Production writes blocked</h3>
          <p>{message}</p>
          {onRetry && (
            <button className="btn" onClick={onRetry}>
              Retry after unblocking
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function ServiceChangePermissionDenied() {
  return (
    <div className="section">
      <div className="container">
        <div className="scs-state scs-state-permission">
          <h3>Authentication required</h3>
          <p>Sign in to publish, roll back, create or list snapshots.</p>
        </div>
      </div>
    </div>
  );
}
