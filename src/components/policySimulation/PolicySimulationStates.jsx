/**
 * src/components/policySimulation/PolicySimulationStates.jsx
 *
 * Shared loading, empty, error, stale and permission-denied states for the
 * policy simulation workspace. Accessible, mobile-first, no PII.
 */

export function PolicySimulationLoading() {
  return (
    <div className="section" role="status" aria-live="polite">
      <div className="container">
        <div className="sim-state sim-state-loading">
          <span aria-hidden="true">⟳</span>
          <p>Running simulation…</p>
        </div>
      </div>
    </div>
  );
}

export function PolicySimulationEmpty() {
  return (
    <div className="section">
      <div className="container">
        <div className="sim-state sim-state-empty">
          <h3>No scenario selected</h3>
          <p>Choose a reviewed scenario from the catalogue to run a simulation.</p>
        </div>
      </div>
    </div>
  );
}

export function PolicySimulationError({ message, onRetry }) {
  return (
    <div className="section" role="alert" aria-live="polite">
      <div className="container">
        <div className="sim-state sim-state-error">
          <h3>Simulation error</h3>
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

export function PolicySimulationStale({ notice }) {
  return (
    <div className="section">
      <div className="container">
        <div className="sim-state sim-state-stale">
          <h3>Data may be stale</h3>
          <p>{notice}</p>
        </div>
      </div>
    </div>
  );
}

export function PolicySimulationPermissionDenied() {
  return (
    <div className="section">
      <div className="container">
        <div className="sim-state sim-state-permission">
          <h3>Authentication required</h3>
          <p>Sign in to save or load named scenario configurations.</p>
        </div>
      </div>
    </div>
  );
}
