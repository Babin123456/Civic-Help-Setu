import { useState } from 'react';
import { Search, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useVoiceSearch } from '../hooks/useVoiceSearch';
import VoiceSearchPanel, { VoiceMicButton } from './common/VoiceSearchPanel';

const SearchBox = ({
  placeholder = 'Search for a service...',
  size = 'normal',
  onSearch,
  value: controlledValue,
  onChange: controlledOnChange,
}) => {
  const [internalQuery, setInternalQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [voicePanelOpen, setVoicePanelOpen] = useState(false);
  const navigate = useNavigate();

  const isControlled = controlledValue !== undefined;
  const currentQuery = isControlled ? controlledValue : internalQuery;

  const setQueryValue = (nextValue) => {
    if (isControlled && controlledOnChange) {
      controlledOnChange(nextValue);
    } else {
      setInternalQuery(nextValue);
    }
  };

  const voice = useVoiceSearch({
    onTranscriptChange: (spokenText) => {
      // Keep the main search input synchronized for direct editing, without auto-submitting
      setQueryValue(spokenText);
    },
  });

  const handleInputChange = (e) => {
    const nextValue = e.target.value;
    setQueryValue(nextValue);
    if (voicePanelOpen) {
      voice.setTranscriptDraft(nextValue);
    }
  };

  const submitQuery = (rawText) => {
    const q = String(rawText || '').trim();
    if (!q) return;

    if (onSearch) {
      onSearch(q);
    } else {
      navigate(`/assistant?q=${encodeURIComponent(q)}`);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    submitQuery(currentQuery);
  };

  const handleMicClick = () => {
    setVoicePanelOpen(true);
    voice.requestStartListening();
  };

  const isLarge = size === 'large';

  return (
    <div style={{ position: 'relative', width: '100%', zIndex: 10 }}>
      <form onSubmit={handleSearch} style={{ position: 'relative', width: '100%' }}>
        <div
          style={{
            position: 'absolute',
            left: isLarge ? '1.5rem' : '1.25rem',
            top: '50%',
            transform: 'translateY(-50%)',
            color: isFocused ? 'var(--accent-main)' : 'var(--text-tertiary)',
            transition: 'color 0.3s ease',
            pointerEvents: 'none',
          }}
        >
          <Search size={isLarge ? 24 : 20} strokeWidth={2.5} aria-hidden="true" />
        </div>
        <input
          type="text"
          aria-label={placeholder}
          className="input-field"
          placeholder={placeholder}
          value={currentQuery}
          onChange={handleInputChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          style={{
            padding: isLarge ? '1.25rem 1.5rem 1.25rem 4rem' : '0.875rem 1rem 0.875rem 3.5rem',
            fontSize: isLarge ? '1.125rem' : '1rem',
            paddingRight: isLarge ? '11.5rem' : '8.75rem',
          }}
        />
        <div
          style={{
            position: 'absolute',
            right: '0.375rem',
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          <VoiceMicButton
            isListening={voice.isListening}
            supported={voice.supported}
            onClick={handleMicClick}
            size={isLarge ? 20 : 17}
            labelStart="Voice search (optional)"
            labelStop="Stop voice search"
            style={{
              padding: isLarge ? '0.62rem' : '0.45rem',
            }}
          />
          <button
            type="submit"
            className="btn-primary"
            style={{
              padding: isLarge ? '0.75rem 1.25rem' : '0.5rem 1rem',
              fontSize: isLarge ? '1rem' : '0.875rem',
              borderRadius: 'var(--radius-full)',
              boxShadow: isFocused ? '0 0 15px var(--glass-bg-hover)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <span style={{ fontWeight: '600' }}>Search</span>
            {isLarge && <ArrowRight size={18} aria-hidden="true" />}
          </button>
        </div>
      </form>

      <VoiceSearchPanel
        voice={voice}
        isOpen={voicePanelOpen}
        submitLabel="Search"
        onClose={() => setVoicePanelOpen(false)}
        onSubmitQuery={(cleanText) => {
          setQueryValue(cleanText);
          setVoicePanelOpen(false);
          submitQuery(cleanText);
        }}
        onSelectService={(match) => {
          const name = match?.service?.name;
          if (name) {
            voice.setTranscriptDraft(name);
            setQueryValue(name);
          }
        }}
      />
    </div>
  );
};

export default SearchBox;
