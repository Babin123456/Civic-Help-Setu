import { useState } from 'react';
import {
  Coins,
  CheckCircle2,
  AlertCircle,
  Calendar,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  FileCheck,
  Sparkles
} from 'lucide-react';
import { calculateServiceBenefit, formatInr } from '../../services/welfareEntitlementEngine';

export default function BenefitEntitlementCalculator({ serviceId, serviceName }) {
  const [incomePreset, setIncomePreset] = useState(150000);
  const [occupation, setOccupation] = useState('farmer');
  const [isExpanded, setIsExpanded] = useState(false);

  const benefit = calculateServiceBenefit(serviceId, {
    annualIncome: Number(incomePreset),
    occupation,
    isFarmer: occupation === 'farmer'
  });

  if (!benefit.hasBenefit) {
    return null;
  }

  const isEligible = benefit.eligibilityStatus === 'eligible';

  return (
    <section
      className="glass-panel"
      role="region"
      aria-label={`Welfare Benefit & Financial Assistance Estimator for ${serviceName || benefit.schemeName}`}
      style={{
        marginTop: '1.5rem',
        padding: '1.5rem',
        border: '1px solid var(--border-light, #334155)',
        borderRadius: '1rem',
        background: 'var(--bg-card, rgba(30, 41, 59, 0.7))',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
      }}
    >
      {/* Header */}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              padding: '0.65rem',
              borderRadius: '0.75rem',
              background: 'rgba(56, 189, 248, 0.15)',
              color: 'var(--accent-main, #38bdf8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Coins size={24} aria-hidden="true" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: '700', margin: 0, color: 'var(--text-primary, #f8fafc)' }}>
                Statutory Welfare & Subsidy Benefit
              </h3>
              <span
                style={{
                  fontSize: '0.75rem',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '9999px',
                  background: 'rgba(16, 185, 129, 0.2)',
                  color: '#10b981',
                  fontWeight: '600',
                }}
              >
                {benefit.category}
              </span>
            </div>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--text-secondary, #94a3b8)' }}>
              Official scheme: <strong>{benefit.schemeName}</strong>
            </p>
          </div>
        </div>

        {/* Highlighted Annual Benefit */}
        <div
          style={{
            background: isEligible ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
            border: `1px solid ${isEligible ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
            borderRadius: '0.75rem',
            padding: '0.5rem 1rem',
            textAlign: 'right',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)' }}>
            Estimated Annual Benefit
          </div>
          <div
            style={{
              fontSize: '1.35rem',
              fontWeight: '800',
              color: isEligible ? '#10b981' : '#f59e0b',
            }}
          >
            {benefit.formattedAnnualBenefit}
            <span style={{ fontSize: '0.8rem', fontWeight: 'normal', color: 'var(--text-secondary)' }}> / yr</span>
          </div>
        </div>
      </div>

      {/* Interactive Scenario Controls */}
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.4)',
          borderRadius: '0.75rem',
          padding: '1rem',
          marginBottom: '1rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
        }}
      >
        <div>
          <label
            htmlFor="benefit-income-select"
            style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}
          >
            Applicant Annual Household Income:
          </label>
          <select
            id="benefit-income-select"
            value={incomePreset}
            onChange={(e) => setIncomePreset(Number(e.target.value))}
            style={{
              width: '100%',
              padding: '0.5rem',
              borderRadius: '0.5rem',
              background: 'var(--bg-main, #0f172a)',
              color: 'var(--text-primary, #f8fafc)',
              border: '1px solid var(--border-light, #334155)',
              fontSize: '0.85rem',
            }}
          >
            <option value={90000}>Below ₹1,00,000 (BPL / Priority Household)</option>
            <option value={150000}>₹1,50,000 (Low-Income Group)</option>
            <option value={250000}>₹2,50,000 (EWS Ceiling)</option>
            <option value={450000}>₹4,50,000 (Non-Taxable Middle Class)</option>
            <option value={850000}>Above ₹8,00,000 (General Income)</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="benefit-occupation-select"
            style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}
          >
            Applicant Occupation Category:
          </label>
          <select
            id="benefit-occupation-select"
            value={occupation}
            onChange={(e) => setOccupation(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem',
              borderRadius: '0.5rem',
              background: 'var(--bg-main, #0f172a)',
              color: 'var(--text-primary, #f8fafc)',
              border: '1px solid var(--border-light, #334155)',
              fontSize: '0.85rem',
            }}
          >
            <option value="farmer">Farmer / Agricultural Landholder</option>
            <option value="artisan">Artisan / Daily Wage Worker</option>
            <option value="student">Student / Aspirant</option>
            <option value="salaried">Salaried / Private Employee</option>
            <option value="general">Self-Employed / General Citizen</option>
          </select>
        </div>
      </div>

      {/* Eligibility Status Alert */}
      <div
        role="status"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.65rem 0.85rem',
          borderRadius: '0.5rem',
          fontSize: '0.85rem',
          marginBottom: '1rem',
          background: isEligible ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
          color: isEligible ? '#34d399' : '#f87171',
          border: `1px solid ${isEligible ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
        }}
      >
        {isEligible ? (
          <CheckCircle2 size={18} aria-hidden="true" />
        ) : (
          <AlertCircle size={18} aria-hidden="true" />
        )}
        <span>
          {isEligible
            ? `Eligible for ${benefit.disbursementFrequency}: ${benefit.eligibilityReasons.join(' ')}`
            : `Notice: ${benefit.eligibilityReasons.join(' ')}`}
        </span>
      </div>

      {/* Disbursement Schedule Breakdown */}
      {benefit.installments && benefit.installments.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            <Calendar size={15} color="var(--accent-main)" aria-hidden="true" />
            <span>Disbursement Schedule ({benefit.disbursementFrequency})</span>
          </div>

          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {benefit.installments.map((inst, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.6rem 0.75rem',
                  borderRadius: '0.5rem',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-light, #334155)',
                  fontSize: '0.85rem',
                }}
              >
                <div>
                  <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{inst.period}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{inst.description}</div>
                </div>
                <div style={{ fontWeight: '700', color: 'var(--accent-main)', minWidth: '70px', textAlign: 'right' }}>
                  {formatInr(inst.amount)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expandable Statutory Rules */}
      <div>
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--accent-main, #38bdf8)',
            fontSize: '0.85rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.25rem 0',
          }}
        >
          <ShieldCheck size={16} aria-hidden="true" />
          <span>{isExpanded ? 'Hide Statutory Guidelines' : 'View Official Statutory Rules & How to Claim'}</span>
          {isExpanded ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
        </button>

        {isExpanded && (
          <div
            style={{
              marginTop: '0.75rem',
              padding: '0.85rem',
              borderRadius: '0.5rem',
              background: 'rgba(15, 23, 42, 0.5)',
              border: '1px solid var(--border-light, #334155)',
              fontSize: '0.825rem',
              color: 'var(--text-secondary)',
              lineHeight: '1.6',
            }}
          >
            <div style={{ fontWeight: '600', color: 'var(--text-primary)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <FileCheck size={15} color="#10b981" aria-hidden="true" />
              Statutory Guidelines & Exclusions:
            </div>
            <ul style={{ paddingLeft: '1.25rem', margin: '0 0 0.75rem 0' }}>
              {benefit.statutoryRules.map((rule, idx) => (
                <li key={idx} style={{ marginBottom: '0.25rem' }}>{rule}</li>
              ))}
            </ul>

            <div style={{ fontWeight: '600', color: 'var(--text-primary)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Sparkles size={15} color="var(--accent-main)" aria-hidden="true" />
              How to Claim:
            </div>
            <p style={{ margin: 0 }}>{benefit.howToClaim}</p>
          </div>
        )}
      </div>
    </section>
  );
}
