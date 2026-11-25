import { useState, useMemo } from 'react';
import {
  CreditCard,
  Plus,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import {
  STANDARD_TARIFF_CEILINGS,
  analyzeHospitalBilling,
} from '../../services/clinicalEstablishmentService.js';

export default function StandardBillingAnalyzerCard({ onBillingAnalysisChange }) {
  const [lineItems, setLineItems] = useState([
    { id: '1', tariffKey: 'ICU_BED_PER_DAY', daysOrUnits: 5, invoicedAmountInr: 45000 },
    { id: '2', tariffKey: 'CARDIAC_STENT_DES', daysOrUnits: 1, invoicedAmountInr: 65000 },
  ]);

  const [selectedTariffKey, setSelectedTariffKey] = useState('ICU_VENTILATOR_PER_DAY');
  const [unitsInput, setUnitsInput] = useState(3);
  const [invoicedInput, setInvoicedInput] = useState(35000);

  const billingAnalysis = useMemo(() => {
    return analyzeHospitalBilling(lineItems);
  }, [lineItems]);

  useMemo(() => {
    if (onBillingAnalysisChange) {
      onBillingAnalysisChange(billingAnalysis);
    }
  }, [billingAnalysis, onBillingAnalysisChange]);

  const handleAddItem = () => {
    if (invoicedInput <= 0) return;
    const newItem = {
      id: String(Date.now()),
      tariffKey: selectedTariffKey,
      daysOrUnits: unitsInput,
      invoicedAmountInr: invoicedInput,
    };
    setLineItems([...lineItems, newItem]);
    setInvoicedInput(15000);
  };

  const handleRemoveItem = (id) => {
    setLineItems(lineItems.filter((item) => item.id !== id));
  };

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
        <div
          style={{
            padding: '0.6rem',
            background: 'rgba(59, 130, 246, 0.15)',
            borderRadius: '0.75rem',
            color: '#3b82f6',
          }}
        >
          <CreditCard size={22} />
        </div>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            Hospital Billing &amp; Standard Tariff Overcharge Analyzer
          </h2>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Audits itemized hospital invoice against CGHS and NPPA statutory rate ceilings under Section 12(2)(o)
          </p>
        </div>
      </div>

      {/* Financial Summary KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ background: 'var(--bg-card-secondary, #0f172a)', padding: '1rem', borderRadius: '0.75rem', border: '1px solid var(--border-light, #334155)' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block' }}>Total Invoiced by Hospital</span>
          <strong style={{ fontSize: '1.6rem', color: 'var(--text-primary)' }}>
            ₹{billingAnalysis.totalInvoicedInr.toLocaleString('en-IN')}
          </strong>
        </div>

        <div style={{ background: 'var(--bg-card-secondary, #0f172a)', padding: '1rem', borderRadius: '0.75rem', border: '1px solid var(--border-light, #334155)' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block' }}>Permissible Standard Ceiling</span>
          <strong style={{ fontSize: '1.6rem', color: '#3b82f6' }}>
            ₹{billingAnalysis.totalStatutoryCeilingInr.toLocaleString('en-IN')}
          </strong>
        </div>

        <div
          style={{
            background: billingAnalysis.hasOvercharge ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
            padding: '1rem',
            borderRadius: '0.75rem',
            border: `1px solid ${billingAnalysis.hasOvercharge ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`,
          }}
        >
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block' }}>Illegal Extracted Overcharge</span>
          <strong style={{ fontSize: '1.6rem', color: billingAnalysis.hasOvercharge ? '#ef4444' : '#22c55e' }}>
            ₹{billingAnalysis.totalOverchargeInr.toLocaleString('en-IN')}
          </strong>
          <small style={{ color: billingAnalysis.hasOvercharge ? '#ef4444' : '#22c55e', display: 'block', fontWeight: 700 }}>
            {billingAnalysis.hasOvercharge ? `+${billingAnalysis.overchargePercent}% Above Statutory Cap` : 'Within Legal Ceiling'}
          </small>
        </div>
      </div>

      {/* Line Item Adder */}
      <div
        style={{
          background: 'var(--bg-card-secondary, #0f172a)',
          border: '1px solid var(--border-light, #334155)',
          borderRadius: '0.75rem',
          padding: '1rem',
          marginBottom: '1.25rem',
        }}
      >
        <span style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.75rem' }}>
          Add Invoice Line Item for Ceiling Audit
        </span>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '0.75rem', alignItems: 'end' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
              Standard Procedure / Tariff Category
            </label>
            <select
              value={selectedTariffKey}
              onChange={(e) => setSelectedTariffKey(e.target.value)}
              style={{
                width: '100%',
                padding: '0.55rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--border-light, #334155)',
                background: 'var(--bg-input, #0f172a)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
              }}
            >
              {Object.values(STANDARD_TARIFF_CEILINGS).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label} (Cap: ₹{t.standardCeilingInr.toLocaleString('en-IN')})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
              Days / Units
            </label>
            <input
              type="number"
              min="1"
              value={unitsInput}
              onChange={(e) => setUnitsInput(Math.max(1, Number(e.target.value) || 1))}
              style={{
                width: '100%',
                padding: '0.55rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--border-light, #334155)',
                background: 'var(--bg-input, #0f172a)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
              Billed Amount (₹)
            </label>
            <input
              type="number"
              min="0"
              value={invoicedInput}
              onChange={(e) => setInvoicedInput(Math.max(0, Number(e.target.value) || 0))}
              style={{
                width: '100%',
                padding: '0.55rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--border-light, #334155)',
                background: 'var(--bg-input, #0f172a)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
              }}
            />
          </div>

          <button
            type="button"
            onClick={handleAddItem}
            style={{
              padding: '0.6rem 1rem',
              borderRadius: '0.5rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              border: 'none',
              background: '#3b82f6',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            <Plus size={16} />
            Add Item
          </button>
        </div>
      </div>

      {/* Itemized Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-light, #334155)', textAlign: 'left', color: 'var(--text-secondary)' }}>
              <th style={{ padding: '0.5rem' }}>Service / Procedure</th>
              <th style={{ padding: '0.5rem' }}>Category</th>
              <th style={{ padding: '0.5rem' }}>Units</th>
              <th style={{ padding: '0.5rem' }}>Invoiced (₹)</th>
              <th style={{ padding: '0.5rem' }}>Statutory Cap (₹)</th>
              <th style={{ padding: '0.5rem' }}>Overcharge</th>
              <th style={{ padding: '0.5rem' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {billingAnalysis.itemsAnalysis.map((item, idx) => (
              <tr
                key={idx}
                style={{
                  borderBottom: '1px solid var(--border-light, #334155)',
                  background: item.isCappedViolation ? 'rgba(239, 68, 68, 0.05)' : 'transparent',
                }}
              >
                <td style={{ padding: '0.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>{item.itemLabel}</td>
                <td style={{ padding: '0.5rem', color: 'var(--text-secondary)' }}>{item.category}</td>
                <td style={{ padding: '0.5rem' }}>{item.units}</td>
                <td style={{ padding: '0.5rem', fontWeight: 700 }}>₹{item.invoicedAmountInr.toLocaleString('en-IN')}</td>
                <td style={{ padding: '0.5rem', color: '#3b82f6' }}>₹{item.standardCeilingInr.toLocaleString('en-IN')}</td>
                <td style={{ padding: '0.5rem' }}>
                  {item.isCappedViolation ? (
                    <span style={{ color: '#ef4444', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <TrendingUp size={13} />
                      +₹{item.overchargeInr.toLocaleString('en-IN')} ({item.markupPercent}%)
                    </span>
                  ) : (
                    <span style={{ color: '#22c55e', fontWeight: 600 }}>Compliant</span>
                  )}
                </td>
                <td style={{ padding: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(lineItems[idx]?.id)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                  >
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
