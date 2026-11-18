/**
 * src/components/waterQuality/ParameterResultsTable.jsx
 * Accessible table component for displaying water test parameters
 * against Bureau of Indian Standards IS 10500:2012 thresholds.
 *
 * Enforces accessibility: does not rely on color alone (uses icons + text tags).
 */

import { CheckCircle2, AlertTriangle, AlertOctagon } from 'lucide-react';
import { IS_10500_STANDARDS } from '../../data/waterQualityContract.js';

const getStatusBadge = (evaluation) => {
  if (!evaluation) {
    return {
      label: 'Verified',
      badgeClass: 'wq-badge wq-badge-success',
      icon: <CheckCircle2 size={14} />,
    };
  }

  if (evaluation.level === 'hazardous_exceeded') {
    return {
      label: evaluation.isMicrobialRisk ? 'Hazardous (Pathogen)' : 'Statutory Limit Exceeded',
      badgeClass: 'wq-badge wq-badge-danger',
      icon: <AlertOctagon size={14} />,
    };
  }

  if (evaluation.level === 'permissible_warning') {
    return {
      label: 'Permissible Warning',
      badgeClass: 'wq-badge wq-badge-warning',
      icon: <AlertTriangle size={14} />,
    };
  }

  return {
    label: 'Desirable Limit Compliant',
    badgeClass: 'wq-badge wq-badge-success',
    icon: <CheckCircle2 size={14} />,
  };
};

export default function ParameterResultsTable({ results = [], isSuperseded = false }) {
  if (!results || results.length === 0) {
    return (
      <div style={{ padding: '1rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)', background: 'var(--bg-card)', borderRadius: '0.5rem', border: '1px solid var(--border-light)' }}>
        No laboratory parameter results recorded for this sampling event.
      </div>
    );
  }

  return (
    <div className="wq-table-wrapper" style={{ margin: '0.75rem 0', opacity: isSuperseded ? 0.65 : 1 }}>
      <table
        className="wq-table"
        aria-label="Water Quality Parameter Results vs IS 10500 Standards"
      >
        <caption className="sr-only">
          Laboratory parameter results comparison against IS 10500:2012 Drinking Water Specification
        </caption>
        <thead>
          <tr>
            <th scope="col">Parameter</th>
            <th scope="col">Tested Value</th>
            <th scope="col">Acceptable Limit (Desirable)</th>
            <th scope="col">Permissible Limit (No Alternate)</th>
            <th scope="col">Compliance Status</th>
          </tr>
        </thead>
        <tbody>
          {results.map((result) => {
            const paramDef = IS_10500_STANDARDS.parameters[result.parameterCode] || {};
            const paramName = paramDef.name || result.parameterCode;
            const unit = paramDef.unit || '';
            const status = getStatusBadge(result.evaluation);

            return (
              <tr key={result.id}>
                <td>
                  <strong>{paramName}</strong>
                  {paramDef.testMethod && (
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block' }}>
                      Ref: {paramDef.testMethod}
                    </span>
                  )}
                </td>
                <td>
                  <strong style={{ textDecoration: isSuperseded ? 'line-through' : 'none' }}>
                    {result.testedValue} {unit}
                  </strong>
                </td>
                <td style={{ color: 'var(--text-secondary)' }}>
                  {paramDef.acceptableMin !== undefined && paramDef.acceptableMax !== undefined ? (
                    paramDef.acceptableMin === 0 && paramDef.acceptableMax === 0 ? (
                      'Absent (0)'
                    ) : paramDef.acceptableMin > 0 ? (
                      `${paramDef.acceptableMin} - ${paramDef.acceptableMax} ${unit}`
                    ) : (
                      `Max ${paramDef.acceptableMax} ${unit}`
                    )
                  ) : (
                    'N/A'
                  )}
                </td>
                <td style={{ color: 'var(--text-secondary)' }}>
                  {paramDef.relaxationAllowed ? (
                    `Max ${paramDef.permissibleMax} ${unit}`
                  ) : (
                    <span style={{ fontStyle: 'italic', fontSize: '0.8rem' }}>No relaxation</span>
                  )}
                </td>
                <td>
                  <span className={status.badgeClass}>
                    {status.icon}
                    <span>{isSuperseded ? 'Superseded' : status.label}</span>
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
