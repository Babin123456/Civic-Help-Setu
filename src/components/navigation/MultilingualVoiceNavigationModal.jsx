import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Languages,
  ArrowRight,
  Sparkles,
  AlertCircle,
  HelpCircle,
  X,
  Search,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  SUPPORTED_VOICE_LANGUAGES,
  resolveMultilingualVoiceQuery,
  generateSpokenServiceSummary,
  speakTextAloud,
  stopSpeaking,
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
} from '../../services/multilingualVoiceNavigationService';

export default function MultilingualVoiceNavigationModal({ isOpen, onClose }) {
  const [selectedLanguage, setSelectedLanguage] = useState('hi-IN');
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingServiceId, setSpeakingServiceId] = useState(null);
  const [recognitionError, setRecognitionError] = useState('');

  const recognitionRef = useRef(null);

  // Stop speaking and listening when modal closes
  useEffect(() => {
    if (!isOpen) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // Ignore
        }
      }
      stopSpeaking();
      setIsListening(false);
      setIsSpeaking(false);
      setSpeakingServiceId(null);
      setRecognitionError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const results = resolveMultilingualVoiceQuery(transcript, selectedLanguage);

  const startListening = () => {
    setRecognitionError('');
    const SpeechRecognition =
      typeof window !== 'undefined'
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : null;

    if (!SpeechRecognition) {
      setRecognitionError(
        'Speech recognition is not supported in this browser. Please use the text input below.'
      );
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = selectedLanguage;
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        setTranscript(currentTranscript);
      };

      recognition.onerror = (event) => {
        setIsListening(false);
        if (event.error === 'not-allowed') {
          setRecognitionError(
            'Microphone access denied. Please check your browser microphone permissions.'
          );
        } else if (event.error !== 'no-speech') {
          setRecognitionError(`Voice input error: ${event.error}`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setRecognitionError('Failed to initialize microphone.');
      setIsListening(false);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Safe ignore
      }
    }
    setIsListening(false);
  };

  const handleToggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleSpeakService = (service) => {
    if (isSpeaking && speakingServiceId === service.id) {
      stopSpeaking();
      setIsSpeaking(false);
      setSpeakingServiceId(null);
      return;
    }

    const spokenText = generateSpokenServiceSummary(service, selectedLanguage);
    setIsSpeaking(true);
    setSpeakingServiceId(service.id);

    speakTextAloud(spokenText, selectedLanguage, () => {
      setIsSpeaking(false);
      setSpeakingServiceId(null);
    });
  };

  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(4px)',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="voice-nav-title"
    >
      <div
        className="modal-container w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        style={{
          backgroundColor: 'var(--bg-surface, #ffffff)',
          color: 'var(--text-primary, #0f172a)',
          border: '1px solid var(--border-color, #e2e8f0)',
        }}
      >
        {/* Header */}
        <div
          className="px-6 py-4 flex items-center justify-between border-b"
          style={{ borderColor: 'var(--border-color, #e2e8f0)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="p-2.5 rounded-xl"
              style={{
                backgroundColor: 'rgba(14, 165, 233, 0.1)',
                color: '#0284c7',
              }}
            >
              <Mic size={22} />
            </div>
            <div>
              <h2 id="voice-nav-title" className="text-base font-bold">
                Multilingual Voice Navigation & Service Discovery
              </h2>
              <p
                className="text-xs"
                style={{ color: 'var(--text-secondary, #64748b)' }}
              >
                Speak in your regional language to discover services and hear key details read aloud
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
            style={{ color: 'var(--text-secondary, #64748b)' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Language Selector Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border bg-slate-50">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <Languages size={16} className="text-blue-600" />
              <span>Select Spoken Language:</span>
            </div>
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="text-xs p-2 rounded-lg border bg-white border-slate-300 font-medium text-slate-800"
            >
              {SUPPORTED_VOICE_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.label}
                </option>
              ))}
            </select>
          </div>

          {/* Voice Microphone Center Section */}
          <div className="flex flex-col items-center justify-center p-6 rounded-2xl border text-center space-y-3 bg-gradient-to-b from-slate-50 to-white">
            <button
              type="button"
              onClick={handleToggleListening}
              className={`w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-lg ${
                isListening
                  ? 'bg-red-500 text-white animate-pulse ring-8 ring-red-200'
                  : 'bg-blue-600 text-white hover:bg-blue-700 hover:scale-105'
              }`}
              aria-label={isListening ? 'Stop listening' : 'Start voice search'}
            >
              {isListening ? <MicOff size={32} /> : <Mic size={32} />}
            </button>

            <span className="text-xs font-bold text-slate-700">
              {isListening
                ? 'Listening... Speak clearly into your microphone'
                : 'Tap to speak your civic requirement'}
            </span>
            <p className="text-[11px] text-slate-500 max-w-sm">
              e.g. "राशन कार्ड बनवाना है" or "car driving license" or "ভোটার কার্ড আবেদন"
            </p>

            {recognitionError && (
              <div className="text-xs text-red-600 bg-red-50 p-2 rounded-lg border border-red-200 flex items-center gap-1.5 mt-2">
                <AlertCircle size={14} className="shrink-0" />
                <span>{recognitionError}</span>
              </div>
            )}
          </div>

          {/* Transcript / Text Input Fallback */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 block">
              Spoken Transcript (or type manually):
            </label>
            <div className="relative">
              <input
                type="text"
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="Spoken words will appear here or type requirement..."
                className="w-full text-xs p-3 pr-10 rounded-xl border border-slate-300 text-slate-800 focus:ring-2 focus:ring-blue-500"
              />
              {transcript && (
                <button
                  type="button"
                  onClick={() => setTranscript('')}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Matched Services List */}
          {results?.isValid && results.matches.length > 0 && (
            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles size={14} className="text-amber-500" />
                  Voice-Matched Civic Schemes ({results.matches.length})
                </h3>
                {isSpeaking && (
                  <button
                    type="button"
                    onClick={() => {
                      stopSpeaking();
                      setIsSpeaking(false);
                      setSpeakingServiceId(null);
                    }}
                    className="text-xs text-red-600 flex items-center gap-1 font-semibold"
                  >
                    <VolumeX size={14} /> Stop Audio
                  </button>
                )}
              </div>

              <div className="space-y-2.5">
                {results.matches.map(({ service, score, matchReason }) => {
                  const isCurrentlyPlaying = isSpeaking && speakingServiceId === service.id;

                  return (
                    <div
                      key={service.id}
                      className="p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:shadow-sm transition-all"
                      style={{
                        backgroundColor: isCurrentlyPlaying
                          ? 'rgba(56, 189, 248, 0.08)'
                          : 'var(--bg-surface, #ffffff)',
                        borderColor: isCurrentlyPlaying
                          ? 'rgba(56, 189, 248, 0.4)'
                          : 'var(--border-color, #e2e8f0)',
                      }}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-900">
                            {service.name}
                          </h4>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                            {score}% Match
                          </span>
                        </div>
                        <p className="text-xs text-slate-600">
                          {matchReason}
                        </p>
                        <div className="text-[11px] text-slate-500 flex items-center gap-3 pt-0.5">
                          <span>Fees: {service.fees || service.fee || 'Nominal'}</span>
                          <span>•</span>
                          <span>Duration: {service.processingTime || service.timeRequired || 'Standard'}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleSpeakService(service)}
                          className={`p-2 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                            isCurrentlyPlaying
                              ? 'bg-sky-600 text-white border-sky-600'
                              : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'
                          }`}
                          title="Read summary aloud (Text-to-Speech)"
                        >
                          {isCurrentlyPlaying ? <VolumeX size={14} /> : <Volume2 size={14} />}
                          <span>{isCurrentlyPlaying ? 'Stop' : 'Listen'}</span>
                        </button>

                        <Link
                          to={`/services/${service.id}`}
                          onClick={onClose}
                          className="px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold flex items-center gap-1 hover:bg-blue-700 transition-colors"
                        >
                          Open <ArrowRight size={12} />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-6 py-4 border-t flex items-center justify-between"
          style={{ borderColor: 'var(--border-color, #e2e8f0)' }}
        >
          <p className="text-[11px] text-slate-500">
            Powered by standard browser Web Speech API. Audio is never stored or transmitted.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 text-white hover:bg-slate-900 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
