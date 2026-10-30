import { useState, useMemo } from 'react';
import { CheckCircle2, XCircle, Search, SlidersHorizontal, Info, ShieldCheck } from 'lucide-react';
import { evaluateCitizenAcrossSchemes } from '../../services/welfareEligibilityMatrixService';

export default function WelfareEligibilityMatrixTable() {
  const [age, setAge] = useState(35);
  const [annualIncome, setAnnualIncome] = useState(200000);
  const [occupation, setOccupation] = useState('salaried');
  const [hasBplCard, setHasBplCard] = useState(false);
  const [hasGirlChild, setHasGirlChild] = useState(false);
  const [childAge, setChildAge] = useState(7);
  const [ownsPuccaHouse, setOwnsPuccaHouse] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const profile = useMemo(() => ({
    age: Number(age),
    annualIncome: Number(annualIncome),
    occupation,
    hasBplCard,
    hasGirlChild,
    childAge: Number(childAge),
    ownsPuccaHouse,
  }), [age, annualIncome, occupation, hasBplCard, hasGirlChild, childAge, ownsPuccaHouse]);

  const results = useMemo(() => evaluateCitizenAcrossSchemes(profile), [profile]);

  const filteredResults = useMemo(() => {
    if (!searchQuery.trim()) return results;
    const query = searchQuery.toLowerCase();
    return results.filter(
      (r) =>
        r.title.toLowerCase().includes(query) ||
        r.category.toLowerCase().includes(query) ||
        r.ministry.toLowerCase().includes(query)
    );
  }, [results, searchQuery]);

  const eligibleCount = results.filter((r) => r.isEligible).length;

  return (
    <div className="glass-panel" style={{ padding: '1.75rem', borderRadius: '1rem', border: '1px solid var(--border-light, #334155)' }}>
      {/* Parameters Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <SlidersHorizontal size={20} color="var(--accent-main, #38bdf8)" aria-hidden="true" />
          <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>Quick Welfare Eligibility Matrix</h3>
        </div>
        <div style={{ fontSize: '0.85rem', padding: '0.3rem 0.8rem', borderRadius: '999px', background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', fontWeight: 600 }}>
          {eligibleCount} of {results.length} Schemes Match
        </div>
      </div>

      {/* Parameter Inputs Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1rem',
          padding: '1rem',
          borderRadius: '0.75rem',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid var(--border-light, #334155)',
          marginBottom: '1.5rem',
        }}
      >
        <div>
          <label htmlFor="matrix-age" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-secondary)' }}>
            Applicant Age ({age} yrs)
          </label>
          <input
            id="matrix-age"
            type="number"
            min="0"
            max="110"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            style={{ width: '100%', padding: '0.5rem', borderRadius: '0.4rem', border: '1px solid var(--border-main)', background: 'var(--bg-main)', color: 'var(--text-primary)' }}
          />
        </div>

        <div>
          <label htmlFor="matrix-income" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-secondary)' }}>
            Annual Family Income (₹)
          </label>
          <input
            id="matrix-income"
            type="number"
            step="10000"
            value={annualIncome}
            onChange={(e) => setAnnualIncome(e.target.value)}
            style={{ width: '100%', padding: '0.5rem', borderRadius: '0.4rem', border: '1px solid var(--border-main)', background: 'var(--bg-main)', color: 'var(--text-primary)' }}
          />
        </div>

        <div>
          <label htmlFor="matrix-occupation" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-secondary)' }}>
            Occupation
          </label>
          <select
            id="matrix-occupation"
            value={occupation}
            onChange={(e) => setOccupation(e.target.value)}
            style={{ width: '100%', padding: '0.5rem', borderRadius: '0.4rem', border: '1px solid var(--border-main)', background: 'var(--bg-main)', color: 'var(--text-primary)' }}
          >
            <option value="salaried">Salaried / Private Worker</option>
            <option value="farmer">Farmer / Agricultural</option>
            <option value="self-employed">Self Employed / Artisan</option>
            <option value="retired">Senior / Retired</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '0.4rem' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.8rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={hasBplCard}
              onChange={(e) => setHasBplCard(e.target.checked)}
            />
            <span>Holds BPL / Ration Card</span>
          </label>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.8rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={hasGirlChild}
              onChange={(e) => setHasGirlChild(e.target.checked)}
            />
            <span>Has Girl Child (&le; 10 yrs)</span>
          </label>
        </div>
      </div>

      {/* Search Bar */}
      <div style={{ position: 'relative', marginBottom: '1.25rem' }}>
        <Search size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
        <input
          type="text"
          placeholder="Filter schemes by name or category (e.g. Health, Housing, Farmer)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '0.65rem 0.85rem 0.65rem 2.5rem',
            borderRadius: '0.5rem',
            border: '1px solid var(--border-light, #334155)',
            background: 'rgba(255, 255, 255, 0.02)',
            color: 'var(--text-primary)',
            fontSize: '0.85rem',
          }}
        />
      </div>

      {/* Schemes Grid Table */}
      <div style={{ display: 'grid', gap: '0.85rem' }}>
        {filteredResults.map((item) => (
          <div
            key={item.schemeId}
            style={{
              padding: '1rem',
              borderRadius: '0.65rem',
              border: item.isEligible ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid var(--border-light, #334155)',
              background: item.isEligible ? 'rgba(34, 197, 94, 0.04)' : 'rgba(255, 255, 255, 0.01)',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: '1rem',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ flex: 1, minWidth: '240px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>{item.title}</h4>
                <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '999px', background: 'rgba(255, 255, 255, 0.08)', color: 'var(--text-secondary)' }}>
                  {item.category}
                </span>
              </div>
              <p style={{ margin: '0 0 0.35rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                {item.benefitSummary}
              </p>
              <div style={{ fontSize: '0.78rem', color: item.isEligible ? '#22c55e' : 'var(--text-tertiary)' }}>
                {item.reason}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
              {item.isEligible ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', fontWeight: 600, color: '#22c55e', background: 'rgba(34, 197, 94, 0.1)', padding: '0.35rem 0.75rem', borderRadius: '0.4rem' }}>
                  <CheckCircle2 size={15} /> Likely Eligible
                </span>
              ) : (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', background: 'rgba(148, 163, 184, 0.1)', padding: '0.35rem 0.75rem', borderRadius: '0.4rem' }}>
                  <XCircle size={15} /> Not Matching
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
