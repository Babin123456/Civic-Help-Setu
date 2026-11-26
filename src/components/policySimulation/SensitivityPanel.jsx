/**
 * src/components/policySimulation/SensitivityPanel.jsx
 *
 * Sensitivity and uncertainty reporting for the simulation result.
 */

import { AlertTriangle, Sliders } from 'lucide-react';

export function SensitivityPanel({ result }) {
  const { sensitivity, uncertainty, aggregateValidation } = result;

  return (
    <section className="sim-sensitivity" aria-label="Sensitivity and uncertainty">
      <div className="sensitivity-card">
        <header className="sensitivity-header">
          <Sliders aria-hidden="true" />
          <h2>Sensitivity &amp; uncertainty</h2>
        </header>

        <div className="sensitivity-grid">
          <UncertaintyCard uncertainty={uncertainty} />
          <ValidationCard validation={aggregateValidation} />
        </div>

        <h3 className="sensitivity-sub">Lever sensitivity</h3>
        <p className="sensitivity-note">
          Change in aggregate outputs when each enabled lever is toggled off,
          holding all other inputs constant. Directional only — not a causal
          claim.
        </p>
        <div className="sensitivity-table-wrap">
          <table aria-label="Lever sensitivity results">
            <caption>Per-lever delta when toggled off.</caption>
            <thead>
              <tr>
                <th>Lever</th>
                <th>Travel min delta</th>
                <th>Demand delta</th>
                <th>Risk note</th>
              </tr>
            </thead>
            <tbody>
              {sensitivity.length === 0 ? (
                <tr>
                  <td colSpan={4}>No levers enabled in this scenario.</td>
                </tr>
              ) : (
                sensitivity.map((row) => (
                  <tr key={row.leverId}>
                    <td>{row.leverLabel}</td>
                    <td>{row.travelMinutesDelta}</td>
                    <td>{row.demandDelta}</td>
                    <td>{row.note}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <p className="sensitivity-disclaimer">
          <AlertTriangle aria-hidden="true" /> Sensitivity measures how the model responds to inputs. It does
          not establish causality, and the simulator never predicts individual
          citizen outcomes.
        </p>
      </div>
    </section>
  );
}

function UncertaintyCard({ uncertainty }) {
  const level = uncertainty.level;
  const levelClass = `uncertainty-level uncertainty-${level}`;
  return (
    <div className="sensitivity-card-panel">
      <h4>Uncertainty level</h4>
      <div className={levelClass}>{level}</div>
      <p>{uncertainty.message}</p>
      {uncertainty.isStale && <p className="uncertainty-stale">Data is past its review window.</p>}
      <p className="uncertainty-detail">
        Low-confidence aggregate inputs: {uncertainty.lowConfidenceStatCount}.
      </p>
    </div>
  );
}

function ValidationCard({ validation }) {
  return (
    <div className="sensitivity-card-panel">
      <h4>Aggregate validation</h4>
      <p>
        {validation.passed} of {validation.total} checks within tolerance
        ({validation.passRate}%).
      </p>
      <p className="validation-note">
        {validation.note}
      </p>
    </div>
  );
}
