import { useState } from 'react';
import { Sliders, Sparkles, RefreshCw, CheckCircle2 } from 'lucide-react';

export default function ScenarioSelector({
  scenarios,
  selectedProfile,
  onSelectProfile,
  onUpdateCustomProfile,
  disabled = false,
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSeedRandomize = () => {
    const newSeed = Math.floor(Math.random() * 90000000) + 10000000;
    onUpdateCustomProfile({ ...selectedProfile, seed: newSeed });
  };

  return (
    <section aria-labelledby="scenario-selector-heading" style={{ marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <h2 id="scenario-selector-heading" style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>
          1. Select Testing Scenario Preset
        </h2>
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="btn btn-secondary"
          style={{ fontSize: '0.82rem', padding: '0.35rem 0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
          aria-expanded={showAdvanced}
        >
          <Sliders size={14} aria-hidden="true" />
          {showAdvanced ? 'Hide Advanced Config' : 'Customize Seed & Volume'}
        </button>
      </div>

      {/* Preset cards grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '0.85rem',
          marginBottom: '1rem',
        }}
        role="radiogroup"
        aria-label="Preset scenarios"
      >
        {scenarios.map((scen) => {
          const profileId = scen.profileId || scen.id;
          const isSelected = (selectedProfile?.profileId || selectedProfile?.id) === profileId;
          const name = scen.scenarioName || scen.title;
          return (
            <div
              key={profileId}
              role="radio"
              aria-checked={isSelected}
              tabIndex={0}
              onClick={() => !disabled && onSelectProfile(scen)}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  if (!disabled) onSelectProfile(scen);
                }
              }}
              style={{
                padding: '0.85rem',
                borderRadius: '0.65rem',
                border: isSelected ? '2px solid var(--primary, #2563eb)' : '1px solid var(--border-light, #e2e8f0)',
                background: isSelected ? 'rgba(37, 99, 235, 0.05)' : 'var(--bg-card, #ffffff)',
                cursor: disabled ? 'not-allowed' : 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'border-color 0.15s ease, transform 0.15s ease',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      padding: '0.15rem 0.45rem',
                      borderRadius: '4px',
                      background: 'var(--bg-secondary, #f1f5f9)',
                      color: 'var(--text-secondary, #475569)',
                    }}
                  >
                    {scen.badge || 'Preset'}
                  </span>
                  {isSelected && <CheckCircle2 size={16} color="var(--primary, #2563eb)" aria-hidden="true" />}
                </div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, margin: '0 0 0.35rem 0' }}>
                  {name}
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #64748b)', margin: 0, lineHeight: 1.35 }}>
                  {scen.description}
                </p>
              </div>

              <div style={{ marginTop: '0.65rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-light, #e2e8f0)', fontSize: '0.72rem', color: 'var(--text-tertiary, #94a3b8)', display: 'flex', justifyContent: 'space-between' }}>
                <span>Seed: {scen.seed}</span>
                <span>Apps: {scen.scaleConfig?.applicationsCount || 25}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Advanced parameter customization drawer */}
      {showAdvanced && (
        <div
          style={{
            padding: '1.1rem',
            borderRadius: '0.75rem',
            border: '1px solid var(--border-light, #cbd5e1)',
            background: 'var(--bg-card, #ffffff)',
            marginBottom: '1rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
            <h3 style={{ fontSize: '0.92rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Sparkles size={16} color="var(--primary, #2563eb)" aria-hidden="true" />
              Generator Seed & Distribution Tuning
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #64748b)' }}>
              Deterministic Mulberry32 PRNG
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            {/* Seed input */}
            <div>
              <label htmlFor="seed-input" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Deterministic Seed
              </label>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <input
                  id="seed-input"
                  type="number"
                  value={selectedProfile.seed}
                  disabled={disabled}
                  onChange={(e) =>
                    onUpdateCustomProfile({
                      ...selectedProfile,
                      seed: Math.abs(parseInt(e.target.value, 10)) || 1337,
                    })
                  }
                  style={{
                    flex: 1,
                    padding: '0.4rem 0.6rem',
                    borderRadius: '0.4rem',
                    border: '1px solid var(--border-light, #cbd5e1)',
                    fontSize: '0.85rem',
                    background: 'var(--bg-card, #ffffff)',
                    color: 'var(--text-primary, #0f172a)',
                  }}
                />
                <button
                  type="button"
                  onClick={handleSeedRandomize}
                  disabled={disabled}
                  aria-label="Generate random seed"
                  className="btn btn-secondary"
                  style={{ padding: '0.4rem 0.65rem' }}
                >
                  <RefreshCw size={14} aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Applications count */}
            <div>
              <label htmlFor="apps-count-input" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Applications Volume: {selectedProfile.scaleConfig?.applicationsCount || 25}
              </label>
              <input
                id="apps-count-input"
                type="range"
                min="5"
                max="150"
                step="5"
                value={selectedProfile.scaleConfig?.applicationsCount || 25}
                disabled={disabled}
                onChange={(e) =>
                  onUpdateCustomProfile({
                    ...selectedProfile,
                    scaleConfig: {
                      ...selectedProfile.scaleConfig,
                      applicationsCount: parseInt(e.target.value, 10),
                    },
                  })
                }
                style={{ width: '100%' }}
              />
            </div>

            {/* Grievances count */}
            <div>
              <label htmlFor="grievances-count-input" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Grievances Volume: {selectedProfile.scaleConfig?.grievancesCount || 10}
              </label>
              <input
                id="grievances-count-input"
                type="range"
                min="0"
                max="80"
                step="5"
                value={selectedProfile.scaleConfig?.grievancesCount || 10}
                disabled={disabled}
                onChange={(e) =>
                  onUpdateCustomProfile({
                    ...selectedProfile,
                    scaleConfig: {
                      ...selectedProfile.scaleConfig,
                      grievancesCount: parseInt(e.target.value, 10),
                    },
                  })
                }
                style={{ width: '100%' }}
              />
            </div>

            {/* Statutory Overdue Rate */}
            <div>
              <label htmlFor="overdue-rate-input" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Statutory Delay Breach Rate: {Math.round((selectedProfile.edgeCaseRates?.statutoryDeadlineOverduePct || 0.15) * 100)}%
              </label>
              <input
                id="overdue-rate-input"
                type="range"
                min="0"
                max="80"
                step="5"
                value={Math.round((selectedProfile.edgeCaseRates?.statutoryDeadlineOverduePct || 0.15) * 100)}
                disabled={disabled}
                onChange={(e) =>
                  onUpdateCustomProfile({
                    ...selectedProfile,
                    edgeCaseRates: {
                      ...selectedProfile.edgeCaseRates,
                      statutoryDeadlineOverduePct: parseInt(e.target.value, 10) / 100,
                    },
                  })
                }
                style={{ width: '100%' }}
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
