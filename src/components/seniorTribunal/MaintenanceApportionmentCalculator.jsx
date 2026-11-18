import { useState, useMemo } from 'react';
import { Plus, Trash2, Calculator, Info, ShieldAlert } from 'lucide-react';
import { calculateEquitableMaintenance } from '../../services/seniorCitizenTribunalService.js';

const MaintenanceApportionmentCalculator = ({ onApplyCalculation }) => {
  const [expenses, setExpenses] = useState({
    food: 5000,
    shelter: 4000,
    medical: 6000,
    caregiver: 3000,
    other: 1000,
  });

  const [existingIncome, setExistingIncome] = useState(2000);

  const [respondents, setRespondents] = useState([
    { id: 1, name: 'Eldest Son', relationship: 'Son', monthlyIncome: 65000, hasInheritedProperty: true },
    { id: 2, name: 'Second Child', relationship: 'Daughter', monthlyIncome: 45000, hasInheritedProperty: false },
  ]);

  const handleExpenseChange = (field, val) => {
    setExpenses((prev) => ({
      ...prev,
      [field]: Math.max(0, Number(val) || 0),
    }));
  };

  const handleAddRespondent = () => {
    setRespondents((prev) => [
      ...prev,
      {
        id: Date.now(),
        name: `Child ${prev.length + 1}`,
        relationship: 'Child',
        monthlyIncome: 30000,
        hasInheritedProperty: false,
      },
    ]);
  };

  const handleRemoveRespondent = (id) => {
    if (respondents.length <= 1) return;
    setRespondents((prev) => prev.filter((r) => r.id !== id));
  };

  const handleRespondentChange = (id, field, value) => {
    setRespondents((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  const calculation = useMemo(() => {
    return calculateEquitableMaintenance({
      expenses,
      existingIncome,
      respondents,
    });
  }, [expenses, existingIncome, respondents]);

  return (
    <div
      className="card"
      style={{
        padding: '1.5rem',
        borderRadius: '0.75rem',
        background: 'var(--bg-main, #0f172a)',
        border: '1px solid var(--border-main, #334155)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
        <div
          style={{
            padding: '0.5rem',
            borderRadius: '0.5rem',
            background: 'rgba(56, 189, 248, 0.1)',
            color: 'var(--accent-main, #38bdf8)',
          }}
        >
          <Calculator size={20} />
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
            Equitable Maintenance & Liability Apportionment Calculator
          </h3>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary, #94a3b8)' }}>
            Statutory computation under Section 4 & 5 apportioning support liability across adult children based on income and inheritance.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* Expenses Column */}
        <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid var(--border-light, #334155)' }}>
          <h4 style={{ fontSize: '0.9rem', fontWeight: 600, margin: '0 0 0.75rem', color: 'var(--text-primary)' }}>
            1. Monthly Essential Needs (₹)
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.85rem' }}>
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Food & Nutrition:</span>
              <input
                type="number"
                min="0"
                value={expenses.food}
                onChange={(e) => handleExpenseChange('food', e.target.value)}
                style={{ width: '100px', padding: '0.3rem 0.5rem', borderRadius: '0.25rem', border: '1px solid var(--border-light, #334155)', background: 'var(--bg-card, #1e293b)', color: 'inherit' }}
              />
            </label>
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Shelter & Utilities:</span>
              <input
                type="number"
                min="0"
                value={expenses.shelter}
                onChange={(e) => handleExpenseChange('shelter', e.target.value)}
                style={{ width: '100px', padding: '0.3rem 0.5rem', borderRadius: '0.25rem', border: '1px solid var(--border-light, #334155)', background: 'var(--bg-card, #1e293b)', color: 'inherit' }}
              />
            </label>
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Healthcare & Medicines:</span>
              <input
                type="number"
                min="0"
                value={expenses.medical}
                onChange={(e) => handleExpenseChange('medical', e.target.value)}
                style={{ width: '100px', padding: '0.3rem 0.5rem', borderRadius: '0.25rem', border: '1px solid var(--border-light, #334155)', background: 'var(--bg-card, #1e293b)', color: 'inherit' }}
              />
            </label>
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Caregiver / Attendant:</span>
              <input
                type="number"
                min="0"
                value={expenses.caregiver}
                onChange={(e) => handleExpenseChange('caregiver', e.target.value)}
                style={{ width: '100px', padding: '0.3rem 0.5rem', borderRadius: '0.25rem', border: '1px solid var(--border-light, #334155)', background: 'var(--bg-card, #1e293b)', color: 'inherit' }}
              />
            </label>
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Other Incidentals:</span>
              <input
                type="number"
                min="0"
                value={expenses.other}
                onChange={(e) => handleExpenseChange('other', e.target.value)}
                style={{ width: '100px', padding: '0.3rem 0.5rem', borderRadius: '0.25rem', border: '1px solid var(--border-light, #334155)', background: 'var(--bg-card, #1e293b)', color: 'inherit' }}
              />
            </label>
            <div style={{ borderTop: '1px solid var(--border-light, #334155)', paddingTop: '0.5rem', marginTop: '0.25rem', display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
              <span>Total Monthly Need:</span>
              <span style={{ color: 'var(--accent-main, #38bdf8)' }}>₹{calculation.totalMonthlyNeed.toLocaleString('en-IN')}</span>
            </div>
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Less: Own Pension / Income:</span>
              <input
                type="number"
                min="0"
                value={existingIncome}
                onChange={(e) => setExistingIncome(Math.max(0, Number(e.target.value) || 0))}
                style={{ width: '100px', padding: '0.3rem 0.5rem', borderRadius: '0.25rem', border: '1px solid var(--border-light, #334155)', background: 'var(--bg-card, #1e293b)', color: 'inherit' }}
              />
            </label>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '0.95rem', color: '#10b981', marginTop: '0.25rem' }}>
              <span>Net Monthly Deficit (Claim):</span>
              <span>₹{calculation.netDeficit.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        {/* Children Column */}
        <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid var(--border-light, #334155)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
              2. Adult Children / Respondents
            </h4>
            <button
              type="button"
              onClick={handleAddRespondent}
              className="btn btn-secondary"
              style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
            >
              <Plus size={14} />
              <span>Add Child</span>
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {respondents.map((resp) => (
              <div
                key={resp.id}
                style={{
                  padding: '0.6rem',
                  borderRadius: '0.375rem',
                  background: 'var(--bg-card, #1e293b)',
                  border: '1px solid var(--border-light, #334155)',
                  fontSize: '0.8rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <input
                    type="text"
                    value={resp.name}
                    onChange={(e) => handleRespondentChange(resp.id, 'name', e.target.value)}
                    placeholder="Name / Label"
                    style={{ fontWeight: 600, background: 'transparent', border: 'none', borderBottom: '1px dashed var(--border-light)', color: 'inherit', padding: '0.1rem 0' }}
                  />
                  {respondents.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveRespondent(resp.id)}
                      aria-label={`Remove ${resp.name}`}
                      style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.1rem' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    <span>Income ₹:</span>
                    <input
                      type="number"
                      min="0"
                      value={resp.monthlyIncome}
                      onChange={(e) => handleRespondentChange(resp.id, 'monthlyIncome', Math.max(0, Number(e.target.value) || 0))}
                      style={{ width: '80px', padding: '0.2rem 0.4rem', borderRadius: '0.2rem', border: '1px solid var(--border-light)', background: 'var(--bg-main)', color: 'inherit' }}
                    />
                  </label>

                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={resp.hasInheritedProperty}
                      onChange={(e) => handleRespondentChange(resp.id, 'hasInheritedProperty', e.target.checked)}
                    />
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>Gifted / Transferred Property (+15% share)</span>
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Apportioned Liability Breakdown */}
      <div style={{ marginBottom: '1.25rem' }}>
        <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.6rem' }}>
          3. Recommended Equitable Apportionment Award
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
          {calculation.apportionedBreakdown.map((r, i) => (
            <div
              key={i}
              style={{
                padding: '0.85rem',
                borderRadius: '0.5rem',
                background: 'rgba(56, 189, 248, 0.05)',
                border: '1px solid rgba(56, 189, 248, 0.2)',
              }}
            >
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {r.name}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', margin: '0.2rem 0 0.5rem' }}>
                Liability Share: <strong>{r.percentageContribution}%</strong>
                {r.hasInheritedProperty && ' • Transferee Liability'}
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent-main, #38bdf8)' }}>
                ₹{r.recommendedMonthlyShare.toLocaleString('en-IN')} <span style={{ fontSize: '0.7rem', fontWeight: 400 }}>/ month</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Statutory Guidance Alert */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.6rem',
          padding: '0.75rem 1rem',
          borderRadius: '0.5rem',
          background: calculation.statutoryCeilingNoticed ? 'rgba(245, 158, 11, 0.08)' : 'rgba(16, 185, 129, 0.08)',
          border: `1px solid ${calculation.statutoryCeilingNoticed ? 'rgba(245, 158, 11, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
          fontSize: '0.78rem',
          lineHeight: '1.4',
        }}
      >
        {calculation.statutoryCeilingNoticed ? (
          <ShieldAlert size={18} color="#f59e0b" style={{ flexShrink: 0, marginTop: '2px' }} />
        ) : (
          <Info size={18} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
        )}
        <div>
          <strong style={{ color: calculation.statutoryCeilingNoticed ? '#f59e0b' : '#10b981' }}>
            {calculation.statutoryCeilingNoticed ? 'Judicial Exception Applicable' : 'Standard Statutory Award'}
          </strong>
          <p style={{ margin: '0.15rem 0 0', color: 'var(--text-secondary)' }}>
            {calculation.statutoryCapNote}
          </p>
        </div>
      </div>

      {onApplyCalculation && (
        <div style={{ marginTop: '1.25rem', textAlign: 'right' }}>
          <button
            type="button"
            onClick={() => onApplyCalculation(calculation)}
            className="btn btn-primary"
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
          >
            Apply to Petition Draft
          </button>
        </div>
      )}
    </div>
  );
};

export default MaintenanceApportionmentCalculator;
