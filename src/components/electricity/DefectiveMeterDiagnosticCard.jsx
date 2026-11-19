import { useState, useMemo } from 'react';
import {
  Activity,
} from 'lucide-react';
import {
  diagnoseDefectiveMeterAndBilling,
} from '../../services/electricityConsumerService.js';

export default function DefectiveMeterDiagnosticCard({ onMeterAuditChange }) {
  const [historicalAverageUnits, setHistoricalAverageUnits] = useState(180);
  const [disputedBillUnits, setDisputedBillUnits] = useState(650);
  const [unitTariffInr, setUnitTariffInr] = useState(8.5);
  const [meterTestBenchRequested, setMeterTestBenchRequested] = useState(true);
  const [meterTestErrorPercentage, setMeterTestErrorPercentage] = useState(12);

  const meterAnalysis = useMemo(() => {
    return diagnoseDefectiveMeterAndBilling({
      historicalAverageUnits: Number(historicalAverageUnits) || 1,
      disputedBillUnits: Number(disputedBillUnits) || 0,
      unitTariffInr: Number(unitTariffInr) || 8.5,
      meterTestBenchRequested,
      meterTestErrorPercentage: Number(meterTestErrorPercentage) || 0,
    });
  }, [
    historicalAverageUnits,
    disputedBillUnits,
    unitTariffInr,
    meterTestBenchRequested,
    meterTestErrorPercentage,
  ]);

  useMemo(() => {
    if (onMeterAuditChange) {
      onMeterAuditChange(meterAnalysis);
    }
  }, [meterAnalysis, onMeterAuditChange]);

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
        <Activity style={{ width: 28, height: 28, color: '#38bdf8' }} />
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary, #f8fafc)' }}>
            Fast / Defective Meter Diagnostic &amp; Billing Adjustment Engine
          </h2>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #94a3b8)' }}>
            Reconciles erratic kWh consumption spikes under CEA Metering Regulations and Rule 7
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
            Historical 6-Month Monthly Average (kWh Units)
          </label>
          <input
            type="number"
            min="10"
            value={historicalAverageUnits}
            onChange={(e) => setHistoricalAverageUnits(e.target.value)}
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
            Baseline typical consumption
          </span>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)', marginBottom: '0.35rem' }}>
            Disputed Billing Cycle Units (kWh)
          </label>
          <input
            type="number"
            min="0"
            value={disputedBillUnits}
            onChange={(e) => setDisputedBillUnits(e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem',
              borderRadius: '0.5rem',
              background: 'var(--bg-dark, #0f172a)',
              color: 'var(--text-primary, #f8fafc)',
              border: '1px solid var(--border-light, #334155)',
            }}
          />
          <span style={{ fontSize: '0.72rem', color: meterAnalysis.isErraticSpike ? '#f87171' : '#4ade80' }}>
            {meterAnalysis.unitSpikeRatio}x surge over baseline
          </span>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)', marginBottom: '0.35rem' }}>
            Average Energy Tariff (₹ / Unit)
          </label>
          <input
            type="number"
            min="1"
            step="0.5"
            value={unitTariffInr}
            onChange={(e) => setUnitTariffInr(e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem',
              borderRadius: '0.5rem',
              background: 'var(--bg-dark, #0f172a)',
              color: 'var(--text-primary, #f8fafc)',
              border: '1px solid var(--border-light, #334155)',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)', marginBottom: '0.35rem' }}>
            NABL Lab Meter Test Bench Error (%)
          </label>
          <input
            type="number"
            min="0"
            max="100"
            step="1"
            value={meterTestErrorPercentage}
            onChange={(e) => setMeterTestErrorPercentage(e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem',
              borderRadius: '0.5rem',
              background: 'var(--bg-dark, #0f172a)',
              color: 'var(--text-primary, #f8fafc)',
              border: '1px solid var(--border-light, #334155)',
            }}
          />
          <span style={{ fontSize: '0.72rem', color: meterAnalysis.isMeterFast ? '#f87171' : '#94a3b8' }}>
            {meterAnalysis.isMeterFast ? 'Permissible error ±2% exceeded: Meter is FAST' : 'Permissible tolerance within ±2%'}
          </span>
        </div>
      </div>

      <div style={{ marginBottom: '1.25rem' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: 'var(--text-secondary, #94a3b8)', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={meterTestBenchRequested}
            onChange={(e) => setMeterTestBenchRequested(e.target.checked)}
          />
          Formally exercised statutory right to NABL laboratory test bench / check meter under Rule 7(3)
        </label>
      </div>

      {/* Outcome Card */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          padding: '1.25rem',
          borderRadius: '0.75rem',
          background: meterAnalysis.isErraticSpike || meterAnalysis.isMeterFast ? 'rgba(239, 68, 68, 0.12)' : 'rgba(34, 197, 94, 0.12)',
          border: `1px solid ${meterAnalysis.isErraticSpike || meterAnalysis.isMeterFast ? 'rgba(239, 68, 68, 0.4)' : 'rgba(34, 197, 94, 0.4)'}`,
          marginBottom: '1rem',
        }}
      >
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)' }}>Consumption Anomaly Ratio</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: meterAnalysis.isErraticSpike ? '#f87171' : '#4ade80' }}>
            {meterAnalysis.unitSpikeRatio}x
          </div>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{meterAnalysis.isErraticSpike ? 'Erratic Spike Detected' : 'Normal Variance'}</div>
        </div>

        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)' }}>Disputed Excess Units</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#facc15' }}>
            {meterAnalysis.excessUnits} kWh
          </div>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Attributable to meter defect</div>
        </div>

        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)' }}>Estimated Billing Refund</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: meterAnalysis.estimatedRefundInr > 0 ? '#4ade80' : 'var(--text-primary, #f8fafc)' }}>
            ₹{meterAnalysis.estimatedRefundInr.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Adjustable in next billing cycle</div>
        </div>
      </div>

      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #94a3b8)', lineHeight: 1.5 }}>
        <strong>Statutory Recourse:</strong> {meterAnalysis.recommendation}
      </div>
    </div>
  );
}
