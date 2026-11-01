import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, ShieldAlert, BookOpen } from 'lucide-react';
import { searchAcronyms, resolveRelatedServices } from '../utils/acronymSearch.js';

/**
 * Acronyms (#263)
 *
 * Standalone searchable directory of civic acronyms and abbreviations with
 * links back to the related service catalogue records.
 */
const Acronyms = () => {
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '');
  const results = searchAcronyms(searchTerm);

  return (
    <div className="section animate-fade-in">
      <div className="container" style={{ maxWidth: '800px' }}>
        <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <BookOpen size={24} color="var(--accent-main)" />
          <h1 style={{ fontSize: 'clamp(1.5rem, 5vw, 2rem)', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
            Acronym Directory
          </h1>
        </div>

        <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: '1.6' }}>
          Search for abbreviations used across civic service guides. Select an entry to see its plain-language
          explanation and the related services it applies to.
        </p>

        {/* Search */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.55rem 0.85rem',
            borderRadius: '0.6rem',
            background: 'var(--glass-bg)',
            border: '1px solid var(--border-light)',
            marginBottom: '1.5rem',
            maxWidth: '420px',
          }}
        >
          <Search size={18} color="var(--text-tertiary)" />
          <input
            type="text"
            className="input-field"
            placeholder="Search acronym or expanded phrase (e.g., NOC, EWS, Below Poverty Line)..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
            }}
            style={{ border: 'none', background: 'transparent', padding: '0.2rem', width: '100%', outline: 'none' }}
          />
        </div>

        {/* Empty state when a search term is given but nothing matches */}
        {searchTerm.trim() && results.length === 0 && (
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
              No acronym found for "{searchTerm}"
            </div>
            <p style={{ margin: '0 auto 1rem', fontSize: '0.82rem', maxWidth: '480px', lineHeight: '1.5' }}>
              Civic Help Setu does not expand unknown acronyms by guessing. Try a different term or browse the full
              directory below.
            </p>
          </div>
        )}

        {/* Results list (or full directory when no search term) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {results.length === 0 && !searchTerm.trim() ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
              No acronym entries are available yet.
            </div>
          ) : (
            results.map((entry) => {
              const relatedServices = resolveRelatedServices(entry);
              return (
                <div
                  key={entry.id}
                  style={{
                    padding: '1rem 1.25rem',
                    borderRadius: '0.75rem',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-light)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          padding: '0.1rem 0.4rem',
                          borderRadius: '4px',
                          background: 'rgba(56, 189, 248, 0.15)',
                          color: 'var(--accent-main)',
                          fontWeight: '700',
                        }}
                      >
                        {entry.acronym}
                      </span>
                      <span style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                        {entry.expandedForm}
                      </span>
                    </div>
                    <a
                      href="#"
                      style={{
                        fontSize: '0.72rem',
                        color: 'var(--text-tertiary)',
                        textDecoration: 'underline',
                      }}
                    >
                      Jump to service details
                    </a>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: '1.5' }}>
                    {entry.plainLanguageExplanation}
                  </p>
                  {relatedServices.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.1rem' }}>
                      <div style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                        Related services
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        {relatedServices.map((service) => (
                          <Link
                            key={service.id}
                            to={`/services/${service.id}`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              fontSize: '0.82rem',
                              color: 'var(--accent-main)',
                              fontWeight: '600',
                              textDecoration: 'underline',
                              textDecorationStyle: 'dotted',
                              padding: '0.15rem 0',
                            }}
                          >
                            {service.name}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default Acronyms;
