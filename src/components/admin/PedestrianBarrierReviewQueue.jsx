/**
 * src/components/admin/PedestrianBarrierReviewQueue.jsx
 * Admin moderation and inspection queue for public pedestrian route barriers (#757).
 */

import { useState, useEffect } from 'react';
import {
  Navigation,
  CheckCircle2,
  XCircle,
  ShieldCheck,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import {
  BARRIER_TYPES,
  BARRIER_SEVERITIES,
  BARRIER_STATUSES,
} from '../../data/pedestrianBarrierContract.js';
import { pedestrianBarrierService } from '../../services/pedestrianBarrierService.js';

export default function PedestrianBarrierReviewQueue() {
  const { toast } = useToast();
  const [items, setItems] = useState(() => {
    try {
      return pedestrianBarrierService.getObservations();
    } catch {
      return [
        {
          id: 'BAR-101',
          segmentId: 'SEG-102-103',
          corridorName: 'Outer Ring Road Connector Footpath',
          barrierType: 'damaged_footpath',
          severity: 'high_barrier',
          ward: 'Ward 150 - Bellandur',
          description: 'Broken concrete paver slabs creating 18cm drop and exposed rebar mesh for 20 meters.',
          reportedAt: '2026-11-03T11:20:00.000Z',
          status: 'reported',
          seal: 'SEAL-BARRIER-A19F-44C2',
          reportedBy: 'Citizen Volunteer (Ward 150)',
        },
        {
          id: 'BAR-102',
          segmentId: 'SEG-101-104',
          corridorName: 'Kaikondrahalli Lake Trail Connection',
          barrierType: 'missing_curb_ramp',
          severity: 'impassable',
          ward: 'Ward 150 - Bellandur',
          description: 'Abrupt 25cm kerb step without ramp transition connecting to dirt walking track.',
          reportedAt: '2026-10-21T09:15:00.000Z',
          status: 'reported',
          seal: 'SEAL-BARRIER-E420-91B8',
          reportedBy: 'Pedestrian Safety Advocate',
        },
      ];
    }
  });

  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    fetch('/api/pedestrian-barriers?action=list')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.observations) && data.observations.length > 0) {
          setItems((prev) => {
            const existingIds = new Set(prev.map((i) => i.id));
            const newItems = data.observations.filter((i) => !existingIds.has(i.id));
            return [...newItems, ...prev];
          });
        }
      })
      .catch(() => {
        // Fallback to service layer
      });
  }, []);

  const handleAction = async (id, action) => {
    try {
      if (action === 'verify') {
        pedestrianBarrierService.verifyBarrierObservation(
          id,
          { action: 'verify', reasonCode: 'statutory_inspection_passed', reviewerNotes: 'Verified via Admin Panel.' },
          { id: 'ADMIN-CONSOLE', role: 'admin' }
        );
        toast.success?.(`Observation ${id} officially verified.`);
      } else if (action === 'reject') {
        pedestrianBarrierService.verifyBarrierObservation(
          id,
          { action: 'reject', reasonCode: 'inaccurate_location', reviewerNotes: 'Dismissed via Admin Panel.' },
          { id: 'ADMIN-CONSOLE', role: 'admin' }
        );
        toast.info?.(`Observation ${id} dismissed.`);
      } else if (action === 'resolve') {
        pedestrianBarrierService.resolveBarrierObservation(
          id,
          { reasonCode: 'defect_rectified', reviewerNotes: 'Cleared via Admin Panel.' },
          { id: 'ADMIN-CONSOLE', role: 'admin' }
        );
        toast.success?.(`Observation ${id} marked as rectified and resolved.`);
      }

      setItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                status: action === 'verify' ? 'verified' : action === 'reject' ? 'rejected' : 'resolved',
              }
            : item
        )
      );
    } catch (err) {
      toast.error?.(err.message || 'Action failed.');
    }
  };

  const pendingItems = items.filter((i) => i.status === 'reported' || i.status === 'under_review');
  const filtered = items.filter((i) => filterStatus === 'all' || i.status === filterStatus);

  return (
    <section
      role="region"
      aria-label="Pedestrian Barrier Moderation Queue"
      className="card"
      style={{
        padding: '1.25rem',
        borderRadius: '0.75rem',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-light)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
          marginBottom: '1rem',
          paddingBottom: '0.75rem',
          borderBottom: '1px solid var(--border-light)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Navigation size={22} style={{ color: 'var(--primary)' }} aria-hidden="true" />
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Accessible Pedestrian Route Barrier Moderation Queue
            </h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Validate citizen obstacle reports, curb ramp deficits, and ground defect resolutions.
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="badge badge-warning" style={{ fontSize: '0.76rem' }}>
            {pendingItems.length} Pending Review
          </span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{
              padding: '0.35rem 0.65rem',
              borderRadius: '0.35rem',
              fontSize: '0.8rem',
              background: 'var(--bg-input, var(--bg-card))',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-light)',
            }}
          >
            <option value="all">All Records</option>
            <option value="reported">Pending Reported</option>
            <option value="verified">Verified Official</option>
            <option value="resolved">Resolved &amp; Cleared</option>
            <option value="rejected">Dismissed</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          No barrier observations found matching the selected filter.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {filtered.map((item) => {
            const barrierMeta = BARRIER_TYPES[item.barrierType] || { label: item.barrierType };
            const severityMeta = BARRIER_SEVERITIES[item.severity] || { label: item.severity, badgeClass: 'badge-secondary' };
            const statusMeta = BARRIER_STATUSES[item.status] || { label: item.status, badgeClass: 'badge-secondary' };

            return (
              <div
                key={item.id}
                style={{
                  padding: '0.85rem 1rem',
                  borderRadius: '0.5rem',
                  background: 'var(--bg-secondary, rgba(0,0,0,0.02))',
                  border: '1px solid var(--border-light)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                }}
              >
                <div style={{ maxWidth: '600px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.3rem' }}>
                    <strong style={{ fontSize: '0.86rem', color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                      {item.id}
                    </strong>
                    <span className="badge badge-info" style={{ fontSize: '0.72rem' }}>
                      {barrierMeta.label}
                    </span>
                    <span className={`badge ${severityMeta.badgeClass}`} style={{ fontSize: '0.72rem' }}>
                      {severityMeta.label}
                    </span>
                    <span className={`badge ${statusMeta.badgeClass}`} style={{ fontSize: '0.72rem' }}>
                      {statusMeta.label}
                    </span>
                    {item.seal && (
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>
                        {item.seal}
                      </span>
                    )}
                  </div>

                  <p style={{ margin: '0 0 0.35rem 0', fontSize: '0.84rem', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                    {item.description}
                  </p>

                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    <span>Ward: <strong>{item.ward}</strong></span> | Corridor: <code>{item.segmentId}</code>
                    {item.reportedBy && <span> | Submitter: {item.reportedBy}</span>}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {(item.status === 'reported' || item.status === 'under_review') && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleAction(item.id, 'verify')}
                        className="btn btn-sm btn-primary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem' }}
                      >
                        <CheckCircle2 size={13} aria-hidden="true" />
                        Verify
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAction(item.id, 'reject')}
                        className="btn btn-sm btn-ghost"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', color: 'var(--danger, #ef4444)' }}
                      >
                        <XCircle size={13} aria-hidden="true" />
                        Dismiss
                      </button>
                    </>
                  )}

                  {item.status === 'verified' && (
                    <button
                      type="button"
                      onClick={() => handleAction(item.id, 'resolve')}
                      className="btn btn-sm btn-success"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem' }}
                    >
                      <ShieldCheck size={13} aria-hidden="true" />
                      Mark Rectified
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
