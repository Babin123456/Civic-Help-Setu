import { useState } from 'react';
import {
  ShieldCheck,
  Building2,
  CheckCircle2,
  AlertTriangle,
  Info,
  XCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  evaluateOfficeServiceMatch,
  OFFICE_MATCH_STATUS,
  MATCH_STATUS_CONFIG,
} from '../../services/explainableOfficeService';

export default function ExplainableOfficeMatchCard({
  office,
  service,
  defaultExpanded = false,
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  if (!office) return null;

  const match = evaluateOfficeServiceMatch(office, service);
  const { status, config, reasons, isResponsibleOffice, isUnverified } = match;

  const getStatusIcon = () => {
    switch (status) {
      case OFFICE_MATCH_STATUS.CONFIRMED_RESPONSIBLE_OFFICE:
        return <ShieldCheck style={{ width: '1.1rem', height: '1.1rem', color: config.color, flexShrink: 0 }} />;
      case OFFICE_MATCH_STATUS.JURISDICTION_MATCH:
        return <CheckCircle2 style={{ width: '1.1rem', height: '1.1rem', color: config.color, flexShrink: 0 }} />;
      case OFFICE_MATCH_STATUS.UNVERIFIED_MATCH:
        return <AlertTriangle style={{ width: '1.1rem', height: '1.1rem', color: config.color, flexShrink: 0 }} />;
      case OFFICE_MATCH_STATUS.UNMATCHED:
        return <XCircle style={{ width: '1.1rem', height: '1.1rem', color: config.color, flexShrink: 0 }} />;
      default:
        return <Info style={{ width: '1.1rem', height: '1.1rem', color: config.color, flexShrink: 0 }} />;
    }
  };

  return (
    <div
      style={{
        backgroundColor: config.bgColor,
        border: `1px solid ${config.borderColor}`,
        borderRadius: '0.65rem',
        padding: '0.85rem 1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        margin: '0.5rem 0',
      }}
    >
      {/* Header Badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          {getStatusIcon()}
          <span
            style={{
              fontSize: '0.8125rem',
              fontWeight: 700,
              color: config.color,
            }}
          >
            {config.label}
          </span>
        </div>
        {reasons.length > 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0.2rem',
              color: config.color,
              display: 'flex',
              alignItems: 'center',
              fontSize: '0.75rem',
              fontWeight: 600,
              gap: '0.2rem',
            }}
          >
            <span>{isExpanded ? 'Less' : 'Why'}</span>
            {isExpanded ? (
              <ChevronUp style={{ width: '0.85rem', height: '0.85rem' }} />
            ) : (
              <ChevronDown style={{ width: '0.85rem', height: '0.85rem' }} />
            )}
          </button>
        )}
      </div>

      {/* Primary Explanation Sentence */}
      <div style={{ fontSize: '0.8rem', color: '#1e293b', lineHeight: 1.45 }}>
        {match.explanation}
      </div>

      {/* Expanded Rationale Details */}
      {isExpanded && reasons.length > 0 && (
        <div
          style={{
            marginTop: '0.25rem',
            paddingTop: '0.5rem',
            borderTop: `1px dashed ${config.borderColor}`,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35rem',
          }}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>
            Match Evaluation Criteria:
          </div>
          <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.775rem', color: '#334155' }}>
            {reasons.map((r, i) => (
              <li key={i} style={{ marginBottom: '0.2rem' }}>
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Unverified Disclaimer */}
      {isUnverified && (
        <div
          style={{
            fontSize: '0.725rem',
            color: '#92400e',
            backgroundColor: 'rgba(245, 158, 11, 0.12)',
            padding: '0.35rem 0.5rem',
            borderRadius: '0.25rem',
            marginTop: '0.2rem',
          }}
        >
          <strong>Notice:</strong> Please telephone the office prior to visiting to confirm whether they handle intake for citizens residing in your specific pincode/ward.
        </div>
      )}

      {/* Responsible Office Guarantee */}
      {isResponsibleOffice && (
        <div style={{ fontSize: '0.725rem', color: '#166534', fontWeight: 500 }}>
          ✓ Verified primary intake authority for this scheme.
        </div>
      )}
    </div>
  );
}
