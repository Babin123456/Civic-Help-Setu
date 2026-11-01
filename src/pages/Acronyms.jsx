import { useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, ShieldAlert, BookOpen, Copy, Check, X, Filter, Tag, ArrowRight } from 'lucide-react';
import {
  filterAcronyms,
  getAcronymCategoryCounts,
  getAcronymCategory,
  ACRONYM_CATEGORIES,
  ACRONYM_CATEGORY_LABELS,
  formatAcronymCitation,
  resolveRelatedServices,
} from '../utils/acronymSearch.js';
import { CIVIC_ACRONYMS } from '../data/civicAcronyms.js';

/**
 * Acronyms Directory (#263, #430)
 *
 * Standalone searchable and categorized directory of civic acronyms and abbreviations
 * with letter indexing, category pills, clipboard citation export, and deep links
 * back to related service catalogue records.
 */
const Acronyms = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '');
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || ACRONYM_CATEGORIES.ALL);
  const [selectedLetter, setSelectedLetter] = useState(searchParams.get('letter') || '');
  const [copiedId, setCopiedId] = useState(null);

  // Dynamic alphabet list based on present acronyms
  const availableLetters = useMemo(() => {
    const letters = new Set();
    CIVIC_ACRONYMS.forEach((entry) => {
      const char = (entry.acronym || '').charAt(0).toUpperCase();
      if (char) letters.add(char);
    });
    return Array.from(letters).sort();
  }, []);

  const categoryCounts = useMemo(() => getAcronymCategoryCounts(), []);

  // Filtered and sorted results
  const results = useMemo(() => {
    return filterAcronyms({
      query: searchTerm,
      category: selectedCategory,
      letter: selectedLetter,
      sortBy: 'acronym-asc',
    });
  }, [searchTerm, selectedCategory, selectedLetter]);

  const handleCopyCitation = (entry) => {
    const text = formatAcronymCitation(entry);
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    setCopiedId(entry.id);
    setTimeout(() => {
      setCopiedId((current) => (current === entry.id ? null : current));
    }, 2000);
  };

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedCategory(ACRONYM_CATEGORIES.ALL);
    setSelectedLetter('');
    setSearchParams({});
  };

  const isFiltered = Boolean(searchTerm.trim() || selectedCategory !== ACRONYM_CATEGORIES.ALL || selectedLetter);

  return (
    <div className="section animate-fade-in" style={{ paddingBottom: '3rem' }}>
      <div className="container" style={{ maxWidth: '880px' }}>
        {/* Header */}
        <div style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: 'rgba(56, 189, 248, 0.12)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
            }}
          >
            <BookOpen size={22} color="var(--accent-main)" />
          </div>
          <div>
            <h1
              style={{
                fontSize: 'clamp(1.5rem, 4vw, 2rem)',
                fontWeight: '800',
                margin: 0,
                color: 'var(--text-primary)',
                letterSpacing: '-0.02em',
              }}
            >
              Civic Acronym Directory
            </h1>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>
              Verified definitions, categories, and service mappings for government abbreviations
            </p>
          </div>
        </div>

        <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: '1.6' }}>
          Search standard abbreviations used across official Indian government citizen services.
          Browse by functional category, filter alphabetically, or copy verified citations to your notes.
        </p>

        {/* Controls Card */}
        <div
          style={{
            padding: '1.25rem',
            borderRadius: '0.75rem',
            background: 'var(--glass-bg)',
            border: '1px solid var(--border-light)',
            marginBottom: '1.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          {/* Search bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.6rem 0.85rem',
              borderRadius: '0.5rem',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid var(--border-light)',
            }}
          >
            <Search size={18} color="var(--text-tertiary)" />
            <input
              type="text"
              className="input-field"
              placeholder="Search acronym or phrase (e.g., NOC, EWS, Below Poverty Line)..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
              }}
              aria-label="Search acronyms"
              style={{
                border: 'none',
                background: 'transparent',
                padding: '0.2rem',
                width: '100%',
                outline: 'none',
                color: 'var(--text-primary)',
                fontSize: '0.9rem',
              }}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                aria-label="Clear search"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-tertiary)',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Category Filter Pills */}
          <div>
            <div
              style={{
                fontSize: '0.75rem',
                fontWeight: '700',
                color: 'var(--text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                marginBottom: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <Filter size={13} />
              Filter by Category
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {Object.entries(ACRONYM_CATEGORY_LABELS).map(([catKey, catLabel]) => {
                const isSelected = selectedCategory === catKey;
                const count = categoryCounts[catKey] ?? 0;
                return (
                  <button
                    key={catKey}
                    type="button"
                    onClick={() => setSelectedCategory(catKey)}
                    style={{
                      padding: '0.3rem 0.65rem',
                      borderRadius: '9999px',
                      fontSize: '0.78rem',
                      fontWeight: isSelected ? '700' : '500',
                      background: isSelected ? 'var(--accent-main)' : 'rgba(255, 255, 255, 0.05)',
                      color: isSelected ? '#000000' : 'var(--text-secondary)',
                      border: isSelected ? '1px solid var(--accent-main)' : '1px solid var(--border-light)',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      transition: 'all 0.15s ease-in-out',
                    }}
                  >
                    <span>{catLabel}</span>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        padding: '0.05rem 0.35rem',
                        borderRadius: '9999px',
                        background: isSelected ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                        color: isSelected ? '#000' : 'var(--text-tertiary)',
                      }}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Letter Index */}
          <div>
            <div
              style={{
                fontSize: '0.75rem',
                fontWeight: '700',
                color: 'var(--text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                marginBottom: '0.4rem',
              }}
            >
              Alphabetical Index
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => setSelectedLetter('')}
                style={{
                  padding: '0.2rem 0.5rem',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: !selectedLetter ? '700' : '500',
                  background: !selectedLetter ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                  color: !selectedLetter ? 'var(--accent-main)' : 'var(--text-secondary)',
                  border: '1px solid var(--border-light)',
                  cursor: 'pointer',
                }}
              >
                All
              </button>
              {availableLetters.map((letter) => {
                const isActive = selectedLetter === letter;
                return (
                  <button
                    key={letter}
                    type="button"
                    onClick={() => setSelectedLetter(isActive ? '' : letter)}
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: isActive ? '700' : '500',
                      background: isActive ? 'var(--accent-main)' : 'transparent',
                      color: isActive ? '#000' : 'var(--text-secondary)',
                      border: isActive ? '1px solid var(--accent-main)' : '1px solid var(--border-light)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {letter}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Filters Summary */}
          {isFiltered && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: '0.5rem',
                borderTop: '1px solid var(--border-light)',
                fontSize: '0.8rem',
                color: 'var(--text-tertiary)',
              }}
            >
              <span>
                Active filters applied — Showing <strong>{results.length}</strong> matching entries
              </span>
              <button
                type="button"
                onClick={resetFilters}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-main)',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  textDecoration: 'underline',
                }}
              >
                Reset filters
              </button>
            </div>
          )}
        </div>

        {/* Empty state when nothing matches */}
        {results.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: '2.5rem',
              color: 'var(--text-secondary)',
              background: 'rgba(234, 179, 8, 0.08)',
              border: '1px solid rgba(234, 179, 8, 0.25)',
              borderRadius: '0.75rem',
            }}
          >
            <ShieldAlert size={32} color="#eab308" style={{ margin: '0 auto 0.75rem' }} />
            <div style={{ fontWeight: '700', fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
              No acronym entries found
            </div>
            <p style={{ margin: '0 auto 1.25rem', fontSize: '0.82rem', maxWidth: '480px', lineHeight: '1.5' }}>
              Civic Help Setu does not expand unknown acronyms by guessing. Only verified government terminology is
              indexed.
            </p>
            <button
              type="button"
              onClick={resetFilters}
              className="btn btn-secondary"
              style={{ fontSize: '0.82rem', padding: '0.4rem 1rem' }}
            >
              Clear filters and view all
            </button>
          </div>
        )}

        {/* Results List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {results.map((entry) => {
            const relatedServices = resolveRelatedServices(entry);
            const categoryKey = getAcronymCategory(entry.id);
            const categoryLabel = ACRONYM_CATEGORY_LABELS[categoryKey] || 'General';
            const isCopied = copiedId === entry.id;

            return (
              <div
                key={entry.id}
                style={{
                  padding: '1.1rem 1.25rem',
                  borderRadius: '0.75rem',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-light)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.6rem',
                  transition: 'border-color 0.15s ease-in-out',
                }}
              >
                {/* Header row */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: '0.78rem',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '4px',
                        background: 'rgba(56, 189, 248, 0.15)',
                        color: 'var(--accent-main)',
                        fontWeight: '700',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {entry.acronym}
                    </span>
                    <span style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                      {entry.expandedForm}
                    </span>
                    <span
                      style={{
                        fontSize: '0.68rem',
                        padding: '0.1rem 0.45rem',
                        borderRadius: '9999px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid var(--border-light)',
                        color: 'var(--text-tertiary)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                      }}
                    >
                      <Tag size={10} />
                      {categoryLabel}
                    </span>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => handleCopyCitation(entry)}
                      aria-label={`Copy definition for ${entry.acronym}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        fontSize: '0.72rem',
                        padding: '0.25rem 0.55rem',
                        borderRadius: '4px',
                        background: isCopied ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                        border: isCopied ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid var(--border-light)',
                        color: isCopied ? '#22c55e' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease-in-out',
                      }}
                    >
                      {isCopied ? <Check size={12} /> : <Copy size={12} />}
                      <span>{isCopied ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                {/* Plain-language explanation */}
                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: '1.55' }}>
                  {entry.plainLanguageExplanation}
                </p>

                {/* Related services links */}
                {relatedServices.length > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.3rem',
                      marginTop: '0.2rem',
                      paddingTop: '0.5rem',
                      borderTop: '1px solid rgba(255, 255, 255, 0.04)',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: '700',
                        color: 'var(--text-tertiary)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      Related Citizen Services
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                      {relatedServices.map((service) => (
                        <Link
                          key={service.id}
                          to={`/services/${service.id}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            fontSize: '0.78rem',
                            color: 'var(--accent-main)',
                            fontWeight: '500',
                            padding: '0.15rem 0.5rem',
                            borderRadius: '4px',
                            background: 'rgba(56, 189, 248, 0.08)',
                            border: '1px solid rgba(56, 189, 248, 0.15)',
                            textDecoration: 'none',
                          }}
                        >
                          <span>{service.name}</span>
                          <ArrowRight size={11} />
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Acronyms;
