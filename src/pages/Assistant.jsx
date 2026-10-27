import { useState, useEffect, useRef } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Send, AlertCircle, Loader2, Sparkles, Mic, MicOff, BookOpen, RefreshCw, Pencil } from 'lucide-react';
import ChatMessage from '../components/ChatMessage';
import { askCivicAssistant } from '../ai/civicAssistant';
import { askGroundedCivicAssistant } from '../ai/groundedCivicAssistant';
import SourceGroundedBadge from '../components/assistant/SourceGroundedBadge';
import SourcesAndLimitations from '../components/assistant/SourcesAndLimitations';
import ChatHeaderControls from '../components/chat/ChatHeaderControls';
import VoiceInputStatus from '../components/chat/VoiceInputStatus';
import PersonalizedRecommendationsPanel from '../components/chat/PersonalizedRecommendationsPanel';
import DocumentChecklistCard from '../components/chat/DocumentChecklistCard';
import ChatEmptyState from '../components/chat/ChatEmptyState';
import UndoResetNotice from '../components/chat/UndoResetNotice';
import ConfirmationDialog from '../components/common/ConfirmationDialog';
import { STARTER_PROMPTS, resolveFollowUpQuery, getLastUserMessage, hasUserMessages } from '../ai/conversationContext';
import { loadChatHistory, saveChatHistory, clearChatHistory } from '../services/chatStorage';
import {
  UNDO_WINDOW_MS,
  needsResetConfirmation,
  createResetSnapshot,
  getUndoRemainingMs,
  restoreFromSnapshot,
} from '../utils/chatSession';

