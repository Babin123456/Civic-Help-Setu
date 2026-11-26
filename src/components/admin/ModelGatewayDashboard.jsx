import { useState, useEffect } from 'react';
import {
  Shield,
  HardDrive,
  Globe,
  Activity,
  Cpu,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  Clock,
} from 'lucide-react';
import {
  getActiveResidencyPolicy,
  setActiveResidencyPolicy,
} from '../../services/gateway/residencyPolicyEngine';
import { circuitBreaker } from '../../services/gateway/circuitBreaker';
import {
  getGatewayMetricsSummary,
  getGatewayTelemetryLogs,
  clearGatewayTelemetry,
} from '../../services/gateway/gatewayTelemetry';
import { RESIDENCY_TIER, CIRCUIT_STATE } from '../../services/gateway/gatewayTypes';

export default function ModelGatewayDashboard() {
  const [currentTier, setCurrentTier] = useState(() => getActiveResidencyPolicy());
  const [metrics, setMetrics] = useState(() => getGatewayMetricsSummary());
  const [logs, setLogs] = useState(() => getGatewayTelemetryLogs(20));
  const [circuits, setCircuits] = useState(() => circuitBreaker.getSnapshot());
  const [notice, setNotice] = useState(null);

  const refreshData = () => {
    setMetrics(getGatewayMetricsSummary());
    setLogs(getGatewayTelemetryLogs(20));
    setCircuits(circuitBreaker.getSnapshot());
  };

  useEffect(() => {
    const interval = setInterval(refreshData, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleTierChange = (newTier) => {
    setActiveResidencyPolicy(newTier);
    setCurrentTier(newTier);
    setNotice(`Residency policy updated to "${newTier}".`);
    setTimeout(() => setNotice(null), 4000);
    refreshData();
  };

  const handleResetCircuits = () => {
    circuitBreaker.reset();
    setCircuits(circuitBreaker.getSnapshot());
    setNotice('All provider circuit breakers have been reset to CLOSED state.');
    setTimeout(() => setNotice(null), 4000);
  };

  const handleClearLogs = () => {
    clearGatewayTelemetry();
    refreshData();
    setNotice('Gateway telemetry logs cleared.');
    setTimeout(() => setNotice(null), 4000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-primary)' }}>
            Civic Model Gateway & Data Residency
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Configure territorial residency policies, inspect circuit breakers, and monitor inference costs without PII leakage.
          </p>
        </div>

        <button
          type="button"
          onClick={refreshData}
          className="btn btn-secondary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
        >
          <RefreshCw size={14} aria-hidden="true" />
          Refresh Status
        </button>
      </div>

      {notice && (
        <div
          role="status"
          style={{
            padding: '0.75rem 1rem',
            borderRadius: '0.5rem',
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            color: '#10b981',
            fontSize: '0.85rem',
            fontWeight: '600',
          }}
        >
          {notice}
        </div>
      )}

      {/* Residency Policy Selector */}
      <section
        style={{
          padding: '1.25rem',
          borderRadius: '0.75rem',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
        aria-labelledby="residency-policy-heading"
      >
        <div>
          <h3 id="residency-policy-heading" style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)' }}>
            Global Civic Data Residency Policy
          </h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            Select the default data processing perimeter under India DPDPA 2023 regulations.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem' }}>
          {[
            {
              id: RESIDENCY_TIER.LOCAL_ONLY,
              name: 'Local Only (Default)',
              desc: 'Zero network transit. Runs entirely in browser memory or local catalog.',
              icon: HardDrive,
              color: '#10b981',
            },
            {
              id: RESIDENCY_TIER.SOVEREIGN_DOMESTIC,
              name: 'Sovereign Domestic',
              desc: 'Permits processing in verified India-region sovereign cloud instances.',
              icon: Shield,
              color: '#3b82f6',
            },
            {
              id: RESIDENCY_TIER.CROSS_BORDER_SCRUBBED,
              name: 'Cross-Border Scrubbed',
              desc: 'Permits commercial models only after mandatory local PII scrubbing.',
              icon: Globe,
              color: '#8b5cf6',
            },
          ].map((tier) => {
            const isSelected = currentTier === tier.id;
            const Icon = tier.icon;
            return (
              <button
                key={tier.id}
                type="button"
                onClick={() => handleTierChange(tier.id)}
                style={{
                  padding: '1rem',
                  borderRadius: '0.6rem',
                  background: isSelected ? 'var(--glass-bg)' : 'transparent',
                  border: isSelected ? `2px solid ${tier.color}` : '1px solid var(--border-light)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '700', color: tier.color, fontSize: '0.9rem' }}>
                    <Icon size={16} aria-hidden="true" />
                    <span>{tier.name}</span>
                  </div>
                  {isSelected && <CheckCircle2 size={16} color={tier.color} aria-hidden="true" />}
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
                  {tier.desc}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Metrics Summary Cards */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1rem',
        }}
        aria-label="Gateway Metrics Summary"
      >
        <div style={{ padding: '1rem', borderRadius: '0.5rem', background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
            <Activity size={14} aria-hidden="true" />
            <span>Total Requests</span>
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: '700', marginTop: '0.35rem', color: 'var(--text-primary)' }}>
            {metrics.totalRequests}
          </div>
        </div>

        <div style={{ padding: '1rem', borderRadius: '0.5rem', background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
            <AlertTriangle size={14} aria-hidden="true" />
            <span>Fallback Rate</span>
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: '700', marginTop: '0.35rem', color: metrics.fallbackRate > 20 ? '#f59e0b' : '#10b981' }}>
            {metrics.fallbackRate}%
          </div>
        </div>

        <div style={{ padding: '1rem', borderRadius: '0.5rem', background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
            <Clock size={14} aria-hidden="true" />
            <span>Avg Latency</span>
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: '700', marginTop: '0.35rem', color: 'var(--text-primary)' }}>
            {metrics.avgLatencyMs}ms
          </div>
        </div>

        <div style={{ padding: '1rem', borderRadius: '0.5rem', background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
            <Cpu size={14} aria-hidden="true" />
            <span>Total Tokens</span>
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: '700', marginTop: '0.35rem', color: 'var(--text-primary)' }}>
            {metrics.totalTokens}
          </div>
        </div>

        <div style={{ padding: '1rem', borderRadius: '0.5rem', background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
            <DollarSign size={14} aria-hidden="true" />
            <span>Estimated Cost</span>
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: '700', marginTop: '0.35rem', color: 'var(--text-primary)' }}>
            ₹{metrics.totalCostINR}
          </div>
        </div>
      </section>

      {/* Circuit Breakers Status */}
      <section
        style={{
          padding: '1.25rem',
          borderRadius: '0.75rem',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
        aria-labelledby="circuit-breaker-heading"
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h3 id="circuit-breaker-heading" style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)' }}>
              Provider Circuit Breaker States
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Monitors error rates and trips automatically to prevent user-facing hangs.
            </p>
          </div>

          <button
            type="button"
            onClick={handleResetCircuits}
            className="btn btn-secondary"
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
          >
            Reset All Circuit Breakers
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
          {Object.entries(circuits).length === 0 ? (
            <p style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>No active provider circuits recorded yet.</p>
          ) : (
            Object.entries(circuits).map(([id, c]) => {
              const isOpen = c.state === CIRCUIT_STATE.OPEN;
              const isHalfOpen = c.state === CIRCUIT_STATE.HALF_OPEN;
              const badgeBg = isOpen ? 'rgba(239, 68, 68, 0.15)' : isHalfOpen ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)';
              const badgeColor = isOpen ? '#ef4444' : isHalfOpen ? '#f59e0b' : '#10b981';

              return (
                <div
                  key={id}
                  style={{
                    padding: '0.85rem',
                    borderRadius: '0.5rem',
                    background: 'var(--glass-bg)',
                    border: '1px solid var(--border-light)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.35rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: '600', fontSize: '0.85rem', color: 'var(--text-primary)' }}>{id}</span>
                    <span
                      style={{
                        padding: '0.15rem 0.5rem',
                        borderRadius: '99px',
                        background: badgeBg,
                        color: badgeColor,
                        fontSize: '0.72rem',
                        fontWeight: '700',
                      }}
                    >
                      {c.state}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                    Failures: {c.failureCount}
                  </div>
                  {c.lastError && (
                    <div style={{ fontSize: '0.72rem', color: '#ef4444', wordBreak: 'break-word' }}>
                      Last Error: {c.lastError}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Telemetry Activity Logs */}
      <section
        style={{
          padding: '1.25rem',
          borderRadius: '0.75rem',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
        aria-labelledby="gateway-logs-heading"
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h3 id="gateway-logs-heading" style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)' }}>
              Recent Gateway Invocations (Privacy-Preserved)
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Telemetry contains zero raw queries, user names, or sensitive citizen identifiers.
            </p>
          </div>

          <button
            type="button"
            onClick={handleClearLogs}
            className="btn btn-secondary"
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
          >
            Clear Telemetry
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '0.5rem' }}>Timestamp</th>
                <th style={{ padding: '0.5rem' }}>Adapter / Model</th>
                <th style={{ padding: '0.5rem' }}>Residency Tier</th>
                <th style={{ padding: '0.5rem' }}>Latency</th>
                <th style={{ padding: '0.5rem' }}>Tokens</th>
                <th style={{ padding: '0.5rem' }}>Est. Cost</th>
                <th style={{ padding: '0.5rem' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                    No recent gateway invocations logged.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <td style={{ padding: '0.5rem', whiteSpace: 'nowrap' }}>
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </td>
                    <td style={{ padding: '0.5rem' }}>
                      <span style={{ fontWeight: '600' }}>{log.modelName}</span>
                    </td>
                    <td style={{ padding: '0.5rem' }}>
                      <span style={{ padding: '0.15rem 0.4rem', borderRadius: '4px', background: 'var(--glass-bg)', fontSize: '0.74rem' }}>
                        {log.residencyTier}
                      </span>
                    </td>
                    <td style={{ padding: '0.5rem' }}>{log.latencyMs}ms</td>
                    <td style={{ padding: '0.5rem' }}>{log.totalTokens}</td>
                    <td style={{ padding: '0.5rem' }}>₹{log.estimatedCostINR}</td>
                    <td style={{ padding: '0.5rem' }}>
                      {log.fallbackTriggered ? (
                        <span style={{ color: '#f59e0b', fontWeight: '600' }}>Fallback</span>
                      ) : (
                        <span style={{ color: '#10b981', fontWeight: '600' }}>Direct</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
