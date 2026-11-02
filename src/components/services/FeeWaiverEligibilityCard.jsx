import { useState, useMemo } from 'react';
import {
  BadgePercent,
  ShieldCheck,
  FileText,
  AlertCircle,
  Copy,
  Check,
  Info,
  CheckCircle2,
} from 'lucide-react';
import {
  CONCESSION_CATEGORIES,
  CONCESSION_METADATA,
  evaluateFeeWaiverEligibility,
} from '../../services/feeWaiverEligibilityService.js';

/**
 * Statutory Fee Waiver & Concession Eligibility Card (#433)
 *
 * Allows citizens to check their eligibility for statutory fee exemptions (e.g.,
 * RTI Sec 7(5) BPL waiver, PwD certification waivers, Senior Citizen concessions)
 * with exact required proof documents and statutory legal citations.
 */
const FeeWaiverEligibilityCard = ({ service }) => {
  const [selectedCategory, setSelectedCategory] = useState(CONCESSION_CATEGORIES.GENERAL);
  const [copiedCitation, setCopiedCitation] = useState(false);

  const report = useMemo(() => {
    return evaluateFeeWaiverEligibility({
      service,
      category: selectedCategory,
    });
  }, [service, selectedCategory]);

  const handleCopyCitation = () => {
    const text = `Statutory Fee Waiver Claim: ${report.categoryTitle}\nApplicable Law: ${report.statutoryCitation}\nMandated Proof: ${report.requiredProof}`;
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    setCopiedCitation(true);
    setTimeout(() => setCopiedCitation(false), 2000);
  };

  return (
    <div
      className="fee-waiver-card animate-fade-in"
      style={{
        marginTop: '1.5rem',
        padding: '1.25rem',
        borderRadius: '0.75rem',
        background: 'var(--glass-bg)',
        border: '1px solid var(--border-light)',
      }}
      aria-labelledby="fee-waiver-heading"
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '0.75rem',
          flexWrap: 'wrap',
          marginBottom: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: 'rgba(34, 197, 94, 0.12)',
              border: '1px solid rgba(34, 197, 94, 0.25)',
            }}
          >
            <BadgePercent size={18} color="#22c55e" />
          </div>
          <div>
            <h3
              id="fee-waiver-heading"
              style={{
                fontSize: '1rem',
                fontWeight: '700',
                margin: 0,
                color: 'var(--text-primary)',
              }}
            >
              Statutory Fee Waiver &amp; Concession Checker
            </h3>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
              Verify legal exemptions under RTI Act, RPwD Act &amp; Citizen Charters
            </p>
          </div>
        </div>

        {report.isFullyExempt && (
          <div
            style={{
              fontSize: '0.72rem',
              fontWeight: '700',
              padding: '0.2rem 0.6rem',
              borderRadius: '9999px',
              background: 'rgba(34, 197, 94, 0.15)',
              border: '1px solid rgba(34, 197, 94, 0.35)',
              color: '#22c55e',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
            }}
          >
            <CheckCircle2 size={13} />
            <span>100% Fee Exempt</span>
          </div>
        )}
      </div>

      {/* Category Selection Pills */}
      <div style={{ marginBottom: '1.15rem' }}>
        <div
          style={{
            fontSize: '0.75rem',
            fontWeight: '600',
            color: 'var(--text-tertiary)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            marginBottom: '0.5rem',
          }}
        >
          Select Your Concession Category:
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
          {Object.entries(CONCESSION_METADATA).map(([key, meta]) => {
            const isSelected = selectedCategory === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedCategory(key)}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '9999px',
                  fontSize: '0.78rem',
                  fontWeight: isSelected ? '700' : '500',
                  background: isSelected ? 'var(--accent-main)' : 'rgba(255, 255, 255, 0.04)',
                  color: isSelected ? '#000000' : 'var(--text-secondary)',
                  border: isSelected ? '1px solid var(--accent-main)' : '1px solid var(--border-light)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease-in-out',
                }}
              >
                {meta.shortLabel}
              </button>
            );
          })}
        </div>
      </div>

      {/* Concession Pricing Card */}
      <div
        style={{
          padding: '1rem',
          borderRadius: '0.65rem',
          background: report.isFullyExempt ? 'rgba(34, 197, 94, 0.06)' : 'rgba(255, 255, 255, 0.02)',
          border: report.isFullyExempt ? '1px solid rgba(34, 197, 94, 0.25)' : '1px solid var(--border-light)',
          marginBottom: '1rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1rem',
          alignItems: 'center',
        }}
      >
        <div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: '600' }}>
            Standard Department Tariff
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-secondary)' }}>
            ₹{report.standardFee}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: '600' }}>
            Statutory Concession
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: '700', color: report.waivedAmount > 0 ? '#22c55e' : 'var(--text-tertiary)' }}>
            {report.waivedAmount > 0 ? `-₹${report.waivedAmount} (${report.waiverPercent}%)` : '₹0 (None)'}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: '600' }}>
            Net Payable Fee
          </div>
          <div
            style={{
              fontSize: '1.5rem',
              fontWeight: '800',
              color: report.netPayableFee === 0 ? '#22c55e' : 'var(--text-primary)',
            }}
          >
            {report.netPayableFee === 0 ? 'FREE / ₹0' : `₹${report.netPayableFee}`}
          </div>
        </div>
      </div>

      {/* Statutory Advice & Proof Requirements */}
      <div
        style={{
          padding: '0.85rem',
          borderRadius: '0.5rem',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid var(--border-light)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          marginBottom: '0.75rem',
        }}
      >
        <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', lineHeight: '1.5' }}>
          <strong>Legal Assessment:</strong> {report.advice}
        </div>

        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
          <strong>Required Proof Document:</strong> {report.requiredProof}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', paddingTop: '0.35rem' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
            <strong>Statutory Rule:</strong> {report.statutoryCitation}
          </div>

          {report.waiverPercent > 0 && (
            <button
              type="button"
              onClick={handleCopyCitation}
              aria-label="Copy statutory waiver citation"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                fontSize: '0.72rem',
                padding: '0.2rem 0.55rem',
                borderRadius: '4px',
                background: copiedCitation ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                border: copiedCitation ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid var(--border-light)',
                color: copiedCitation ? '#22c55e' : 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              {copiedCitation ? <Check size={12} /> : <Copy size={12} />}
              <span>{copiedCitation ? 'Copied' : 'Copy Legal Citation'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Safety Tip */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          fontSize: '0.72rem',
          color: 'var(--text-tertiary)',
        }}
      >
        <ShieldCheck size={14} color="#22c55e" />
        <span>{report.safetyTip}</span>
      </div>
    </div>
  );
};

export default FeeWaiverEligibilityCard;
