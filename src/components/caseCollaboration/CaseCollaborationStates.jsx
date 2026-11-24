/**
 * src/components/caseCollaboration/CaseCollaborationStates.jsx
 *
 * Shared loading, empty, error, revoked/expired and permission-denied states
 * for the case collaboration workspace. Accessible, mobile-first, no PII.
 */

export function CaseCollaborationLoading() {
  return (
    <div className="section" role="status" aria-live="polite">
      <div className="container">
        <div className="cc-state cc-state-loading">
          <span aria-hidden="true">⟳</span>
          <p>Preparing share…</p>
        </div>
      </div>
    </div>
  );
}

export function CaseCollaborationEmpty() {
  return (
    <div className="section">
      <div className="container">
        <div className="cc-state cc-state-empty">
          <h3>No share configured</h3>
          <p>Select case items and a recipient to create a share link.</p>
        </div>
      </div>
    </div>
  );
}

export function CaseCollaborationError({ message, onRetry }) {
  return (
    <div className="section" role="alert" aria-live="polite">
      <div className="container">
        <div className="cc-state cc-state-error">
          <h3>Collaboration error</h3>
          <p>{message}</p>
          {onRetry && <button className="btn" onClick={onRetry}>Retry</button>}
        </div>
      </div>
    </div>
  );
}

export function CaseCollaborationRevoked({ message, onRetry }) {
  return (
    <div className="section" role="alert" aria-live="polite">
      <div className="container">
        <div className="cc-state cc-state-revoked">
          <h3>Share access revoked or expired</h3>
          <p>{message}</p>
          {onRetry && <button className="btn" onClick={onRetry}>Retry</button>}
        </div>
      </div>
    </div>
  );
}

export function CaseCollaborationPermissionDenied() {
  return (
    <div className="section">
      <div className="container">
        <div className="cc-state cc-state-permission">
          <h3>Authentication required</h3>
          <p>Sign in to create, revoke or list case shares.</p>
        </div>
      </div>
    </div>
  );
}
