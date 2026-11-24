import { useState, useMemo } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  Layers,
  Sparkles,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import {
  auditTemplateCitations,
  bindHistoricalSourcesSnapshot,
  TEMPLATE_REGISTRY,
} from '../../services/legalSourceService.js';

export default function TemplateCitationAuditCard({
  onInspectCitation,
}) {
  const [selectedTemplateId, setSelectedTemplateId] = useState('rera_homebuyer_dispute');
  const [selectedJurisdiction, setSelectedJurisdiction] = useState('National');
  const [snapshotResult, setSnapshotResult] = useState(null);
  const [isSnapshotting, setIsSnapshotting] = useState(false);

  const templateDef = TEMPLATE_REGISTRY[selectedTemplateId];

  const audit = useMemo(() => {
    return auditTemplateCitations(selectedTemplateId, {
      userJurisdiction: selectedJurisdiction,
    });
  }, [selectedTemplateId, selectedJurisdiction]);

  const handleCreateDraftSnapshot = async () => {
    setIsSnapshotting(true);
    try {
      const draftId = `draft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const result = await bindHistoricalSourcesSnapshot(draftId, selectedTemplateId, {
        userJurisdiction: selectedJurisdiction,
      });
      setSnapshotResult(result);
    } catch {
      // Snapshot handling
    } finally {
      setIsSnapshotting(false);
    }
  };

  const getHealthScoreColor = (score) => {
    if (score >= 90) return '#22c55e';
    if (score >= 70) return '#eab308';
    return '#ef4444';
  };

  return (
    <div
      style={{
        background: 'var(--bg-card, #1e293b)',
        borderRadius: '1rem',
        padding: '1.5rem',
        border: '1px solid var(--border-light, #334155)',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        marginBottom: '1.5rem',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '1rem',
          borderBottom: '1px solid var(--border-light, #334155)',
          paddingBottom: '1rem',
          marginBottom: '1.25rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                background: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                padding: '0.2rem 0.5rem',
                borderRadius: '0.375rem',
                fontSize: '0.75rem',
                fontWeight: 600,
              }}
            >
              <Layers size={13} /> CITATION INTEGRITY AUDITOR
            </span>
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0.25rem 0', color: '#ffffff' }}>
            Workspace Template Legal Source Health
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0, maxWidth: '650px' }}>
            Audits active statutory citations against official gazettes, flagging missing provisions, stale reviews (&gt;365d), superseded enactments, and state jurisdiction mismatches.
          </p>
        </div>

        {/* Template & Jurisdiction Pickers */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div>
            <label
              htmlFor="audit-template-select"
              style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}
            >
              Select Template
            </label>
            <select
              id="audit-template-select"
              value={selectedTemplateId}
              onChange={(e) => {
                setSelectedTemplateId(e.target.value);
                setSnapshotResult(null);
              }}
              style={{
                padding: '0.5rem 0.75rem',
                borderRadius: '0.5rem',
                background: 'var(--bg-input, #0f172a)',
                border: '1px solid var(--border-light, #334155)',
                color: 'var(--text-main, #f8fafc)',
                fontSize: '0.85rem',
              }}
            >
              {Object.entries(TEMPLATE_REGISTRY).map(([id, t]) => (
                <option key={id} value={id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="audit-jurisdiction-select"
              style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}
            >
              User Circumstance / State
            </label>
            <select
              id="audit-jurisdiction-select"
              value={selectedJurisdiction}
              onChange={(e) => {
                setSelectedJurisdiction(e.target.value);
                setSnapshotResult(null);
              }}
              style={{
                padding: '0.5rem 0.75rem',
                borderRadius: '0.5rem',
                background: 'var(--bg-input, #0f172a)',
                border: '1px solid var(--border-light, #334155)',
                color: 'var(--text-main, #f8fafc)',
                fontSize: '0.85rem',
              }}
            >
              <option value="National">National (Central Acts)</option>
              <option value="Delhi">Delhi</option>
              <option value="Maharashtra">Maharashtra</option>
              <option value="Karnataka">Karnataka</option>
              <option value="Tamil Nadu">Tamil Nadu</option>
              <option value="Uttar Pradesh">Uttar Pradesh</option>
            </select>
          </div>
        </div>
      </div>

      {/* Health Score & Metrics Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '0.75rem',
          marginBottom: '1.25rem',
        }}
      >
        {/* Health Score Pill */}
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.6)',
            borderRadius: '0.75rem',
            padding: '1rem',
            border: `1px solid ${getHealthScoreColor(audit.healthScore)}`,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>
            Citation Health
          </div>
          <div
            style={{
              fontSize: '1.75rem',
              fontWeight: 800,
              color: getHealthScoreColor(audit.healthScore),
              marginTop: '0.2rem',
            }}
          >
            {audit.healthScore}%
          </div>
          <div style={{ fontSize: '0.7rem', color: '#cbd5e1', marginTop: '0.2rem' }}>
            {audit.isValid ? (
              <span style={{ color: '#22c55e', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                <CheckCircle2 size={11} /> Valid to Draft
              </span>
            ) : (
              <span style={{ color: '#ef4444', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                <AlertTriangle size={11} /> Action Needed
              </span>
            )}
          </div>
        </div>

        {/* Total Checked */}
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.4)',
            borderRadius: '0.75rem',
            padding: '1rem',
            border: '1px solid #334155',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Total Citations</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f8fafc', marginTop: '0.2rem' }}>
            {audit.summary.totalChecked}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Required by template</div>
        </div>

        {/* Missing */}
        <div
          style={{
            background:
              audit.summary.missingCount > 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(15, 23, 42, 0.4)',
            borderRadius: '0.75rem',
            padding: '1rem',
            border: `1px solid ${audit.summary.missingCount > 0 ? '#ef4444' : '#334155'}`,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Missing</div>
          <div
            style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              color: audit.summary.missingCount > 0 ? '#ef4444' : '#f8fafc',
              marginTop: '0.2rem',
            }}
          >
            {audit.summary.missingCount}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Unregistered</div>
        </div>

        {/* Stale */}
        <div
          style={{
            background:
              audit.summary.staleCount > 0 ? 'rgba(234, 179, 8, 0.1)' : 'rgba(15, 23, 42, 0.4)',
            borderRadius: '0.75rem',
            padding: '1rem',
            border: `1px solid ${audit.summary.staleCount > 0 ? '#eab308' : '#334155'}`,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Stale Citations</div>
          <div
            style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              color: audit.summary.staleCount > 0 ? '#eab308' : '#f8fafc',
              marginTop: '0.2rem',
            }}
          >
            {audit.summary.staleCount}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>&gt;365 days unreviewed</div>
        </div>

        {/* Superseded */}
        <div
          style={{
            background:
              audit.summary.supersededCount > 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(15, 23, 42, 0.4)',
            borderRadius: '0.75rem',
            padding: '1rem',
            border: `1px solid ${audit.summary.supersededCount > 0 ? '#ef4444' : '#334155'}`,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Superseded</div>
          <div
            style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              color: audit.summary.supersededCount > 0 ? '#ef4444' : '#f8fafc',
              marginTop: '0.2rem',
            }}
          >
            {audit.summary.supersededCount}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Repealed rules</div>
        </div>

        {/* Conflicts */}
        <div
          style={{
            background:
              audit.summary.conflictCount > 0 ? 'rgba(168, 85, 247, 0.1)' : 'rgba(15, 23, 42, 0.4)',
            borderRadius: '0.75rem',
            padding: '1rem',
            border: `1px solid ${audit.summary.conflictCount > 0 ? '#a855f7' : '#334155'}`,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Jurisdiction Clashes</div>
          <div
            style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              color: audit.summary.conflictCount > 0 ? '#c084fc' : '#f8fafc',
              marginTop: '0.2rem',
            }}
          >
            {audit.summary.conflictCount}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>State mismatch</div>
        </div>
      </div>

      {/* Issues Breakdown Alerts */}
      {audit.issues.length > 0 ? (
        <div style={{ marginBottom: '1.25rem' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.5rem' }}>
            Detected Statutory Audit Alerts ({audit.issues.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {audit.issues.map((issue, idx) => (
              <div
                key={idx}
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '0.5rem',
                  background:
                    issue.severity === 'CRITICAL'
                      ? 'rgba(239, 68, 68, 0.1)'
                      : issue.severity === 'HIGH'
                      ? 'rgba(245, 158, 11, 0.1)'
                      : 'rgba(234, 179, 8, 0.1)',
                  borderLeft: `4px solid ${
                    issue.severity === 'CRITICAL'
                      ? '#ef4444'
                      : issue.severity === 'HIGH'
                      ? '#f59e0b'
                      : '#eab308'
                  }`,
                  borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                  borderRight: '1px solid rgba(255, 255, 255, 0.05)',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        padding: '0.1rem 0.35rem',
                        borderRadius: '0.2rem',
                        background:
                          issue.severity === 'CRITICAL'
                            ? '#ef4444'
                            : issue.severity === 'HIGH'
                            ? '#f59e0b'
                            : '#eab308',
                        color: '#000000',
                      }}
                    >
                      {issue.type}
                    </span>
                    <strong style={{ fontSize: '0.85rem', color: '#f8fafc' }}>{issue.message}</strong>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                    <strong>Remediation:</strong> {issue.recommendation}
                  </div>
                </div>

                {issue.sourceId && onInspectCitation && (
                  <button
                    onClick={() => onInspectCitation(issue.sourceId)}
                    type="button"
                    style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#38bdf8',
                      fontSize: '0.75rem',
                      padding: '0.3rem 0.6rem',
                      borderRadius: '0.375rem',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    View Source
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div
          style={{
            background: 'rgba(34, 197, 94, 0.1)',
            border: '1px solid rgba(34, 197, 94, 0.25)',
            borderRadius: '0.5rem',
            padding: '0.75rem 1rem',
            marginBottom: '1.25rem',
            color: '#22c55e',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <ShieldCheck size={18} />
          <span>
            All required statutory citations for <strong>{templateDef?.name}</strong> are reviewed, active, and fully compliant with {selectedJurisdiction} jurisdiction.
          </span>
        </div>
      )}

      {/* Snapshot Simulation Action */}
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.6)',
          borderRadius: '0.75rem',
          padding: '1rem',
          border: '1px solid #334155',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, color: '#f8fafc' }}>
            <Lock size={15} style={{ color: '#38bdf8' }} /> Immutable Historical Citizen Draft Binding
          </div>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.2rem', maxWidth: '600px' }}>
            When a citizen compiles a petition, CivicBridge seals an immutable snapshot of all active citations. Even if a statute is amended months later, the citizen's generated draft retains the exact historical provision.
          </div>
        </div>

        <button
          onClick={handleCreateDraftSnapshot}
          type="button"
          disabled={isSnapshotting}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.55rem 1rem',
            borderRadius: '0.5rem',
            background: '#2563eb',
            color: '#ffffff',
            border: 'none',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: isSnapshotting ? 'not-allowed' : 'pointer',
            opacity: isSnapshotting ? 0.7 : 1,
          }}
        >
          <Sparkles size={14} /> {isSnapshotting ? 'Sealing Citations...' : 'Simulate Draft Snapshot'}
        </button>
      </div>

      {/* Snapshot Demonstration Result Card */}
      {snapshotResult && (
        <div
          style={{
            marginTop: '1rem',
            background: 'rgba(30, 41, 59, 0.8)',
            border: '1px solid #38bdf8',
            borderRadius: '0.75rem',
            padding: '1rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#38bdf8' }}>
              ✓ CITIZEN DRAFT CITATION SEAL GENERATED
            </span>
            <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#94a3b8' }}>
              ID: {snapshotResult.draftId}
            </span>
          </div>
          <div style={{ fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '0.5rem' }}>
            Sealed <strong>{snapshotResult.sources.length}</strong> statutory provisions for {snapshotResult.templateName} at {new Date(snapshotResult.boundAt).toLocaleTimeString()}.
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {snapshotResult.sources.map((s) => (
              <span
                key={s.id}
                style={{
                  background: 'rgba(56, 189, 248, 0.1)',
                  color: '#38bdf8',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '0.25rem',
                  fontSize: '0.75rem',
                  fontFamily: 'monospace',
                }}
              >
                {s.provision || s.id} (v{s.version || '1.0.0'})
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
