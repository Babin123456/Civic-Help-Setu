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
  FileText,
  History,
  MapPin,
  Calendar,
  ChevronDown,
  ChevronUp,
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
 * FeeTransparencyCard (#145, #647)
 *
 * Displays a structured, transparent breakdown of official statutory charges,
 * portal convenience fees, authorized service-centre caps, and optional add-on costs.
 *
 * Acceptance criteria coverage (#647):
 * - Fee breakdowns show jurisdiction, effective date, source, and verification date.
 * - Disputed/unknown charges are not presented as official.
 * - Historical fee versions remain auditable via an expandable audit trail.
 * - Distinctly separates government statutory fees from portal and service-centre charges.
 */
const FeeTransparencyCard = ({ serviceId, serviceName }) => {
  const feeBreakdown = getServiceFeeBreakdown(serviceId);
  const [showVersionHistory, setShowVersionHistory] = useState(false);

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

  const jurisdictionLabel =
    feeBreakdown.jurisdiction?.state ||
    (feeBreakdown.jurisdiction?.level === 'national'
      ? 'National (All States & UTs)'
      : feeBreakdown.jurisdiction?.authority || 'Central / State Jurisdiction');

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
              Fee &amp; Cost Transparency Breakdown
            </h3>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary, #94a3b8)', margin: 0 }}>
            Published statutory rates, portal fees, authorized service-centre caps, and verified audit history
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

      {/* 2. Official Metadata Ribbon (#647: Jurisdiction, Effective Date, Verification Date, Version Audit) */}
      {feeBreakdown.isVerified && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.65rem 0.85rem',
            background: 'rgba(255, 255, 255, 0.02)',
            borderRadius: '0.5rem',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            marginBottom: '1rem',
            fontSize: '0.8rem',
            color: 'var(--text-secondary, #94a3b8)',
          }}
        >
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            <MapPin size={13} color="var(--accent-main, #38bdf8)" />
            <span><strong>Jurisdiction:</strong> {jurisdictionLabel}</span>
          </div>

          <span style={{ opacity: 0.3 }}>|</span>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            <Calendar size={13} color="#22c55e" />
            <span><strong>Effective:</strong> {feeBreakdown.effectiveDate || 'Gazetted'}</span>
          </div>

          <span style={{ opacity: 0.3 }}>|</span>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            <CheckCircle size={13} color="#38bdf8" />
            <span><strong>Verified:</strong> {feeBreakdown.verificationDate || feeBreakdown.lastReviewedDate || 'Current'}</span>
          </div>

          {feeBreakdown.versionHistory && feeBreakdown.versionHistory.length > 0 && (
            <>
              <span style={{ opacity: 0.3 }}>|</span>
              <button
                type="button"
                onClick={() => setShowVersionHistory(!showVersionHistory)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  background: showVersionHistory ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                  color: 'var(--accent-main, #38bdf8)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                }}
                aria-expanded={showVersionHistory}
              >
                <History size={12} />
                <span>v{feeBreakdown.version || 1} Audit History</span>
                {showVersionHistory ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
            </>
          )}
        </div>
      )}

      {/* 2b. Expandable Version History Drawer (#647: Historical fee versions remain auditable) */}
      {showVersionHistory && feeBreakdown.versionHistory && (
        <div
          style={{
            padding: '1rem',
            background: 'rgba(0, 0, 0, 0.3)',
            borderRadius: '0.5rem',
            border: '1px solid rgba(56, 189, 248, 0.2)',
            marginBottom: '1rem',
            fontSize: '0.8rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem', color: 'var(--accent-main, #38bdf8)', fontWeight: '700' }}>
            <History size={14} /> Historical Fee Audit Log
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {feeBreakdown.versionHistory.map((v) => (
              <div
                key={v.version}
                style={{
                  padding: '0.5rem 0.75rem',
                  background: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: '0.35rem',
                  borderLeft: '3px solid var(--accent-main, #38bdf8)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>Version {v.version}</span>
                  <span style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: '0.75rem' }}>
                    Effective: {v.effectiveDate} | Verified: {v.verificationDate || '—'}
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)', marginTop: '2px' }}>
                  <strong>Source:</strong> {v.source || 'Official Gazette'}
                </div>
                {v.feeChanges && (
                  <div style={{ fontSize: '0.75rem', color: '#22c55e', marginTop: '2px' }}>
                    <strong>Changes:</strong> {v.feeChanges}
                  </div>
                )}
                {v.notes && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)', marginTop: '2px' }}>
                    <em>{v.notes}</em>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Mandatory Non-Collection Legal Disclaimer Banner */}
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

      {/* 3b. Disputed Charges Protection Notice (#647: Disputed/unknown charges not presented as official) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          padding: '0.6rem 0.85rem',
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          borderRadius: '0.5rem',
          marginBottom: '1.25rem',
          fontSize: '0.8rem',
          color: '#f87171',
        }}
      >
        <AlertTriangle size={16} color="#ef4444" style={{ flexShrink: 0 }} />
        <span>
          <strong>Official Fee Protection:</strong> Disputed, unknown, or informal tout charges are never recognized as official statutory fees. Always insist on an official system-generated receipt.
        </span>
      </div>

      {/* 4. Review Warning Banner if Expired */}
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

      {/* 5. Unverified Fee Safe Fallback */}
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

      {/* 6. Active Verified Fee Breakdown & Calculator */}
      {feeBreakdown.isVerified && (
        <div>
          {/* Conditional Tier Selection */}
          {feeBreakdown.hasConditionalTiers && (
            <div style={{ marginBottom: '1.5rem' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.85rem',
                  fontWeight: '700',
                  color: 'var(--text-secondary, #94a3b8)',
                  marginBottom: '0.5rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                Select Applicable Service Tier:
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {feeBreakdown.conditionalTiers.map((tier) => {
                  const isSelected = (selectedTierId || feeBreakdown.conditionalTiers[0].id) === tier.id;
                  return (
                    <div
                      key={tier.id}
                      onClick={() => handleTierSelect(tier.id)}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.75rem 1rem',
                        borderRadius: '0.5rem',
                        border: isSelected
                          ? '2px solid var(--accent-main, #38bdf8)'
                          : '1px solid var(--border-light, rgba(255, 255, 255, 0.08))',
                        background: isSelected
                          ? 'rgba(56, 189, 248, 0.08)'
                          : 'rgba(255, 255, 255, 0.02)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div
                          style={{
                            width: '16px',
                            height: '16px',
                            borderRadius: '50%',
                            border: isSelected ? '5px solid var(--accent-main, #38bdf8)' : '2px solid #64748b',
                            background: 'transparent',
                          }}
                        />
                        <div>
                          <div style={{ fontWeight: '600', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                            {tier.label}
                          </div>
                          <div style={{ fontSize: '0.775rem', color: 'var(--text-secondary, #94a3b8)' }}>
                            {tier.applicability} {tier.processingTime ? `• Processing: ${tier.processingTime}` : ''}
                          </div>
                        </div>
                      </div>
                      <div
                        style={{
                          fontWeight: '700',
                          fontSize: '1rem',
                          color: tier.amount === 0 ? '#22c55e' : 'var(--text-primary)',
                        }}
                      >
                        {formatCurrency(tier.amount, feeBreakdown.currency)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section: Category 1 - Official Government Charge */}
          <div
            style={{
              padding: '1rem',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
              borderRadius: '0.75rem',
              marginBottom: '1rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span
                  style={{
                    padding: '0.2rem 0.5rem',
                    background: 'rgba(56, 189, 248, 0.15)',
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

          {/* Section: Category 2 - Portal / Convenience Charges (#647) */}
          {feeBreakdown.portalConvenienceCharges && feeBreakdown.portalConvenienceCharges.length > 0 && (
            <div
              style={{
                padding: '1rem',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
                borderRadius: '0.75rem',
                marginBottom: '1rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <span
                  style={{
                    padding: '0.2rem 0.5rem',
                    background: 'rgba(168, 85, 247, 0.15)',
                    color: '#c084fc',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  Portal &amp; Technology Charges
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary, #94a3b8)' }}>
                  (Gateway / Processing)
                </span>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {feeBreakdown.portalConvenienceCharges.map((c) => (
                  <li
                    key={c.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.4rem 0',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>{c.label}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)' }}>{c.applicability} ({c.provider})</div>
                    </div>
                    <span style={{ fontSize: '0.95rem', fontWeight: '700', color: c.amount === 0 ? '#22c55e' : 'var(--text-primary)' }}>
                      {formatCurrency(c.amount, c.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Section: Category 3 - Authorized Service-Centre Charges (#647) */}
          {feeBreakdown.authorizedServiceCentreCharges && feeBreakdown.authorizedServiceCentreCharges.length > 0 && (
            <div
              style={{
                padding: '1rem',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
                borderRadius: '0.75rem',
                marginBottom: '1rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <span
                  style={{
                    padding: '0.2rem 0.5rem',
                    background: 'rgba(14, 165, 233, 0.15)',
                    color: '#38bdf8',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  Authorized Service-Centre Charges
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary, #94a3b8)' }}>
                  (CSC / ASK Official Operator Caps)
                </span>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {feeBreakdown.authorizedServiceCentreCharges.map((c) => (
                  <li
                    key={c.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.4rem 0',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>{c.label}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)' }}>{c.applicability}</div>
                    </div>
                    <span style={{ fontSize: '0.95rem', fontWeight: '700', color: c.amount === 0 ? '#22c55e' : 'var(--text-primary)' }}>
                      Cap: {formatCurrency(c.maxPermissibleCap || c.amount, c.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Section: Category 4 - Optional Third-Party Charges */}
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
                    (Voluntary Facilitation / Add-ons)
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
