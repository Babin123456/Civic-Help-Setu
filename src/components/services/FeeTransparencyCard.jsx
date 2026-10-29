import { useState, useEffect } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  Info,
  ExternalLink,
  CheckCircle,
  HelpCircle,
  CreditCard,
  Building,
  RefreshCw,
  FileText,
} from 'lucide-react';
import {
  getServiceFeeBreakdown,
  calculateTotalExpenditure,
  formatCurrency,
  loadFeePreferences,
  saveFeePreferences,
} from '../../services/feeTransparencyService';
import { safeHttpUrl } from '../../utils/safeContent';

/**
 * FeeTransparencyCard (#145)
 *
 * Displays a structured, transparent breakdown of official statutory charges,
 * optional third-party facilitation fees, accepted payment channels,
 * and gazetted references. Distinctly separates mandatory government fees
 * from optional service provider costs and strictly disclaims fee collection.
 */
const FeeTransparencyCard = ({ serviceId, serviceName }) => {
  const feeBreakdown = getServiceFeeBreakdown(serviceId);

  // Initialize selected tier and selected optional charges
  const [selectedTierId, setSelectedTierId] = useState(() => {
    const saved = loadFeePreferences(serviceId);
    if (saved?.selectedTierId) return saved.selectedTierId;
    return feeBreakdown.conditionalTiers?.[0]?.id || null;
  });

  const [selectedOptionalIds, setSelectedOptionalIds] = useState(() => {
    const saved = loadFeePreferences(serviceId);
    if (Array.isArray(saved?.selectedOptionalIds)) return saved.selectedOptionalIds;
    return [];
  });

  // Keep state in sync if serviceId changes
  useEffect(() => {
    const saved = loadFeePreferences(serviceId);
    setSelectedTierId(saved?.selectedTierId || feeBreakdown.conditionalTiers?.[0]?.id || null);
    setSelectedOptionalIds(saved?.selectedOptionalIds || []);
  }, [serviceId, feeBreakdown.conditionalTiers]);

  const handleTierSelect = (tierId) => {
    setSelectedTierId(tierId);
    saveFeePreferences(serviceId, {
      selectedTierId: tierId,
      selectedOptionalIds,
    });
  };

  const handleOptionalToggle = (chargeId) => {
    setSelectedOptionalIds((prev) => {
      const next = prev.includes(chargeId)
        ? prev.filter((id) => id !== chargeId)
        : [...prev, chargeId];
      saveFeePreferences(serviceId, {
        selectedTierId,
        selectedOptionalIds: next,
      });
      return next;
    });
  };

  const totals = calculateTotalExpenditure(feeBreakdown, selectedTierId, selectedOptionalIds);

  return (
    <div
      className="fee-transparency-card"
      style={{
        marginTop: '2rem',
        padding: '1.5rem',
        borderRadius: '1rem',
        background: 'var(--bg-card, rgba(255, 255, 255, 0.03))',
        border: '1px solid var(--border-light, rgba(255, 255, 255, 0.08))',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
      }}
      aria-labelledby="fee-transparency-heading"
    >
      {/* 1. Header & Status Badges */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <Building size={20} color="var(--accent-main, #38bdf8)" />
            <h3
              id="fee-transparency-heading"
              style={{ fontSize: '1.25rem', fontWeight: '700', margin: 0 }}
            >
              Fee & Cost Transparency Breakdown
            </h3>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary, #94a3b8)', margin: 0 }}>
            Published statutory rates, optional facilitation caps, and payment channels
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {feeBreakdown.isFreeService && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.25rem 0.75rem',
                background: 'rgba(34, 197, 94, 0.15)',
                color: '#22c55e',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                borderRadius: '99px',
                fontSize: '0.8rem',
                fontWeight: '600',
              }}
            >
              <CheckCircle size={14} /> 100% Free Public Service
            </span>
          )}

          {feeBreakdown.isVerified && !feeBreakdown.isExpired && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.25rem 0.75rem',
                background: 'rgba(56, 189, 248, 0.15)',
                color: 'var(--accent-main, #38bdf8)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                borderRadius: '99px',
                fontSize: '0.8rem',
                fontWeight: '600',
              }}
            >
              <FileText size={14} /> Gazette Verified
            </span>
          )}

          {feeBreakdown.isExpired && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.25rem 0.75rem',
                background: 'rgba(245, 158, 11, 0.15)',
                color: '#f59e0b',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: '99px',
                fontSize: '0.8rem',
                fontWeight: '600',
              }}
            >
              <AlertTriangle size={14} /> Review Warning
            </span>
          )}

          {!feeBreakdown.isVerified && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.25rem 0.75rem',
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#ef4444',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '99px',
                fontSize: '0.8rem',
                fontWeight: '600',
              }}
            >
              <HelpCircle size={14} /> Fee Unverified
            </span>
          )}
        </div>
      </div>

      {/* 2. Mandatory Non-Collection Legal Disclaimer Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.75rem',
          padding: '0.85rem 1rem',
          background: 'rgba(56, 189, 248, 0.08)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          borderRadius: '0.75rem',
          marginBottom: '1.25rem',
          fontSize: '0.85rem',
          lineHeight: '1.5',
          color: 'var(--text-primary, #f8fafc)',
        }}
        role="note"
        aria-label="Non-collection disclaimer"
      >
        <ShieldCheck size={20} color="var(--accent-main, #38bdf8)" style={{ flexShrink: 0, marginTop: '2px' }} />
        <div>
          <strong>Civic Help Setu Does Not Collect Any Fees.</strong>
          <span style={{ color: 'var(--text-secondary, #94a3b8)', display: 'block', marginTop: '2px' }}>
            We provide verified informational guidance only. All statutory payments must be made directly on official government web portals or authorized treasury counters. Never pay money to unauthorized agents or informal solicitations.
          </span>
        </div>
      </div>

      {/* 3. Review Warning Banner if Expired */}
      {feeBreakdown.isExpired && feeBreakdown.reviewWarning && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem',
            padding: '0.85rem 1rem',
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: '0.75rem',
            marginBottom: '1.25rem',
            fontSize: '0.85rem',
            lineHeight: '1.5',
            color: '#fbbf24',
          }}
          role="alert"
        >
          <AlertTriangle size={20} color="#f59e0b" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong>Published Schedule Due for Review:</strong>
            <p style={{ margin: '2px 0 0', color: 'var(--text-secondary, #cbd5e1)' }}>
              {feeBreakdown.reviewWarning}
            </p>
          </div>
        </div>
      )}

      {/* 4. Unverified Fee Safe Fallback */}
      {!feeBreakdown.isVerified && (
        <div
          style={{
            padding: '1.25rem',
            background: 'rgba(255, 255, 255, 0.02)',
            borderRadius: '0.75rem',
            border: '1px dashed var(--border-light, rgba(255, 255, 255, 0.15))',
            textAlign: 'center',
          }}
        >
          <HelpCircle size={32} color="#94a3b8" style={{ margin: '0 auto 0.5rem' }} />
          <h4 style={{ margin: '0 0 0.5rem', fontSize: '1rem', color: 'var(--text-primary)' }}>
            Official Statutory Fee Not Verified
          </h4>
          <p
            style={{
              margin: '0 auto 1rem',
              maxWidth: '540px',
              fontSize: '0.875rem',
              color: 'var(--text-secondary, #94a3b8)',
              lineHeight: '1.6',
            }}
          >
            A gazetted or centralized fee schedule is not verified on record for &ldquo;{serviceName || feeBreakdown.serviceName}&rdquo;. Fees may be set locally by individual municipal wards or state departments. Civic Help Setu will never estimate or guess fee figures without confirmed official sources.
          </p>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.8rem',
              color: '#f59e0b',
              background: 'rgba(245, 158, 11, 0.1)',
              padding: '0.4rem 0.8rem',
              borderRadius: '99px',
            }}
          >
            <Info size={14} /> Tip: Confirm statutory fees with the official department counter before payment.
          </div>
        </div>
      )}

      {/* 5. Verified Fee Content */}
      {feeBreakdown.isVerified && (
        <div>
          {/* Conditional Tier Selector if available */}
          {feeBreakdown.hasConditionalTiers && (
            <div style={{ marginBottom: '1.5rem' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  marginBottom: '0.5rem',
                  color: 'var(--text-primary)',
                }}
              >
                Select Applicable Category / Tier:
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem' }}>
                {feeBreakdown.conditionalTiers.map((tier) => {
                  const isSelected = tier.id === selectedTierId;
                  return (
                    <button
                      key={tier.id}
                      type="button"
                      onClick={() => handleTierSelect(tier.id)}
                      style={{
                        padding: '0.85rem 1rem',
                        textAlign: 'left',
                        background: isSelected ? 'rgba(56, 189, 248, 0.12)' : 'var(--bg-main, rgba(255, 255, 255, 0.02))',
                        border: isSelected
                          ? '2px solid var(--accent-main, #38bdf8)'
                          : '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
                        borderRadius: '0.75rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                      aria-pressed={isSelected}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                        <span style={{ fontWeight: '700', fontSize: '0.95rem', color: isSelected ? 'var(--accent-main, #38bdf8)' : 'var(--text-primary)' }}>
                          {tier.label}
                        </span>
                        <span style={{ fontWeight: '800', fontSize: '1rem', color: tier.amount === 0 ? '#22c55e' : 'var(--text-primary)' }}>
                          {formatCurrency(tier.amount, tier.currency)}
                        </span>
                      </div>
                      <p style={{ margin: '0 0 0.25rem', fontSize: '0.8rem', color: 'var(--text-secondary, #94a3b8)', lineHeight: '1.4' }}>
                        {tier.applicability}
                      </p>
                      {tier.processingTime && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary, #64748b)' }}>
                          ⏱ Turnaround: {tier.processingTime}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section: Official Statutory Fees */}
          <div
            style={{
              padding: '1rem',
              background: 'rgba(56, 189, 248, 0.04)',
              border: '1px solid rgba(56, 189, 248, 0.2)',
              borderRadius: '0.75rem',
              marginBottom: '1.25rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span
                  style={{
                    padding: '0.2rem 0.5rem',
                    background: 'rgba(56, 189, 248, 0.2)',
                    color: 'var(--accent-main, #38bdf8)',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  Official Government Charge
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary, #94a3b8)' }}>
                  (Statutory / Mandatory)
                </span>
              </div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary, #94a3b8)' }}>
                Effective: {feeBreakdown.effectiveDate || 'Verified'}
              </span>
            </div>

            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {totals.appliedOfficialItems.map((item) => (
                <li
                  key={item.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.5rem 0',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                  }}
                >
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                    {item.label}
                  </span>
                  <span style={{ fontSize: '1rem', fontWeight: '700', color: item.amount === 0 ? '#22c55e' : 'var(--text-primary)' }}>
                    {formatCurrency(item.amount, totals.currency)}
                  </span>
                </li>
              ))}
            </ul>

            {/* Official Source Link */}
            {feeBreakdown.officialSource && (
              <div
                style={{
                  marginTop: '0.75rem',
                  paddingTop: '0.5rem',
                  borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                  fontSize: '0.8rem',
                }}
              >
                <span style={{ color: 'var(--text-secondary, #94a3b8)' }}>
                  Official Authority: {feeBreakdown.officialSource.department ? `${feeBreakdown.officialSource.department} - ${feeBreakdown.officialSource.name}` : feeBreakdown.officialSource.name}
                </span>
                {feeBreakdown.officialSource.url && (
                  <a
                    href={safeHttpUrl(feeBreakdown.officialSource.url) || undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      color: 'var(--accent-main, #38bdf8)',
                      textDecoration: 'none',
                      fontWeight: '500',
                    }}
                  >
                    View Official Gazette Fee Table <ExternalLink size={12} />
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Section: Optional Facilitation & Kiosk Charges */}
          {feeBreakdown.hasOptionalCharges && (
            <div
              style={{
                padding: '1rem',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
                borderRadius: '0.75rem',
                marginBottom: '1.25rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span
                    style={{
                      padding: '0.2rem 0.5rem',
                      background: 'rgba(245, 158, 11, 0.15)',
                      color: '#fbbf24',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: '700',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    Optional Third-Party Charges
                  </span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #94a3b8)' }}>
                    (CSC Kiosks / Convenience Services)
                  </span>
                </div>
              </div>

              <p style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary, #94a3b8)', lineHeight: '1.4' }}>
                These charges are completely voluntary. You do NOT need to pay them if applying directly through the official government portal. If visiting a CSC or kiosk, operators cannot exceed the authorized cap.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {feeBreakdown.optionalProviderCharges.map((charge) => {
                  const isChecked = selectedOptionalIds.includes(charge.id);
                  return (
                    <label
                      key={charge.id}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.75rem',
                        padding: '0.65rem 0.85rem',
                        background: isChecked ? 'rgba(245, 158, 11, 0.06)' : 'rgba(255, 255, 255, 0.01)',
                        border: isChecked ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(255, 255, 255, 0.05)',
                        borderRadius: '0.5rem',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleOptionalToggle(charge.id)}
                        style={{ marginTop: '0.25rem' }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                            {charge.label}
                          </span>
                          <span style={{ fontSize: '0.9rem', fontWeight: '700', color: '#fbbf24' }}>
                            +{formatCurrency(charge.amount, charge.currency)}
                          </span>
                        </div>
                        <p style={{ margin: '0.2rem 0', fontSize: '0.775rem', color: 'var(--text-secondary, #94a3b8)' }}>
                          {charge.applicability} (Provider: {charge.provider})
                        </p>
                        {charge.maxPermissibleCap && (
                          <span style={{ fontSize: '0.725rem', color: '#22c55e' }}>
                            ✓ Max Authorized Cap: {formatCurrency(charge.maxPermissibleCap, charge.currency)}
                          </span>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section: Grand Total Calculator Summary */}
          <div
            style={{
              padding: '1rem',
              background: 'rgba(0, 0, 0, 0.25)',
              border: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
              borderRadius: '0.75rem',
              marginBottom: '1.25rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary, #94a3b8)' }}>
                Official Statutory Total:
              </span>
              <span style={{ fontSize: '0.95rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                {formatCurrency(totals.officialTotal, totals.currency)}
              </span>
            </div>

            {feeBreakdown.hasOptionalCharges && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary, #94a3b8)' }}>
                  Selected Optional Charges:
                </span>
                <span style={{ fontSize: '0.95rem', fontWeight: '600', color: '#fbbf24' }}>
                  {formatCurrency(totals.optionalTotal, totals.currency)}
                </span>
              </div>
            )}

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: '0.5rem',
                borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              }}
            >
              <span style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                Estimated Total Expenditure:
              </span>
              <span
                style={{
                  fontSize: '1.35rem',
                  fontWeight: '800',
                  color: totals.grandTotal === 0 ? '#22c55e' : 'var(--accent-main, #38bdf8)',
                }}
              >
                {formatCurrency(totals.grandTotal, totals.currency)}
              </span>
            </div>
          </div>

          {/* Section: Accepted Payment Methods */}
          {feeBreakdown.acceptedPaymentMethods && feeBreakdown.acceptedPaymentMethods.length > 0 && (
            <div style={{ marginBottom: '1.25rem' }}>
              <h5
                style={{
                  fontSize: '0.85rem',
                  fontWeight: '700',
                  margin: '0 0 0.5rem',
                  color: 'var(--text-secondary, #94a3b8)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <CreditCard size={15} /> Authorized Payment Channels
              </h5>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.5rem' }}>
                {feeBreakdown.acceptedPaymentMethods.map((m, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '0.65rem 0.85rem',
                      background: 'rgba(255, 255, 255, 0.02)',
                      borderRadius: '0.5rem',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                      fontSize: '0.8rem',
                    }}
                  >
                    <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{m.method}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary, #94a3b8)', marginTop: '2px' }}>
                      {m.notes}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section: Official Refund Policy Notes */}
          {feeBreakdown.refundPolicyNotes && (
            <div
              style={{
                fontSize: '0.8rem',
                color: 'var(--text-secondary, #94a3b8)',
                borderLeft: '2px solid rgba(255, 255, 255, 0.2)',
                paddingLeft: '0.75rem',
                margin: '0.75rem 0 1rem',
              }}
            >
              <strong>Official Refund Policy:</strong> {feeBreakdown.refundPolicyNotes}
            </div>
          )}
        </div>
      )}

      {/* Footer: Anti-Corruption / Grievance Helpline */}
      <div
        style={{
          marginTop: '1rem',
          paddingTop: '0.75rem',
          borderTop: '1px solid var(--border-light, rgba(255, 255, 255, 0.08))',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.5rem',
          fontSize: '0.775rem',
          color: 'var(--text-tertiary, #94a3b8)',
        }}
      >
        <span>
          Demanded unauthorized or excess fees? Report directly to Anti-Corruption Helpline (1064) or Vigilance Bureau.
        </span>
        <a
          href="https://pgportal.gov.in"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: 'var(--accent-main, #38bdf8)',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem',
          }}
        >
          CPGRAMS Portal <ExternalLink size={12} />
        </a>
      </div>
    </div>
  );
};

export default FeeTransparencyCard;
