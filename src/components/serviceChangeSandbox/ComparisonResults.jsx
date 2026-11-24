/**
 * src/components/serviceChangeSandbox/ComparisonResults.jsx
 *
 * Renders shadow-traffic comparison results: baseline vs proposed outcomes,
 * deltas and recommendation. Aggregate-only — no individual prediction.
 */

import { TrendingUp, TrendingDown, Activity, ShieldAlert, ShieldCheck, Clock, Database } from 'lucide-react';

export function ComparisonResults({ result }) {
  const { snapshot, baseline, proposed, comparison, reproducibility, isStale, disclaimer } = result;

  const recLabel = {
    proceed: 'Proceed',
    'proceed-with-caution': 'Proceed with caution',
    hold: 'Hold',
    reject: 'Reject'
  }[comparison.recommendation] || comparison.recommendation;

  return (
    <section className="scs-results" aria-label="Shadow-traffic comparison results">
      <div className="results-card">
        <header className="results-header">
          <h2>
            <Activity aria-hidden="true" /> Shadow-traffic comparison
          </h2>
          <p className="results-meta">
            Snapshot: {snapshot.title} &bull; Seed:{' '}
            {reproducibility.seed} &bull; Aggregate only &mdash; no individual prediction
          </p>
        </header>

        <div className="results-totals" aria-label="Baseline vs proposed">
          <h3>Baseline vs proposed</h3>
          <div className="totals-grid">
            <DeltaCard
              label="Completion rate"
              baseline={baseline.completionRate}
              proposed={proposed.completionRate}
              delta={comparison.completionDelta}
              icon={<Activity aria-hidden="true" />}
            />
            <DeltaCard
              label="Validation failure rate"
              baseline={baseline.validationFailureRate}
              proposed={proposed.validationFailureRate}
              delta={comparison.validationFailureDelta}
              icon={<ShieldAlert aria-hidden="true" />}
            />
            <DeltaCard
              label="Accessibility issues"
              baseline={baseline.accessibilityIssues}
              proposed={proposed.accessibilityIssues}
              delta={comparison.accessibilityIssuesDelta}
              icon={<ShieldCheck aria-hidden="true" />}
            />
            <DeltaCard
              label="Avg completion time (s)"
              baseline={baseline.averageCompletionTimeSeconds}
              proposed={proposed.averageCompletionTimeSeconds}
              delta={comparison.completionTimeDeltaSeconds}
              icon={<Clock aria-hidden="true" />}
            />
            <DeltaCard
              label="Document drop-off rate"
              baseline={baseline.documentDropOffRate}
              proposed={proposed.documentDropOffRate}
              delta={comparison.documentDropOffDelta}
              icon={<Database aria-hidden="true" />}
            />
          </div>
        </div>

        <h3 className="results-sub">Recommendation</h3>
        <div className="recommendation-card">
          <span className={`rec-badge rec-${comparison.recommendation}`}>{recLabel}</span>
          <p>{comparison.reasoning}</p>
        </div>

        <h3 className="results-sub">Journey runs</h3>
        <div className="results-table-wrap">
          <table aria-label="Per-journey-pattern baseline vs proposed results">
            <caption>Per-pattern outcomes under shadow traffic.</caption>
            <thead>
              <tr>
                <th>Journey pattern</th>
                <th>Baseline completion</th>
                <th>Proposed completion</th>
                <th>Completion delta</th>
                <th>Validation failure delta</th>
              </tr>
            </thead>
            <tbody>
              {result.journeyRuns.baseline.map((base, index) => {
                const prop = result.journeyRuns.proposed[index];
                return (
                  <tr key={base.journeyPatternId}>
                    <td>{base.journeyPatternId}</td>
                    <td>{base.completionRate}</td>
                    <td>{prop ? prop.completionRate : '—'}</td>
                    <td>{prop ? Number((prop.completionRate - base.completionRate).toFixed(4)) : '—'}</td>
                    <td>{prop ? Number((prop.validationFailureRate - base.validationFailureRate).toFixed(4)) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {isStale && (
          <div className="scs-stale-notice">
            <ShieldAlert aria-hidden="true" />
            <p>Data is past its review window. Results are indicative only; confirm before publishing.</p>
          </div>
        )}

        <p className="results-disclaimer">
          <ShieldAlert aria-hidden="true" /> {disclaimer}
        </p>
      </div>
    </section>
  );
}

function DeltaCard({ label, baseline, proposed, delta, icon }) {
  const isNegative = typeof delta === 'number' && delta < 0;
  const isPositive = typeof delta === 'number' && delta > 0;
  const deltaClass = isNegative ? 'delta-negative' : isPositive ? 'delta-positive' : 'delta-neutral';
  const arrow = isNegative ? <TrendingDown aria-hidden="true" /> : isPositive ? <TrendingUp aria-hidden="true" /> : <ShieldCheck aria-hidden="true" />;
  return (
    <div className="totals-card">
      <div className="totals-card-icon" aria-hidden="true">{icon}</div>
      <div className="totals-card-body">
        <p className="totals-card-label">{label}</p>
        <p className="totals-card-value">{baseline} &rarr; {proposed}</p>
        <p className={`totals-card-delta ${deltaClass}`}>
          {arrow} Δ {delta >= 0 ? '+' : ''}{delta}
        </p>
      </div>
    </div>
  );
}
