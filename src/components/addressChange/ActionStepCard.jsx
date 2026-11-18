import { useState } from 'react';
import {
  ExternalLink,
  Info,
  Clock,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from 'lucide-react';
import { CHECKLIST_STATUSES, CHECKLIST_STATUS_LABELS } from '../../services/addressChangeStorage';

export default function ActionStepCard({
  record,
  index,
  itemState = {},
  isBlocked = false,
  missingPrereqNames = [],
  onUpdateProgress,
  onOpenDetails,
  onOpenCorrection,
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const status = itemState.status || 'not_started';
  const ackRef = itemState.acknowledgementRef || '';
  const subDate = itemState.submissionDate || '';
  const notes = itemState.notes || '';
  const completedProofs = Array.isArray(itemState.completedProofs) ? itemState.completedProofs : [];

  const handleStatusChange = (newStatus) => {
    onUpdateProgress(record.id, { status: newStatus });
  };

  const handleAckChange = (val) => {
    onUpdateProgress(record.id, { acknowledgementRef: val });
  };

  const handleDateChange = (val) => {
    onUpdateProgress(record.id, { submissionDate: val });
  };

  const handleNotesChange = (val) => {
    onUpdateProgress(record.id, { notes: val });
  };

  const toggleProof = (proofName) => {
    const updated = completedProofs.includes(proofName)
      ? completedProofs.filter((p) => p !== proofName)
      : [...completedProofs, proofName];
    onUpdateProgress(record.id, { completedProofs: updated });
  };

  const getStatusColor = (st) => {
    switch (st) {
      case 'completed':
        return '#059669'; // Green
      case 'submitted':
        return '#2563eb'; // Blue
      case 'documents_prepared':
        return '#d97706'; // Amber
      default:
        return 'var(--text-secondary, #6b7280)';
    }
  };

  return (
    <div
      className="card"
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: status === 'completed'
          ? '1px solid #10b981'
          : isBlocked
          ? '1px dashed #f59e0b'
          : '1px solid var(--border-main)',
        borderRadius: '0.75rem',
        padding: '1.25rem',
        marginBottom: '1rem',
      }}
    >
      {/* Top Header: Step Number, Title & Status Selector */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '0.75rem',
          marginBottom: '0.75rem',
        }}
      >
        <div style={{ flex: 1, minWidth: '240px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                backgroundColor: status === 'completed' ? '#059669' : 'var(--accent-main, #2563eb)',
                color: '#ffffff',
                fontSize: '0.8rem',
                fontWeight: 700,
              }}
            >
              {index + 1}
            </span>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--text-secondary)',
              }}
            >
              {record.authority.name}
            </span>
          </div>

          <h4 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            {record.name}
          </h4>

          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            <strong>Statutory Basis:</strong> {record.statutoryBasis}
          </div>
        </div>

        {/* Status Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label htmlFor={`status-select-${record.id}`} style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Status:
          </label>
          <select
            id={`status-select-${record.id}`}
            value={status}
            onChange={(e) => handleStatusChange(e.target.value)}
            style={{
              padding: '0.4rem 0.75rem',
              borderRadius: '0.375rem',
              border: `1.5px solid ${getStatusColor(status)}`,
              backgroundColor: 'var(--bg-main)',
              color: getStatusColor(status),
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            {CHECKLIST_STATUSES.map((st) => (
              <option key={st} value={st}>
                {CHECKLIST_STATUS_LABELS[st]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Prerequisite Blocker Notice */}
      {isBlocked && status === 'not_started' && (
        <div
          role="alert"
          style={{
            backgroundColor: 'rgba(245, 158, 11, 0.12)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: '0.375rem',
            padding: '0.65rem 0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.85rem',
            color: 'var(--warning, #f59e0b)',
            marginBottom: '0.75rem',
          }}
        >
          <AlertTriangle size={16} color="#d97706" style={{ flexShrink: 0 }} />
          <span>
            <strong>Prerequisite Sequence:</strong> We recommend completing{' '}
            <em>{missingPrereqNames.join(', ') || 'prior prerequisite'}</em> first to obtain valid proof of address before submitting this application.
          </span>
        </div>
      )}

      {/* Meta Pills: Fee, Estimated Days, Form Number */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <Clock size={14} /> {record.estimatedProcessingDays}
        </div>
        <div>
          <strong>Official Fee:</strong> {record.officialFee}
        </div>
        <div>
          <strong>Form:</strong> {record.formNumber}
        </div>
      </div>

      {/* Editorial Guidance Snippet */}
      <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: 1.45, marginBottom: '0.75rem' }}>
        {record.editorialNotes}
      </p>

      {/* Action Buttons Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
          borderTop: '1px solid var(--border-light, #f3f4f6)',
          paddingTop: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={() => onOpenDetails(record)}
            className="btn btn-secondary"
            style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <Info size={14} /> Official Instructions & Proofs
          </button>

          <a
            href={record.authority.portalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
            style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem', display: 'flex', alignItems: 'center', gap: '0.35rem', textDecoration: 'none' }}
          >
            <ExternalLink size={14} /> Official Portal
          </a>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--accent-main, #2563eb)',
            fontSize: '0.8rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            cursor: 'pointer',
            padding: '0.25rem',
          }}
        >
          {isExpanded ? (
            <>
              Hide Local Tracker <ChevronUp size={16} />
            </>
          ) : (
            <>
              Track URN & Documents ({completedProofs.length}/{record.acceptedProofs.length}) <ChevronDown size={16} />
            </>
          )}
        </button>
      </div>

      {/* Collapsible Citizen Tracking Form (Strictly Local) */}
      {isExpanded && (
        <div
          style={{
            marginTop: '1rem',
            padding: '1rem',
            backgroundColor: 'var(--bg-main)',
            borderRadius: '0.5rem',
            border: '1px solid var(--border-main)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem' }}>
            <ShieldCheck size={16} color="#059669" />
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#10b981' }}>
              Citizen Privacy Guardrail: Stored only locally on your device. Never transmitted or uploaded.
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div>
              <label
                htmlFor={`ack-${record.id}`}
                style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.2rem' }}
              >
                Acknowledgement / URN Reference ID:
              </label>
              <input
                id={`ack-${record.id}`}
                type="text"
                placeholder="e.g. URN-1029384756 or Ref No."
                value={ackRef}
                onChange={(e) => handleAckChange(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.4rem 0.6rem',
                  fontSize: '0.85rem',
                  borderRadius: '0.375rem',
                  border: '1px solid var(--border-main)',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>

            <div>
              <label
                htmlFor={`subdate-${record.id}`}
                style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.2rem' }}
              >
                Submission Date:
              </label>
              <input
                id={`subdate-${record.id}`}
                type="date"
                value={subDate}
                onChange={(e) => handleDateChange(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.4rem 0.6rem',
                  fontSize: '0.85rem',
                  borderRadius: '0.375rem',
                  border: '1px solid var(--border-main)',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
          </div>

          {/* Evidence Checklist */}
          <div style={{ marginBottom: '0.75rem' }}>
            <span style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
              Check off accepted proofs gathered:
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {record.acceptedProofs.map((proof) => {
                const checked = completedProofs.includes(proof.name);
                return (
                  <label
                    key={proof.name}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontSize: '0.8rem',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleProof(proof.name)}
                    />
                    <span>{proof.name} ({proof.issuingAuthority})</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Personal Notes */}
          <div>
            <label
              htmlFor={`notes-${record.id}`}
              style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.2rem' }}
            >
              Personal Tracking Notes:
            </label>
            <textarea
              id={`notes-${record.id}`}
              rows={2}
              placeholder="e.g., Visited ASK on Monday; BLO inspection scheduled next week."
              value={notes}
              onChange={(e) => handleNotesChange(e.target.value)}
              style={{
                width: '100%',
                padding: '0.4rem 0.6rem',
                fontSize: '0.85rem',
                borderRadius: '0.375rem',
                border: '1px solid var(--border-main)',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                resize: 'vertical',
              }}
            />
          </div>

          {/* Report Gazette update link */}
          <div style={{ textAlign: 'right', marginTop: '0.5rem' }}>
            <button
              type="button"
              onClick={() => onOpenCorrection(record)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                fontSize: '0.75rem',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Report a broken portal link or state rule change
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

