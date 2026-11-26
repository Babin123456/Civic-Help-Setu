/**
 * src/components/waterQuality/WaterPointCard.jsx
 * Presentation component for individual public water point asset cards.
 */

import { Droplet, MapPin, Calendar, Activity, ShieldCheck, AlertTriangle, AlertOctagon, Clock } from 'lucide-react';
import { WATER_POINT_TYPES, OPERATIONAL_STATUSES } from '../../data/waterQualityContract.js';

export default function WaterPointCard({
  waterPoint,
  onViewDetails,
  onRecordSample,
  onAddCorrectiveAction,
  userRole = 'public',
}) {
  const typeDef = WATER_POINT_TYPES[waterPoint.pointType] || { label: waterPoint.pointType };
  const opStatus = OPERATIONAL_STATUSES[waterPoint.operationalStatus] || { label: waterPoint.operationalStatus, badgeClass: 'badge-neutral' };

  const getComplianceIndicator = (compliance) => {
    switch (compliance) {
      case 'compliant':
        return {
          label: 'IS 10500 Compliant',
          badgeClass: 'wq-badge-success',
          icon: <ShieldCheck size={14} />,
        };
      case 'critical_hazard':
        return {
          label: 'Critical Hazard (Action Required)',
          badgeClass: 'wq-badge-danger',
          icon: <AlertOctagon size={14} />,
        };
      case 'exceeded':
        return {
          label: 'Parameter Exceeded (Under Review)',
          badgeClass: 'wq-badge-warning',
          icon: <AlertTriangle size={14} />,
        };
      default:
        return {
          label: 'Pending Initial Lab Analysis',
          badgeClass: 'wq-badge-neutral',
          icon: <Clock size={14} />,
        };
    }
  };

  const complianceBadge = getComplianceIndicator(waterPoint.overallComplianceStatus);
  const sampleAge = waterPoint.sampleAge || { text: 'Not yet sampled', isStale: false };

  return (
    <article
      className="wq-card"
      aria-labelledby={`wp-title-${waterPoint.id}`}
    >
      <div>
        {/* Top Badges */}
        <div className="wq-card-header">
          <span className="wq-card-id">
            {waterPoint.id}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            <span className={`wq-badge ${opStatus.badgeClass || 'wq-badge-neutral'}`}>
              {opStatus.label}
            </span>
            <span className={`wq-badge ${complianceBadge.badgeClass}`}>
              {complianceBadge.icon}
              {complianceBadge.label}
            </span>
          </div>
        </div>

        {/* Title & Type */}
        <h3
          id={`wp-title-${waterPoint.id}`}
          className="wq-card-title"
        >
          {waterPoint.name}
        </h3>
        <p className="wq-card-source">
          <Droplet size={14} style={{ flexShrink: 0 }} />
          <span>{typeDef.label}</span>
          <span style={{ opacity: 0.5 }}>•</span>
          <span>{waterPoint.sourceType}</span>
        </p>

        {/* Location & Landmark */}
        <div className="wq-card-meta">
          <div className="wq-card-meta-row" style={{ alignItems: 'flex-start' }}>
            <MapPin size={14} style={{ color: '#ef4444', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong>{waterPoint.ward}</strong>, {waterPoint.city}
              {waterPoint.landmark && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontStyle: 'italic', marginTop: '2px' }}>
                  Landmark: {waterPoint.landmark}
                </div>
              )}
            </div>
          </div>
          <div className="wq-card-meta-row">
            <Activity size={14} style={{ color: '#818cf8', flexShrink: 0 }} />
            <span>
              {waterPoint.testedCount > 0
                ? `${waterPoint.testedCount} surveillance tests completed`
                : 'No historical test records'}
            </span>
          </div>
          <div className="wq-card-meta-row">
            <Calendar size={14} style={{ color: '#f59e0b', flexShrink: 0 }} />
            <span style={{ color: sampleAge.isStale ? '#ef4444' : 'inherit', fontWeight: sampleAge.isStale ? 700 : 400 }}>
              {sampleAge.text}
            </span>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="wq-card-footer">
        <button
          type="button"
          onClick={() => onViewDetails(waterPoint.id)}
          className="btn btn-secondary text-xs"
          style={{ padding: '0.45rem 0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
          aria-label={`View laboratory test history and parameters for ${waterPoint.name}`}
        >
          <span>Laboratory Results &amp; History</span>
        </button>

        {['sampler', 'official_reviewer', 'admin'].includes(userRole) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <button
              type="button"
              onClick={() => onRecordSample(waterPoint.id)}
              className="btn btn-primary text-xs"
              style={{ padding: '0.45rem 0.75rem' }}
              aria-label={`Log new sampling event for ${waterPoint.name}`}
            >
              + Log Sample
            </button>
            {['official_reviewer', 'admin'].includes(userRole) && (
              <button
                type="button"
                onClick={() => onAddCorrectiveAction(waterPoint.id)}
                className="btn btn-secondary text-xs"
                style={{ padding: '0.45rem 0.75rem', color: '#f59e0b' }}
                aria-label={`Sanction remedial action for ${waterPoint.name}`}
              >
                Remedial Action
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
