import { useState } from 'react';
import {
  Ruler,
  AlertCircle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Info,
} from 'lucide-react';
import {
  MEASURED_BENCHMARKS,
  evaluateMeasurement,
} from '../../services/accessibilityAuditService.js';

export default function MeasuredAuditTable({
  measurements = {},
  onMeasurementChange,
  readOnly = false,
}) {
  const [activeCaveatKey, setActiveCaveatKey] = useState(null);

  const handleInputChange = (benchmarkKey, value) => {
    if (readOnly || !onMeasurementChange) return;
    onMeasurementChange(benchmarkKey, value);
  };

  return (
    <div
      role="region"
      aria-label="Measured Accessibility Benchmarks Table"
      style={{
        background: 'var(--surface-color, #ffffff)',
        border: '1px solid var(--border-color, #e2e8f0)',
        borderRadius: '12px',
        padding: '1.25rem',
        marginBottom: '1.5rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Ruler size={22} color="#0284c7" />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary, #0f172a)' }}>
            Physical Facility Measurements (Harmonised Guidelines 2021)
          </h3>
        </div>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #64748b)' }}>
          Enter numeric values. Units: mm or ratio.
        </span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '0.85rem',
            textAlign: 'left',
          }}
        >
          <caption className="sr-only" style={{ display: 'none' }}>
            Accessibility measurement benchmarks and compliance audit
          </caption>
          <thead>
            <tr
              style={{
                borderBottom: '2px solid var(--border-color, #cbd5e1)',
                background: 'var(--bg-card-subtle, #f8fafc)',
                color: 'var(--text-secondary, #475569)',
              }}
            >
              <th scope="col" style={{ padding: '0.65rem 0.5rem' }}>Facility / Element</th>
              <th scope="col" style={{ padding: '0.65rem 0.5rem' }}>Benchmark Standard</th>
              <th scope="col" style={{ padding: '0.65rem 0.5rem', width: '170px' }}>Recorded Measurement</th>
              <th scope="col" style={{ padding: '0.65rem 0.5rem' }}>Status &amp; Gap</th>
              <th scope="col" style={{ padding: '0.65rem 0.5rem', textAlign: 'center' }}>Details</th>
            </tr>
          </thead>
          <tbody>
            {MEASURED_BENCHMARKS.map((benchmark) => {
              const rawVal = measurements[benchmark.key];
              const evalResult = evaluateMeasurement(benchmark, rawVal);
              const isCompliant = evalResult.status === 'COMPLIANT';
              const isNonCompliant = evalResult.status === 'NON_COMPLIANT';
              const isUnknown = evalResult.status === 'UNKNOWN';
              const isNA = evalResult.status === 'NOT_APPLICABLE';

              return (
                <tr
                  key={benchmark.key}
                  style={{
                    borderBottom: '1px solid var(--border-color, #e2e8f0)',
                    background: isNonCompliant ? '#fff5f5' : isCompliant ? '#f0fdf4' : 'transparent',
                  }}
                >
                  <th scope="row" style={{ padding: '0.75rem 0.5rem', fontWeight: 600, color: 'var(--text-primary, #0f172a)' }}>
                    <div>{benchmark.label}</div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-secondary, #64748b)' }}>
                      {benchmark.facility} {benchmark.critical && <span style={{ color: '#dc2626', fontWeight: 700 }}>• Critical</span>}
                    </div>
                  </th>

                  <td style={{ padding: '0.75rem 0.5rem' }}>
                    <div style={{ fontWeight: 600 }}>{benchmark.benchmarkDisplay}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary, #64748b)' }}>
                      {benchmark.source}
                    </div>
                  </td>

                  <td style={{ padding: '0.75rem 0.5rem' }}>
                    {readOnly ? (
                      <span style={{ fontWeight: 600 }}>
                        {rawVal !== undefined && rawVal !== null && rawVal !== '' ? `${rawVal} ${benchmark.unit}` : 'Unassessed'}
                      </span>
                    ) : (
                      <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                        <input
                          type="text"
                          aria-label={`Measurement for ${benchmark.label}`}
                          placeholder={benchmark.unit === 'ratio' ? 'e.g. 12' : 'e.g. 900'}
                          value={rawVal !== undefined && rawVal !== null ? rawVal : ''}
                          onChange={(e) => handleInputChange(benchmark.key, e.target.value)}
                          style={{
                            width: '90px',
                            padding: '0.35rem 0.5rem',
                            borderRadius: '6px',
                            border: '1px solid var(--border-color, #cbd5e1)',
                            fontSize: '0.85rem',
                            background: 'var(--bg-input, #ffffff)',
                          }}
                        />
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #64748b)' }}>
                          {benchmark.unit}
                        </span>
                      </div>
                    )}
                  </td>

                  <td style={{ padding: '0.75rem 0.5rem' }}>
                    {isCompliant && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          background: '#dcfce7',
                          color: '#166534',
                          padding: '3px 8px',
                          borderRadius: '999px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                        }}
                      >
                        <CheckCircle2 size={13} /> Compliant
                      </span>
                    )}

                    {isNonCompliant && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          background: '#fee2e2',
                          color: '#991b1b',
                          padding: '3px 8px',
                          borderRadius: '999px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                        }}
                      >
                        <XCircle size={13} /> Gap: {evalResult.gap} {benchmark.unit}
                      </span>
                    )}

                    {isUnknown && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          background: '#f1f5f9',
                          color: '#475569',
                          padding: '3px 8px',
                          borderRadius: '999px',
                          fontSize: '0.75rem',
                        }}
                      >
                        <HelpCircle size={13} /> Unknown
                      </span>
                    )}

                    {isNA && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          background: '#e0f2fe',
                          color: '#0369a1',
                          padding: '3px 8px',
                          borderRadius: '999px',
                          fontSize: '0.75rem',
                        }}
                      >
                        <Info size={13} /> N/A
                      </span>
                    )}
                  </td>

                  <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                    <button
                      type="button"
                      aria-label={`View caveat for ${benchmark.label}`}
                      onClick={() => setActiveCaveatKey(activeCaveatKey === benchmark.key ? null : benchmark.key)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: activeCaveatKey === benchmark.key ? '#0284c7' : '#94a3b8',
                        padding: '4px',
                      }}
                    >
                      <AlertCircle size={16} />
                    </button>
                    {activeCaveatKey === benchmark.key && (
                      <div
                        style={{
                          position: 'absolute',
                          zIndex: 10,
                          right: '2rem',
                          background: '#1e293b',
                          color: '#ffffff',
                          padding: '0.5rem 0.75rem',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          maxWidth: '280px',
                          textAlign: 'left',
                          boxShadow: '0 4px 6px rgba(0,0,0,0.2)',
                        }}
                      >
                        <div><strong>Caveat:</strong> {benchmark.caveat}</div>
                        <div style={{ marginTop: '0.25rem', color: '#93c5fd' }}>
                          <strong>Remediation:</strong> {benchmark.remediationHint}
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
