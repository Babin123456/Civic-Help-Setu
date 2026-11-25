import { Printer, ArrowLeft, Download } from 'lucide-react';
import { exportContinuityPlanOfflinePackage } from '../../services/continuityPlannerService';

export const PrintableContinuityRunbook = ({ plan, dependencies = [], onBack = null }) => {
  if (!plan) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleExportOfflineJson = () => {
    try {
      const offlinePkg = exportContinuityPlanOfflinePackage(plan.id);
      const blob = new Blob([JSON.stringify(offlinePkg, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `continuity-runbook-${plan.jurisdictionId || plan.id}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Graceful fallback for non-browser or test runner environments
    }
  };

  const criticalDeps = dependencies.filter((d) => d.criticality === 'TIER_1_CRITICAL');

  return (
    <div style={{ width: '100%', maxWidth: '900px', margin: '0 auto', padding: '1rem' }}>
      {/* SCREEN-ONLY TOOLBAR */}
      <div
        className="no-print"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
          padding: '0.75rem 1rem',
          background: 'var(--bg-card)',
          borderRadius: '0.5rem',
          border: '1px solid var(--border-main)',
        }}
      >
        {onBack && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onBack}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
          >
            <ArrowLeft size={15} aria-hidden="true" />
            <span>Back to Planner</span>
          </button>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleExportOfflineJson}
            title="Download offline JSON runbook for air-gapped disaster operations"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
          >
            <Download size={15} aria-hidden="true" />
            <span>Export Offline JSON</span>
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handlePrint}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
          >
            <Printer size={15} aria-hidden="true" />
            <span>Print Runbook</span>
          </button>
        </div>
      </div>

      {/* PRINT-RENDERED RUNBOOK DOCUMENT */}
      <div
        className="printable-runbook-sheet"
        style={{
          padding: '2rem',
          background: '#ffffff',
          color: '#0f172a',
          borderRadius: '0.5rem',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          lineHeight: 1.5,
        }}
      >
        {/* RUNBOOK HEADER */}
        <div
          style={{
            borderBottom: '2px solid #0f172a',
            paddingBottom: '1rem',
            marginBottom: '1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          <div>
            <span
              style={{
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                fontSize: '0.75rem',
                fontWeight: '800',
                color: '#475569',
              }}
            >
              CIVIC PUBLIC SERVICE CONTINUITY & DISASTER RUNBOOK
            </span>
            <h1 style={{ margin: '0.25rem 0', fontSize: '1.6rem', fontWeight: '900', color: '#0f172a' }}>
              {plan.title}
            </h1>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#334155' }}>
              Jurisdiction: <strong>{plan.jurisdictionId}</strong> | Department:{' '}
              <strong>{plan.department}</strong>
            </p>
          </div>

          <div style={{ textAlign: 'right', fontSize: '0.8rem', color: '#475569' }}>
            <div>Plan Version: <strong>v{plan.version || '1.0'}</strong></div>
            <div>Status: <strong>{plan.status}</strong></div>
            <div>Effective Date: <strong>{new Date(plan.updatedAt || plan.createdAt).toLocaleDateString()}</strong></div>
          </div>
        </div>

        {/* SECTION 1: RECOVERY OBJECTIVES */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#0f172a', borderBottom: '1px solid #cbd5e1', paddingBottom: '0.35rem' }}>
            1. Core Recovery Objectives & Resilience Thresholds
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem', fontSize: '0.85rem' }}>
            <div style={{ padding: '0.75rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
              <strong>Recovery Time Objective (RTO):</strong>
              <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#dc2626' }}>
                {plan.recoveryObjectives?.rtoHours || 4} Hours
              </div>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                Maximum acceptable duration of public service disruption before emergency manual restoration.
              </p>
            </div>

            <div style={{ padding: '0.75rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
              <strong>Recovery Point Objective (RPO):</strong>
              <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#2563eb' }}>
                {plan.recoveryObjectives?.rpoHours || 1} Hours
              </div>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                Maximum acceptable transaction/registry data loss gap permissible during failover.
              </p>
            </div>
          </div>
        </div>

        {/* SECTION 2: EMERGENCY ESCALATION CALL TREE */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#0f172a', borderBottom: '1px solid #cbd5e1', paddingBottom: '0.35rem' }}>
            2. Emergency Escalation Call Tree
          </h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.5rem', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f1f5f9', textAlign: 'left', borderBottom: '1px solid #cbd5e1' }}>
                <th style={{ padding: '0.5rem', border: '1px solid #e2e8f0' }}>Priority</th>
                <th style={{ padding: '0.5rem', border: '1px solid #e2e8f0' }}>Command Role</th>
                <th style={{ padding: '0.5rem', border: '1px solid #e2e8f0' }}>Officer Name</th>
                <th style={{ padding: '0.5rem', border: '1px solid #e2e8f0' }}>Direct Contact</th>
                <th style={{ padding: '0.5rem', border: '1px solid #e2e8f0' }}>Official Email</th>
              </tr>
            </thead>
            <tbody>
              {(plan.contactTree || []).map((contact, idx) => (
                <tr key={idx}>
                  <td style={{ padding: '0.5rem', border: '1px solid #e2e8f0', textAlign: 'center', fontWeight: '700' }}>
                    #{contact.priorityOrder || idx + 1}
                  </td>
                  <td style={{ padding: '0.5rem', border: '1px solid #e2e8f0', fontWeight: '600' }}>
                    {contact.role}
                  </td>
                  <td style={{ padding: '0.5rem', border: '1px solid #e2e8f0' }}>
                    {contact.officerName}
                  </td>
                  <td style={{ padding: '0.5rem', border: '1px solid #e2e8f0' }}>
                    {contact.phone || 'N/A'}
                  </td>
                  <td style={{ padding: '0.5rem', border: '1px solid #e2e8f0' }}>
                    {contact.email || 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* SECTION 3: OFFLINE MANUAL OPERATING PROCEDURES (SOPs) */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#0f172a', borderBottom: '1px solid #cbd5e1', paddingBottom: '0.35rem' }}>
            3. Offline Manual Operating Procedures (Zero-Connectivity SOPs)
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
            {criticalDeps.map((dep) => (
              <div
                key={dep.id}
                style={{
                  padding: '0.75rem',
                  border: '1px solid #e2e8f0',
                  borderRadius: '4px',
                  background: '#f8fafc',
                  fontSize: '0.85rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <strong style={{ color: '#0f172a' }}>{dep.serviceName} (Tier 1 Critical)</strong>
                  <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Restoration Target: ≤{dep.estimatedRestorationHours || 2}h</span>
                </div>
                <div style={{ marginBottom: '0.35rem' }}>
                  <span style={{ fontWeight: '600' }}>Manual Standby Alternative: </span>
                  <span>{dep.redundantAlternative || 'None (Requires direct dispatch)'}</span>
                </div>
                <div>
                  <span style={{ fontWeight: '600' }}>Offline Step-by-Step SOP: </span>
                  <p style={{ margin: '0.25rem 0 0', color: '#334155', fontStyle: 'italic' }}>
                    "{dep.manualFallbackProcedure || 'Engage manual bypass valve and log paper records.'}"
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SECTION 4: ALTERNATE EMERGENCY OPERATING FACILITIES */}
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#0f172a', borderBottom: '1px solid #cbd5e1', paddingBottom: '0.35rem' }}>
            4. Designated Alternate Emergency Operating Facilities
          </h2>
          <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.2rem', fontSize: '0.85rem', color: '#334155' }}>
            {(plan.recoveryObjectives?.alternateFacilities || []).map((fac, idx) => (
              <li key={idx} style={{ marginBottom: '0.25rem' }}>
                {fac}
              </li>
            ))}
          </ul>
        </div>

        {/* SIGN-OFF ATTESTATION BLOCK */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '2rem',
            borderTop: '2px solid #0f172a',
            paddingTop: '1.5rem',
            marginTop: '2rem',
            fontSize: '0.8rem',
          }}
        >
          <div>
            <div style={{ borderBottom: '1px dashed #64748b', height: '40px', marginBottom: '0.35rem' }} />
            <strong>Incident Commander Signature</strong>
            <div style={{ color: '#64748b' }}>Name / Designation / Date</div>
          </div>

          <div>
            <div style={{ borderBottom: '1px dashed #64748b', height: '40px', marginBottom: '0.35rem' }} />
            <strong>Municipal Commissioner / Scrutiny Authority</strong>
            <div style={{ color: '#64748b' }}>Name / Official Seal / Date</div>
          </div>
        </div>
      </div>
    </div>
  );
};
