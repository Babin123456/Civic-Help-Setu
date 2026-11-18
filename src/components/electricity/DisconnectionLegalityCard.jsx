import { useState, useMemo } from 'react';
import {
  PowerOff,
  AlertOctagon,
  CheckCircle2,
} from 'lucide-react';
import {
  auditDisconnectionLegality,
} from '../../services/electricityConsumerService.js';

export default function DisconnectionLegalityCard({ onDisconnectionAuditChange }) {
  const [noticeDaysGiven, setNoticeDaysGiven] = useState(3);
  const [writtenNoticeServed, setWrittenNoticeServed] = useState(true);
  const [disconnectedAfterOnePm, setDisconnectedAfterOnePm] = useState(true);
  const [disconnectedOnFridayOrHoliday, setDisconnectedOnFridayOrHoliday] = useState(true);
  const [hasDisputedProvisionalBill, setHasDisputedProvisionalBill] = useState(true);
  const [depositedProtestAmount, setDepositedProtestAmount] = useState(true);

  const disconnectionAnalysis = useMemo(() => {
    return auditDisconnectionLegality({
      noticeDaysGiven: Number(noticeDaysGiven) || 0,
      writtenNoticeServed,
      disconnectedAfterOnePm,
      disconnectedOnFridayOrHoliday,
      hasDisputedProvisionalBill,
      depositedProtestAmount,
    });
  }, [
    noticeDaysGiven,
    writtenNoticeServed,
    disconnectedAfterOnePm,
    disconnectedOnFridayOrHoliday,
    hasDisputedProvisionalBill,
    depositedProtestAmount,
  ]);

  useMemo(() => {
    if (onDisconnectionAuditChange) {
      onDisconnectionAuditChange(disconnectionAnalysis);
    }
  }, [disconnectionAnalysis, onDisconnectionAuditChange]);

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
        <PowerOff style={{ width: 28, height: 28, color: '#f87171' }} />
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary, #f8fafc)' }}>
            Section 56(1) Disconnection Legality &amp; Due Process Auditor
          </h2>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #94a3b8)' }}>
            Evaluates mandatory 15-day notice, after-hours bans, and Section 56(1) disputed bill protections
          </span>
        </div>
      </div>

      {/* Inputs */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1rem',
          marginBottom: '1.25rem',
        }}
      >
        <div>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)', marginBottom: '0.35rem' }}>
            Notice Period Days Provided by DISCOM
          </label>
          <input
            type="number"
            min="0"
            max="60"
            value={noticeDaysGiven}
            onChange={(e) => setNoticeDaysGiven(e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem',
              borderRadius: '0.5rem',
              background: 'var(--bg-dark, #0f172a)',
              color: 'var(--text-primary, #f8fafc)',
              border: '1px solid var(--border-light, #334155)',
            }}
          />
          <span style={{ fontSize: '0.72rem', color: noticeDaysGiven >= 15 ? '#4ade80' : '#f87171' }}>
            {noticeDaysGiven >= 15 ? 'Complies with 15 clear days' : 'Non-compliant: Minimum 15 clear days mandatory'}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', justifyContent: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: 'var(--text-secondary, #94a3b8)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={writtenNoticeServed}
              onChange={(e) => setWrittenNoticeServed(e.target.checked)}
            />
            Formal written notice delivered (verbal/SMS invalid under Sec 56)
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: 'var(--text-secondary, #94a3b8)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={disconnectedAfterOnePm}
              onChange={(e) => setDisconnectedAfterOnePm(e.target.checked)}
            />
            Supply disconnected after 1:00 PM (prohibited by Supply Code)
          </label>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', justifyContent: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: 'var(--text-secondary, #94a3b8)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={disconnectedOnFridayOrHoliday}
              onChange={(e) => setDisconnectedOnFridayOrHoliday(e.target.checked)}
            />
            Disconnected on Friday, weekend, or declared public holiday
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: 'var(--text-secondary, #94a3b8)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={hasDisputedProvisionalBill}
              onChange={(e) => setHasDisputedProvisionalBill(e.target.checked)}
            />
            Formally disputed provisional bill under Section 56(1) proviso
          </label>

          {hasDisputedProvisionalBill && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: 'var(--text-secondary, #94a3b8)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={depositedProtestAmount}
                onChange={(e) => setDepositedProtestAmount(e.target.checked)}
              />
              Deposited 50% / 6-month average under protest (statutory bar on disconnection)
            </label>
          )}
        </div>
      </div>

      {/* Outcome Banner */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          padding: '1.25rem',
          borderRadius: '0.75rem',
          background: disconnectionAnalysis.isIllegalDisconnection ? 'rgba(239, 68, 68, 0.12)' : 'rgba(34, 197, 94, 0.12)',
          border: `1px solid ${disconnectionAnalysis.isIllegalDisconnection ? 'rgba(239, 68, 68, 0.4)' : 'rgba(34, 197, 94, 0.4)'}`,
          marginBottom: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {disconnectionAnalysis.isIllegalDisconnection ? (
            <AlertOctagon style={{ width: 32, height: 32, color: '#f87171' }} />
          ) : (
            <CheckCircle2 style={{ width: 32, height: 32, color: '#4ade80' }} />
          )}
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: disconnectionAnalysis.isIllegalDisconnection ? '#f87171' : '#4ade80' }}>
              {disconnectionAnalysis.isIllegalDisconnection ? 'ILLEGAL DISCONNECTION / SECTION 56(1) BREACH' : 'PROCEDURAL DUE PROCESS COMPLIED'}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #94a3b8)' }}>
              {disconnectionAnalysis.remedy}
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)' }}>Statutory Severity</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: disconnectionAnalysis.isIllegalDisconnection ? '#f87171' : '#4ade80' }}>
            {disconnectionAnalysis.severity}
          </div>
        </div>
      </div>

      {disconnectionAnalysis.violations.length > 0 && (
        <div>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f87171', marginBottom: '0.4rem', display: 'block' }}>
            Violated Legal Safeguards:
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {disconnectionAnalysis.violations.map((v, i) => (
              <div
                key={i}
                style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: '0.4rem',
                  background: 'rgba(0,0,0,0.2)',
                  border: '1px solid var(--border-light, #334155)',
                  fontSize: '0.8rem',
                }}
              >
                <strong style={{ color: 'var(--text-primary, #f8fafc)' }}>{v.provision}:</strong> {v.name}
                <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary, #94a3b8)', marginTop: '0.15rem' }}>
                  {v.impact}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
