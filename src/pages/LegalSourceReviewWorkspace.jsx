import { useState, useMemo } from 'react';
import {
  Scale,
  ShieldCheck,
  History,
  AlertTriangle,
  Download,
  RotateCcw,
  Layers,
  Lock,
  BookOpen,
  CheckCircle2,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { can, getCurrentActor } from '../services/accessControl.js';
import {
  loadLegalSources,
  loadDraftSnapshots,
  loadLegalSourceAuditLogs,
  resetLegalSourcesToDefault,
  exportLegalSourceDossier,
} from '../services/legalSourceStorage.js';
import {
  createDraftSource,
  reviewAndPublishSource,
  supersedeSource,
  rollbackSourceVersion,
  isSourceStale,
  VERSION_STATUSES,
  TEMPLATE_REGISTRY,
  STATUTORY_DISCLAIMER,
} from '../services/legalSourceService.js';
import LegalSourceRegistryTable from '../components/legalSources/LegalSourceRegistryTable.jsx';
import LegalSourceDetailModal from '../components/legalSources/LegalSourceDetailModal.jsx';
import SourceReviewActionModal from '../components/legalSources/SourceReviewActionModal.jsx';
import TemplateCitationAuditCard from '../components/legalSources/TemplateCitationAuditCard.jsx';

export default function LegalSourceReviewWorkspace() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('registry');
  const [sources, setSources] = useState(() => loadLegalSources());
  const [snapshots, setSnapshots] = useState(() => loadDraftSnapshots());
  const [auditLogs, setAuditLogs] = useState(() => loadLegalSourceAuditLogs());
  const [selectedSource, setSelectedSource] = useState(null);
  const [actionModalConfig, setActionModalConfig] = useState(null); // { type, source }
  const [isNewDraftOpen, setIsNewDraftOpen] = useState(false);
  const [notification, setNotification] = useState(null);

  // New Draft Form State
  const [draftTitle, setDraftTitle] = useState('');
  const [draftActName, setDraftActName] = useState('');
  const [draftProvision, setDraftProvision] = useState('');
  const [draftJurisdiction, setDraftJurisdiction] = useState('National');
  const [draftTemplate, setDraftTemplate] = useState('rera_homebuyer_dispute');
  const [draftOfficialUrl, setDraftOfficialUrl] = useState('');
  const [draftSummary, setDraftSummary] = useState('');
  const [draftFullText, setDraftFullText] = useState('');

  // Check RBAC permissions for the logged-in user
  const actor = user || getCurrentActor();
  const canReview = can('legalSources.review', actor);
  const canManage = can('legalSources.manage', actor);

  const showNotification = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const refreshData = () => {
    setSources(loadLegalSources());
    setSnapshots(loadDraftSnapshots());
    setAuditLogs(loadLegalSourceAuditLogs());
  };

  // Summary Metrics
  const metrics = useMemo(() => {
    const total = sources.length;
    const reviewed = sources.filter((s) => s.status === VERSION_STATUSES.REVIEWED).length;
    const drafts = sources.filter((s) => s.status === VERSION_STATUSES.DRAFT).length;
    const superseded = sources.filter((s) => s.status === VERSION_STATUSES.SUPERSEDED).length;
    const stale = sources.filter((s) => s.status === VERSION_STATUSES.REVIEWED && isSourceStale(s)).length;
    const templatesCount = Object.keys(TEMPLATE_REGISTRY).length;

    return { total, reviewed, drafts, superseded, stale, templatesCount };
  }, [sources]);

  // Handle Review Actions (Review/Publish, Supersede, Rollback)
  const handleReviewActionSubmit = async (payload) => {
    try {
      if (payload.type === 'review') {
        await reviewAndPublishSource(payload.sourceId, {
          reviewerNotes: payload.reviewerNotes,
          nextVersion: payload.nextVersion,
        });
        showNotification(`Successfully reviewed and published version ${payload.nextVersion}`);
      } else if (payload.type === 'supersede') {
        await supersedeSource(payload.sourceId, {
          replacementSourceId: payload.replacementSourceId,
          supersededReason: payload.supersededReason,
        });
        showNotification('Legal source marked as superseded.');
      } else if (payload.type === 'rollback') {
        await rollbackSourceVersion(payload.sourceId, payload.targetVersion, {
          rollbackReason: payload.rollbackReason,
        });
        showNotification(`Successfully rolled back to version ${payload.targetVersion}`);
      }
      refreshData();
      setActionModalConfig(null);
      if (selectedSource) {
        setSelectedSource(loadLegalSources().find((s) => s.id === selectedSource.id) || null);
      }
    } catch (err) {
      showNotification(`Action failed: ${err.message}`, 'error');
    }
  };

  // Handle Create New Draft Source
  const handleCreateDraft = async (e) => {
    e.preventDefault();
    try {
      await createDraftSource({
        title: draftTitle,
        actName: draftActName,
        provision: draftProvision,
        jurisdiction: draftJurisdiction,
        applicableTemplates: [draftTemplate],
        officialUrl: draftOfficialUrl,
        summary: draftSummary,
        fullText: draftFullText,
      });

      showNotification('New draft legal source registered successfully.');
      setIsNewDraftOpen(false);
      // Reset form
      setDraftTitle('');
      setDraftActName('');
      setDraftProvision('');
      setDraftOfficialUrl('');
      setDraftSummary('');
      setDraftFullText('');
      refreshData();
    } catch (err) {
      showNotification(`Could not create draft: ${err.message}`, 'error');
    }
  };

  // Export JSON Dossier
  const handleExportDossier = () => {
    const json = exportLegalSourceDossier(sources);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `civicbridge-legal-sources-dossier-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification('Exported complete legal source registry dossier.');
  };

  // Reset to Factory Defaults
  const handleReset = () => {
    if (window.confirm('Reset all legal sources and test revisions to factory seed data?')) {
      resetLegalSourcesToDefault();
      refreshData();
      showNotification('Reset registry to official seed baseline.');
    }
  };

  return (
    <div
      style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '2rem 1.5rem',
        color: 'var(--text-main, #f8fafc)',
      }}
    >
      {/* Toast Notification */}
      {notification && (
        <div
          role="alert"
          style={{
            position: 'fixed',
            top: '1.5rem',
            right: '1.5rem',
            zIndex: 10000,
            padding: '0.75rem 1.25rem',
            borderRadius: '0.5rem',
            background: notification.type === 'error' ? '#ef4444' : '#15803d',
            color: '#ffffff',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontWeight: 500,
            fontSize: '0.875rem',
          }}
        >
          {notification.type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
          {notification.msg}
        </div>
      )}

      {/* Main Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                background: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                padding: '0.25rem 0.6rem',
                borderRadius: '0.375rem',
                fontSize: '0.75rem',
                fontWeight: 700,
                letterSpacing: '0.05em',
              }}
            >
              <Scale size={13} /> STATUTORY CITATION REGISTRY
            </span>
            <span
              style={{
                background: canReview ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                color: canReview ? '#22c55e' : '#94a3b8',
                padding: '0.25rem 0.6rem',
                borderRadius: '0.375rem',
                fontSize: '0.75rem',
                fontWeight: 600,
              }}
            >
              {canReview ? '✓ Authorized Legal Reviewer (Admin)' : 'Citizen Read-Only Mode'}
            </span>
          </div>

          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: '0.2rem 0', color: '#ffffff' }}>
            Versioned Legal Source Review for Workspace Templates
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.92rem', margin: 0, maxWidth: '750px', lineHeight: 1.5 }}>
            Maintains reviewed, versioned statutory references powering CivicBridge drafting templates. Enforces authorized reviewer publication, tracks SemVer lifecycles, and seals historical citations in citizen drafts.
          </p>
        </div>

        {/* Global Toolbar */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={handleExportDossier}
            type="button"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.55rem 0.9rem',
              borderRadius: '0.5rem',
              background: 'rgba(255, 255, 255, 0.08)',
              color: '#f8fafc',
              border: '1px solid var(--border-light, #334155)',
              fontSize: '0.85rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <Download size={15} /> Export JSON Dossier
          </button>

          <button
            onClick={handleReset}
            type="button"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.55rem 0.9rem',
              borderRadius: '0.5rem',
              background: 'rgba(239, 68, 68, 0.1)',
              color: '#ef4444',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
            title="Reset to factory statutory seed data"
          >
            <RotateCcw size={15} /> Reset Defaults
          </button>
        </div>
      </div>

      {/* Outcome Neutrality Advisory Banner */}
      <div
        style={{
          background: 'rgba(30, 41, 59, 0.7)',
          borderLeft: '4px solid #38bdf8',
          borderRadius: '0.5rem',
          padding: '0.75rem 1rem',
          marginBottom: '1.5rem',
          fontSize: '0.82rem',
          color: '#cbd5e1',
          lineHeight: 1.5,
          display: 'flex',
          gap: '0.6rem',
          alignItems: 'flex-start',
        }}
      >
        <BookOpen size={16} style={{ color: '#38bdf8', flexShrink: 0, marginTop: '0.1rem' }} />
        <div>
          <strong>Statutory Compliance & Outcome Neutrality:</strong> {STATUTORY_DISCLAIMER}
        </div>
      </div>

      {/* Stats Metric Strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '0.75rem',
          marginBottom: '1.5rem',
        }}
      >
        <div
          style={{
            background: 'var(--bg-card, #1e293b)',
            padding: '1rem',
            borderRadius: '0.75rem',
            border: '1px solid var(--border-light, #334155)',
          }}
        >
          <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Total Sources</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f8fafc', marginTop: '0.2rem' }}>
            {metrics.total}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Across all templates</div>
        </div>

        <div
          style={{
            background: 'var(--bg-card, #1e293b)',
            padding: '1rem',
            borderRadius: '0.75rem',
            border: '1px solid var(--border-light, #334155)',
          }}
        >
          <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Reviewed & Active</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#22c55e', marginTop: '0.2rem' }}>
            {metrics.reviewed}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Verified against gazettes</div>
        </div>

        <div
          style={{
            background: 'var(--bg-card, #1e293b)',
            padding: '1rem',
            borderRadius: '0.75rem',
            border: '1px solid var(--border-light, #334155)',
          }}
        >
          <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Unreviewed Drafts</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f59e0b', marginTop: '0.2rem' }}>
            {metrics.drafts}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Pending review</div>
        </div>

        <div
          style={{
            background: 'var(--bg-card, #1e293b)',
            padding: '1rem',
            borderRadius: '0.75rem',
            border: '1px solid var(--border-light, #334155)',
          }}
        >
          <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Superseded</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ef4444', marginTop: '0.2rem' }}>
            {metrics.superseded}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Repealed/amended</div>
        </div>

        <div
          style={{
            background: 'var(--bg-card, #1e293b)',
            padding: '1rem',
            borderRadius: '0.75rem',
            border: '1px solid var(--border-light, #334155)',
          }}
        >
          <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Stale Reviews</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#eab308', marginTop: '0.2rem' }}>
            {metrics.stale}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>&gt;365 days old</div>
        </div>

        <div
          style={{
            background: 'var(--bg-card, #1e293b)',
            padding: '1rem',
            borderRadius: '0.75rem',
            border: '1px solid var(--border-light, #334155)',
          }}
        >
          <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Covered Templates</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#a5b4fc', marginTop: '0.2rem' }}>
            {metrics.templatesCount}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Workspace engines</div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '1px solid var(--border-light, #334155)',
          marginBottom: '1.5rem',
        }}
      >
        <button
          onClick={() => setActiveTab('registry')}
          type="button"
          style={{
            padding: '0.65rem 1.25rem',
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'registry' ? '3px solid #38bdf8' : '3px solid transparent',
            color: activeTab === 'registry' ? '#38bdf8' : '#94a3b8',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          <Scale size={16} /> Legal Source Registry ({sources.length})
        </button>

        <button
          onClick={() => setActiveTab('templateAudit')}
          type="button"
          style={{
            padding: '0.65rem 1.25rem',
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'templateAudit' ? '3px solid #38bdf8' : '3px solid transparent',
            color: activeTab === 'templateAudit' ? '#38bdf8' : '#94a3b8',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          <Layers size={16} /> Template Citation Audits
        </button>

        <button
          onClick={() => setActiveTab('historicalDrafts')}
          type="button"
          style={{
            padding: '0.65rem 1.25rem',
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'historicalDrafts' ? '3px solid #38bdf8' : '3px solid transparent',
            color: activeTab === 'historicalDrafts' ? '#38bdf8' : '#94a3b8',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          <Lock size={16} /> Historical Draft Snapshots ({snapshots.length})
        </button>

        <button
          onClick={() => setActiveTab('auditTrail')}
          type="button"
          style={{
            padding: '0.65rem 1.25rem',
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'auditTrail' ? '3px solid #38bdf8' : '3px solid transparent',
            color: activeTab === 'auditTrail' ? '#38bdf8' : '#94a3b8',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          <History size={16} /> Review Audit Log ({auditLogs.length})
        </button>
      </div>

      {/* Tab 1: Registry Table */}
      {activeTab === 'registry' && (
        <div>
          <LegalSourceRegistryTable
            sources={sources}
            onSelectSource={(src) => setSelectedSource(src)}
            onAction={(actionType, src) => setActionModalConfig({ type: actionType, source: src })}
            canReview={canReview}
            canManage={canManage}
            onAddNewDraft={() => setIsNewDraftOpen(true)}
          />
        </div>
      )}

      {/* Tab 2: Template Citation Audit Engine */}
      {activeTab === 'templateAudit' && (
        <div>
          <TemplateCitationAuditCard
            onInspectCitation={(citationId) => {
              const found = sources.find((s) => s.id === citationId);
              if (found) setSelectedSource(found);
            }}
          />
        </div>
      )}

      {/* Tab 3: Historical Draft Snapshots */}
      {activeTab === 'historicalDrafts' && (
        <div
          style={{
            background: 'var(--bg-card, #1e293b)',
            borderRadius: '1rem',
            padding: '1.5rem',
            border: '1px solid var(--border-light, #334155)',
          }}
        >
          <div style={{ marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 0.25rem 0', color: '#ffffff' }}>
              Sealed Citizen Draft Historical Citations
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0 }}>
              Whenever a citizen compiles a petition or grievance, an immutable statutory snapshot is sealed. If laws or rules are amended later, previously generated drafts remain legally anchored to the statutory wording effective at creation time.
            </p>
          </div>

          {snapshots.length === 0 ? (
            <div
              style={{
                padding: '3rem',
                textAlign: 'center',
                color: '#94a3b8',
                fontStyle: 'italic',
                background: 'rgba(15, 23, 42, 0.4)',
                borderRadius: '0.75rem',
              }}
            >
              No citizen draft snapshots recorded yet. Go to the "Template Citation Audits" tab and click "Simulate Draft Snapshot" to bind citations!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {snapshots.map((snap) => (
                <div
                  key={snap.draftId}
                  style={{
                    background: 'rgba(15, 23, 42, 0.6)',
                    borderRadius: '0.75rem',
                    padding: '1rem 1.25rem',
                    border: '1px solid #334155',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '0.5rem',
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.95rem' }}>
                        {snap.templateName || snap.templateId}
                      </span>
                      <span
                        style={{
                          marginLeft: '0.5rem',
                          fontFamily: 'monospace',
                          color: '#38bdf8',
                          fontSize: '0.8rem',
                        }}
                      >
                        [{snap.draftId}]
                      </span>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                      Sealed: {new Date(snap.boundAt).toLocaleString()} • Jurisdiction: {snap.userJurisdiction}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '0.75rem' }}>
                    Bound Citations ({snap.sources.length}):
                  </div>

                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    {snap.sources.map((s) => (
                      <div
                        key={s.id}
                        style={{
                          background: 'rgba(255, 255, 255, 0.05)',
                          padding: '0.3rem 0.6rem',
                          borderRadius: '0.375rem',
                          fontSize: '0.75rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                        }}
                      >
                        <ShieldCheck size={12} style={{ color: '#22c55e' }} />
                        <span style={{ fontWeight: 600 }}>{s.provision || s.id}</span>
                        <code style={{ color: '#38bdf8' }}>v{s.version}</code>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Administrative Audit Trail */}
      {activeTab === 'auditTrail' && (
        <div
          style={{
            background: 'var(--bg-card, #1e293b)',
            borderRadius: '1rem',
            padding: '1.5rem',
            border: '1px solid var(--border-light, #334155)',
          }}
        >
          <div style={{ marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 0.25rem 0', color: '#ffffff' }}>
              Statutory Version Transition Audit Trail
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0 }}>
              Chronological log of legal source draft creation, authorized reviewer publications, supersessions, and rollbacks.
            </p>
          </div>

          {auditLogs.length === 0 ? (
            <div
              style={{
                padding: '3rem',
                textAlign: 'center',
                color: '#94a3b8',
                fontStyle: 'italic',
              }}
            >
              No review audit events logged yet.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr
                    style={{
                      borderBottom: '1px solid #334155',
                      color: '#94a3b8',
                      textAlign: 'left',
                      fontSize: '0.75rem',
                      textTransform: 'uppercase',
                    }}
                  >
                    <th style={{ padding: '0.6rem' }}>Timestamp</th>
                    <th style={{ padding: '0.6rem' }}>Action</th>
                    <th style={{ padding: '0.6rem' }}>Source ID</th>
                    <th style={{ padding: '0.6rem' }}>Version</th>
                    <th style={{ padding: '0.6rem' }}>Reviewer / Actor</th>
                    <th style={{ padding: '0.6rem' }}>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr
                      key={log.id}
                      style={{ borderBottom: '1px solid rgba(51, 65, 85, 0.4)' }}
                    >
                      <td style={{ padding: '0.6rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td style={{ padding: '0.6rem' }}>
                        <span
                          style={{
                            padding: '0.15rem 0.4rem',
                            borderRadius: '0.25rem',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            background:
                              log.action === 'REVIEW_AND_PUBLISH'
                                ? 'rgba(34, 197, 94, 0.15)'
                                : log.action === 'ROLLBACK_VERSION'
                                ? 'rgba(234, 179, 8, 0.15)'
                                : log.action === 'SUPERSEDE'
                                ? 'rgba(239, 68, 68, 0.15)'
                                : 'rgba(56, 189, 248, 0.15)',
                            color:
                              log.action === 'REVIEW_AND_PUBLISH'
                                ? '#22c55e'
                                : log.action === 'ROLLBACK_VERSION'
                                ? '#eab308'
                                : log.action === 'SUPERSEDE'
                                ? '#ef4444'
                                : '#38bdf8',
                          }}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td style={{ padding: '0.6rem', fontFamily: 'monospace', color: '#cbd5e1' }}>
                        {log.sourceId}
                      </td>
                      <td style={{ padding: '0.6rem', fontFamily: 'monospace' }}>
                        v{log.version}
                      </td>
                      <td style={{ padding: '0.6rem', color: '#f8fafc', fontWeight: 500 }}>
                        {log.actor}
                      </td>
                      <td style={{ padding: '0.6rem', color: '#94a3b8' }}>
                        {log.details}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal 1: Legal Source Detail Modal */}
      {selectedSource && (
        <LegalSourceDetailModal
          source={selectedSource}
          onClose={() => setSelectedSource(null)}
          canReview={canReview}
          onRollback={(targetVer) => {
            setActionModalConfig({
              type: 'rollback',
              source: selectedSource,
              targetVersion: targetVer,
            });
          }}
        />
      )}

      {/* Modal 2: Source Review Action Modal (Publish / Supersede / Rollback) */}
      {actionModalConfig && (
        <SourceReviewActionModal
          source={actionModalConfig.source}
          actionType={actionModalConfig.type}
          allSources={sources}
          canReview={canReview}
          onClose={() => setActionModalConfig(null)}
          onSubmit={handleReviewActionSubmit}
        />
      )}

      {/* Modal 3: Add Draft Legal Source Modal */}
      {isNewDraftOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: 'var(--bg-modal, #1e293b)',
              borderRadius: '1rem',
              maxWidth: '650px',
              width: '100%',
              border: '1px solid var(--border-light, #334155)',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
              color: 'var(--text-main, #f8fafc)',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '90vh',
            }}
          >
            <div
              style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid var(--border-light, #334155)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#ffffff' }}>
                Add New Draft Legal Source
              </h2>
              <button
                onClick={() => setIsNewDraftOpen(false)}
                type="button"
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateDraft} style={{ padding: '1.5rem', overflowY: 'auto' }}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                  Statutory Provision (e.g. Section 18(1), Rule 13) *
                </label>
                <input
                  type="text"
                  value={draftProvision}
                  onChange={(e) => setDraftProvision(e.target.value)}
                  required
                  placeholder="Section 18(1)"
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.75rem',
                    borderRadius: '0.5rem',
                    background: '#0f172a',
                    border: '1px solid #334155',
                    color: '#f8fafc',
                  }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                  Full Act / Regulation Name *
                </label>
                <input
                  type="text"
                  value={draftActName}
                  onChange={(e) => setDraftActName(e.target.value)}
                  required
                  placeholder="Real Estate (Regulation and Development) Act, 2016"
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.75rem',
                    borderRadius: '0.5rem',
                    background: '#0f172a',
                    border: '1px solid #334155',
                    color: '#f8fafc',
                  }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                  Citation Title *
                </label>
                <input
                  type="text"
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  required
                  placeholder="Section 18(1), RERA 2016 - Return of Amount and Compensation"
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.75rem',
                    borderRadius: '0.5rem',
                    background: '#0f172a',
                    border: '1px solid #334155',
                    color: '#f8fafc',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                    Jurisdiction
                  </label>
                  <select
                    value={draftJurisdiction}
                    onChange={(e) => setDraftJurisdiction(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.75rem',
                      borderRadius: '0.5rem',
                      background: '#0f172a',
                      border: '1px solid #334155',
                      color: '#f8fafc',
                    }}
                  >
                    <option value="National">National (Central)</option>
                    <option value="Delhi">Delhi</option>
                    <option value="Maharashtra">Maharashtra</option>
                    <option value="Karnataka">Karnataka</option>
                    <option value="Tamil Nadu">Tamil Nadu</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                    Primary Template
                  </label>
                  <select
                    value={draftTemplate}
                    onChange={(e) => setDraftTemplate(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.75rem',
                      borderRadius: '0.5rem',
                      background: '#0f172a',
                      border: '1px solid #334155',
                      color: '#f8fafc',
                    }}
                  >
                    {Object.entries(TEMPLATE_REGISTRY).map(([id, t]) => (
                      <option key={id} value={id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                  Official India Code / Gazette URL
                </label>
                <input
                  type="url"
                  value={draftOfficialUrl}
                  onChange={(e) => setDraftOfficialUrl(e.target.value)}
                  placeholder="https://www.indiacode.nic.in/handle/123456789/..."
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.75rem',
                    borderRadius: '0.5rem',
                    background: '#0f172a',
                    border: '1px solid #334155',
                    color: '#f8fafc',
                  }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                  Plain-Language Legal Summary
                </label>
                <textarea
                  value={draftSummary}
                  onChange={(e) => setDraftSummary(e.target.value)}
                  rows={2}
                  placeholder="Neutral explanation of what the statutory section provides..."
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.75rem',
                    borderRadius: '0.5rem',
                    background: '#0f172a',
                    border: '1px solid #334155',
                    color: '#f8fafc',
                  }}
                />
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                  Canonical Statutory Provision Text
                </label>
                <textarea
                  value={draftFullText}
                  onChange={(e) => setDraftFullText(e.target.value)}
                  rows={3}
                  placeholder="Excerpt of actual section or rule text..."
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.75rem',
                    borderRadius: '0.5rem',
                    background: '#0f172a',
                    border: '1px solid #334155',
                    color: '#f8fafc',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  onClick={() => setIsNewDraftOpen(false)}
                  type="button"
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '0.5rem',
                    background: 'rgba(255, 255, 255, 0.08)',
                    color: '#f8fafc',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '0.5rem 1.25rem',
                    borderRadius: '0.5rem',
                    background: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Register Draft Source
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
