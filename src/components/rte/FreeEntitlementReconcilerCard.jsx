import { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
} from 'lucide-react';
import {
  reconcileFreeEntitlementOvercharges,
} from '../../services/rteAdmissionService.js';

export default function FreeEntitlementReconcilerCard({ onBillingAuditChange }) {
  const [feeItems, setFeeItems] = useState([
    { id: 'tuition_fee', label: 'Tuition & Academic Term Fee', billedInr: 15000 },
    { id: 'textbooks_workbooks', label: 'Textbooks, Notebooks & Learning Kit', billedInr: 4500 },
    { id: 'school_uniform', label: 'School Uniform, Belt & Sports Shoes', billedInr: 3800 },
    { id: 'library_computer_fee', label: 'Library, Smart Classroom & Computer Lab', billedInr: 2500 },
    { id: 'development_building_fee', label: 'Annual Development & Infrastructure Cess', billedInr: 8000 },
  ]);

  const handleFeeChange = (id, value) => {
    setFeeItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, billedInr: Math.max(0, Number(value) || 0) } : item))
    );
  };

  const billingAnalysis = useMemo(() => {
    return reconcileFreeEntitlementOvercharges(feeItems);
  }, [feeItems]);

  useMemo(() => {
    if (onBillingAuditChange) {
      onBillingAuditChange(billingAnalysis);
    }
  }, [billingAnalysis, onBillingAuditChange]);

  return (
    <div
      style={{
        background: 'var(--bg-card, #1e293b)',
        borderRadius: '1rem',
        padding: '1.5rem',
        border: '1px solid var(--border-light, #334155)',
        marginBottom: '1.5rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <FileSpreadsheet style={{ width: 28, height: 28, color: '#facc15' }} />
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary, #f8fafc)' }}>
            Section 3(2) Mandatory Free Entitlement &amp; Auxiliary Fee Reconciler
          </h2>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #94a3b8)' }}>
            Audits unlawful auxiliary bills: EWS elementary education must be completely free of compulsory fees
          </span>
        </div>
      </div>

      {/* Itemized Table */}
      <div style={{ overflowX: 'auto', marginBottom: '1.25rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-light, #334155)', color: 'var(--text-secondary, #94a3b8)' }}>
              <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem' }}>Fee Line Item</th>
              <th style={{ textAlign: 'right', padding: '0.5rem 0.75rem' }}>Billed Amount (INR)</th>
              <th style={{ textAlign: 'right', padding: '0.5rem 0.75rem' }}>Statutory Cap</th>
              <th style={{ textAlign: 'right', padding: '0.5rem 0.75rem' }}>Illegal Overcharge</th>
              <th style={{ textAlign: 'center', padding: '0.5rem 0.75rem' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {billingAnalysis.lineAudits.map((item) => (
              <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-primary, #f8fafc)', fontWeight: 500 }}>
                  {item.label}
                </td>
                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    value={item.billedInr}
                    onChange={(e) => handleFeeChange(item.id, e.target.value)}
                    style={{
                      width: '110px',
                      padding: '0.35rem 0.5rem',
                      borderRadius: '0.35rem',
                      textAlign: 'right',
                      background: 'var(--bg-dark, #0f172a)',
                      color: 'var(--text-primary, #f8fafc)',
                      border: '1px solid var(--border-light, #334155)',
                    }}
                  />
                </td>
                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', color: '#4ade80', fontWeight: 600 }}>
                  ₹0 (Free)
                </td>
                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', color: item.overchargeInr > 0 ? '#f87171' : '#4ade80', fontWeight: 700 }}>
                  ₹{item.overchargeInr.toLocaleString('en-IN')}
                </td>
                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                  {item.overchargeInr > 0 ? (
                    <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.45rem', borderRadius: '0.25rem', background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', fontWeight: 600 }}>
                      ILLEGAL
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.45rem', borderRadius: '0.25rem', background: 'rgba(34, 197, 94, 0.2)', color: '#4ade80', fontWeight: 600 }}>
                      COMPLIANT
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Aggregate Financial Card */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          padding: '1.25rem',
          borderRadius: '0.75rem',
          background: billingAnalysis.hasOvercharges ? 'rgba(239, 68, 68, 0.12)' : 'rgba(34, 197, 94, 0.12)',
          border: `1px solid ${billingAnalysis.hasOvercharges ? 'rgba(239, 68, 68, 0.4)' : 'rgba(34, 197, 94, 0.4)'}`,
        }}
      >
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)' }}>Total Billed Invoice</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary, #f8fafc)' }}>
            ₹{billingAnalysis.totalBilledInr.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Demanded by School</div>
        </div>

        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)' }}>Permissible EWS Charge</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#4ade80' }}>
            ₹0
          </div>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Sec 3(2) Complete Immunity</div>
        </div>

        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)' }}>Total Illegal Overcharge</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: billingAnalysis.hasOvercharges ? '#f87171' : '#4ade80' }}>
            ₹{billingAnalysis.totalIllegalOverchargeInr.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Refundable with 18% Interest</div>
        </div>
      </div>

      {/* Legal Explainer */}
      <div style={{ marginTop: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary, #94a3b8)', lineHeight: 1.5 }}>
        <strong>Statutory Note on School Reimbursement:</strong> Under Section 12(2) of the RTE Act 2009, private unaided schools receive per-child expenditure reimbursements directly from the State Government. The school has zero legal authority to pass costs of textbooks, uniforms, or development charges onto EWS/DG quota students.
      </div>
    </div>
  );
}
