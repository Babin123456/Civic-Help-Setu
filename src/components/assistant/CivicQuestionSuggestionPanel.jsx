import { useState, useMemo } from 'react';
import { HelpCircle, Sparkles, ArrowRight, CornerDownLeft, X, Layers } from 'lucide-react';
import {
  getCivicQuestionSuggestions,
  deduplicateSuggestions,
} from '../../services/civicQuestionSuggestionService.js';
import { getAllServices } from '../../services/serviceCatalog.js';

/**
 * CivicQuestionSuggestionPanel
 *
 * Displays contextual starter questions for the AI assistant.
 * Adapts questions based on the active service or current page context,
 * provides generic fallbacks when context is missing, and ensures all
 * suggestions remain neutral exploratory inquiries (no guaranteed approvals).
 */
export default function CivicQuestionSuggestionPanel({
  service = null,
  serviceId = null,
  page = null,
  onSelectSuggestion = () => {},
  onFillSuggestion = null,
  onClearService = null,
  disabled = false,
  allowServiceSwitch = true,
}) {
  const [selectedServiceId, setSelectedServiceId] = useState(serviceId || service?.id || '');

  // Keep internal state aligned if props change
  const effectiveServiceId = serviceId || service?.id || selectedServiceId || null;

  const allAvailableServices = useMemo(() => {
    if (!allowServiceSwitch) return [];
    try {
      return getAllServices({ includeArchived: false });
    } catch {
      return [];
    }
  }, [allowServiceSwitch]);

  const activeService = useMemo(() => {
    if (service && service.id === effectiveServiceId) return service;
    if (!effectiveServiceId) return null;
    return allAvailableServices.find((s) => s.id === effectiveServiceId) || null;
  }, [service, effectiveServiceId, allAvailableServices]);

  const suggestions = useMemo(() => {
    const raw = getCivicQuestionSuggestions({
      service: activeService,
      serviceId: effectiveServiceId,
      page,
    });
    return deduplicateSuggestions(raw);
  }, [activeService, effectiveServiceId, page]);

  const handleClearContext = () => {
    setSelectedServiceId('');
    if (typeof onClearService === 'function') {
      onClearService();
    }
  };

  const handleServiceChange = (e) => {
    setSelectedServiceId(e.target.value);
  };

  return (
    <section
      role="region"
      aria-labelledby="civic-suggestions-title"
      className="card animate-fade-in"
      style={{
        padding: '1.15rem 1.35rem',
        marginBottom: '1.5rem',
        borderRadius: '1rem',
        background: 'var(--glass-bg)',
        borderColor: 'var(--border-main)',
        boxShadow: 'var(--shadow-sm, 0 2px 8px rgba(0,0,0,0.04))',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          marginBottom: '0.85rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              background: 'var(--accent-light, rgba(56, 189, 248, 0.15))',
              color: 'var(--accent-main)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {activeService ? <Sparkles size={16} /> : <HelpCircle size={16} />}
          </div>
          <div>
            <h2
              id="civic-suggestions-title"
              style={{
                fontSize: '0.95rem',
                fontWeight: '700',
                margin: 0,
                color: 'var(--text-primary)',
              }}
            >
              Suggested Questions
            </h2>
            <p
              style={{
                margin: 0,
                fontSize: '0.78rem',
                color: 'var(--text-secondary)',
              }}
            >
              {activeService
                ? `Context tailored to ${activeService.name}`
                : 'Common public service questions to get started'}
            </p>
          </div>
        </div>

        {/* Active Context Badge or Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {activeService ? (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.25rem 0.65rem',
                borderRadius: '99px',
                background: 'var(--accent-light, rgba(56, 189, 248, 0.12))',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                fontSize: '0.78rem',
                fontWeight: '600',
                color: 'var(--accent-main)',
              }}
            >
              <span>{activeService.name}</span>
              <button
                type="button"
                onClick={handleClearContext}
                aria-label={`Clear ${activeService.name} context`}
                title="Clear service context"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'inherit',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <X size={13} />
              </button>
            </div>
          ) : (
            allowServiceSwitch &&
            allAvailableServices.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <label
                  htmlFor="civic-service-filter-select"
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-tertiary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                  }}
                >
                  <Layers size={12} /> Filter by service:
                </label>
                <select
                  id="civic-service-filter-select"
                  aria-label="Filter starter questions by civic service"
                  value={effectiveServiceId || ''}
                  onChange={handleServiceChange}
                  style={{
                    padding: '0.25rem 0.5rem',
                    borderRadius: '0.5rem',
                    fontSize: '0.78rem',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-main)',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <option value="">General Public Services</option>
                  {allAvailableServices.map((svc) => (
                    <option key={svc.id} value={svc.id}>
                      {svc.name}
                    </option>
                  ))}
                </select>
              </div>
            )
          )}
        </div>
      </div>

      {/* Suggestion Buttons Grid */}
      <div
        role="group"
        aria-label="Civic question suggestions"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '0.5rem',
        }}
      >
        {suggestions.map((question, index) => (
          <div
            key={`${question}-${index}`}
            style={{
              display: 'flex',
              alignItems: 'stretch',
              borderRadius: '0.75rem',
              border: '1px solid var(--border-light)',
              background: 'var(--bg-secondary)',
              transition: 'border-color 0.2s, background-color 0.2s',
            }}
          >
            {/* Primary Action Button: Sends the message */}
            <button
              type="button"
              disabled={disabled}
              onClick={() => onSelectSuggestion(question)}
              aria-label={`Ask: ${question}`}
              style={{
                flex: 1,
                padding: '0.65rem 0.85rem',
                background: 'transparent',
                border: 'none',
                textAlign: 'left',
                color: 'var(--text-primary)',
                fontSize: '0.86rem',
                lineHeight: '1.45',
                cursor: disabled ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.5rem',
                borderRadius: '0.75rem 0 0 0.75rem',
              }}
              onFocus={(e) => {
                e.currentTarget.parentElement.style.borderColor = 'var(--accent-main)';
              }}
              onBlur={(e) => {
                e.currentTarget.parentElement.style.borderColor = 'var(--border-light)';
              }}
              onMouseEnter={(e) => {
                e.currentTarget.parentElement.style.borderColor = 'var(--accent-main)';
                e.currentTarget.parentElement.style.background = 'var(--glass-bg-hover, rgba(56, 189, 248, 0.05))';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.parentElement.style.borderColor = 'var(--border-light)';
                e.currentTarget.parentElement.style.background = 'var(--bg-secondary)';
              }}
            >
              <span>{question}</span>
              <ArrowRight
                size={14}
                style={{
                  flexShrink: 0,
                  color: 'var(--accent-main)',
                  opacity: 0.7,
                }}
              />
            </button>

            {/* Optional Fill-Only Button: Populates the text input without immediately submitting */}
            {typeof onFillSuggestion === 'function' && (
              <button
                type="button"
                disabled={disabled}
                onClick={() => onFillSuggestion(question)}
                aria-label={`Edit in input box: ${question}`}
                title="Fill in search input without sending"
                style={{
                  padding: '0 0.6rem',
                  background: 'transparent',
                  border: 'none',
                  borderLeft: '1px solid var(--border-light)',
                  color: 'var(--text-tertiary)',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '0 0.75rem 0.75rem 0',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.color = 'var(--accent-main)';
                  e.currentTarget.parentElement.style.borderColor = 'var(--accent-main)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.color = 'var(--text-tertiary)';
                  e.currentTarget.parentElement.style.borderColor = 'var(--border-light)';
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--accent-main)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--text-tertiary)';
                }}
              >
                <CornerDownLeft size={13} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Safety & Policy Notice */}
      <p
        style={{
          margin: '0.85rem 0 0',
          fontSize: '0.72rem',
          color: 'var(--text-tertiary)',
          lineHeight: '1.4',
        }}
      >
        Note: Suggestions provide guidance on procedural rules. Official eligibility and approvals are decided solely by the designated government authorities.
      </p>
    </section>
  );
}

