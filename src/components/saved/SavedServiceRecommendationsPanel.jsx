import { useState, useMemo } from 'react';
import {
  Sparkles,
  ArrowRight,
  X,
  Layers,
  ShieldCheck,
  Tag
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  getRelatedServiceRecommendations,
  dismissRecommendation
} from '../../services/savedServiceRecommendationsService';

export default function SavedServiceRecommendationsPanel({
  savedServices = [],
  catalogueServices = []
}) {
  const [dismissalNonce, setDismissalNonce] = useState(0);

  const recommendations = useMemo(() => {
    return getRelatedServiceRecommendations(savedServices, catalogueServices);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedServices, catalogueServices, dismissalNonce]);

  if (!recommendations || recommendations.length === 0) {
    return null;
  }

  const handleDismiss = (serviceId) => {
    dismissRecommendation(serviceId);
    setDismissalNonce((n) => n + 1);
  };

  return (
    <section
      className="card"
      style={{
        padding: '1.25rem 1.5rem',
        borderRadius: '12px',
        backgroundColor: 'rgba(56, 189, 248, 0.05)',
        border: '1px solid rgba(56, 189, 248, 0.25)',
        marginBottom: '1.5rem'
      }}
      aria-label="Related service recommendations"
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Sparkles size={18} color="var(--accent-main)" />
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Related Services You May Need
          </h3>
        </div>
        <small style={{ color: 'var(--text-tertiary)', fontSize: '0.78rem' }}>
          Grounded in verified prerequisites &amp; administrative category metadata
        </small>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: '1rem'
        }}
      >
        {recommendations.map(({ service, relationshipType, relationshipLabel, explanation, evidenceGrounding }) => {
          const isCurated = evidenceGrounding === 'curated_rule';

          return (
            <div
              key={service.id}
              style={{
                borderRadius: '10px',
                border: '1px solid var(--border-main)',
                backgroundColor: 'var(--bg-main, #ffffff)',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                position: 'relative'
              }}
            >
              <div>
                {/* Dismiss button */}
                <button
                  type="button"
                  onClick={() => handleDismiss(service.id)}
                  aria-label={`Dismiss recommendation for ${service.name}`}
                  title="Dismiss this recommendation"
                  style={{
                    position: 'absolute',
                    top: '0.65rem',
                    right: '0.65rem',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-tertiary)',
                    cursor: 'pointer',
                    padding: '0.2rem'
                  }}
                >
                  <X size={15} />
                </button>

                {/* Relationship Tag */}
                <div style={{ marginBottom: '0.45rem', paddingRight: '1.5rem' }}>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '12px',
                      backgroundColor: isCurated ? 'rgba(168, 85, 247, 0.12)' : 'rgba(37, 99, 235, 0.1)',
                      color: isCurated ? '#9333ea' : 'var(--accent-main)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem'
                    }}
                  >
                    {isCurated ? <ShieldCheck size={12} /> : <Tag size={12} />}
                    {relationshipLabel}
                  </span>
                </div>

                <strong style={{ fontSize: '0.95rem', display: 'block', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                  {service.name}
                </strong>

                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  {explanation}
                </p>
              </div>

              <div style={{ marginTop: '0.85rem', paddingTop: '0.65rem', borderTop: '1px solid var(--border-main)' }}>
                <Link
                  to={`/services/${service.id}`}
                  style={{
                    color: 'var(--accent-main)',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem'
                  }}
                >
                  <span>View Service Details</span>
                  <ArrowRight size={13} />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
