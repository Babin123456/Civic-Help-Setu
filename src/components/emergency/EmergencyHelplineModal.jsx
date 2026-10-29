import { useState, useEffect, useRef } from 'react';
import {
  PhoneCall,
  ShieldAlert,
  Search,
  X,
  Copy,
  Check,
  Clock,
  Sparkles,
  Phone
} from 'lucide-react';
import {
  searchEmergencyHelplines,
  getEmergencyCategories,
  formatDialerLink
} from '../../services/emergencyHelplineService';

export default function EmergencyHelplineModal({ isOpen, onClose }) {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [copiedId, setCopiedId] = useState(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      searchInputRef.current?.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const helplines = searchEmergencyHelplines(query, activeCategory);
  const categories = getEmergencyCategories();

  const handleCopyNumber = async (id, number) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(number);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
      }
    } catch {
      // Fallback
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.8)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2500,
        padding: '1rem',
      }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="emergency-modal-title"
        className="glass-panel animate-scale-up"
        style={{
          width: 'min(94vw, 680px)',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '1.25rem',
          background: 'var(--bg-card, #1e293b)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-light, #334155)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(239, 68, 68, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.2)',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ShieldAlert size={22} aria-hidden="true" />
            </div>
            <div>
              <h3 id="emergency-modal-title" style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                Civic Emergency &amp; SOS Helplines
              </h3>
              <p style={{ margin: '0.15rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Official 24x7 Government Toll-Free Emergency Response Directory
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close emergency modal"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '0.35rem',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Search & Category Filter Section */}
        <div style={{ padding: '1rem 1.5rem 0.5rem', borderBottom: '1px solid var(--border-light, #334155)' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: 'var(--bg-main, #0f172a)',
              border: '1px solid var(--border-light, #334155)',
              borderRadius: '0.5rem',
              padding: '0.5rem 0.75rem',
              marginBottom: '0.75rem',
            }}
          >
            <Search size={16} color="var(--text-secondary)" aria-hidden="true" />
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search helpline name, service, or number (e.g. cyber, women, 112, ambulance)..."
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary, #f8fafc)',
                fontSize: '0.875rem',
                width: '100%',
                outline: 'none',
              }}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Category Pills */}
          <div
            style={{
              display: 'flex',
              gap: '0.4rem',
              overflowX: 'auto',
              paddingBottom: '0.5rem',
              scrollbarWidth: 'none',
            }}
          >
            {categories.map((cat) => {
              const active = activeCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  style={{
                    padding: '0.25rem 0.75rem',
                    borderRadius: '9999px',
                    fontSize: '0.75rem',
                    fontWeight: active ? '700' : '500',
                    background: active ? 'var(--accent-main, #38bdf8)' : 'rgba(255, 255, 255, 0.05)',
                    color: active ? 'var(--bg-main, #0f172a)' : 'var(--text-secondary)',
                    border: '1px solid',
                    borderColor: active ? 'var(--accent-main, #38bdf8)' : 'var(--border-light, #334155)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* Helplines List */}
        <div style={{ padding: '1rem 1.5rem', overflowY: 'auto', flex: 1, display: 'grid', gap: '0.75rem' }}>
          {helplines.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
              No helplines found matching &quot;{query}&quot;. Try a different emergency keyword.
            </div>
          ) : (
            helplines.map((item) => {
              const isCopied = copiedId === item.id;
              const dialerUrl = formatDialerLink(item.number);

              return (
                <div
                  key={item.id}
                  style={{
                    padding: '0.85rem 1rem',
                    borderRadius: '0.75rem',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-light, #334155)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '0.75rem',
                  }}
                >
                  <div style={{ flex: '1 1 300px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontSize: '1.25rem',
                          fontWeight: '800',
                          color: item.badgeColor || '#ef4444',
                          letterSpacing: '0.5px',
                        }}
                      >
                        {item.number}
                      </span>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          padding: '0.1rem 0.45rem',
                          borderRadius: '4px',
                          background: 'rgba(255, 255, 255, 0.08)',
                          color: 'var(--text-secondary)',
                          fontWeight: '600',
                        }}
                      >
                        {item.category}
                      </span>
                      {item.tollFree && (
                        <span
                          style={{
                            fontSize: '0.7rem',
                            padding: '0.1rem 0.45rem',
                            borderRadius: '4px',
                            background: 'rgba(16, 185, 129, 0.15)',
                            color: '#10b981',
                            fontWeight: '700',
                          }}
                        >
                          Toll-Free 24x7
                        </span>
                      )}
                    </div>
                    <div style={{ fontWeight: '600', fontSize: '0.9rem', color: 'var(--text-primary)', marginTop: '0.2rem' }}>
                      {item.name}
                    </div>
                    <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                      {item.description}
                    </p>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => handleCopyNumber(item.id, item.number)}
                      aria-label={`Copy ${item.name} phone number`}
                      style={{
                        padding: '0.45rem 0.65rem',
                        borderRadius: '0.5rem',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid var(--border-light, #334155)',
                        color: isCopied ? '#10b981' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        fontSize: '0.75rem',
                      }}
                    >
                      {isCopied ? <Check size={14} /> : <Copy size={14} />}
                      <span>{isCopied ? 'Copied' : 'Copy'}</span>
                    </button>

                    <a
                      href={dialerUrl}
                      aria-label={`Call ${item.name} at ${item.number}`}
                      style={{
                        padding: '0.45rem 0.85rem',
                        borderRadius: '0.5rem',
                        background: '#ef4444',
                        color: '#ffffff',
                        textDecoration: 'none',
                        fontWeight: '700',
                        fontSize: '0.8rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        boxShadow: '0 2px 6px rgba(239, 68, 68, 0.3)',
                      }}
                    >
                      <PhoneCall size={14} />
                      <span>Call Now</span>
                    </a>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
