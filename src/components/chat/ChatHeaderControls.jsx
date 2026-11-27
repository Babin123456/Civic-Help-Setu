import { Download, MessageSquarePlus, Printer, ShieldCheck } from 'lucide-react';
import { exportChatAsMarkdown } from '../../services/chatStorage';

const ChatHeaderControls = ({
  messages = [],
  onNewConversation,
  canReset = true,
  isLoading = false,
  onOpenCaseMemory,
}) => {
  const messageCount = messages.filter((m) => m.role === 'user').length;

  const handleExport = () => {
    exportChatAsMarkdown(messages);
  };

  const handlePrint = () => {
    window.print();
  };

  const resetDisabled = isLoading || !canReset;
  let resetHint = 'Clear this chat and start a new question. You will be asked to confirm.';
  if (isLoading) resetHint = 'Wait for the current reply to finish before starting a new conversation';
  else if (!canReset) resetHint = 'Ask a question first, then you can start a new conversation';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.75rem 1.25rem',
        background: 'var(--glass-bg)',
        border: '1px solid var(--border-light)',
        borderRadius: '1rem',
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
        gap: '0.75rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: 'var(--success, #10b981)',
            boxShadow: '0 0 8px rgba(16, 185, 129, 0.4)',
          }}
        />
        <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
          Civic Assistant Session: <strong>{messageCount}</strong> {messageCount === 1 ? 'query' : 'queries'} answered
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <button
          type="button"
          onClick={handleExport}
          className="btn"
          style={{
            padding: '0.35rem 0.75rem',
            fontSize: '0.8rem',
            background: 'var(--glass-bg-subtle)',
            border: '1px solid var(--border-light)',
            color: 'var(--text-secondary)',
            borderRadius: '99px',
            gap: '0.35rem',
          }}
          title="Save discussion as Markdown note"
        >
          <Download size={14} /> Export Transcript
        </button>

        <button
          type="button"
          onClick={handlePrint}
          className="btn"
          style={{
            padding: '0.35rem 0.75rem',
            fontSize: '0.8rem',
            background: 'var(--glass-bg-subtle)',
            border: '1px solid var(--border-light)',
            color: 'var(--text-secondary)',
            borderRadius: '99px',
            gap: '0.35rem',
          }}
          title="Print consultation for in-person office visits"
        >
          <Printer size={14} /> Print
        </button>

        {onOpenCaseMemory && (
          <button
            type="button"
            onClick={onOpenCaseMemory}
            className="btn"
            style={{
              padding: '0.35rem 0.75rem',
              fontSize: '0.8rem',
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              color: '#10b981',
              borderRadius: '99px',
              gap: '0.35rem',
            }}
            title="Inspect and manage privacy-isolated case memory"
          >
            <ShieldCheck size={14} /> Case Memory
          </button>
        )}

        <button
          type="button"
          onClick={onNewConversation}
          disabled={resetDisabled}
          className="btn"
          style={{
            padding: '0.35rem 0.75rem',
            fontSize: '0.8rem',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            color: 'var(--error, #ef4444)',
            borderRadius: '99px',
            gap: '0.35rem',
            opacity: resetDisabled ? 0.5 : 1,
            cursor: resetDisabled ? 'not-allowed' : 'pointer',
          }}
          title={resetHint}
        >
          <MessageSquarePlus size={14} aria-hidden="true" /> New conversation
        </button>
      </div>
    </div>
  );
};

export default ChatHeaderControls;
