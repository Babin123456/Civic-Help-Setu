import {
  MapPin,
  Clock,
  Layers,
  Wrench,
  ChevronRight,
  Info,
} from 'lucide-react';
import {
  StreetlightStatusBadge,
  StreetlightPriorityBadge,
  StreetlightEmptyState,
} from './StreetlightStates';
import { canStreetlight } from '../../services/streetlightAccessControl';

export default function StreetlightClusterList({
  clusters = [],
  onSelectCluster,
  onDispatchWorkOrder,
  activeActor,
}) {
  if (!clusters || clusters.length === 0) {
    return <StreetlightEmptyState />;
  }

  const canCreateWorkOrder = canStreetlight('workOrder.create', activeActor);

  return (
    <div
      className="streetlight-cluster-list"
      style={{ display: 'grid', gap: '1rem', width: '100%' }}
      role="region"
      aria-label="Streetlight Outage Clusters"
    >
      {clusters.map((cluster) => {
        const topFactor = cluster.explainability?.factors?.[0];
        const isResolved = cluster.status === 'resolved';

        return (
          <article
            key={cluster.id}
            className="card"
            style={{
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem',
              transition: 'border-color 0.2s ease',
              borderLeft: `4px solid ${
                cluster.priorityTier === 'critical'
                  ? '#dc2626'
                  : cluster.priorityTier === 'high'
                  ? '#ea580c'
                  : '#ca8a04'
              }`,
            }}
          >
            {/* Header row */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.5rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    color: 'var(--text-secondary)',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-main)',
                    padding: '0.15rem 0.45rem',
                    borderRadius: '4px',
                  }}
                >
                  {cluster.id}
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  {cluster.jurisdictionId}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <StreetlightPriorityBadge tier={cluster.priorityTier} score={cluster.priorityScore} />
                <StreetlightStatusBadge status={cluster.status} type="cluster" />
              </div>
            </div>

            {/* Corridor Title & Counts */}
            <div>
              <h2
                style={{
                  fontSize: '1.05rem',
                  fontWeight: 700,
                  margin: '0 0 0.35rem',
                  color: 'var(--text-primary)',
                }}
              >
                {cluster.corridorName}
              </h2>

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: '1.25rem',
                  fontSize: '0.825rem',
                  color: 'var(--text-secondary)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Layers size={14} aria-hidden="true" />
                  <span>
                    <strong>{cluster.poleCount || cluster.assetIds?.length || 1}</strong> Streetlight Poles
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <MapPin size={14} aria-hidden="true" />
                  <span>
                    Centroid: {cluster.centroid ? `${cluster.centroid.lat}, ${cluster.centroid.lng}` : 'Ward Center'}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Clock size={14} aria-hidden="true" />
                  <span>
                    Reported: {cluster.createdAt ? new Date(cluster.createdAt).toLocaleDateString() : 'Active'}
                  </span>
                </div>
              </div>
            </div>

            {/* Explainability Snippet Callout */}
            {topFactor && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '0.5rem',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-main)',
                  fontSize: '0.8rem',
                  color: 'var(--text-secondary)',
                }}
              >
                <Info size={14} style={{ color: 'var(--accent-main)', flexShrink: 0 }} aria-hidden="true" />
                <span>
                  <strong style={{ color: 'var(--text-primary)' }}>Prioritization Factor:</strong> {topFactor.impact} (+{topFactor.points} pts)
                </span>
              </div>
            )}

            {/* Action Bar */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '0.6rem',
                borderTop: '1px solid var(--border-main)',
                paddingTop: '0.75rem',
              }}
            >
              <button
                type="button"
                onClick={() => onSelectCluster(cluster.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  padding: '0.4rem 0.75rem',
                  borderRadius: '0.375rem',
                  border: '1px solid var(--border-main)',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                }}
              >
                View Triage & Explainability
                <ChevronRight size={14} aria-hidden="true" />
              </button>

              {canCreateWorkOrder && !isResolved && cluster.status !== 'work_order_created' && cluster.status !== 'in_progress' && (
                <button
                  type="button"
                  onClick={() => onDispatchWorkOrder(cluster)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    padding: '0.4rem 0.85rem',
                    borderRadius: '0.375rem',
                    background: '#2563eb',
                    border: '1px solid #3b82f6',
                    color: '#ffffff',
                    cursor: 'pointer',
                  }}
                >
                  <Wrench size={14} aria-hidden="true" />
                  Dispatch Repair Work Order
                </button>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
