import { useState, useMemo } from 'react';
import { CheckSquare, Square, FileCheck, AlertCircle } from 'lucide-react';
import { generateEvidenceChecklist } from '../../services/seniorCitizenTribunalService.js';

const EvidenceChecklistDrawer = ({ caseType = 'MAINTENANCE_AND_EXPENSES' }) => {
  const [checkedItems, setCheckedItems] = useState({});

  const items = useMemo(() => {
    return generateEvidenceChecklist(caseType);
  }, [caseType]);

  const toggleCheck = (id) => {
    setCheckedItems((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const mandatoryCount = items.filter((item) => item.mandatory).length;
  const completedMandatoryCount = items.filter(
    (item) => item.mandatory && checkedItems[item.id]
  ).length;

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div
            style={{
              padding: '0.5rem',
              borderRadius: '0.5rem',
              background: 'rgba(16, 185, 129, 0.1)',
              color: '#10b981',
            }}
          >
            <FileCheck size={20} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
              Statutory Evidence & Document Readiness Checklist
            </h3>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary, #94a3b8)' }}>
              Required supporting records to append with your petition before the Sub-Divisional Magistrate.
            </p>
          </div>
        </div>

        <div style={{ fontSize: '0.82rem', padding: '0.35rem 0.75rem', borderRadius: '9999px', background: completedMandatoryCount === mandatoryCount ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)', color: completedMandatoryCount === mandatoryCount ? '#10b981' : '#f59e0b', fontWeight: 700 }}>
          {completedMandatoryCount}/{mandatoryCount} Mandatory Documents Ready
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {items.map((item) => {
          const isDone = Boolean(checkedItems[item.id]);
          return (
            <div
              key={item.id}
              onClick={() => toggleCheck(item.id)}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                padding: '0.75rem 1rem',
                borderRadius: '0.5rem',
                background: isDone ? 'rgba(16, 185, 129, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                border: `1px solid ${isDone ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-light, #334155)'}`,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <button
                type="button"
                aria-label={isDone ? `Mark ${item.name} as incomplete` : `Mark ${item.name} as complete`}
                style={{ background: 'transparent', border: 'none', color: isDone ? '#10b981' : 'var(--text-tertiary)', padding: 0, cursor: 'pointer', marginTop: '2px' }}
              >
                {isDone ? <CheckSquare size={18} /> : <Square size={18} />}
              </button>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <strong style={{ fontSize: '0.88rem', color: isDone ? '#10b981' : 'var(--text-primary)', textDecoration: isDone ? 'line-through' : 'none' }}>
                    {item.name}
                  </strong>
                  {item.mandatory ? (
                    <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', fontWeight: 700 }}>
                      MANDATORY
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'rgba(148, 163, 184, 0.15)', color: 'var(--text-tertiary)' }}>
                      SUPPORTING
                    </span>
                  )}
                </div>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  {item.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {completedMandatoryCount < mandatoryCount && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '1rem', fontSize: '0.75rem', color: '#f59e0b' }}>
          <AlertCircle size={14} />
          <span>Keep physical self-attested photocopies ready for filing in triplicate before the SDM reader.</span>
        </div>
      )}
    </div>
  );
};

export default EvidenceChecklistDrawer;
