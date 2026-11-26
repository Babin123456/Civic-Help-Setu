/**
 * src/components/agentSandbox/SandboxResults.jsx
 *
 * Renders sandbox run output, threat scan results, resources and disclaimer.
 * Aggregate-only — no individual prediction.
 */

import { AlertTriangle, ShieldCheck, Activity, Database, Clock, Info } from 'lucide-react';

export function SandboxResults({ result }) {
  const { run, scan } = result;

  return (
    <section className="sandbox-results" aria-label="Sandbox run results">
      <div className="results-card">
        <header className="results-header">
          <h2>
            <ShieldCheck aria-hidden="true" /> Sandbox run complete
          </h2>
          <p className="results-meta">
            Tool: {run.toolName} &bull; Policy: {run.policyName} &bull; Status:{' '}
            <span className={`status ${run.status}`}>{run.status}</span>
          </p>
        </header>

        <div className="results-totals" aria-label="Run resources">
          <h3>Resources used</h3>
          <div className="totals-grid">
            <TotalsCard label="CPU (ms)" value={run.resourcesUsed.cpuMs} icon={<Activity aria-hidden="true" />} />
            <TotalsCard label="Memory (MB)" value={run.resourcesUsed.memoryMB} icon={<Database aria-hidden="true" />} />
            <TotalsCard label="Time (ms)" value={run.resourcesUsed.timeMs} icon={<Clock aria-hidden="true" />} />
            <TotalsCard
              label="Network"
              value={run.networkUsed ? 'used' : 'disabled'}
              icon={<Info aria-hidden="true" />}
            />
          </div>
        </div>

        <h3 className="results-sub">Sandbox output (untrusted)</h3>
        <div className="results-output-wrap">
          <pre className="results-output">{JSON.stringify(run.output, null, 2)}</pre>
        </div>

        <h3 className="results-sub">Threat scan</h3>
        <div className="scan-summary">
          <ScanItem label="Pre-run threats" value={scan.pre.length} severity={scan.pre.length > 0 ? 'high' : 'ok'} />
          <ScanItem label="Post-run threats" value={scan.post.length} severity={scan.post.length > 0 ? 'high' : 'ok'} />
          <ScanItem label="Blocked" value={scan.blocked ? 'yes' : 'no'} severity={scan.blocked ? 'high' : 'ok'} />
          <ScanItem label="Redacted" value={scan.redacted ? 'yes' : 'no'} severity={scan.redacted ? 'high' : 'ok'} />
        </div>

        {scan.pre.length > 0 || scan.post.length > 0 ? (
          <div className="threat-details">
            <h4>Detected threats</h4>
            <ul className="threat-list">
              {[...scan.pre, ...scan.post].map((t) => (
                <li key={`${t.threatId}-${t.detectedIn}`}>
                  <strong>{t.threatName}</strong> ({t.severity}) — {t.description}
                  <span className="threat-action">{t.action}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="scan-clean"><ShieldCheck aria-hidden="true" /> No threats detected.</p>
        )}

        <p className="results-disclaimer">
          <AlertTriangle aria-hidden="true" /> {run.disclaimer}
        </p>
      </div>
    </section>
  );
}

function TotalsCard({ label, value, icon }) {
  return (
    <div className="totals-card">
      <div className="totals-card-icon" aria-hidden="true">{icon}</div>
      <div className="totals-card-body">
        <p className="totals-card-label">{label}</p>
        <p className="totals-card-value">{value}</p>
      </div>
    </div>
  );
}

function ScanItem({ label, value, severity }) {
  return (
    <div className={`scan-item scan-${severity}`}>
      <span className="scan-item-label">{label}</span>
      <span className="scan-item-value">{value}</span>
    </div>
  );
}
