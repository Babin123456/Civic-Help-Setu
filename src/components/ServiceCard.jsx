import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Clock, Gauge, Sparkles } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
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
  const { isPlainLanguage } = useLanguage();
  const diffStyle = getDifficultyBadge(service.difficulty);

  const card = (
    <Link
      to={`/services/${service.id}`}
      className="card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        height: '100%',
        textDecoration: 'none',
        position: 'relative',
        transition: 'all 0.3s ease',
      }}
    >
      <div>
        {/* Badges Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1.25rem',
            gap: '0.5rem',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
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
                <Gauge size={12} /> {service.difficulty}
              </span>
            )}
          </div>

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
        </div>

        <h3
          style={{
            fontSize: '1.4rem',
            fontWeight: '800',
            marginBottom: '0.75rem',
            color: 'var(--text-primary)',
            transition: 'color 0.2s',
          }}
        >
          {service.name}
        </h3>

        <p
          style={{
            color: 'var(--text-secondary)',
            fontSize: '0.95rem',
            marginBottom: '1.5rem',
            lineHeight: '1.6',
          }}
        >
          {service.shortDescription}
        </p>
        <div style={{ marginBottom: '0.75rem' }}>
          <ApplicabilityBadge service={service} />
        </div>
        <UntranslatedBadge />
      </div>

      <div
        style={{
          marginTop: 'auto',
          paddingTop: '1.25rem',
          borderTop: '1px dashed var(--border-main)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>
          <Clock size={14} />
          <span>{service.processingTime || 'Standard Processing'}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '600', color: 'var(--accent-main)', fontSize: '0.875rem' }}>
          <BookOpen size={16} />
          <span>View Guide</span>
          <ArrowRight size={14} />
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
