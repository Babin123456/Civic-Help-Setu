import { useState } from 'react';
import {
  Building2,
  AlertTriangle,
  Clock,
  ShieldAlert,
  Edit3,
  Download,
  Trash2,
  CheckCircle2,
  FileText,
} from 'lucide-react';
import {
  CASE_STAGES,
  CASE_STAGE_LABELS,
  FACILITY_TYPES,
  AUTHORITY_TYPES,
  computeFollowUpReminders,
} from '../../services/accessibilityEscalationService.js';
import {
  OFFICIAL_STATUS_DISCLAIMER,
} from '../../services/accessibilityEscalationStorage.js';

export default function CaseSummaryCard({
  caseData,
  onStatusChange,
  onEditCase,
  onDeleteCase,
  onExportJson,
  onExportMarkdown,
  onGenerateDraft,
}) {
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);

  if (!caseData) return null;

  const reminders = computeFollowUpReminders(caseData);
  const facilityTypeLabel = FACILITY_TYPES[caseData.facilityType] || caseData.facilityType;
  const authorityLabel = AUTHORITY_TYPES[caseData.authorityType] || caseData.authorityType;

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
      {/* Top Banner: Official Status vs Citizen Tracker Distinction */}
      <div
        style={{
          background: 'rgba(56, 189, 248, 0.08)',
          borderLeft: '4px solid #38bdf8',
          borderRadius: '0.375rem',
          padding: '0.6rem 0.85rem',
          marginBottom: '1.25rem',
          fontSize: '0.8rem',
          color: '#cbd5e1',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.5rem',
          lineHeight: 1.4,
        }}
      >
        <ShieldAlert size={16} style={{ color: '#38bdf8', flexShrink: 0, marginTop: '0.1rem' }} />
        <div>
          <strong>Citizen Record vs Official Status:</strong> {OFFICIAL_STATUS_DISCLAIMER}
        </div>
      </div>

      {/* Main Details Grid */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div style={{ flex: '1 1 500px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                background: 'rgba(99, 102, 241, 0.15)',
                color: '#a5b4fc',
                padding: '0.2rem 0.5rem',
                borderRadius: '0.375rem',
                fontSize: '0.75rem',
                fontWeight: 600,
              }}
            >
              <Building2 size={12} /> {facilityTypeLabel}
            </span>

            {caseData.officialComplaintNumber && (
              <span
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: '#e2e8f0',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '0.375rem',
                  fontSize: '0.75rem',
                  fontFamily: 'monospace',
                }}
              >
                Docket: {caseData.officialComplaintNumber}
              </span>
            )}
          </div>

          <h1
            style={{
              fontSize: '1.35rem',
              fontWeight: 700,
              margin: '0.2rem 0',
              color: 'var(--text-main, #f8fafc)',
            }}
          >
            {caseData.title}
          </h1>

          <div style={{ fontSize: '0.875rem', color: '#94a3b8', marginTop: '0.35rem' }}>
            <strong>Facility:</strong> {caseData.facilityName} • <strong>Location:</strong> {caseData.location || 'N/A'}
          </div>

          <div style={{ fontSize: '0.85rem', color: '#cbd5e1', marginTop: '0.2rem' }}>
            <strong>Authority Addressed:</strong> {authorityLabel}{' '}
            {caseData.authorityContact ? `(${caseData.authorityContact})` : ''}
          </div>
        </div>

        {/* Current Citizen Stage Pill & Dropdown */}
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>
            Citizen Case Stage
          </div>
          <button
            onClick={() => setShowStatusDropdown((prev) => !prev)}
            type="button"
            aria-expanded={showStatusDropdown}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              background:
                caseData.status === CASE_STAGES.RESOLVED
                  ? 'rgba(34, 197, 94, 0.2)'
                  : caseData.status === CASE_STAGES.ESCALATED
                  ? 'rgba(168, 85, 247, 0.2)'
                  : 'rgba(56, 189, 248, 0.15)',
              color:
                caseData.status === CASE_STAGES.RESOLVED
                  ? '#22c55e'
                  : caseData.status === CASE_STAGES.ESCALATED
                  ? '#c084fc'
                  : '#38bdf8',
              border: '1px solid currentColor',
              padding: '0.45rem 0.85rem',
              borderRadius: '0.5rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {caseData.status === CASE_STAGES.RESOLVED ? <CheckCircle2 size={15} /> : <Clock size={15} />}
            {CASE_STAGE_LABELS[caseData.status] || caseData.status}
          </button>

          {showStatusDropdown && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: '100%',
                marginTop: '0.4rem',
                background: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '0.5rem',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
                zIndex: 100,
                minWidth: '220px',
                padding: '0.4rem 0',
              }}
            >
              {Object.entries(CASE_STAGE_LABELS).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => {
                    onStatusChange(k);
                    setShowStatusDropdown(false);
                  }}
                  type="button"
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '0.5rem 1rem',
                    background: caseData.status === k ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                    border: 'none',
                    color: caseData.status === k ? '#38bdf8' : '#e2e8f0',
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Reminder Alerts Strip */}
      {reminders.hasOverdue && (
        <div
          style={{
            marginTop: '1.25rem',
            background: 'rgba(234, 179, 8, 0.12)',
            border: '1px solid rgba(234, 179, 8, 0.35)',
            borderRadius: '0.5rem',
            padding: '0.85rem 1rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.6rem',
            color: '#fef08a',
            fontSize: '0.85rem',
          }}
        >
          <AlertTriangle size={18} style={{ color: '#eab308', flexShrink: 0, marginTop: '0.1rem' }} />
          <div>
            <strong>Follow-Up Milestone Overdue:</strong> Target response date for "
            {reminders.overdueEvents[0].summary}" elapsed {reminders.overdueEvents[0].overdueDays} days ago ({reminders.overdueEvents[0].followUpDate}).
            <div style={{ marginTop: '0.3rem', color: '#cbd5e1', fontSize: '0.8rem' }}>
              <strong>Suggested Next Step:</strong> {reminders.suggestedNextAction}
            </div>
            <div style={{ marginTop: '0.3rem', color: '#94a3b8', fontSize: '0.75rem', fontStyle: 'italic' }}>
              {reminders.disclaimer}
            </div>
          </div>
        </div>
      )}

      {/* Action Toolbar */}
      <div
        style={{
          marginTop: '1.25rem',
          paddingTop: '1rem',
          borderTop: '1px solid var(--border-light, #334155)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={onGenerateDraft}
            type="button"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.5rem 0.9rem',
              borderRadius: '0.5rem',
              background: '#2563eb',
              color: '#ffffff',
              border: 'none',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            <FileText size={15} /> Draft Follow-Up / Escalation
          </button>

          <button
            onClick={onEditCase}
            type="button"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.5rem 0.85rem',
              borderRadius: '0.5rem',
              background: 'rgba(255, 255, 255, 0.08)',
              color: '#f8fafc',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            <Edit3 size={14} /> Edit Case Details
          </button>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={onExportJson}
            type="button"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.45rem 0.75rem',
              borderRadius: '0.5rem',
              background: 'transparent',
              color: '#94a3b8',
              border: '1px solid #334155',
              fontSize: '0.8rem',
              cursor: 'pointer',
            }}
          >
            <Download size={13} /> JSON
          </button>

          <button
            onClick={onExportMarkdown}
            type="button"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.45rem 0.75rem',
              borderRadius: '0.5rem',
              background: 'transparent',
              color: '#94a3b8',
              border: '1px solid #334155',
              fontSize: '0.8rem',
              cursor: 'pointer',
            }}
          >
            <Download size={13} /> Markdown Log
          </button>

          <button
            onClick={onDeleteCase}
            type="button"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.45rem 0.75rem',
              borderRadius: '0.5rem',
              background: 'rgba(239, 68, 68, 0.1)',
              color: '#ef4444',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              fontSize: '0.8rem',
              cursor: 'pointer',
            }}
          >
            <Trash2 size={13} /> Delete
          </button>
        </div>
      </div>
    </div>
  );
}
