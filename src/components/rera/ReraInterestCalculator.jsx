import {
  RERA_RELIEF_TYPE,
  DEFAULT_STATUTORY_INTEREST_RATE,
  calculateReraDelayInterest,
} from '../../services/reraDisputeService.js';
import { Calculator, AlertTriangle, TrendingUp, CheckCircle, RefreshCw } from 'lucide-react';

export default function ReraInterestCalculator({
  committedPossessionDate,
  onCommittedDateChange,
  gracePeriodMonths,
  onGracePeriodChange,
  totalAgreementCostInr,
  onAgreementCostChange,
  totalPaidInr,
  onTotalPaidChange,
  annualInterestRate,
  onInterestRateChange,
  reliefType,
  onReliefTypeChange,
}) {
  const calculation = calculateReraDelayInterest({
    committedPossessionDate,
    gracePeriodMonths,
    totalAgreementCostInr,
    totalPaidInr,
    annualInterestRate,
    reliefType,
  });

  return (
    <div
      style={{
        background: 'var(--bg-card, #1e293b)',
        border: '1px solid var(--border-light, #334155)',
        borderRadius: '0.75rem',
        padding: '1.5rem',
        marginBottom: '1.5rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div
          style={{
            padding: '0.5rem',
            borderRadius: '0.5rem',
            background: 'rgba(59, 130, 246, 0.15)',
            color: '#3b82f6',
            display: 'flex',
          }}
        >
          <Calculator size={22} />
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-primary, #f8fafc)' }}>
            RERA Section 18 Statutory Delay Interest & Refund Calculator
          </h3>
          <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary, #94a3b8)' }}>
            Deterministic statutory calculation benchmarked to SBI Highest MCLR + 2.0% per annum
          </p>
        </div>
      </div>

      {/* Input Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1rem',
          marginBottom: '1.25rem',
        }}
      >
        <div>
          <label
            htmlFor="committed-possession-date"
            style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-primary, #f8fafc)' }}
          >
            Committed Possession Date *
          </label>
          <input
            id="committed-possession-date"
            type="date"
            value={committedPossessionDate || ''}
            onChange={(e) => onCommittedDateChange?.(e.target.value)}
            style={{
              width: '100%',
              padding: '0.6rem 0.75rem',
              borderRadius: '0.5rem',
              background: 'var(--bg-primary, #0f172a)',
              border: '1px solid var(--border-light, #334155)',
              color: 'var(--text-primary, #f8fafc)',
              fontSize: '0.9rem',
            }}
          />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)' }}>
            Specified in Registered Agreement for Sale
          </span>
        </div>

        <div>
          <label
            htmlFor="grace-period-months"
            style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-primary, #f8fafc)' }}
          >
            Grace Period (Months)
          </label>
          <input
            id="grace-period-months"
            type="number"
            min="0"
            max="12"
            value={gracePeriodMonths ?? 0}
            onChange={(e) => onGracePeriodChange?.(Math.max(0, parseInt(e.target.value, 10) || 0))}
            style={{
              width: '100%',
              padding: '0.6rem 0.75rem',
              borderRadius: '0.5rem',
              background: 'var(--bg-primary, #0f172a)',
              border: '1px solid var(--border-light, #334155)',
              color: 'var(--text-primary, #f8fafc)',
              fontSize: '0.9rem',
            }}
          />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)' }}>
            Usually 3 to 6 months per contract terms
          </span>
        </div>

        <div>
          <label
            htmlFor="total-paid-inr"
            style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-primary, #f8fafc)' }}
          >
            Total Amount Paid by You (Rs.) *
          </label>
          <input
            id="total-paid-inr"
            type="number"
            min="0"
            step="10000"
            value={totalPaidInr ?? ''}
            onChange={(e) => onTotalPaidChange?.(Math.max(0, parseFloat(e.target.value) || 0))}
            placeholder="e.g. 5000000"
            style={{
              width: '100%',
              padding: '0.6rem 0.75rem',
              borderRadius: '0.5rem',
              background: 'var(--bg-primary, #0f172a)',
              border: '1px solid var(--border-light, #334155)',
              color: 'var(--text-primary, #f8fafc)',
              fontSize: '0.9rem',
            }}
          />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)' }}>
            Principal sum paid to promoter or escrow
          </span>
        </div>

        <div>
          <label
            htmlFor="total-agreement-cost-inr"
            style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-primary, #f8fafc)' }}
          >
            Total Agreement Price (Rs.)
          </label>
          <input
            id="total-agreement-cost-inr"
            type="number"
            min="0"
            step="10000"
            value={totalAgreementCostInr ?? ''}
            onChange={(e) => onAgreementCostChange?.(Math.max(0, parseFloat(e.target.value) || 0))}
            placeholder="e.g. 6000000"
            style={{
              width: '100%',
              padding: '0.6rem 0.75rem',
              borderRadius: '0.5rem',
              background: 'var(--bg-primary, #0f172a)',
              border: '1px solid var(--border-light, #334155)',
              color: 'var(--text-primary, #f8fafc)',
              fontSize: '0.9rem',
            }}
          />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)' }}>
            Total sanctioned purchase price
          </span>
        </div>

        <div>
          <label
            htmlFor="annual-interest-rate"
            style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-primary, #f8fafc)' }}
          >
            Statutory Annual Interest Rate (%)
          </label>
          <input
            id="annual-interest-rate"
            type="number"
            min="1"
            max="25"
            step="0.05"
            value={annualInterestRate ?? DEFAULT_STATUTORY_INTEREST_RATE}
            onChange={(e) => onInterestRateChange?.(parseFloat(e.target.value) || DEFAULT_STATUTORY_INTEREST_RATE)}
            style={{
              width: '100%',
              padding: '0.6rem 0.75rem',
              borderRadius: '0.5rem',
              background: 'var(--bg-primary, #0f172a)',
              border: '1px solid var(--border-light, #334155)',
              color: 'var(--text-primary, #f8fafc)',
              fontSize: '0.9rem',
            }}
          />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)' }}>
            Benchmark: SBI 1-Yr MCLR (8.75%) + 2.0% = 10.75%
          </span>
        </div>
      </div>

      {/* Statutory Remedy Selector */}
      <div style={{ marginBottom: '1.25rem' }}>
        <span style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-primary, #f8fafc)' }}>
          Statutory Remedy Choice under Section 18:
        </span>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => onReliefTypeChange?.(RERA_RELIEF_TYPE.POSSESSION_DELAY_INTEREST)}
            style={{
              flex: '1 1 240px',
              padding: '0.75rem 1rem',
              borderRadius: '0.5rem',
              textAlign: 'left',
              cursor: 'pointer',
              border: reliefType === RERA_RELIEF_TYPE.POSSESSION_DELAY_INTEREST
                ? '2px solid #3b82f6'
                : '1px solid var(--border-light, #334155)',
              background: reliefType === RERA_RELIEF_TYPE.POSSESSION_DELAY_INTEREST
                ? 'rgba(59, 130, 246, 0.12)'
                : 'var(--bg-primary, #0f172a)',
              color: 'var(--text-primary, #f8fafc)',
            }}
          >
            <div style={{ fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <TrendingUp size={16} color="#3b82f6" /> Option B: Stay in Project & Claim Delay Compensation
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)', marginTop: '0.25rem' }}>
              Monthly interest payout until physical possession with Occupancy Certificate (Sec 18 Proviso 2)
            </div>
          </button>

          <button
            type="button"
            onClick={() => onReliefTypeChange?.(RERA_RELIEF_TYPE.WITHDRAWAL_REFUND)}
            style={{
              flex: '1 1 240px',
              padding: '0.75rem 1rem',
              borderRadius: '0.5rem',
              textAlign: 'left',
              cursor: 'pointer',
              border: reliefType === RERA_RELIEF_TYPE.WITHDRAWAL_REFUND
                ? '2px solid #ef4444'
                : '1px solid var(--border-light, #334155)',
              background: reliefType === RERA_RELIEF_TYPE.WITHDRAWAL_REFUND
                ? 'rgba(239, 68, 68, 0.12)'
                : 'var(--bg-primary, #0f172a)',
              color: 'var(--text-primary, #f8fafc)',
            }}
          >
            <div style={{ fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <RefreshCw size={16} color="#ef4444" /> Option A: Withdraw from Project & Demand Full Refund
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)', marginTop: '0.25rem' }}>
              Return of 100% principal amount paid + statutory interest + compensation (Sec 18 Proviso 1)
            </div>
          </button>
        </div>
      </div>

      {/* Results Card */}
      {calculation.isValid ? (
        <div
          style={{
            background: 'var(--bg-primary, #0f172a)',
            border: '1px solid var(--border-light, #334155)',
            borderRadius: '0.5rem',
            padding: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary, #f8fafc)' }}>
              Statutory Calculation Summary
            </span>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '0.2rem 0.6rem',
                borderRadius: '999px',
                background: calculation.isDelayed ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                color: calculation.isDelayed ? '#ef4444' : '#22c55e',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
              }}
            >
              {calculation.isDelayed ? <AlertTriangle size={14} /> : <CheckCircle size={14} />}
              {calculation.isDelayed ? `DELAYED BY ${calculation.delayDays} DAYS (${calculation.delayMonths} MONTHS)` : 'NO DEFAULT DETECTED'}
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem',
              marginBottom: '1rem',
            }}
          >
            <div style={{ padding: '0.75rem', borderRadius: '0.5rem', background: 'rgba(255, 255, 255, 0.03)' }}>
              <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)' }}>
                Effective Possession Deadline
              </span>
              <strong style={{ fontSize: '1rem', color: 'var(--text-primary, #f8fafc)' }}>
                {calculation.effectivePossessionDate}
              </strong>
            </div>

            <div style={{ padding: '0.75rem', borderRadius: '0.5rem', background: 'rgba(255, 255, 255, 0.03)' }}>
              <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)' }}>
                Accrued Delay Interest to Date
              </span>
              <strong style={{ fontSize: '1.15rem', color: '#f59e0b' }}>
                Rs. {calculation.accruedInterestInr.toLocaleString('en-IN')}
              </strong>
            </div>

            {reliefType === RERA_RELIEF_TYPE.POSSESSION_DELAY_INTEREST ? (
              <div style={{ padding: '0.75rem', borderRadius: '0.5rem', background: 'rgba(255, 255, 255, 0.03)' }}>
                <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)' }}>
                  Monthly Compensation Owed
                </span>
                <strong style={{ fontSize: '1.15rem', color: '#3b82f6' }}>
                  Rs. {calculation.monthlyDelayCompensationInr.toLocaleString('en-IN')} / mo
                </strong>
              </div>
            ) : (
              <div style={{ padding: '0.75rem', borderRadius: '0.5rem', background: 'rgba(255, 255, 255, 0.03)' }}>
                <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)' }}>
                  Total Refund Claimable (Principal + Interest)
                </span>
                <strong style={{ fontSize: '1.15rem', color: '#ef4444' }}>
                  Rs. {calculation.totalClaimableAmountInr.toLocaleString('en-IN')}
                </strong>
              </div>
            )}
          </div>

          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary, #94a3b8)', fontStyle: 'italic' }}>
            Statutory Basis: {calculation.statutoryCitation}
          </p>
        </div>
      ) : (
        <div style={{ padding: '1rem', borderRadius: '0.5rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', fontSize: '0.85rem' }}>
          Please enter a valid committed possession date to compute statutory entitlement.
        </div>
      )}
    </div>
  );
}
