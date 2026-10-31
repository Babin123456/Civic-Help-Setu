import { useState, useEffect } from 'react';
import { X, Calculator, ShieldCheck, Check, Sparkles, Printer, FileText, Zap } from 'lucide-react';
import {
  CONCESSION_CATEGORIES,
  calculateEstimatedCost,
} from '../../services/serviceFeeEstimatorService';

export default function InteractiveFeeEstimatorModal({ service, isOpen, onClose }) {
  const [isTatkal, setIsTatkal] = useState(false);
  const [needsPostalDelivery, setNeedsPostalDelivery] = useState(true);
  const [needsNotaryAffidavit, setNeedsNotaryAffidavit] = useState(false);
  const [needsKioskAssistance, setNeedsKioskAssistance] = useState(false);
  const [concessionId, setConcessionId] = useState('NONE');

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !service) return null;

  const cost = calculateEstimatedCost(service, {
    isTatkal,
    needsPostalDelivery,
    needsNotaryAffidavit,
    needsKioskAssistance,
    concessionId,
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="fee-estimator-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 110,
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        className="card animate-fade-in"
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'var(--bg-main)',
          border: '1px solid var(--border-main)',
          borderRadius: '1rem',
          padding: '1.75rem',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '2.4rem',
                height: '2.4rem',
                borderRadius: '0.6rem',
                background: 'rgba(16, 185, 129, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#10b981',
              }}
            >
              <Calculator size={20} />
            </div>
            <div>
              <h2 id="fee-estimator-title" style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>
                Interactive Cost & Concession Calculator
              </h2>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Calculate itemized total expenditure for <strong>{service.name}</strong>.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close cost calculator"
            className="btn-icon"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
              padding: '0.4rem',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Options Selection */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          {/* Concession Category */}
          <div style={{ gridColumn: '1 / -1' }}>
            <label htmlFor="concession-select" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
              Citizen Concession Category (Statutory Waivers)
            </label>
            <select
              id="concession-select"
              value={concessionId}
              onChange={(e) => setConcessionId(e.target.value)}
              style={{
                width: '100%',
                padding: '0.6rem 0.8rem',
                borderRadius: '0.5rem',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-light)',
                color: 'var(--text-primary)',
                fontSize: '0.875rem',
              }}
            >
              {CONCESSION_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {/* Option toggles */}
          <div
            style={{
              padding: '0.85rem',
              borderRadius: '0.6rem',
              background: 'var(--glass-bg)',
              border: '1px solid var(--border-light)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
              Service Delivery Speed
            </span>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
              <input
                type="checkbox"
                checked={isTatkal}
                onChange={(e) => setIsTatkal(e.target.checked)}
              />
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Zap size={14} color="#f59e0b" /> Fast-Track / Tatkal Surcharge
              </span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
              <input
                type="checkbox"
                checked={needsPostalDelivery}
                onChange={(e) => setNeedsPostalDelivery(e.target.checked)}
              />
              <span>Physical Postal Delivery (+₹50)</span>
            </label>
          </div>

          <div
            style={{
              padding: '0.85rem',
              borderRadius: '0.6rem',
              background: 'var(--glass-bg)',
              border: '1px solid var(--border-light)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
              Attestation & Facilitation
            </span>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
              <input
                type="checkbox"
                checked={needsNotaryAffidavit}
                onChange={(e) => setNeedsNotaryAffidavit(e.target.checked)}
              />
              <span>Notarized Affidavit Duty (+₹150)</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
              <input
                type="checkbox"
                checked={needsKioskAssistance}
                onChange={(e) => setNeedsKioskAssistance(e.target.checked)}
              />
              <span>CSC / Seva Kendra Kiosk Assistance (+₹60)</span>
            </label>
          </div>
        </div>

        {/* Itemized Breakdown Table */}
        <div style={{ borderRadius: '0.6rem', border: '1px solid var(--border-light)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: 'var(--glass-bg)', borderBottom: '1px solid var(--border-light)' }}>
                <th style={{ textAlign: 'left', padding: '0.6rem 0.8rem', fontWeight: 700 }}>Fee Component</th>
                <th style={{ textAlign: 'right', padding: '0.6rem 0.8rem', fontWeight: 700 }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {cost.breakdownItems.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--border-light)' }}>
                  <td style={{ padding: '0.6rem 0.8rem' }}>
                    <div style={{ fontWeight: 600 }}>{item.label}</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-tertiary)' }}>{item.description}</div>
                  </td>
                  <td style={{ textAlign: 'right', padding: '0.6rem 0.8rem', fontWeight: 700 }}>
                    {item.isExempted ? (
                      <div>
                        <span style={{ textDecoration: 'line-through', color: 'var(--text-tertiary)', marginRight: '0.4rem' }}>
                          ₹{item.amount}
                        </span>
                        <span style={{ color: '#10b981' }}>₹{item.discountedAmount}</span>
                      </div>
                    ) : (
                      `₹${item.amount}`
                    )}
                  </td>
                </tr>
              ))}
              {cost.waiverDiscount > 0 && (
                <tr style={{ background: 'rgba(16, 185, 129, 0.08)' }}>
                  <td style={{ padding: '0.6rem 0.8rem', color: '#10b981', fontWeight: 600 }}>
                    Total Statutory Concession Applied
                  </td>
                  <td style={{ textAlign: 'right', padding: '0.6rem 0.8rem', color: '#10b981', fontWeight: 700 }}>
                    -₹{cost.waiverDiscount}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Total Summary Banner */}
        <div
          style={{
            padding: '1rem 1.25rem',
            borderRadius: '0.75rem',
            background: 'rgba(56, 189, 248, 0.08)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
              Estimated Total Out-of-Pocket Cost
            </span>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--accent-main)' }}>
              ₹{cost.netPayable}
              {cost.isFullyExempt && (
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#10b981', marginLeft: '0.5rem' }}>
                  (100% EXEMPT)
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handlePrint}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
          >
            <Printer size={15} /> Print Estimate Slip
          </button>
        </div>
      </div>
    </div>
  );
}
