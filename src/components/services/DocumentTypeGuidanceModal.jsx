import { useState, useMemo } from 'react';
import {
  X,
  FileText,
  ShieldCheck,
  AlertTriangle,
  Info,
  CheckCircle,
  HelpCircle,
  Search,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
} from 'lucide-react';
import { getServiceDocumentGuidance } from '../../services/documentTypeGuidanceService.js';
import { useToast } from '../../context/ToastContext.jsx';

const DocumentTypeGuidanceModal = ({ isOpen, onClose, service }) => {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all' | 'standard' | 'ambiguous'
  const [expandedIndex, setExpandedIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  const guidanceData = useMemo(() => {
    if (!service) return null;
    return getServiceDocumentGuidance(service);
  }, [service]);

  if (!isOpen || !service || !guidanceData) return null;

  const filteredItems = guidanceData.items.filter((item) => {
    const matchesFilter =
      filterType === 'all' ||
      (filterType === 'standard' && !item.isAmbiguous) ||
      (filterType === 'ambiguous' && item.isAmbiguous);

    const matchesSearch =
      !searchQuery.trim() ||
      item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.categoryName && item.categoryName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesFilter && matchesSearch;
  });

  const toggleExpand = (idx) => {
    setExpandedIndex(expandedIndex === idx ? null : idx);
  };

  const handleCopySummary = () => {
    const textLines = [
      `DOCUMENT-TYPE GUIDANCE: ${service.name}`,
      `Total Requirements: ${guidanceData.totalCount} (Standard: ${guidanceData.standardCount}, Ambiguous: ${guidanceData.ambiguousCount})`,
      '',
      ...guidanceData.items.map((it, idx) => {
        return [
          `${idx + 1}. Requirement: ${it.label}`,
          `   Category: ${it.categoryName || 'Custom/Ambiguous'}`,
          `   Official Rule: ${it.officialRule}`,
          `   Acceptable Examples: ${it.acceptableExamples.join(', ')}`,
          it.isAmbiguous ? `   [!] Note: ${it.confirmationNotice}` : '',
          '',
        ].filter(Boolean).join('\n');
      }),
      'Notice: This guidance is informational only and does not verify personal documents.',
    ];

    navigator.clipboard?.writeText(textLines.join('\n'));
    setCopied(true);
    toast?.info?.('Document guidance summary copied to clipboard!');
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="doc-guidance-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '850px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          borderRadius: '1rem',
          border: '1px solid var(--border-main)',
          backgroundColor: 'var(--bg-primary, #ffffff)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-main)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'var(--bg-secondary, #f8fafc)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '2.5rem',
                height: '2.5rem',
                borderRadius: '0.6rem',
                backgroundColor: 'rgba(14, 165, 233, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#0284c7',
              }}
            >
              <FileText size={22} />
            </div>
            <div>
              <h2 id="doc-guidance-title" style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
                Document-Type Requirements Guidance
              </h2>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {service.name} • Category explanations without storing document contents
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close document guidance modal"
            className="btn btn-ghost"
            style={{ padding: '0.5rem', borderRadius: '0.5rem' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Privacy & Zero-Data-Ingestion Guarantee Banner */}
        <div
          style={{
            padding: '0.9rem 1.5rem',
            backgroundColor: 'rgba(16, 185, 129, 0.08)',
            borderBottom: '1px solid rgba(16, 185, 129, 0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <ShieldCheck size={20} color="#059669" style={{ flexShrink: 0 }} />
          <div style={{ fontSize: '0.82rem', color: '#065f46', lineHeight: '1.4' }}>
            <strong>Zero Document Ingestion Guarantee:</strong> This guidance is generated entirely from published
            service requirement titles. Civic Help Setu <strong>never uploads, inspects, parses, or retains</strong> your
            personal document files or identity bytes.
          </div>
        </div>

        {/* Search & Filter Controls */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderBottom: '1px solid var(--border-main)',
            display: 'flex',
            gap: '1rem',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-secondary, #f8fafc)',
          }}
        >
          <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: '0.8rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-tertiary)',
              }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter requirement names or categories..."
              style={{
                width: '100%',
                padding: '0.6rem 0.8rem 0.6rem 2.4rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--border-main)',
                fontSize: '0.85rem',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={`btn ${filterType === 'all' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '0.45rem 0.75rem', fontSize: '0.8rem' }}
            >
              All ({guidanceData.totalCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('standard')}
              className={`btn ${filterType === 'standard' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '0.45rem 0.75rem', fontSize: '0.8rem' }}
            >
              Standard ({guidanceData.standardCount})
            </button>
            {guidanceData.ambiguousCount > 0 && (
              <button
                type="button"
                onClick={() => setFilterType('ambiguous')}
                className={`btn ${filterType === 'ambiguous' ? 'btn-primary' : 'btn-secondary'}`}
                style={{
                  padding: '0.45rem 0.75rem',
                  fontSize: '0.8rem',
                  color: filterType === 'ambiguous' ? '#fff' : '#b45309',
                  borderColor: '#f59e0b',
                }}
              >
                Needs Confirmation ({guidanceData.ambiguousCount})
              </button>
            )}
            <button
              type="button"
              onClick={handleCopySummary}
              className="btn btn-secondary"
              style={{ padding: '0.45rem 0.75rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            >
              {copied ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Requirements List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'grid', gap: '1rem' }}>
          {filteredItems.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <HelpCircle size={32} style={{ opacity: 0.4, marginBottom: '0.5rem' }} />
              <p>No matching document requirements found.</p>
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const isExpanded = expandedIndex === idx || filteredItems.length === 1;

              return (
                <div
                  key={idx}
                  className="card"
                  style={{
                    borderRadius: '0.75rem',
                    border: item.isAmbiguous ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid var(--border-main)',
                    overflow: 'hidden',
                  }}
                >
                  {/* Item Accordion Bar */}
                  <div
                    onClick={() => toggleExpand(idx)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        toggleExpand(idx);
                      }
                    }}
                    style={{
                      padding: '1rem 1.25rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                      backgroundColor: item.isAmbiguous
                        ? 'rgba(245, 158, 11, 0.05)'
                        : 'var(--bg-secondary, #f8fafc)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span
                        style={{
                          width: '1.75rem',
                          height: '1.75rem',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          backgroundColor: item.isAmbiguous ? 'rgba(245, 158, 11, 0.15)' : 'rgba(59, 130, 246, 0.1)',
                          color: item.isAmbiguous ? '#b45309' : '#2563eb',
                        }}
                      >
                        {idx + 1}
                      </span>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>{item.label}</h4>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              padding: '0.15rem 0.5rem',
                              borderRadius: '0.3rem',
                              fontWeight: 600,
                              backgroundColor: item.isAmbiguous ? '#fef3c7' : '#e0f2fe',
                              color: item.isAmbiguous ? '#92400e' : '#0369a1',
                            }}
                          >
                            {item.categoryName}
                          </span>
                          {item.isAmbiguous && (
                            <span
                              style={{
                                fontSize: '0.75rem',
                                color: '#b45309',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                              }}
                            >
                              <AlertTriangle size={13} /> Needs Department Confirmation
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div>{isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</div>
                  </div>

                  {/* Expanded Item Details */}
                  {isExpanded && (
                    <div style={{ padding: '1.25rem', display: 'grid', gap: '1rem', borderTop: '1px solid var(--border-main)' }}>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                        {item.description}
                      </p>

                      {/* Official Rule Callout */}
                      <div
                        style={{
                          padding: '0.85rem 1rem',
                          borderRadius: '0.5rem',
                          backgroundColor: 'rgba(59, 130, 246, 0.05)',
                          borderLeft: '4px solid #2563eb',
                        }}
                      >
                        <strong style={{ display: 'block', fontSize: '0.8rem', color: '#1d4ed8', marginBottom: '0.2rem' }}>
                          Official Acceptance Rule:
                        </strong>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{item.officialRule}</div>
                      </div>

                      {/* Acceptable Examples vs Common Pitfalls */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                        {/* Acceptable Examples */}
                        <div
                          style={{
                            padding: '0.85rem',
                            borderRadius: '0.5rem',
                            backgroundColor: 'rgba(16, 185, 129, 0.04)',
                            border: '1px solid rgba(16, 185, 129, 0.2)',
                          }}
                        >
                          <strong style={{ display: 'block', fontSize: '0.8rem', color: '#047857', marginBottom: '0.4rem' }}>
                            Acceptable Document Examples:
                          </strong>
                          <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'grid', gap: '0.3rem' }}>
                            {item.acceptableExamples.map((ex, i) => (
                              <li key={i}>{ex}</li>
                            ))}
                          </ul>
                        </div>

                        {/* Common Pitfalls / Rejection reasons */}
                        <div
                          style={{
                            padding: '0.85rem',
                            borderRadius: '0.5rem',
                            backgroundColor: 'rgba(239, 68, 68, 0.04)',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                          }}
                        >
                          <strong style={{ display: 'block', fontSize: '0.8rem', color: '#b91c1c', marginBottom: '0.4rem' }}>
                            Common Rejection Pitfalls:
                          </strong>
                          <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'grid', gap: '0.3rem' }}>
                            {item.unacceptableExamples.map((pitfall, i) => (
                              <li key={i}>{pitfall}</li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {/* Confirmation Alert */}
                      <div
                        style={{
                          fontSize: '0.8rem',
                          color: item.isAmbiguous ? '#b45309' : 'var(--text-tertiary)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                        }}
                      >
                        <Info size={14} />
                        {item.confirmationNotice}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border-main)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'var(--bg-secondary, #f8fafc)',
          }}
        >
          <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
            Guidance only • Not automated verification
          </span>
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default DocumentTypeGuidanceModal;