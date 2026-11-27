import { useState } from 'react';
import { useVoiceSearch } from '../../hooks/useVoiceSearch';
import VoiceSearchPanel, { VoiceMicButton } from './VoiceSearchPanel';

/**
 * Voice search entry point with consent disclosure, language selection,
 * editable transcript review before submission, and keyboard/manual fallback.
 */
export default function VoiceSearchInput({ onTranscript, onServiceMatched }) {
  const [panelOpen, setPanelOpen] = useState(false);
  const voice = useVoiceSearch();

  const handleTogglePanelOrMic = () => {
    if (!panelOpen) {
      setPanelOpen(true);
      voice.requestStartListening();
    } else if (voice.isListening) {
      voice.stopListening();
    } else {
      voice.requestStartListening();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <VoiceMicButton
          isListening={voice.isListening}
          supported={voice.supported}
          onClick={handleTogglePanelOrMic}
          labelStart="Start voice search"
          labelStop="Stop voice search"
        />
        <button
          type="button"
          onClick={() => setPanelOpen((prev) => !prev)}
          aria-expanded={panelOpen}
          style={{
            background: 'transparent',
            border: 'none',
            padding: 0,
            color: 'var(--text-secondary)',
            fontSize: '0.82rem',
            fontWeight: '600',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          {voice.isListening
            ? 'Listening... (tap mic to stop)'
            : panelOpen
              ? 'Hide voice search'
              : 'Search by voice (optional)'}
        </button>
      </div>

      <VoiceSearchPanel
        voice={voice}
        isOpen={panelOpen}
        compact
        submitLabel="Search"
        onClose={() => setPanelOpen(false)}
        onSubmitQuery={(cleanText) => {
          voice.clearTranscript();
          setPanelOpen(false);
          onTranscript?.(cleanText);
        }}
        onSelectService={(match) => {
          if (match?.service?.id && onServiceMatched) {
            voice.clearTranscript();
            setPanelOpen(false);
            onServiceMatched({
              targetServiceId: match.service.id,
              canonicalName: match.service.name,
            });
          } else if (match?.service?.name) {
            voice.setTranscriptDraft(match.service.name);
          }
        }}
      />
    </div>
  );
}
