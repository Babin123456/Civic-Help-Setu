import { useEffect, useRef } from 'react';
import { X, Printer } from 'lucide-react';
import { MOVE_TYPE_LABELS } from '../../data/addressChangeContract';
import { CHECKLIST_STATUS_LABELS } from '../../services/addressChangeStorage';

export default function AddressChangePrintReportModal({
  records,
  planState,
  readiness,
  onClose,
}) {
  const modalRef = useRef(null);
  const closeButtonRef = useRef(null);

  useEffect(() => {
    closeButtonRef.current?.focus();
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="print-report-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        zIndex: 1050,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        style={{
          backgroundColor: '#ffffff',
          color: '#1f2937',
          borderRadius: '0.75rem',
          maxWidth: '800px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Printer size={20} color="#2563eb" />
            <h2 id="print-report-modal-title" style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>
              Printable Address Change Action Plan
            </h2>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={handlePrint}
              className="btn btn-primary"
              style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <Printer size={16} /> Print Document
            </button>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              style={{ fontSize: '0.85rem' }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Printable Content Body */}
        <div
          id="printable-address-report"
          style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, fontSize: '0.875rem' }}
        >
          {/* Document Header */}
          <div style={{ textAlign: 'center', borderBottom: '2px solid #2563eb', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1e3a8a', margin: '0 0 0.25rem 0' }}>
              Civic Moving-Home Address-Change Action Plan
            </h1>
            <p style={{ margin: 0, color: '#4b5563', fontSize: '0.85rem' }}>
              Generated via Civic Help Setu • Scope: <strong>{MOVE_TYPE_LABELS[planState.moveType]}</strong>
              {planState.originState && planState.destinationState && (
                <span> ({planState.originState} → {planState.destinationState})</span>
              )}
            </p>
          </div>

          {/* Privacy & Non-transactional Notice */}
          <div
            style={{
              backgroundColor: '#f3f4f6',
              border: '1px solid #d1d5db',
              borderRadius: '0.375rem',
              padding: '0.75rem',
              fontSize: '0.75rem',
              color: '#374151',
              marginBottom: '1.25rem',
              lineHeight: 1.4,
            }}
          >
            <strong>Citizen Privacy &amp; Security Notice:</strong> This offline checklist coordinates independent address updates across government authorities. Civic Help Setu does not collect passwords, biometric authentication, or credentials. All URN reference numbers are recorded for personal tracking only.
          </div>

          {/* Summary Stats */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '0.5rem',
              marginBottom: '1.5rem',
              textAlign: 'center',
            }}
          >
            <div style={{ padding: '0.5rem', backgroundColor: '#eff6ff', borderRadius: '0.375rem' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1d4ed8' }}>{readiness.percentage}%</div>
              <div style={{ fontSize: '0.75rem', color: '#4b5563' }}>Readiness Score</div>
            </div>
            <div style={{ padding: '0.5rem', backgroundColor: '#f0fdf4', borderRadius: '0.375rem' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#15803d' }}>{readiness.completed}</div>
              <div style={{ fontSize: '0.75rem', color: '#4b5563' }}>Completed</div>
            </div>
            <div style={{ padding: '0.5rem', backgroundColor: '#eff6ff', borderRadius: '0.375rem' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#2563eb' }}>{readiness.submitted}</div>
              <div style={{ fontSize: '0.75rem', color: '#4b5563' }}>Submitted (URN)</div>
            </div>
            <div style={{ padding: '0.5rem', backgroundColor: '#f9fafb', borderRadius: '0.375rem' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#4b5563' }}>{readiness.total}</div>
              <div style={{ fontSize: '0.75rem', color: '#4b5563' }}>Total Records</div>
            </div>
          </div>

          {/* Action Checklist Items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {records.map((record, idx) => {
              const item = planState.items[record.id] || {};
              const status = item.status || 'not_started';
              const completedProofs = item.completedProofs || [];

              return (
                <div
                  key={record.id}
                  style={{
                    border: '1px solid #d1d5db',
                    borderRadius: '0.5rem',
                    padding: '0.85rem',
                    pageBreakInside: 'avoid',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.35rem' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                      {idx + 1}. {record.name}
                    </div>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        padding: '0.15rem 0.5rem',
                        borderRadius: '0.25rem',
                        backgroundColor: status === 'completed' ? '#dcfce7' : '#f3f4f6',
                        color: status === 'completed' ? '#166534' : '#374151',
                      }}
                    >
                      {CHECKLIST_STATUS_LABELS[status]}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.8rem', color: '#4b5563', marginBottom: '0.4rem' }}>
                    <strong>Authority:</strong> {record.authority.name} • <strong>Form:</strong> {record.formNumber} • <strong>Fee:</strong> {record.officialFee}
                  </div>

                  {/* Tracking details if recorded */}
                  {(item.acknowledgementRef || item.submissionDate) && (
                    <div style={{ fontSize: '0.8rem', backgroundColor: '#f8fafc', padding: '0.4rem 0.6rem', borderRadius: '0.25rem', marginBottom: '0.4rem' }}>
                      {item.acknowledgementRef && <span><strong>URN / Ref:</strong> {item.acknowledgementRef} </span>}
                      {item.submissionDate && <span><strong>Date:</strong> {item.submissionDate}</span>}
                    </div>
                  )}

                  {/* Accepted Proofs Checklist */}
                  <div style={{ fontSize: '0.8rem', marginTop: '0.4rem' }}>
                    <div style={{ fontWeight: 600, color: '#374151', marginBottom: '0.2rem' }}>Proof of Address (POA) options:</div>
                    <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#4b5563' }}>
                      {record.acceptedProofs.map((p, pIdx) => (
                        <li key={pIdx}>
                          {completedProofs.includes(p.name) ? '☑ ' : '☐ '}
                          {p.name} ({p.issuingAuthority})
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

