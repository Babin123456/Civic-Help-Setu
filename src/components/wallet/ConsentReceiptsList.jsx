import { useState } from 'react';
import {
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { CONSENT_STATUSES } from '../../data/walletContracts';

export default function ConsentReceiptsList({
  receipts = [],
  onRevoke
}) {
  const [expandedId, setExpandedId] = useState(null);
  const [revokingId, setRevokingId] = useState(null);
  const [revokeReason, setRevokeReason] = useState('Withdrawn by citizen');

  const toggleExpand = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const handleRevokeSubmit = (receiptId) => {
    onRevoke(receiptId, revokeReason);
    setRevokingId(null);
    setRevokeReason('Withdrawn by citizen');
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case CONSENT_STATUSES.ACTIVE:
        return (
          <span
            style={{
              background: 'rgba(34, 197, 94, 0.15)',
              color: 'var(--success-color, #16a34a)',
              padding: '0.2rem 0.5rem',
              borderRadius: '999px',
              fontSize: '0.75rem',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem'
            }}
          >
            <CheckCircle2 size={12} /> Active
          </span>
        );
      case CONSENT_STATUSES.REVOKED:
        return (
          <span
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              color: 'var(--danger-color, #dc2626)',
              padding: '0.2rem 0.5rem',
              borderRadius: '999px',
              fontSize: '0.75rem',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem'
            }}
          >
            <XCircle size={12} /> Revoked
          </span>
        );
      case CONSENT_STATUSES.EXPIRED:
      default:
        return (
          <span
            style={{
              background: 'rgba(100, 116, 139, 0.15)',
              color: '#64748b',
              padding: '0.2rem 0.5rem',
              borderRadius: '999px',
              fontSize: '0.75rem',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem'
            }}
          >
            <Clock size={12} /> Expired
          </span>
        );
    }
  };

  if (receipts.length === 0) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: '3rem 1.5rem',
          background: 'var(--bg-secondary, #f8fafc)',
          borderRadius: '0.75rem',
          border: '1px dashed var(--border-light, #e2e8f0)',
          color: 'var(--text-secondary)'
        }}
      >
        <FileText size={36} style={{ opacity: 0.5, marginBottom: '0.75rem' }} />
        <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem', color: 'var(--text-primary)' }}>
          No Consent Receipts Issued Yet
        </h3>
        <p style={{ margin: 0, fontSize: '0.85rem', maxWidth: '420px', marginLeft: 'auto', marginRight: 'auto' }}>
          When you selectively disclose attributes to a civic service, an immutable, auditable Consent Receipt under the DPDP Act will appear here.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div
        role="note"
        style={{
          padding: '0.75rem 1rem',
          borderRadius: '0.5rem',
          background: 'rgba(59, 130, 246, 0.08)',
          border: '1px solid rgba(59, 130, 246, 0.25)',
          fontSize: '0.82rem',
          color: 'var(--text-secondary)'
        }}
      >
        <strong>Digital Personal Data Protection (DPDP) Act, 2023 Notice:</strong> You retain complete ownership over your civic attributes.
        Revoking consent immediately flags your presentation in the revocation registry and disallows any downstream processing by the relying party.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {receipts.map((receipt) => {
          const isExpanded = expandedId === receipt.receiptId;
          const isRevoking = revokingId === receipt.receiptId;
          const rpName = typeof receipt.relyingParty === 'object' ? receipt.relyingParty.name || receipt.relyingParty.serviceId : receipt.relyingParty;

          return (
            <div
              key={receipt.receiptId}
              style={{
                border: '1px solid var(--border-light, #e2e8f0)',
                borderRadius: '0.75rem',
                padding: '1rem',
                background: 'var(--bg-card, #ffffff)',
                boxShadow: '0 1px 4px rgba(0,0,0,0.03)'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '0.5rem',
                  flexWrap: 'wrap'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 600 }}>{rpName}</h4>
                    {getStatusBadge(receipt.status)}
                  </div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    Issued: {new Date(receipt.timestamp).toLocaleString()} • Expires: {new Date(receipt.validUntil).toLocaleString()}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {receipt.status === CONSENT_STATUSES.ACTIVE && (
                    <button
                      type="button"
                      onClick={() => setRevokingId(receipt.receiptId)}
                      className="btn btn-sm btn-outline-danger"
                      style={{ fontSize: '0.78rem', padding: '0.25rem 0.6rem' }}
                    >
                      Revoke Consent
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => toggleExpand(receipt.receiptId)}
                    className="btn btn-sm btn-ghost"
                    style={{ padding: '0.25rem', fontSize: '0.75rem' }}
                    aria-label={isExpanded ? 'Collapse receipt details' : 'Expand receipt details'}
                  >
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>
              </div>

              {isRevoking && (
                <div
                  style={{
                    marginTop: '0.75rem',
                    padding: '0.75rem',
                    background: 'rgba(239, 68, 68, 0.06)',
                    borderRadius: '0.5rem',
                    border: '1px solid rgba(239, 68, 68, 0.2)'
                  }}
                >
                  <label htmlFor={`revoke-reason-${receipt.receiptId}`} style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                    Revocation Reason / Justification:
                  </label>
                  <input
                    id={`revoke-reason-${receipt.receiptId}`}
                    type="text"
                    value={revokeReason}
                    onChange={(e) => setRevokeReason(e.target.value)}
                    className="form-control"
                    style={{ width: '100%', fontSize: '0.85rem', marginBottom: '0.5rem' }}
                  />
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={() => setRevokingId(null)}
                      className="btn btn-sm btn-secondary"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRevokeSubmit(receipt.receiptId)}
                      className="btn btn-sm btn-danger"
                    >
                      Confirm Revocation
                    </button>
                  </div>
                </div>
              )}

              {isExpanded && (
                <div
                  style={{
                    marginTop: '0.75rem',
                    paddingTop: '0.75rem',
                    borderTop: '1px solid var(--border-light, #e2e8f0)',
                    fontSize: '0.82rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.4rem'
                  }}
                >
                  <div>
                    <strong>Purpose:</strong> {receipt.purpose}
                  </div>
                  <div>
                    <strong>Linked Presentation ID:</strong> <code>{receipt.presentationId}</code>
                  </div>
                  <div>
                    <strong>Disclosed Attributes:</strong>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.2rem' }}>
                      {receipt.disclosedAttributes.map((attr) => (
                        <span
                          key={attr}
                          style={{
                            background: 'var(--bg-secondary, #f1f5f9)',
                            padding: '0.15rem 0.45rem',
                            borderRadius: '0.25rem',
                            fontSize: '0.76rem'
                          }}
                        >
                          {attr}
                        </span>
                      ))}
                    </div>
                  </div>
                  {receipt.revokedAt && (
                    <div style={{ color: 'var(--danger-color, #dc2626)' }}>
                      <strong>Revoked At:</strong> {new Date(receipt.revokedAt).toLocaleString()} ({receipt.revocationReason})
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