const Assistant = () => {
  const [messages, setMessages] = useState(() => loadChatHistory());
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const inputRef = useRef(null);
  const [failedQuery, setFailedQuery] = useState(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  // Messages cleared by "New conversation", kept in memory only for the undo window
  const [undoSnapshot, setUndoSnapshot] = useState(null);
  const undoNoticeRef = useRef(null);
  // State updates are async, so this stops two quick sends from both going out
  const requestInFlightRef = useRef(false);

  const location = useLocation();

  // Save messages to persistent storage whenever they update
  useEffect(() => {
    saveChatHistory(messages);
  }, [messages]);

  // Handle URL query parameter ?q=
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const query = searchParams.get('q');

    if (query) {
      handleSendMessage(query);
      window.history.replaceState({}, document.title, location.pathname);
    }
  }, [location]);

  // If the notice had keyboard focus when it goes away, hand focus back to the input
  const closeUndo = () => {
    if (undoNoticeRef.current?.contains(document.activeElement)) inputRef.current?.focus();
    setUndoSnapshot(null);
  };

  // Drop the undo option when the window closes
  useEffect(() => {
    if (!undoSnapshot) return undefined;
    const timer = setTimeout(() => closeUndo(), getUndoRemainingMs(undoSnapshot));
    return () => clearTimeout(timer);
  }, [undoSnapshot]);

  useEffect(() => {
    // Nothing to scroll to in the empty state, and after a reset the starters should stay in view
    if (!hasUserMessages(messages) && !isLoading) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isLoading]);

  const getAnswer = async (query, history) => {
    // Short follow-ups like "what are the fees?" reuse the service from the last answer
    const resolved = resolveFollowUpQuery(query, history);
    let response;
    try {
      response = await askGroundedCivicAssistant(resolved);
    } catch (groundingErr) {
      console.warn('Grounded retrieval error, falling back to basic assistant:', groundingErr);
      response = await askCivicAssistant(resolved);
    }
    return {
      id: `asst-${Date.now()}`,
      role: 'assistant',
      text: '',
      data: response.data,
      serviceId: response.serviceId,
      grounded: response.grounded ?? true,
      confidenceScore: response.confidenceScore,
      retrievedChunks: response.retrievedChunks || [],
      suggestions: response.suggestions || [],
      timestamp: new Date().toISOString(),
    };
  };

  const handleSendMessage = async (text = input, { isRetry = false } = {}) => {
    const query = text.trim();
    if (!query || isLoading || requestInFlightRef.current) return;
    requestInFlightRef.current = true;

    // Sending a new question starts a different conversation, so the old one can no longer be restored
    setUndoSnapshot(null);
    const history = messages;
    if (!isRetry) {
      const userMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        text: query,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMessage]);
    }
    setInput('');
    setIsLoading(true);
    setError(null);
    setFailedQuery(null);

    try {
      const assistantMessage = await getAnswer(query, history);
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      console.error(err);
      setError("We couldn't process your request. Please try again.");
      setFailedQuery(query);
    } finally {
      requestInFlightRef.current = false;
      setIsLoading(false);
    }
  };

  // Put the last question back in the input so it can be reworded
  const handleRefineLast = () => {
    const last = getLastUserMessage(messages);
    if (!last) return;
    setInput(last.text || '');
    inputRef.current?.focus();
  };

  const toggleVoiceInput = () => {
    setVoiceError('');
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceError('Speech recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge.');
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-IN';

      recognition.onstart = () => {
        setIsListening(true);
        setVoiceError('');
      };

      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map((result) => result[0].transcript)
          .join('');
        setInput(transcript);
      };

      recognition.onerror = (event) => {
        console.error('Speech error:', event.error);
        if (event.error === 'not-allowed') {
          setVoiceError('Microphone permission was denied. Please allow microphone access in your browser.');
        } else if (event.error !== 'no-speech') {
          setVoiceError(`Voice recognition error: ${event.error}`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (err) {
      console.error('Failed to initialize speech recognition:', err);
      setVoiceError('Could not start microphone recording. Please check browser settings.');
      setIsListening(false);
    }
  };

  const handleNewConversationClick = () => {
    if (isLoading) return;
    if (needsResetConfirmation(messages)) setShowResetConfirm(true);
  };

  const handleConfirmNewConversation = () => {
    setShowResetConfirm(false);
    if (isLoading || !needsResetConfirmation(messages)) return;
    setUndoSnapshot(createResetSnapshot(messages));
    setMessages(clearChatHistory());
    window.scrollTo({ top: 0 });
    setError(null);
    setFailedQuery(null);
  };

  const handleUndoReset = () => {
    const restored = restoreFromSnapshot(undoSnapshot);
    setUndoSnapshot(null);
    if (restored) setMessages(restored);
  };

  const questionCount = messages.filter((m) => m.role === 'user').length;

  const renderAssistantContent = (msg) => {
    if (msg.text && !msg.data) {
      return <p style={{ fontSize: '1.05rem', lineHeight: '1.6' }}>{msg.text}</p>;
    }

    const data = msg.data || {};

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <SourceGroundedBadge
          grounded={msg.grounded ?? (msg.serviceId !== null)}
          confidenceScore={msg.confidenceScore ?? 0.85}
          sourcesCount={data.officialSources?.length || (msg.retrievedChunks?.length || 1)}
        />

        {data.missingInformationNotice && (
          <div
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '0.5rem',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              color: '#f87171',
              fontSize: '0.875rem',
              lineHeight: '1.4',
            }}
          >
            <strong>Official Policy Notice:</strong> {data.missingInformationNotice}
          </div>
        )}

        {data.title && (
          <h3 style={{ fontSize: '1.35rem', fontWeight: '800', color: 'var(--text-primary)' }}>
            {data.title}
          </h3>
        )}

        {data.summary && (
          <p style={{ fontSize: '1.05rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            {data.summary}
          </p>
        )}

        {/* Fees and processing pill if present */}
        {(data.fees || data.processingTime) && (
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', margin: '0.25rem 0' }}>
            {data.fees && (
              <span style={{ fontSize: '0.8rem', padding: '0.25rem 0.65rem', borderRadius: '99px', background: 'var(--glass-bg)', border: '1px solid var(--border-light)', color: 'var(--accent-main)', fontWeight: '600' }}>
                Fees: {data.fees}
              </span>
            )}
            {data.processingTime && (
              <span style={{ fontSize: '0.8rem', padding: '0.25rem 0.65rem', borderRadius: '99px', background: 'var(--glass-bg)', border: '1px solid var(--border-light)', color: 'var(--text-secondary)', fontWeight: '600' }}>
                Est. Time: {data.processingTime}
              </span>
            )}
          </div>
        )}

        {/* Steps */}
        {data.steps && data.steps.length > 0 && (
          <div style={{ marginTop: '0.5rem' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--accent-main)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.5rem' }}>
              Action Steps:
            </h4>
            <ol style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {data.steps.slice(0, 4).map((step, i) => (
                <li key={i} style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>{step.title}</strong>
                  {step.description ? ` — ${step.description}` : ''}
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Document Readiness Checklist */}
        {data.documents && data.documents.length > 0 && (
          <DocumentChecklistCard
            serviceName={data.title}
            requiredDocuments={data.documents}
          />
        )}

        {/* Direct Link to Detailed Service Guide */}
        {msg.serviceId && (
          <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-light)' }}>
            <Link
              to={`/services/${msg.serviceId}`}
              className="btn btn-primary"
              style={{ padding: '0.55rem 1.25rem', fontSize: '0.9rem', display: 'inline-flex' }}
            >
              <BookOpen size={16} /> View Full Detailed Roadmap
            </Link>
          </div>
        )}

        {/* Sources, review dates and limitations (omitted when the response has no source data) */}
        <SourcesAndLimitations message={msg} />

        {/* Suggested Follow-up Questions */}
        {msg.suggestions && msg.suggestions.length > 0 && (
          <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px dashed var(--border-light)' }}>
            <p style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.5rem' }}>
              Suggested Questions
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {msg.suggestions.map((suggestion, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSendMessage(suggestion)}
                  style={{
                    padding: '0.35rem 0.85rem',
                    borderRadius: '99px',
                    border: '1px solid var(--border-light)',
                    background: 'var(--glass-bg)',
                    color: 'var(--accent-main)',
                    fontSize: '0.8rem',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = 'var(--accent-main)';
                    e.currentTarget.style.color = 'var(--bg-main)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = 'var(--glass-bg)';
                    e.currentTarget.style.color = 'var(--accent-main)';
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="section animate-fade-in" style={{ paddingBottom: '6rem' }}>
      <div className="container" style={{ maxWidth: '850px' }}>
        {/* Page Heading */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: 'var(--accent-main)',
              fontSize: '0.85rem',
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              marginBottom: '0.5rem',
            }}
          >
            <Sparkles size={16} /> AI-Powered Civic Guide
          </div>
          <h1 style={{ fontSize: 'clamp(2.25rem, 5vw, 3rem)', fontWeight: '800' }}>
            Civic Consultation Assistant
          </h1>
          <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
            Ask anything in plain language to find eligibility, procedures, and official government portals.
          </p>
        </div>

        {/* Chat Session Header Controls */}
        <ChatHeaderControls
          messages={messages}
          onNewConversation={handleNewConversationClick}
          canReset={needsResetConfirmation(messages)}
          isLoading={isLoading}
        />

        {/* Voice Input Feedback */}
        <VoiceInputStatus
          isListening={isListening}
          voiceError={voiceError}
          onDismissError={() => setVoiceError('')}
        />

        {/* Personalized Civic Recommendations based on User Profile Context */}
        <PersonalizedRecommendationsPanel onSelectPrompt={(prompt) => handleSendMessage(prompt)} />

        {/* Empty state with starter prompts for a fresh session */}
        {!hasUserMessages(messages) && (
          <ChatEmptyState
            prompts={STARTER_PROMPTS}
            onSelectPrompt={(prompt) => handleSendMessage(prompt)}
            disabled={isLoading}
          />
        )}

        {/* Messages Container */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            marginBottom: '2rem',
            minHeight: '350px',
          }}
          aria-busy={isLoading}
        >
          {messages.map((msg, index) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id || index}
                style={{
                  display: 'flex',
                  justifyContent: isUser ? 'flex-end' : 'flex-start',
                }}
              >
                <div
                  className="card animate-fade-in"
                  style={{
                    maxWidth: '85%',
                    padding: '1.5rem',
                    background: isUser ? 'rgba(56, 189, 248, 0.1)' : 'var(--glass-bg)',
                    borderColor: isUser ? 'rgba(56, 189, 248, 0.3)' : 'var(--border-main)',
                    borderRadius: '1.25rem',
                  }}
                >
                  {isUser ? (
                    <p style={{ fontSize: '1.05rem', color: 'var(--text-primary)', fontWeight: '500' }}>
                      {msg.text || msg.content}
                    </p>
                  ) : (
                    renderAssistantContent(msg)
                  )}
                  {isUser && msg.id === getLastUserMessage(messages)?.id && !isLoading && (
                    <button
                      type="button"
                      onClick={handleRefineLast}
                      style={{ marginTop: '0.5rem', background: 'none', border: 'none', color: 'var(--accent-main)', fontSize: '0.8rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: 0 }}
                    >
                      <Pencil size={12} /> Edit and resend
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div
                className="card"
                role="status"
                style={{
                  padding: '1.25rem 1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  color: 'var(--accent-main)',
                  background: 'var(--glass-bg)',
                }}
              >
                <Loader2 size={20} className="animate-spin" />
                <span style={{ fontSize: '0.95rem', fontWeight: '500' }}>
                  Consulting official civic rules & FAQ database...
                </span>
              </div>
            </div>
          )}

          {error && (
            <div
              style={{
                padding: '1rem',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                borderRadius: '0.75rem',
                color: 'var(--error, #ef4444)',
                fontSize: '0.9rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                flexWrap: 'wrap',
              }}
              role="alert"
            >
              <AlertCircle size={18} />
              <span style={{ flex: 1 }}>{error}</span>
              {failedQuery && (
                <button
                  type="button"
                  onClick={() => handleSendMessage(failedQuery, { isRetry: true })}
                  className="btn"
                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', borderRadius: '99px', gap: '0.35rem' }}
                >
                  <RefreshCw size={14} /> Try again
                </button>
              )}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {undoSnapshot && (
          <UndoResetNotice
            seconds={UNDO_WINDOW_MS / 1000}
            onUndo={handleUndoReset}
            containerRef={undoNoticeRef}
          />
        )}

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          style={{
            position: 'sticky',
            bottom: '1.5rem',
            zIndex: 30,
            background: 'var(--bg-secondary)',
            padding: '0.65rem 0.85rem',
            borderRadius: '99px',
            border: '1px solid var(--border-main)',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <button
            type="button"
            onClick={toggleVoiceInput}
            aria-label={isListening ? 'Stop listening' : 'Start voice typing'}
            title="Voice typing uses your browser's speech service. In Chrome the audio is processed by Google."
            style={{
              padding: '0.65rem',
              flexShrink: 0,
              borderRadius: '50%',
              background: isListening ? '#ef4444' : 'var(--glass-bg)',
              color: isListening ? '#ffffff' : 'var(--accent-main)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              transition: 'all 0.2s',
            }}
          >
            {isListening ? <MicOff size={18} /> : <Mic size={18} />}
          </button>

          <input
            type="text"
            ref={inputRef}
            aria-label="Ask a civic question"
            placeholder='Ask e.g. "Documents for Birth Certificate"'
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            style={{
              flex: 1,
              minWidth: 0,
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              fontSize: '1.05rem',
              padding: '0.5rem 0.5rem',
              outline: 'none',
            }}
          />

          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="btn-primary"
            style={{
              padding: '0.65rem 1.25rem',
              flexShrink: 0,
              borderRadius: '99px',
              fontSize: '0.95rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              opacity: !input.trim() || isLoading ? 0.5 : 1,
              cursor: !input.trim() || isLoading ? 'not-allowed' : 'pointer',
            }}
          >
            <span>Send</span>
            <Send size={16} />
          </button>
        </form>
      </div>

      <ConfirmationDialog
        isOpen={showResetConfirm}
        title="Start a new conversation?"
        message={`This clears your ${questionCount === 1 ? '1 question' : `${questionCount} questions`} and the answers from this chat. You can undo it for ${UNDO_WINDOW_MS / 1000} seconds afterwards.`}
        confirmLabel="Start new conversation"
        cancelLabel="Keep this chat"
        variant="warning"
        onConfirm={handleConfirmNewConversation}
        onCancel={() => setShowResetConfirm(false)}
      />
    </div>
  );
};

export default Assistant;
