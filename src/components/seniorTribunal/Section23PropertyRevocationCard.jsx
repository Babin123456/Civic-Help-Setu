import { useState, useMemo } from 'react';
import { ShieldAlert, CheckCircle2, AlertTriangle, Scale, BookOpen } from 'lucide-react';
import { validateSection23RevocationReadiness } from '../../services/seniorCitizenTribunalService.js';

const Section23PropertyRevocationCard = ({ onApplyFindings }) => {
  const [deedInfo, setDeedInfo] = useState({
    deedType: 'gift deed',
    transferYear: 2019,
    hasAmenityCondition: true,
    isSeniorCitizenAtTransfer: true,
    neglectDocumented: true,
    parentInPossession: false,
  });

  const evaluation = useMemo(() => {
    return validateSection23RevocationReadiness(deedInfo);
  }, [deedInfo]);

  const handleChange = (field, value) => {
    setDeedInfo((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

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
            background: 'rgba(239, 68, 68, 0.1)',
            color: '#ef4444',
          }}
        >
          <Scale size={20} />
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
            Section 23 Property Transfer Revocation & Eviction Validator
          </h3>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary, #94a3b8)' }}>
            Evaluates statutory grounds for declaring gift deeds void for non-provision of basic amenities and securing eviction.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* Checklist Inputs */}
        <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid var(--border-light, #334155)' }}>
          <h4 style={{ fontSize: '0.9rem', fontWeight: 600, margin: '0 0 0.75rem' }}>
            1. Deed & Neglect Criteria
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.82rem' }}>
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Deed Category:</span>
              <select
                value={deedInfo.deedType}
                onChange={(e) => handleChange('deedType', e.target.value)}
                style={{ padding: '0.3rem 0.5rem', borderRadius: '0.25rem', border: '1px solid var(--border-light, #334155)', background: 'var(--bg-card, #1e293b)', color: 'inherit' }}
              >
                <option value="gift deed">Gift Deed (Danpatra)</option>
                <option value="settlement deed">Family Settlement Deed</option>
                <option value="relinquishment">Relinquishment Deed</option>
                <option value="sale_deed">Sale Deed without consideration</option>
              </select>
            </label>

            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Registration Year:</span>
              <input
                type="number"
                min="1990"
                max={new Date().getFullYear()}
                value={deedInfo.transferYear}
                onChange={(e) => handleChange('transferYear', Number(e.target.value) || 0)}
                style={{ width: '90px', padding: '0.3rem 0.5rem', borderRadius: '0.25rem', border: '1px solid var(--border-light, #334155)', background: 'var(--bg-card, #1e293b)', color: 'inherit' }}
              />
            </label>

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={deedInfo.isSeniorCitizenAtTransfer}
                onChange={(e) => handleChange('isSeniorCitizenAtTransfer', e.target.checked)}
                style={{ marginTop: '3px' }}
              />
              <span>Parent was aged 60+ at the time of deed execution</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={deedInfo.hasAmenityCondition}
                onChange={(e) => handleChange('hasAmenityCondition', e.target.checked)}
                style={{ marginTop: '3px' }}
              />
              <span>Deed states or implies transferee must provide care & amenities</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={deedInfo.neglectDocumented}
                onChange={(e) => handleChange('neglectDocumented', e.target.checked)}
                style={{ marginTop: '3px' }}
              />
              <span>Neglect, harassment, or medical abandonment is documented</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={!deedInfo.parentInPossession}
                onChange={(e) => handleChange('parentInPossession', !e.target.checked)}
                style={{ marginTop: '3px' }}
              />
              <span>Parent has been evicted / locked out from the residence</span>
            </label>
          </div>
        </div>

        {/* Readiness Score & Evaluation */}
        <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid var(--border-light, #334155)' }}>
          <h4 style={{ fontSize: '0.9rem', fontWeight: 600, margin: '0 0 0.75rem' }}>
            2. Statutory Readiness Verdict
          </h4>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', borderRadius: '0.375rem', background: evaluation.verdict === 'STRONG' ? 'rgba(16, 185, 129, 0.1)' : evaluation.verdict === 'MODERATE' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)', border: `1px solid ${evaluation.verdict === 'STRONG' ? '#10b981' : evaluation.verdict === 'MODERATE' ? '#f59e0b' : '#ef4444'}`, marginBottom: '1rem' }}>
            <div>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Grounds Strength</span>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: evaluation.verdict === 'STRONG' ? '#10b981' : evaluation.verdict === 'MODERATE' ? '#f59e0b' : '#ef4444' }}>
                {evaluation.verdict} CASE ({evaluation.score}/100)
              </div>
            </div>
            {evaluation.verdict === 'STRONG' ? (
              <CheckCircle2 size={24} color="#10b981" />
            ) : evaluation.verdict === 'MODERATE' ? (
              <AlertTriangle size={24} color="#f59e0b" />
            ) : (
              <ShieldAlert size={24} color="#ef4444" />
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.75rem' }}>
            {evaluation.findings.map((f, i) => (
              <div key={i} style={{ display: 'flex', gap: '0.4rem', alignItems: 'flex-start' }}>
                <span style={{ color: f.status === 'PASS' ? '#10b981' : f.status === 'ACTION_REQUIRED' ? '#ef4444' : '#f59e0b', fontWeight: 700 }}>•</span>
                <div>
                  <strong style={{ color: 'var(--text-primary)' }}>{f.title}: </strong>
                  <span style={{ color: 'var(--text-secondary)' }}>{f.description}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Judicial Precedents */}
      <div>
        <h4 style={{ fontSize: '0.85rem', fontWeight: 600, margin: '0 0 0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <BookOpen size={15} color="var(--accent-main)" />
          <span>Binding Judicial Precedents (to cite in petition):</span>
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.6rem' }}>
          {evaluation.applicablePrecedents.map((p, i) => (
            <div
              key={i}
              style={{
                padding: '0.6rem 0.75rem',
                borderRadius: '0.375rem',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-light, #334155)',
                fontSize: '0.75rem',
              }}
            >
              <strong style={{ display: 'block', color: 'var(--accent-main, #38bdf8)' }}>{p.citation}</strong>
              <p style={{ margin: '0.2rem 0 0', color: 'var(--text-secondary)' }}>{p.relevance}</p>
            </div>
          ))}
        </div>
      </div>

      {onApplyFindings && (
        <div style={{ marginTop: '1.25rem', textAlign: 'right' }}>
          <button
            type="button"
            onClick={() => onApplyFindings(evaluation)}
            className="btn btn-primary"
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
          >
            Incorporate Grounds into Petition
          </button>
        </div>
      )}
    </div>
  );
};

export default Section23PropertyRevocationCard;
