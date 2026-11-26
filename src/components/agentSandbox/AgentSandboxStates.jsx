/**
 * src/components/agentSandbox/AgentSandboxStates.jsx
 *
 * Shared loading, empty, error, blocked and permission-denied states for the
 * secure agent sandbox workspace. Accessible, mobile-first, no PII.
 */

export function AgentSandboxLoading() {
  return (
    <div className="section" role="status" aria-live="polite">
      <div className="container">
        <div className="sandbox-state sandbox-state-loading">
          <span aria-hidden="true">⟳</span>
          <p>Preparing sandbox…</p>
        </div>
      </div>
    </div>
  );
}

export function AgentSandboxEmpty() {
  return (
    <div className="section">
      <div className="container">
        <div className="sandbox-state sandbox-state-empty">
          <h3>No sandbox run yet</h3>
          <p>Select a reviewed tool and policy, then run the sandbox.</p>
        </div>
      </div>
    </div>
  );
}

export function AgentSandboxError({ message, onRetry }) {
  return (
    <div className="section" role="alert" aria-live="polite">
      <div className="container">
        <div className="sandbox-state sandbox-state-error">
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

export function AgentSandboxBlocked({ threats, onRetry }) {
  return (
    <div className="section" role="alert" aria-live="polite">
      <div className="container">
        <div className="sandbox-state sandbox-state-blocked">
          <h3>Run blocked by sandbox policy</h3>
          <p>
            A threat was detected and the run was stopped. No untrusted code
            was executed.
          </p>
          {threats && threats.length > 0 && (
            <ul className="threat-list">
              {threats.map((t) => (
                <li key={t.threatId || t.id}>
                  {t.threatName || t.name} ({t.severity}) — {t.description}
                </li>
              ))}
            </ul>
          )}
          {onRetry && (
            <button className="btn" onClick={onRetry}>
              Retry with stricter input
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function AgentSandboxPermissionDenied() {
  return (
    <div className="section">
      <div className="container">
        <div className="sandbox-state sandbox-state-permission">
          <h3>Authentication required</h3>
          <p>Sign in to save or list sandbox run records.</p>
        </div>
      </div>
    </div>
  );
}
