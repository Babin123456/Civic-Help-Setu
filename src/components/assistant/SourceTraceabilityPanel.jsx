import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  ExternalLink,
  BookOpen,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  FileText,
  Info,
} from 'lucide-react';
import { RAG_CONFIDENCE_LEVELS } from '../../services/groundedCivicRagService';
import { safeHttpUrl } from '../../utils/safeContent';

export default function SourceTraceabilityPanel({
  ragResult,
  defaultExpanded = true,
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  if (!ragResult) return null;

  const {
    status,
    confidenceLevel,
    coverageScore,
    citations = [],
    uncertaintyAcknowledged,
  } = ragResult;

  const getStatusBadge = () => {
    switch (confidenceLevel) {
      case RAG_CONFIDENCE_LEVELS.HIGH:
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', backgroundColor: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0', padding: '0.2rem 0.55rem', borderRadius: '0.25rem', fontSize: '0.75rem', fontWeight: 700 }}>
            <ShieldCheck style={{ width: '0.9rem', height: '0.9rem' }} />
            Grounded in Verified Records ({coverageScore}% coverage)
          </span>
        );
      case RAG_CONFIDENCE_LEVELS.MEDIUM:
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', backgroundColor: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', padding: '0.2rem 0.55rem', borderRadius: '0.25rem', fontSize: '0.75rem', fontWeight: 700 }}>
            <AlertTriangle style={{ width: '0.9rem', height: '0.9rem' }} />
            Partially Grounded ({coverageScore}% coverage)
          </span>
        );
      default:
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', padding: '0.2rem 0.55rem', borderRadius: '0.25rem', fontSize: '0.75rem', fontWeight: 700 }}>
            <Info style={{ width: '0.9rem', height: '0.9rem' }} />
            No Catalogue Source Available
          </span>
        );
    }
  };

  return (
    <div
      style={{
        marginTop: '0.75rem',
        backgroundColor: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: '0.65rem',
        padding: '0.85rem 1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.65rem',
      }}
    >
      {/* Panel Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <BookOpen style={{ width: '1.1rem', height: '1.1rem', color: '#2563eb' }} />
          <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#1e293b' }}>
            Source Traceability & Grounding
          </span>
          {getStatusBadge()}
        </div>

        {citations.length > 0 && (
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#2563eb',
              fontSize: '0.75rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              padding: '0.2rem 0.4rem',
            }}
          >
            <span>{isExpanded ? 'Hide Sources' : `View ${citations.length} Sources`}</span>
            {isExpanded ? (
              <ChevronUp style={{ width: '0.85rem', height: '0.85rem' }} />
            ) : (
              <ChevronDown style={{ width: '0.85rem', height: '0.85rem' }} />
            )}
          </button>
        )}
      </div>

      {/* Uncertainty Notice */}
      {uncertaintyAcknowledged && (
        <div
          style={{
            fontSize: '0.75rem',
            color: '#92400e',
            backgroundColor: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: '0.35rem',
            padding: '0.5rem 0.65rem',
            lineHeight: 1.4,
          }}
        >
          <strong>Grounding Disclosure:</strong> The assistant is constrained strictly to indexed government service guides. Where specific guidelines are not published in our catalogue, the assistant states uncertainty instead of guessing.
        </div>
      )}

      {/* Citations List */}
      {isExpanded && citations.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginTop: '0.25rem' }}>
          {citations.map((cit) => (
            <div
              key={cit.citationId}
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '0.5rem',
                padding: '0.75rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem',
              }}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <FileText style={{ width: '0.95rem', height: '0.95rem', color: '#64748b' }} />
                  <Link
                    to={`/services/${cit.serviceId}`}
                    style={{
                      fontSize: '0.8125rem',
                      fontWeight: 700,
                      color: '#2563eb',
                      textDecoration: 'underline',
                    }}
                  >
                    {cit.serviceTitle}
                  </Link>
                </div>
                <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.45rem', backgroundColor: '#f1f5f9', color: '#475569', borderRadius: '0.25rem', fontWeight: 600 }}>
                  {cit.fieldLabel}
                </span>
              </div>

              {/* Exact Excerpt */}
              <div
                style={{
                  fontSize: '0.775rem',
                  color: '#334155',
                  backgroundColor: '#f8fafc',
                  padding: '0.45rem 0.65rem',
                  borderRadius: '0.35rem',
                  borderLeft: '3px solid #2563eb',
                  fontStyle: 'italic',
                  lineHeight: 1.45,
                }}
              >
                "{cit.excerpt}"
              </div>

              {/* Department & Official Link Footer */}
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.725rem', color: '#64748b', marginTop: '0.2rem' }}>
                <span>Dept: {cit.department}</span>
                {cit.officialUrl && (
                  <a
                    href={safeHttpUrl(cit.officialUrl) || undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      color: '#2563eb',
                      textDecoration: 'none',
                      fontWeight: 600,
                    }}
                  >
                    Official Portal <ExternalLink style={{ width: '0.75rem', height: '0.75rem' }} />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
