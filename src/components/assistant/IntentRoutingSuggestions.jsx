import {
  Compass,
  FileCheck,
  MapPin,
  Clock,
  BookOpen,
  HelpCircle,
  ArrowRight
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { routeUserIntent } from '../../services/multilingualIntentRouterService';

const INTENT_ICONS = {
  find_service: Compass,
  understand_documents: FileCheck,
  check_eligibility: BookOpen,
  locate_office: MapPin,
  track_application: Clock,
  explain_term: HelpCircle,
  generic_fallback: HelpCircle
};

export default function IntentRoutingSuggestions({ query = '', onSelectIntent }) {
  if (!query || query.trim().length === 0) return null;

  const result = routeUserIntent(query);

  if (result.isConfident && result.definition && result.definition.route) {
    const Icon = INTENT_ICONS[result.definition.id] || Compass;

    return (
      <div
        className="card"
        style={{
          padding: '0.85rem 1rem',
          borderRadius: '10px',
          backgroundColor: 'rgba(37, 99, 235, 0.05)',
          border: '1px solid rgba(37, 99, 235, 0.25)',
          margin: '0.65rem 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: 'rgba(37, 99, 235, 0.15)',
              color: 'var(--accent-main)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Icon size={18} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-main)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Suggested Civic Destination
            </div>
            <strong style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>
              {result.definition.label}
            </strong>
          </div>
        </div>

        <Link
          to={result.definition.route}
          className="btn btn-primary"
          style={{
            padding: '0.4rem 0.85rem',
            fontSize: '0.8rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            textDecoration: 'none'
          }}
          onClick={() => {
            if (typeof onSelectIntent === 'function') {
              onSelectIntent(result.definition);
            }
          }}
        >
          <span>{result.definition.actionText}</span>
          <ArrowRight size={14} />
        </Link>
      </div>
    );
  }

  // Clarifying suggestions when confidence is low
  if (!result.isConfident && result.clarifyingQuestion) {
    return (
      <div
        style={{
          padding: '0.85rem 1rem',
          borderRadius: '10px',
          backgroundColor: 'var(--bg-card, #f8fafc)',
          border: '1px solid var(--border-main)',
          margin: '0.65rem 0',
          display: 'grid',
          gap: '0.5rem'
        }}
      >
        <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
          {result.clarifyingQuestion}
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
          {result.suggestedIntents.map((item) => {
            if (!item.route) return null;
            return (
              <Link
                key={item.id}
                to={item.route}
                className="btn btn-secondary"
                style={{
                  padding: '0.3rem 0.65rem',
                  fontSize: '0.75rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  textDecoration: 'none'
                }}
              >
                <span>{item.label}</span>
                <ArrowRight size={12} />
              </Link>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
}
