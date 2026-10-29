import { Sparkles, HelpCircle, ArrowRight, Tag } from 'lucide-react';
import { getDidYouMeanSuggestion, getFuzzyMatchSummary } from '../../services/searchRankingEngine';

const QUICK_CHIPS = [
  { label: 'Free Services', query: '', feeType: 'Free' },
  { label: 'Fast-Track (<7 days)', query: '', speed: 'Fast' },
  { label: 'Aadhaar & Identity', query: 'aadhaar' },
  { label: 'Driving License', query: 'driving license' },
  { label: 'Passport', query: 'passport' },
  { label: 'Income & Certificates', query: 'certificate' },
];

const SearchAnalyticsBar = ({
  searchQuery = '',
  onSelectSuggestion = () => {},
  onSelectChip = () => {},
}) => {
  const suggestion = getDidYouMeanSuggestion(searchQuery);
  const fuzzySummary = getFuzzyMatchSummary(searchQuery);

  return (
    <div style={{ marginBottom: '1.25rem' }}>
      {/* Regional & Phonetic Transliteration Banner */}
      {fuzzySummary?.isTransliterated && (
        <div
          className="animate-fade-in"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.6rem',
            padding: '0.5rem 1rem',
            borderRadius: '99px',
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            marginBottom: '0.85rem',
            fontSize: '0.875rem',
          }}
        >
          <Sparkles size={16} color="#10b981" />
          <span style={{ color: 'var(--text-secondary)' }}>Matching civic term:</span>
          <button
            type="button"
            onClick={() => onSelectSuggestion(fuzzySummary.suggestedTerm)}
            style={{
              background: 'none',
              border: 'none',
              color: '#34d399',
              fontWeight: '700',
              cursor: 'pointer',
              textDecoration: 'underline',
              padding: 0,
            }}
          >
            &quot;{fuzzySummary.suggestedTerm}&quot;
          </button>
        </div>
      )}

      {/* "Did you mean" suggestion card */}
      {suggestion && (
        <div
          className="animate-fade-in"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.6rem',
            padding: '0.5rem 1rem',
            borderRadius: '99px',
            background: 'rgba(56, 189, 248, 0.12)',
            border: '1px solid rgba(56, 189, 248, 0.35)',
            marginBottom: '0.85rem',
            fontSize: '0.875rem',
          }}
        >
          <Sparkles size={16} color="var(--accent-main)" />
          <span style={{ color: 'var(--text-secondary)' }}>Did you mean:</span>
          <button
            type="button"
            onClick={() => onSelectSuggestion(suggestion)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--accent-main)',
              fontWeight: '700',
              cursor: 'pointer',
              textDecoration: 'underline',
              padding: 0,
            }}
          >
            "{suggestion}"?
          </button>
        </div>
      )}

      {/* Popular quick-filter exploration chips */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', fontWeight: '700', textTransform: 'uppercase' }}>
          Trending:
        </span>
        {QUICK_CHIPS.map((chip, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onSelectChip(chip)}
            style={{
              padding: '0.3rem 0.75rem',
              borderRadius: '99px',
              border: '1px solid var(--border-light)',
              background: 'var(--glass-bg)',
              color: 'var(--text-secondary)',
              fontSize: '0.78rem',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent-main)';
              e.currentTarget.style.color = 'var(--accent-main)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-light)';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            {chip.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default SearchAnalyticsBar;
