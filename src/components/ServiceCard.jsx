import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Building2, Clock, Gauge } from 'lucide-react';
import UntranslatedBadge from './common/UntranslatedBadge';
import ApplicabilityBadge from './services/ApplicabilityBadge';

const getDifficultyBadge = (diff = '') => {
  const d = diff.toLowerCase();
  if (d === 'easy') {
    return { bg: 'rgba(16, 185, 129, 0.15)', text: 'var(--success, #10b981)', border: 'rgba(16, 185, 129, 0.3)' };
  }
  if (d === 'hard') {
    return { bg: 'rgba(192, 132, 252, 0.15)', text: '#c084fc', border: 'rgba(192, 132, 252, 0.3)' };
  }
  return { bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b', border: 'rgba(245, 158, 11, 0.3)' };
};

const ServiceCard = ({ service, isCompared = false, compareDisabled = false, onToggleCompare }) => {
  if (!service) return null;

  const diffStyle = getDifficultyBadge(service.difficulty);

  const card = (
    <Link
      to={`/services/${service.id}`}
      className="card service-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        textDecoration: 'none',
        position: 'relative',
        transition: 'all 0.3s ease',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
        {/* Badges Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '0.85rem',
            gap: '0.5rem',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            <span
              style={{
                padding: '0.2rem 0.65rem',
                background: 'var(--accent-light)',
                color: 'var(--accent-main)',
                borderRadius: '99px',
                fontSize: '0.8rem',
                fontWeight: '700',
                border: '1px solid rgba(56, 189, 248, 0.25)',
              }}
            >
              {service.category}
            </span>
            {service.difficulty && (
              <span
                style={{
                  padding: '0.2rem 0.55rem',
                  borderRadius: '99px',
                  fontSize: '0.75rem',
                  fontWeight: '700',
                  background: diffStyle.bg,
                  color: diffStyle.text,
                  border: `1px solid ${diffStyle.border}`,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                }}
              >
                <Gauge size={12} aria-hidden="true" /> {service.difficulty}
              </span>
            )}
          </div>

          {service.type && (
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: '600',
                color: 'var(--text-tertiary)',
                background: 'var(--glass-bg)',
                padding: '0.2rem 0.6rem',
                borderRadius: '99px',
                border: '1px solid var(--border-light)',
              }}
            >
              {service.type}
            </span>
          )}
        </div>

        {/* Department Metadata */}
        {service.department && (
          <div
            className="service-card-dept"
            title={service.department}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.8rem',
              color: 'var(--text-secondary)',
              marginBottom: '0.75rem',
              maxWidth: '100%',
            }}
          >
            <Building2 size={13} style={{ flexShrink: 0, color: 'var(--text-tertiary)' }} aria-hidden="true" />
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {service.department}
            </span>
          </div>
        )}

        {/* Title */}
        <h3
          style={{
            fontSize: '1.35rem',
            fontWeight: '800',
            marginBottom: '0.65rem',
            color: 'var(--text-primary)',
            transition: 'color 0.2s',
            lineHeight: 1.3,
          }}
        >
          {service.name}
        </h3>

        {/* Description with multi-line clamp to prevent uneven card height */}
        <p
          className="service-card-desc"
          style={{
            color: 'var(--text-secondary)',
            fontSize: '0.925rem',
            marginBottom: '1rem',
            lineHeight: '1.55',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {service.shortDescription}
        </p>

        {/* Badges container */}
        <div style={{ marginTop: 'auto', marginBottom: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <div>
            <ApplicabilityBadge service={service} />
          </div>
          <div>
            <UntranslatedBadge />
          </div>
        </div>
      </div>

      {/* Card Action Footer */}
      <div
        style={{
          marginTop: 'auto',
          paddingTop: '1rem',
          borderTop: '1px dashed var(--border-main)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>
          <Clock size={14} aria-hidden="true" />
          <span>{service.processingTime || 'Standard Processing'}</span>
        </div>

        <div
          className="service-card-action"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            fontWeight: '600',
            color: 'var(--accent-main)',
            fontSize: '0.875rem',
          }}
        >
          <BookOpen size={16} aria-hidden="true" />
          <span>View Guide</span>
          <ArrowRight size={14} aria-hidden="true" />
        </div>
      </div>
    </Link>
  );

  if (!onToggleCompare) return card;

  return (
    <div className="service-card-wrap">
      {card}
      <label className={`compare-toggle${compareDisabled ? ' is-disabled' : ''}`}>
        <input
          type="checkbox"
          checked={isCompared}
          disabled={compareDisabled}
          aria-label={`Compare ${service.name}`}
          onChange={() => onToggleCompare(service.id)}
        />
        <span>
          Compare<span className="sr-only"> {service.name}</span>
        </span>
      </label>
    </div>
  );
};

export default ServiceCard;
