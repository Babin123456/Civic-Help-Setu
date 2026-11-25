import { useState, useMemo } from 'react';
import {
  Zap,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import {
  calculateSopCompensation,
} from '../../services/electricityConsumerService.js';

export default function DiscomSopCalculatorCard({ onSopChange }) {
  const [outageDurationHours, setOutageDurationHours] = useState(12);
  const [transformerFailureDays, setTransformerFailureDays] = useState(2);
  const [isRuralArea, setIsRuralArea] = useState(false);
  const [newConnectionDelayDays, setNewConnectionDelayDays] = useState(0);
  const [meterDelayDays, setMeterDelayDays] = useState(0);
  const [voltageDelayDays, setVoltageDelayDays] = useState(0);

  const sopAnalysis = useMemo(() => {
    return calculateSopCompensation({
      outageDurationHours: Number(outageDurationHours) || 0,
      transformerFailureDays: Number(transformerFailureDays) || 0,
      isRuralArea,
      newConnectionDelayDays: Number(newConnectionDelayDays) || 0,
      meterDelayDays: Number(meterDelayDays) || 0,
      voltageDelayDays: Number(voltageDelayDays) || 0,
    });
  }, [
    outageDurationHours,
    transformerFailureDays,
    isRuralArea,
    newConnectionDelayDays,
    meterDelayDays,
    voltageDelayDays,
  ]);

  useMemo(() => {
    if (onSopChange) {
      onSopChange(sopAnalysis);
    }
  }, [sopAnalysis, onSopChange]);

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
        <Zap style={{ width: 28, height: 28, color: '#facc15' }} />
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary, #f8fafc)' }}>
            Guaranteed Standard of Performance (SoP) Outage Compensation Calculator
          </h2>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #94a3b8)' }}>
            Rule 11 automatic compensation payable on electricity bills for service defaults
          </span>
        </div>
      </div>

      {/* Grid Inputs */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
          marginBottom: '1.25rem',
        }}
      >
        <div>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)', marginBottom: '0.35rem' }}>
            Unscheduled Outage Duration (Hours)
          </label>
          <input
            type="number"
            min="0"
            value={outageDurationHours}
            onChange={(e) => setOutageDurationHours(e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem',
              borderRadius: '0.5rem',
              background: 'var(--bg-dark, #0f172a)',
              color: 'var(--text-primary, #f8fafc)',
              border: '1px solid var(--border-light, #334155)',
            }}
          />
          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
            Permissible cap: 4h (₹10/hr beyond, min ₹100/day)
          </span>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)', marginBottom: '0.35rem' }}>
            Burnt Transformer Replacement Delay (Days)
          </label>
          <input
            type="number"
            min="0"
            value={transformerFailureDays}
            onChange={(e) => setTransformerFailureDays(e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem',
              borderRadius: '0.5rem',
              background: 'var(--bg-dark, #0f172a)',
              color: 'var(--text-primary, #f8fafc)',
              border: '1px solid var(--border-light, #334155)',
            }}
          />
          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
            Permissible: 24h Metro / 48h Rural (₹150/day)
          </span>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)', marginBottom: '0.35rem' }}>
            Jurisdiction Type
          </label>
          <select
            value={isRuralArea ? 'rural' : 'metro'}
            onChange={(e) => setIsRuralArea(e.target.value === 'rural')}
            style={{
              width: '100%',
              padding: '0.55rem',
              borderRadius: '0.5rem',
              background: 'var(--bg-dark, #0f172a)',
              color: 'var(--text-primary, #f8fafc)',
              border: '1px solid var(--border-light, #334155)',
            }}
          >
            <option value="metro">Urban / Metro Municipality</option>
            <option value="rural">Rural / Gram Panchayat</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)', marginBottom: '0.35rem' }}>
            New Power Connection Delay (Days)
          </label>
          <input
            type="number"
            min="0"
            value={newConnectionDelayDays}
            onChange={(e) => setNewConnectionDelayDays(e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem',
              borderRadius: '0.5rem',
              background: 'var(--bg-dark, #0f172a)',
              color: 'var(--text-primary, #f8fafc)',
              border: '1px solid var(--border-light, #334155)',
            }}
          />
          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
            ₹500 per week of delay (Rule 4)
          </span>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)', marginBottom: '0.35rem' }}>
            Defective Meter Replacement Delay (Days)
          </label>
          <input
            type="number"
            min="0"
            value={meterDelayDays}
            onChange={(e) => setMeterDelayDays(e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem',
              borderRadius: '0.5rem',
              background: 'var(--bg-dark, #0f172a)',
              color: 'var(--text-primary, #f8fafc)',
              border: '1px solid var(--border-light, #334155)',
            }}
          />
          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
            ₹50 per day of delay (Rule 7)
          </span>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)', marginBottom: '0.35rem' }}>
            Voltage Fluctuation Duration (Days)
          </label>
          <input
            type="number"
            min="0"
            value={voltageDelayDays}
            onChange={(e) => setVoltageDelayDays(e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem',
              borderRadius: '0.5rem',
              background: 'var(--bg-dark, #0f172a)',
              color: 'var(--text-primary, #f8fafc)',
              border: '1px solid var(--border-light, #334155)',
            }}
          />
          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
            ₹100 per day for unresolved dips (Rule 10)
          </span>
        </div>
      </div>

      {/* Compensation Summary Card */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          padding: '1.25rem',
          borderRadius: '0.75rem',
          background: sopAnalysis.hasClaim ? 'rgba(234, 179, 8, 0.12)' : 'rgba(34, 197, 94, 0.12)',
          border: `1px solid ${sopAnalysis.hasClaim ? 'rgba(234, 179, 8, 0.4)' : 'rgba(34, 197, 94, 0.4)'}`,
          marginBottom: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {sopAnalysis.hasClaim ? (
            <AlertTriangle style={{ width: 32, height: 32, color: '#facc15' }} />
          ) : (
            <CheckCircle2 style={{ width: 32, height: 32, color: '#4ade80' }} />
          )}
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: sopAnalysis.hasClaim ? '#facc15' : '#4ade80' }}>
              {sopAnalysis.hasClaim ? 'STATUTORY DELAY COMPENSATION CLAIMABLE' : 'SUPPLY WITHIN STATUTORY BENCHMARKS'}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #94a3b8)' }}>
              Mandatory credit to consumer electricity bill under Rule 11(3)
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)' }}>Total Compensation Credit</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: sopAnalysis.hasClaim ? '#facc15' : '#4ade80' }}>
            ₹{sopAnalysis.totalCompensationInr.toLocaleString('en-IN')}
          </div>
        </div>
      </div>

      {sopAnalysis.breakdown.length > 0 && (
        <div>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary, #f8fafc)', marginBottom: '0.4rem', display: 'block' }}>
            Statutory Breakdown of Default Penalties:
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {sopAnalysis.breakdown.map((item, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.6rem 0.8rem',
                  borderRadius: '0.5rem',
                  background: 'rgba(0,0,0,0.2)',
                  border: '1px solid var(--border-light, #334155)',
                  fontSize: '0.8rem',
                }}
              >
                <div>
                  <strong style={{ color: 'var(--text-primary, #f8fafc)' }}>{item.category}</strong>
                  <div style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: '0.74rem' }}>
                    {item.excessDuration} ({item.statutoryRate})
                  </div>
                </div>
                <div style={{ fontWeight: 700, color: '#facc15', fontSize: '0.9rem' }}>
                  ₹{item.payableInr.toLocaleString('en-IN')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
