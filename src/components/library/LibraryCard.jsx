import {
  MapPin,
  Clock,
  ClipboardList,
  Copy,
  Info,
  Globe,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import { LIBRARY_TYPE_LABELS } from '../../data/libraryContract';
import { getLibraryFreshness, formatLibraryInstructions } from '../../services/libraryService';
import { useToast } from '../../context/ToastContext';
import { safeHttpUrl } from '../../utils/safeContent';

export default function LibraryCard({
  library,
  onOpenDetails,
  onOpenChecklist,
  onOpenCorrection,
}) {
  const { toast } = useToast();
  if (!library) return null;

  const freshness = getLibraryFreshness(library);
  const typeLabel = LIBRARY_TYPE_LABELS[library.libraryType] || 'Public Library';
  const opacUrl = safeHttpUrl(library.officialContact?.opacCatalogueUrl);
  const digitalCount = Array.isArray(library.digitalLearningResources) ? library.digitalLearningResources.length : 0;

  const handleCopyInstructions = (e) => {
    e.stopPropagation();
    const text = formatLibraryInstructions(library);
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
      toast?.success?.('Library details and rules copied to clipboard.');
    }
  };

  return (
    <article
      className="library-card"
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-main)',
        borderRadius: '1rem',
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
        position: 'relative',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
      }}
    >
      <div>
        {/* Top Badges */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem' }}>
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              padding: '0.2rem 0.6rem',
              borderRadius: '9999px',
              backgroundColor: 'rgba(56, 189, 248, 0.12)',
              color: 'var(--accent-main, #0284c7)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
            }}
          >
            {typeLabel}
          </span>
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              padding: '0.2rem 0.6rem',
              borderRadius: '9999px',
              backgroundColor: 'var(--glass-bg)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-light)',
            }}
          >
            {library.managingAuthority}
          </span>
          {digitalCount > 0 && (
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '0.2rem 0.6rem',
                borderRadius: '9999px',
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                color: 'var(--success, #10b981)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
            >
              <Globe size={12} /> {digitalCount} Digital Repositories
            </span>
          )}
          {freshness.status === 'overdue' && (
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '0.2rem 0.6rem',
                borderRadius: '9999px',
                backgroundColor: 'rgba(245, 158, 11, 0.15)',
                color: 'var(--warning, #f59e0b)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
            >
              <ShieldAlert size={12} /> Audit Overdue (Stale Record)
            </span>
          )}
        </div>

        {/* Title & Address */}
        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.5rem', lineHeight: 1.3 }}>
          {library.name}
        </h3>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
          <MapPin size={16} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--text-tertiary)' }} />
          <span>{library.address}, {library.district}, {library.state} - {library.pincode}</span>
        </div>

        {/* Operating Hours */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
          <Clock size={15} style={{ flexShrink: 0, color: 'var(--text-tertiary)' }} />
          <span><strong>Hours:</strong> {library.operatingHours?.hours || 'Operating hours unverified'}</span>
        </div>

        {/* Borrowing / Membership Summary */}
        <div
          style={{
            backgroundColor: 'var(--bg-main)',
            border: '1px solid var(--border-light)',
            borderRadius: '0.6rem',
            padding: '0.75rem',
            marginBottom: '1rem',
            fontSize: '0.8rem',
            color: 'var(--text-secondary)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35rem',
          }}
        >
          <div>
            <strong style={{ color: 'var(--text-primary)' }}>Renewal & Borrowing:</strong>{' '}
            {library.renewalRules
              ? `${library.renewalRules.loanPeriodDays} days loan • Max ${library.renewalRules.maxRenewalsAllowed} renewal(s) • ${
                  library.renewalRules.onlineRenewalAvailable ? 'Online OPAC supported' : 'Counter only'
                }`
              : 'Renewal rules not officially published.'}
          </div>
          <div>
            <strong style={{ color: 'var(--text-primary)' }}>Access:</strong>{' '}
            {library.statutoryCharges?.isFree
              ? 'Reading room reference is completely free for all citizens.'
              : 'Subsidized statutory membership fees apply.'}
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <button
            type="button"
            onClick={() => onOpenDetails?.(library)}
            style={{
              flex: 1,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.35rem',
              padding: '0.55rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              borderRadius: '0.5rem',
              backgroundColor: 'var(--accent-main)',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <Info size={15} /> View Rules & Resources
          </button>
          <button
            type="button"
            onClick={() => onOpenChecklist?.(library)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.35rem',
              padding: '0.55rem 0.85rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              borderRadius: '0.5rem',
              backgroundColor: 'var(--bg-main)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-main)',
              cursor: 'pointer',
            }}
            title="Open Application Preparation Checklist"
          >
            <ClipboardList size={15} /> Checklist
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-light)' }}>
          {opacUrl ? (
            <a
              href={opacUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: 'var(--accent-main)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.2rem',
                textDecoration: 'underline',
              }}
            >
              Online OPAC Catalogue <ExternalLink size={11} />
            </a>
          ) : (
            <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>OPAC unavailable</span>
          )}

          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <button
              type="button"
              onClick={handleCopyInstructions}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                fontSize: '0.75rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.2rem',
                padding: 0,
              }}
              title="Copy plain-text instructions for low-bandwidth / SMS"
            >
              <Copy size={12} /> Copy
            </button>
            <button
              type="button"
              onClick={() => onOpenCorrection?.(library)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent-main)',
                fontSize: '0.75rem',
                cursor: 'pointer',
                padding: 0,
                textDecoration: 'underline',
              }}
            >
              Suggest Update
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
