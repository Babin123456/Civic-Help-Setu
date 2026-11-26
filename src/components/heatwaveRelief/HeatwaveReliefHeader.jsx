import React from 'react';
import StandardPageHeader from '../common/StandardPageHeader';
import {
  Sun,
  ThermometerSun,
  AlertTriangle,
  Phone,
  HelpCircle,
  WifiOff,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import { HEAT_ALERT_LEVELS } from '../../data/upHeatwaveReliefContract';

export default function HeatwaveReliefHeader({
  districtAlert,
  offlineDraftsCount,
  onOpenGuidanceModal,
  onSyncDrafts,
  isSyncing,
}) {
  const isEmergencyAlert = districtAlert?.alertLevel === HEAT_ALERT_LEVELS.SEVERE_EMERGENCY;
  const isHeatAlert = districtAlert?.alertLevel === HEAT_ALERT_LEVELS.HEAT_ALERT;

  const alertBorderColor = isEmergencyAlert
    ? 'rgba(239, 68, 68, 0.4)'
    : isHeatAlert
    ? 'rgba(249, 115, 22, 0.4)'
    : 'rgba(234, 179, 8, 0.4)';

  const alertBgColor = isEmergencyAlert
    ? 'rgba(239, 68, 68, 0.1)'
    : isHeatAlert
    ? 'rgba(249, 115, 22, 0.1)'
    : 'rgba(234, 179, 8, 0.1)';

  const alertTextColor = isEmergencyAlert
    ? '#ef4444'
    : isHeatAlert
    ? '#f97316'
    : '#eab308';

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <StandardPageHeader
        eyebrow="Uttar Pradesh Disaster Management & Heat Action Plan"
        eyebrowIcon={<ThermometerSun size={16} style={{ color: 'var(--accent-main)' }} />}
        title="UP Community Heatwave Exposure & Cooling-Relief Coordination Map"
        subtitle="Ward- and village-level directory of verified public cooling spaces, drinking water points, shaded rest stops, and health help desks with live community verification."
        badgeText="Pilot: Lucknow DDMA"
        badgeType="accent"
      />

      {/* Official Heatwave Alert Context Banner */}
      {districtAlert && (
        <div
          role="region"
          aria-label="Official District Heatwave Alert"
          style={{
            marginTop: '1rem',
            padding: '1.25rem',
            borderRadius: '0.75rem',
            background: alertBgColor,
            border: `1.5px solid ${alertBorderColor}`,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <ShieldAlert size={22} style={{ color: alertTextColor, flexShrink: 0 }} aria-hidden="true" />
              <div>
                <span
                  style={{
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    fontWeight: 700,
                    color: alertTextColor,
                  }}
                >
                  {districtAlert.district} Official Heat Advisory • {districtAlert.officialSource}
                </span>
                <h2 style={{ fontSize: '1.1rem', margin: '0.15rem 0', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {districtAlert.advisoryHeadline}
                </h2>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div
                style={{
                  padding: '0.4rem 0.75rem',
                  borderRadius: '0.5rem',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-light)',
                  textAlign: 'right',
                }}
              >
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Forecast Temp / Feels Like</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: alertTextColor }}>
                  {districtAlert.maxTemperature} <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-secondary)' }}>(Feels {districtAlert.feelsLike})</span>
                </div>
              </div>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={onOpenGuidanceModal}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontSize: '0.82rem',
                  padding: '0.45rem 0.8rem',
                }}
                aria-label="View heat emergency first-aid and hydration guidance"
              >
                <HelpCircle size={15} aria-hidden="true" />
                Emergency Heat Guide
              </button>
            </div>
          </div>

          {/* District Helpline Quick Access */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1.25rem',
              flexWrap: 'wrap',
              paddingTop: '0.6rem',
              borderTop: '1px solid var(--border-light)',
              fontSize: '0.82rem',
              color: 'var(--text-secondary)',
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <Phone size={14} style={{ color: 'var(--text-primary)' }} aria-hidden="true" />
              <strong>DDMA Control:</strong> {districtAlert.emergencyContacts?.ddmaEmergencyRoom || '1077'}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <Phone size={14} style={{ color: '#ef4444' }} aria-hidden="true" />
              <strong>Ambulance:</strong> 108
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <Phone size={14} style={{ color: 'var(--text-primary)' }} aria-hidden="true" />
              <strong>UPSDMA Toll-Free:</strong> 1070
            </span>

            {/* Offline draft sync status if any */}
            {offlineDraftsCount > 0 && (
              <span
                style={{
                  marginLeft: 'auto',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  color: 'var(--accent-main)',
                  fontWeight: 600,
                }}
              >
                <WifiOff size={14} aria-hidden="true" />
                {offlineDraftsCount} offline draft{offlineDraftsCount > 1 ? 's' : ''} queued
                <button
                  type="button"
                  onClick={onSyncDrafts}
                  disabled={isSyncing}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--accent-main)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '0 0.2rem',
                    textDecoration: 'underline',
                  }}
                  aria-label="Sync offline drafts now"
                >
                  <RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''} style={{ marginRight: '0.2rem' }} aria-hidden="true" />
                  Sync
                </button>
              </span>
            )}
          </div>

          {/* Mandatory Medical Disclaimer Banner */}
          <div
            style={{
              fontSize: '0.76rem',
              color: 'var(--text-tertiary)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              paddingTop: '0.35rem',
            }}
          >
            <AlertTriangle size={13} style={{ flexShrink: 0 }} aria-hidden="true" />
            <span>
              <strong>Medical Disclaimer:</strong> {districtAlert.medicalDisclaimer}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
