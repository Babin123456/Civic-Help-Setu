import { useState, useMemo } from 'react';
import {
  PackageX,
} from 'lucide-react';
import {
  reconcileGoodsSeizure,
} from '../../services/streetVendorService.js';

export default function SeizureReconcilerCard({ onSeizureAuditChange }) {
  const [inventoryMemoIssued, setInventoryMemoIssued] = useState(false);
  const [perishableStockValueInr, setPerishableStockValueInr] = useState(3500);
  const [nonPerishableStockValueInr, setNonPerishableStockValueInr] = useState(4500);
  const [cartEquipmentValueInr, setCartEquipmentValueInr] = useState(12000);
  const [seizureHoldingDays, setSeizureHoldingDays] = useState(4);
  const [fineDemandedInr, setFineDemandedInr] = useState(4000);

  const seizureAnalysis = useMemo(() => {
    return reconcileGoodsSeizure({
      inventoryMemoIssued,
      perishableStockValueInr: Number(perishableStockValueInr) || 0,
      nonPerishableStockValueInr: Number(nonPerishableStockValueInr) || 0,
      cartEquipmentValueInr: Number(cartEquipmentValueInr) || 0,
      seizureHoldingDays: Number(seizureHoldingDays) || 0,
      fineDemandedInr: Number(fineDemandedInr) || 0,
    });
  }, [
    inventoryMemoIssued,
    perishableStockValueInr,
    nonPerishableStockValueInr,
    cartEquipmentValueInr,
    seizureHoldingDays,
    fineDemandedInr,
  ]);

  useMemo(() => {
    if (onSeizureAuditChange) {
      onSeizureAuditChange(seizureAnalysis);
    }
  }, [seizureAnalysis, onSeizureAuditChange]);

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
        <PackageX style={{ width: 28, height: 28, color: '#f87171' }} />
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary, #f8fafc)' }}>
            Section 19 Goods Confiscation &amp; Seizure Memo Reconciler
          </h2>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #94a3b8)' }}>
            Audits mandatory inventory receipts, 2-day perishable release limits &amp; holding fee caps
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
            Perishable Stock Value (INR)
          </label>
          <input
            type="number"
            min="0"
            step="500"
            value={perishableStockValueInr}
            onChange={(e) => setPerishableStockValueInr(e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem',
              borderRadius: '0.5rem',
              background: 'var(--bg-dark, #0f172a)',
              color: 'var(--text-primary, #f8fafc)',
              border: '1px solid var(--border-light, #334155)',
            }}
          />
          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Fruits, vegetables, prepared snacks</span>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)', marginBottom: '0.35rem' }}>
            Non-Perishable Stock Value (INR)
          </label>
          <input
            type="number"
            min="0"
            step="500"
            value={nonPerishableStockValueInr}
            onChange={(e) => setNonPerishableStockValueInr(e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem',
              borderRadius: '0.5rem',
              background: 'var(--bg-dark, #0f172a)',
              color: 'var(--text-primary, #f8fafc)',
              border: '1px solid var(--border-light, #334155)',
            }}
          />
          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Utensils, dry goods, electronics</span>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)', marginBottom: '0.35rem' }}>
            Push Cart / Counter Asset Value (INR)
          </label>
          <input
            type="number"
            min="0"
            step="1000"
            value={cartEquipmentValueInr}
            onChange={(e) => setCartEquipmentValueInr(e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem',
              borderRadius: '0.5rem',
              background: 'var(--bg-dark, #0f172a)',
              color: 'var(--text-primary, #f8fafc)',
              border: '1px solid var(--border-light, #334155)',
            }}
          />
          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Thela, stall structure, electronic scale</span>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)', marginBottom: '0.35rem' }}>
            Days Detained in Municipal Yard
          </label>
          <input
            type="number"
            min="0"
            value={seizureHoldingDays}
            onChange={(e) => setSeizureHoldingDays(e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem',
              borderRadius: '0.5rem',
              background: 'var(--bg-dark, #0f172a)',
              color: 'var(--text-primary, #f8fafc)',
              border: '1px solid var(--border-light, #334155)',
            }}
          />
          <span style={{ fontSize: '0.72rem', color: seizureHoldingDays > 2 ? '#f87171' : '#4ade80' }}>
            {seizureHoldingDays > 2 ? 'Exceeds 2-day perishable release limit' : 'Within statutory release window'}
          </span>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)', marginBottom: '0.35rem' }}>
            Challan / Penalty Demanded (INR)
          </label>
          <input
            type="number"
            min="0"
            step="500"
            value={fineDemandedInr}
            onChange={(e) => setFineDemandedInr(e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem',
              borderRadius: '0.5rem',
              background: 'var(--bg-dark, #0f172a)',
              color: 'var(--text-primary, #f8fafc)',
              border: '1px solid var(--border-light, #334155)',
            }}
          />
          <span style={{ fontSize: '0.72rem', color: '#f87171' }}>Statutory cap: ₹1,300 max holding fees</span>
        </div>
      </div>

      <div style={{ marginBottom: '1.25rem' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: 'var(--text-secondary, #94a3b8)', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={inventoryMemoIssued}
            onChange={(e) => setInventoryMemoIssued(e.target.checked)}
          />
          Official signed itemized inventory memo was issued at the time of seizure (Section 19(1) mandatory duty)
        </label>
      </div>

      {/* Financial Output Card */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          padding: '1.25rem',
          borderRadius: '0.75rem',
          background: seizureAnalysis.isIllegalSeizure ? 'rgba(239, 68, 68, 0.12)' : 'rgba(34, 197, 94, 0.12)',
          border: `1px solid ${seizureAnalysis.isIllegalSeizure ? 'rgba(239, 68, 68, 0.4)' : 'rgba(34, 197, 94, 0.4)'}`,
          marginBottom: '1rem',
        }}
      >
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)' }}>Total Confiscated Asset Value</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary, #f8fafc)' }}>
            ₹{seizureAnalysis.totalSeizedAssetValueInr.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Goods, stock and vending cart</div>
        </div>

        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)' }}>Perishable Stock Damages</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#f87171' }}>
            ₹{seizureAnalysis.perishableDamagesInr.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Spoiled due to detention &gt; 2 days</div>
        </div>

        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)' }}>Total Restitution Claimable</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: seizureAnalysis.totalRestitutionClaimInr > 0 ? '#4ade80' : 'var(--text-primary, #f8fafc)' }}>
            ₹{seizureAnalysis.totalRestitutionClaimInr.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Claimable under Section 20</div>
        </div>
      </div>

      {seizureAnalysis.violations.length > 0 && (
        <div>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f87171', marginBottom: '0.4rem', display: 'block' }}>
            Procedural Defects in Confiscation:
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {seizureAnalysis.violations.map((v, i) => (
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
                <strong style={{ color: '#f87171' }}>{v.rule}:</strong> {v.issue}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
