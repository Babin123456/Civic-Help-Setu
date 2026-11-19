/**
 * src/components/pedestrianBarriers/AccessibleRouteTable.jsx
 * Screen-reader friendly semantic table alternative for route steps and barrier records.
 * Complies with WCAG 2.1 AA non-visual requirements (#757).
 */

import { useState } from 'react';
import {
  Table,
  CheckCircle,
  AlertTriangle,
  XCircle,
} from 'lucide-react';
import {
  BARRIER_TYPES,
  BARRIER_SEVERITIES,
  BARRIER_STATUSES,
  SURFACE_TYPES,
} from '../../data/pedestrianBarrierContract.js';

export default function AccessibleRouteTable({
  routeResult,
  observations = [],
  onSelectObservation,
}) {
  const [activeTab, setActiveTab] = useState('route'); // 'route' | 'barriers'
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filteredObservations = observations.filter((o) => {
    const matchesSearch =
      o.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.ward.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (statusId) => {
    const s = BARRIER_STATUSES[statusId] || { label: statusId, badgeClass: 'badge-secondary' };
    return <span className={`badge ${s.badgeClass}`}>{s.label}</span>;
  };

  const getSeverityBadge = (sevId) => {
    const s = BARRIER_SEVERITIES[sevId] || { label: sevId, badgeClass: 'badge-secondary' };
    return <span className={`badge ${s.badgeClass}`}>{s.label}</span>;
  };

  return (
    <div
      className="card"
      style={{
        padding: '1.25rem',
        borderRadius: '0.75rem',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-light)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Table size={20} style={{ color: 'var(--primary)' }} aria-hidden="true" />
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            Accessible Data Tables (Screen Reader Alternative)
          </h2>
        </div>

        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'route' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('route')}
          >
            Turn-by-Turn Route ({routeResult?.segments?.length || 0})
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'barriers' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('barriers')}
          >
            Barrier Directory ({observations.length})
          </button>
        </div>
      </div>

      {activeTab === 'route' && (
        <div>
          {!routeResult || !routeResult.segments || routeResult.segments.length === 0 ? (
            <div
              style={{
                padding: '2rem',
                textAlign: 'center',
                background: 'var(--bg-secondary, rgba(0,0,0,0.02))',
                borderRadius: '0.5rem',
                border: '1px dashed var(--border-light)',
              }}
            >
              <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.9rem' }}>
                No active route calculated yet. Select an origin and destination in the Route Planner above and click
                "Calculate Accessible Route" to view the tabular turn-by-turn guidance.
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  textAlign: 'left',
                  fontSize: '0.84rem',
                }}
              >
                <caption style={{ textAlign: 'left', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  Sequential Walkway Segments for Calculated Accessible Route ({routeResult.totalDistanceMeters}m total distance)
                </caption>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-light)', background: 'var(--bg-secondary, rgba(0,0,0,0.04))' }}>
                    <th scope="col" style={{ padding: '0.6rem 0.5rem' }}>Step</th>
                    <th scope="col" style={{ padding: '0.6rem 0.5rem' }}>Corridor / Street</th>
                    <th scope="col" style={{ padding: '0.6rem 0.5rem' }}>Distance</th>
                    <th scope="col" style={{ padding: '0.6rem 0.5rem' }}>Width &amp; Slope</th>
                    <th scope="col" style={{ padding: '0.6rem 0.5rem' }}>Curb Ramps</th>
                    <th scope="col" style={{ padding: '0.6rem 0.5rem' }}>Tactile Guidance</th>
                    <th scope="col" style={{ padding: '0.6rem 0.5rem' }}>Surface</th>
                    <th scope="col" style={{ padding: '0.6rem 0.5rem' }}>Inspection Status</th>
                  </tr>
                </thead>
                <tbody>
                  {routeResult.segments.map((seg, idx) => (
                    <tr
                      key={seg.id}
                      style={{
                        borderBottom: '1px solid var(--border-light)',
                        background: idx % 2 === 0 ? 'transparent' : 'var(--bg-secondary, rgba(0,0,0,0.015))',
                      }}
                    >
                      <td style={{ padding: '0.65rem 0.5rem', fontWeight: 700 }}>{idx + 1}</td>
                      <td style={{ padding: '0.65rem 0.5rem' }}>
                        <strong>{seg.corridorName}</strong>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>{seg.ward}</div>
                      </td>
                      <td style={{ padding: '0.65rem 0.5rem' }}>{seg.lengthMeters} m</td>
                      <td style={{ padding: '0.65rem 0.5rem' }}>
                        <div>{seg.widthMeters} m wide</div>
                        <div style={{ fontSize: '0.74rem', color: seg.gradientPct > 8 ? 'var(--danger, #ef4444)' : 'var(--text-secondary)' }}>
                          {seg.gradientPct}% slope {seg.hasStairsOrSteps ? '(Has Steps)' : ''}
                        </div>
                      </td>
                      <td style={{ padding: '0.65rem 0.5rem' }}>
                        {seg.curbRampStatus === 'present_compliant' ? (
                          <span style={{ color: 'var(--success, #10b981)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            <CheckCircle size={13} aria-hidden="true" /> Compliant
                          </span>
                        ) : seg.curbRampStatus === 'present_steep_or_damaged' ? (
                          <span style={{ color: 'var(--warning, #f59e0b)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            <AlertTriangle size={13} aria-hidden="true" /> Steep Lip
                          </span>
                        ) : (
                          <span style={{ color: 'var(--danger, #ef4444)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            <XCircle size={13} aria-hidden="true" /> Missing Curb Cut
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '0.65rem 0.5rem' }}>
                        {seg.tactilePaving === 'continuous' ? 'Continuous Tiles' : seg.tactilePaving === 'interrupted' ? 'Interrupted Tiles' : 'None'}
                      </td>
                      <td style={{ padding: '0.65rem 0.5rem' }}>
                        {SURFACE_TYPES[seg.surfaceType]?.label || seg.surfaceType}
                      </td>
                      <td style={{ padding: '0.65rem 0.5rem' }}>
                        {seg.verificationStatus === 'verified' ? (
                          <span className="badge badge-success" style={{ fontSize: '0.74rem' }}>Verified Audit</span>
                        ) : (
                          <span className="badge badge-warning" style={{ fontSize: '0.74rem' }}>Provisional</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'barriers' && (
        <div>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.85rem', flexWrap: 'wrap' }}>
            <div style={{ flex: '1', minWidth: '220px', position: 'relative' }}>
              <input
                type="text"
                placeholder="Filter by description, ID, or ward..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.45rem 0.75rem',
                  borderRadius: '0.5rem',
                  background: 'var(--bg-input, var(--bg-card))',
                  border: '1px solid var(--border-light)',
                  color: 'var(--text-primary)',
                  fontSize: '0.84rem',
                }}
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: '0.45rem 0.75rem',
                borderRadius: '0.5rem',
                background: 'var(--bg-input, var(--bg-card))',
                border: '1px solid var(--border-light)',
                color: 'var(--text-primary)',
                fontSize: '0.84rem',
              }}
            >
              <option value="all">All Statuses</option>
              <option value="reported">Reported</option>
              <option value="under_review">Under Review</option>
              <option value="verified">Verified Defect</option>
              <option value="resolved">Resolved / Cleared</option>
            </select>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                textAlign: 'left',
                fontSize: '0.84rem',
              }}
            >
              <caption style={{ textAlign: 'left', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                Municipal Pedestrian Infrastructure Barrier Register ({filteredObservations.length} items listed)
              </caption>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-light)', background: 'var(--bg-secondary, rgba(0,0,0,0.04))' }}>
                  <th scope="col" style={{ padding: '0.6rem 0.5rem' }}>ID</th>
                  <th scope="col" style={{ padding: '0.6rem 0.5rem' }}>Barrier Type</th>
                  <th scope="col" style={{ padding: '0.6rem 0.5rem' }}>Severity</th>
                  <th scope="col" style={{ padding: '0.6rem 0.5rem' }}>Ward &amp; Corridor</th>
                  <th scope="col" style={{ padding: '0.6rem 0.5rem' }}>Description</th>
                  <th scope="col" style={{ padding: '0.6rem 0.5rem' }}>Status</th>
                  <th scope="col" style={{ padding: '0.6rem 0.5rem' }}>Reported Date</th>
                  <th scope="col" style={{ padding: '0.6rem 0.5rem' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredObservations.map((obs) => (
                  <tr
                    key={obs.id}
                    style={{ borderBottom: '1px solid var(--border-light)' }}
                  >
                    <td style={{ padding: '0.65rem 0.5rem', fontWeight: 600, fontFamily: 'monospace' }}>
                      {obs.id}
                    </td>
                    <td style={{ padding: '0.65rem 0.5rem' }}>
                      {BARRIER_TYPES[obs.barrierType]?.label || obs.barrierType}
                    </td>
                    <td style={{ padding: '0.65rem 0.5rem' }}>
                      {getSeverityBadge(obs.severity)}
                    </td>
                    <td style={{ padding: '0.65rem 0.5rem' }}>
                      <div>{obs.ward}</div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                        {obs.segmentId}
                      </div>
                    </td>
                    <td style={{ padding: '0.65rem 0.5rem', maxWidth: '280px' }}>
                      {obs.description}
                    </td>
                    <td style={{ padding: '0.65rem 0.5rem' }}>
                      {getStatusBadge(obs.status)}
                    </td>
                    <td style={{ padding: '0.65rem 0.5rem', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                      {new Date(obs.reportedAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '0.65rem 0.5rem' }}>
                      {onSelectObservation && (
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost"
                          onClick={() => onSelectObservation(obs)}
                          style={{ fontSize: '0.75rem', padding: '0.2rem 0.45rem' }}
                        >
                          View Details
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
