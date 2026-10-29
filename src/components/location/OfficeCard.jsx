import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MapPin,
  Clock,
  Phone,
  Navigation,
  Calendar,
  Copy,
  Check,
  Building,
  UserCheck,
  CheckCircle2,
  ExternalLink,
  Accessibility,
} from 'lucide-react';
import { formatDistance } from '../../services/locationService';
import { useToast } from '../../context/ToastContext';
import BestTimeToVisitCard from './BestTimeToVisitCard';
import { OfficeAccessibilityDetails } from './AccessibilityFacilityPanel';
import IntakeWindowBadge from './IntakeWindowBadge';

const OfficeCard = ({
  office,
  onBookAppointment,
  isSelected = false,
  onSelect = () => {},
  onAuditAccessibility,
}) => {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopyAddress = (e) => {
    e.stopPropagation();
    const fullText = `${office.name}, ${office.address}, ${office.city}, ${office.state} - ${office.pincode}`;
    navigator.clipboard?.writeText(fullText);
    setCopied(true);
    toast?.info?.('Address copied to clipboard.');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`glass-panel animate-fade-in ${isSelected ? 'selected-card' : ''}`}
      onClick={() => onSelect(office)}
      style={{
        padding: '1.5rem',
        borderRadius: '1rem',
        border: isSelected ? '2px solid var(--accent-main)' : '1px solid var(--border-light)',
        background: isSelected ? 'rgba(56, 189, 248, 0.05)' : 'var(--glass-bg)',
        transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: '1.25rem',
      }}
    >
      {/* Top Header: Category & Live Badges */}
      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '0.5rem',
            marginBottom: '0.5rem',
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              color: 'var(--accent-main)',
            }}
          >
            {office.type || office.category}
          </span>

          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            {office.distanceKm != null && (
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: '700',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '99px',
                  background: 'rgba(56, 189, 248, 0.15)',
                  color: 'var(--accent-main)',
                }}
              >
                📍 {formatDistance(office.distanceKm)}
              </span>
            )}
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: '700',
                padding: '0.2rem 0.6rem',
                borderRadius: '99px',
                background: office.isOpenNow ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: office.isOpenNow ? '#10b981' : '#ef4444',
              }}
            >
              {office.isOpenNow ? 'Open Now' : 'Closed'}
            </span>
          </div>
        </div>

        {/* Office Title */}
        <h3
          style={{
            fontSize: '1.25rem',
            fontWeight: '800',
            color: 'var(--text-primary)',
            lineHeight: '1.3',
            marginBottom: '0.4rem',
          }}
        >
          {office.name}
        </h3>

        {/* Full Address */}
        <p
          style={{
            fontSize: '0.875rem',
            color: 'var(--text-secondary)',
            lineHeight: '1.5',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.4rem',
            marginBottom: '0.75rem',
          }}
        >
          <MapPin size={16} color="var(--accent-main)" style={{ flexShrink: 0, marginTop: '0.2rem' }} />
          <span>
            {office.address}
            {office.landmark && <span style={{ color: 'var(--text-tertiary)' }}> ({office.landmark})</span>}
            , {office.city}, {office.state} - {office.pincode}
          </span>
        </p>

        <IntakeWindowBadge office={office} />

        {/* Metadata Details Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '0.6rem',
            fontSize: '0.8rem',
            background: 'rgba(0, 0, 0, 0.15)',
            padding: '0.75rem 1rem',
            borderRadius: '0.6rem',
            marginBottom: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)' }}>
            <Clock size={14} color="var(--accent-main)" />
            <span>{office.officeHours?.hours} ({office.officeHours?.days})</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)' }}>
            <Phone size={14} color="var(--accent-main)" />
            <a
              href={`tel:${office.contact?.helpline || office.contact?.phone}`}
              onClick={(e) => e.stopPropagation()}
              style={{ color: 'inherit', textDecoration: 'none' }}
            >
              Helpline: <strong>{office.contact?.helpline || office.contact?.phone}</strong>
            </a>
          </div>

          {office.officerInCharge && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)' }}>
              <UserCheck size={14} color="var(--accent-main)" />
              <span>In-Charge: {office.officerInCharge}</span>
            </div>
          )}

          {office.averageWaitTime && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)' }}>
              <CheckCircle2 size={14} color="#10b981" />
              <span>Avg Wait: {office.averageWaitTime}</span>
            </div>
          )}
        </div>

        {/* Service Channels Supported */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: '600' }}>
            Channels:
          </span>
          {office.channels.map((chan) => (
            <span
              key={chan}
              style={{
                fontSize: '0.7rem',
                textTransform: 'capitalize',
                padding: '0.15rem 0.5rem',
                borderRadius: '0.4rem',
                background: 'var(--glass-bg)',
                border: '1px solid var(--border-light)',
                color: 'var(--text-secondary)',
              }}
            >
              {chan === 'in-person' ? '🏛️ In-Person Center' : chan === 'online' ? '🌐 Online Portal' : '📞 Helpline'}
            </span>
          ))}
          {office.features?.includes('wheelchair_accessible') && (
            <span
              style={{
                fontSize: '0.7rem',
                padding: '0.15rem 0.5rem',
                borderRadius: '0.4rem',
                background: 'rgba(16, 185, 129, 0.1)',
                color: '#10b981',
                border: '1px solid rgba(16, 185, 129, 0.2)',
              }}
            >
              ♿ Accessible
            </span>
          )}
        </div>

        {/* Associated Services Provided */}
        {office.serviceIds && office.serviceIds.length > 0 && (
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: '600' }}>
              Services:
            </span>
            {office.serviceIds.slice(0, 4).map((sId) => (
              <Link
                key={sId}
                to={`/service/${sId}`}
                onClick={(e) => e.stopPropagation()}
                style={{
                  fontSize: '0.75rem',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '99px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  color: 'var(--accent-main)',
                  textDecoration: 'none',
                  border: '1px solid var(--border-light)',
                }}
              >
                {sId.replace(/-/g, ' ')}
              </Link>
            ))}
            {office.serviceIds.length > 4 && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                +{office.serviceIds.length - 4} more
              </span>
            )}
          </div>
        )}

        {/* Real-time Footfall Rush Forecaster & Best Time to Visit */}
        <BestTimeToVisitCard office={office} />

        {/* Verified Accessibility Facilities and Language Coverage */}
        <OfficeAccessibilityDetails office={office} />
      </div>

      {/* Bottom Action Buttons */}
      <div
        style={{
          display: 'flex',
          gap: '0.6rem',
          flexWrap: 'wrap',
          borderTop: '1px solid var(--border-light)',
          paddingTop: '1rem',
          alignItems: 'center',
        }}
      >
        <a
          href={office.directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="btn btn-secondary"
          style={{
            flex: '1 1 140px',
            padding: '0.55rem 0.85rem',
            fontSize: '0.85rem',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.4rem',
            borderRadius: '0.5rem',
          }}
        >
          <Navigation size={15} color="var(--accent-main)" />
          Directions
        </a>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onBookAppointment(office);
          }}
          className="btn btn-primary"
          style={{
            flex: '1 1 150px',
            padding: '0.55rem 0.85rem',
            fontSize: '0.85rem',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.4rem',
            borderRadius: '0.5rem',
          }}
        >
          <Calendar size={15} />
          Book Visit Token
        </button>

        {onAuditAccessibility && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAuditAccessibility(office);
            }}
            className="btn btn-secondary"
            title="Inspect & Rate Office Physical Accessibility"
            style={{
              padding: '0.55rem 0.75rem',
              fontSize: '0.825rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              borderRadius: '0.5rem',
            }}
          >
            <Accessibility size={15} />
            <span>Audit</span>
          </button>
        )}

        <button
          type="button"
          onClick={handleCopyAddress}
          className="btn"
          title="Copy full address"
          style={{
            padding: '0.55rem 0.75rem',
            background: 'var(--glass-bg)',
            border: '1px solid var(--border-light)',
            color: 'var(--text-secondary)',
            borderRadius: '0.5rem',
            cursor: 'pointer',
          }}
        >
          {copied ? <Check size={15} color="#10b981" /> : <Copy size={15} />}
        </button>
      </div>
    </div>
  );
};

export default OfficeCard;
