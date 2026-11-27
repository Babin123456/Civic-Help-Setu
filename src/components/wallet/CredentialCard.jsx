import { useState } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  Eye,
  EyeOff,
  Share2,
  Trash2,
  Tag
} from 'lucide-react';
import { TRUST_TIERS, TRUST_TIER_DESCRIPTIONS } from '../../data/walletContracts';

export default function CredentialCard({
  credential,
  onPresent,
  onDelete
}) {
  const [showSensitive, setShowSensitive] = useState(false);

  const isSelfAsserted = credential.trustTier === TRUST_TIERS.SELF_ASSERTED;
  const isAttested = credential.trustTier === TRUST_TIERS.CRYPTOGRAPHICALLY_ATTESTED;

  const getTierBadge = () => {
    if (isAttested) {
      return (
        <span
          className="badge"
          style={{
            background: 'rgba(34, 197, 94, 0.15)',
            color: 'var(--success-color, #16a34a)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
            fontSize: '0.75rem',
            padding: '0.2rem 0.55rem',
            borderRadius: '999px',
            fontWeight: 600
          }}
          title={TRUST_TIER_DESCRIPTIONS.CRYPTOGRAPHICALLY_ATTESTED}
        >
          <ShieldCheck size={13} aria-hidden="true" />
          Cryptographically Attested
        </span>
      );
    }
    if (credential.trustTier === TRUST_TIERS.COMMUNITY_VERIFIED) {
      return (
        <span
          className="badge"
          style={{
            background: 'rgba(59, 130, 246, 0.15)',
            color: 'var(--primary-color, #2563eb)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
            fontSize: '0.75rem',
            padding: '0.2rem 0.55rem',
            borderRadius: '999px',
            fontWeight: 600
          }}
          title={TRUST_TIER_DESCRIPTIONS.COMMUNITY_VERIFIED}
        >
          <Tag size={13} aria-hidden="true" />
          Community Verified
        </span>
      );
    }
    return (
      <span
        className="badge"
        style={{
          background: 'rgba(234, 179, 8, 0.15)',
          color: '#ca8a04',
          border: '1px solid rgba(234, 179, 8, 0.3)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.3rem',
          fontSize: '0.75rem',
          padding: '0.2rem 0.55rem',
          borderRadius: '999px',
          fontWeight: 600
        }}
        title={TRUST_TIER_DESCRIPTIONS.SELF_ASSERTED}
      >
        <AlertTriangle size={13} aria-hidden="true" />
        Self-Asserted (Citizen Declared)
      </span>
    );
  };

  return (
    <div
      className="card wallet-credential-card"
      style={{
        border: '1px solid var(--border-light, #e2e8f0)',
        borderRadius: '0.75rem',
        padding: '1.25rem',
        background: 'var(--bg-card, #ffffff)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
        <div>
          <h3 style={{ margin: '0 0 0.35rem', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {credential.title || 'Civic Credential'}
          </h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Schema: <code>{credential.schemaType}</code>
          </span>
        </div>
        <div>{getTierBadge()}</div>
      </div>

      {isSelfAsserted && (
        <div
          role="note"
          style={{
            padding: '0.6rem 0.75rem',
            borderRadius: '0.5rem',
            background: 'rgba(234, 179, 8, 0.08)',
            border: '1px solid rgba(234, 179, 8, 0.25)',
            fontSize: '0.78rem',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <AlertTriangle size={15} color="#ca8a04" style={{ flexShrink: 0 }} aria-hidden="true" />
          <span>
            <strong>Statutory Notice:</strong> Self-asserted credentials carry no official government legal guarantee.
          </span>
        </div>
      )}

      {/* Claims Breakdown */}
      <div
        style={{
          background: 'var(--bg-secondary, #f8fafc)',
          borderRadius: '0.5rem',
          padding: '0.85rem',
          border: '1px solid var(--border-light, #e2e8f0)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            Claims & Attributes ({Object.keys(credential.claims || {}).length})
          </span>
          <button
            type="button"
            onClick={() => setShowSensitive((prev) => !prev)}
            className="btn btn-sm btn-ghost"
            style={{ fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.15rem 0.4rem' }}
            aria-label={showSensitive ? 'Hide sensitive attributes' : 'Reveal sensitive attributes'}
          >
            {showSensitive ? <EyeOff size={13} /> : <Eye size={13} />}
            {showSensitive ? 'Mask Values' : 'Reveal Values'}
          </button>
        </div>

        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          {Object.entries(credential.claims || {}).map(([key, val]) => (
            <li
              key={key}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.85rem',
                borderBottom: '1px dashed var(--border-light, #e2e8f0)',
                paddingBottom: '0.2rem'
              }}
            >
              <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{key}:</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                {showSensitive ? String(val) : typeof val === 'boolean' ? String(val) : '••••••••'}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '0.5rem' }}>
        <button
          type="button"
          onClick={() => onDelete(credential.id)}
          className="btn btn-sm btn-ghost"
          style={{ color: 'var(--danger-color, #dc2626)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem' }}
        >
          <Trash2 size={14} aria-hidden="true" />
          Delete
        </button>

        <button
          type="button"
          onClick={() => onPresent(credential)}
          className="btn btn-sm btn-primary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 600 }}
        >
          <Share2 size={14} aria-hidden="true" />
          Present & Share Minimally
        </button>
      </div>
    </div>
  );
}
