import { useState, useEffect } from 'react';
import { Mic, MicOff, Volume2 } from 'lucide-react';
import { resolveSpokenQuery } from '../../services/voiceCivicAssistantService';

export default function VoiceSearchInput({ onTranscript, onServiceMatched }) {
  const [isListening, setIsListening] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      setSupported(true);
    }
  }, []);

  const handleStartListening = () => {
    if (!supported) {
      alert('Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-IN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    setIsListening(true);

    recognition.onresult = (event) => {
      const speechToText = event.results[0][0].transcript;
      setIsListening(false);
      if (onTranscript) {
        onTranscript(speechToText);
      }
      const match = resolveSpokenQuery(speechToText);
      if (match && match.targetServiceId && onServiceMatched) {
        onServiceMatched(match);
      }
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  return (
    <button
      type="button"
      onClick={handleStartListening}
      aria-label={isListening ? 'Listening to voice search' : 'Start voice search'}
      title={isListening ? 'Listening...' : "Voice Search. Uses your browser's speech service (in Chrome the audio is processed by Google)."}
      style={{
        border: 'none',
        background: isListening ? '#fee2e2' : 'transparent',
        color: isListening ? '#dc2626' : 'var(--text-tertiary, #64748b)',
        cursor: 'pointer',
        padding: '6px',
        borderRadius: '50%',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s',
        animation: isListening ? 'pulse 1.5s infinite' : 'none'
      }}
    >
      {isListening ? <MicOff size={18} /> : <Mic size={18} />}
    </button>
  );
}
