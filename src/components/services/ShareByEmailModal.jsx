import { useState, useMemo } from 'react';
import { X, Mail, Send, ShieldCheck } from 'lucide-react';
import { sendServiceShare } from '../../services/shareService';
import { useToast } from '../../context/ToastContext';

const SHARE_NOTE_MAX_LENGTH = 500;

export default function ShareByEmailModal({ isOpen, services = [], preSelectedIds = [], onSent, onClose }) {
  const { toast } = useToast();
  const [recipient, setRecipient] = useState('');
  const [note, setNote] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set(preSelectedIds.filter(Boolean)));
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient.trim());
  const noteRemaining = SHARE_NOTE_MAX_LENGTH - note.trim().length;
  const canSend = Boolean(
    isValidEmail &&
    selectedIds.size > 0 &&
    noteRemaining >= 0 &&
    !sending
  );

  const shareableServices = useMemo(() => {
    return services.filter((s) => s && s.id && s.archived !== true);
  }, [services]);

  const handleToggleService = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === shareableServices.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(shareableServices.map((s) => s.id)));
    }
  };

  const handleSend = async () => {
    if (!canSend) return;
    setSending(true);
    setSendResult(null);

    try {
      const result = await sendServiceShare({
        to: recipient.trim(),
        serviceIds: Array.from(selectedIds),
        note,
        senderEmail: '',
      });

      if (result.ok) {
        setSendResult({ type: 'success', message: 'Share email sent successfully.' });
        toast?.success?.('Services shared by email.');
        onSent?.();
      } else {
        setSendResult({ type: 'error', message: result.error || 'Failed to send share email.' });
        toast?.error?.(result.error || 'Failed to send share email.');
      }
    } catch {
      setSendResult({ type: 'error', message: 'An unexpected error occurred.' });
      toast?.error?.('An unexpected error occurred.');
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.5)',
        padding: '1rem',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-by-email-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) {
          onClose();
        }
      }}
    >
      <div
        style={{
          background: 'var(--bg-card, #ffffff)',
          border: '1px solid var(--border-main, #e5e7eb)',
          borderRadius: '1rem',
          width: '100%',
          maxWidth: '640px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-light, #e5e7eb)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                padding: '0.5rem',
                borderRadius: '8px',
                background: 'rgba(56, 189, 248, 0.1)',
                color: '#0ea5e9',
              }}
            >
              <Mail size={20} />
            </div>
            <div>
              <h3
                id="share-by-email-title"
                style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-primary, #111827)' }}
              >
                Share services by email
              </h3>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary, #6b7280)' }}>
                Send service details to a recipient. Only public service information is shared.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-tertiary, #9ca3af)', cursor: 'pointer' }}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', flex: 1 }}>
          {/* Recipient email */}
          <div style={{ marginBottom: '1rem' }}>
            <label
              style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-primary, #111827)' }}
            >
              Recipient email
            </label>
            <input
              type="email"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="recipient@example.com"
              style={{
                width: '100%',
                padding: '0.6rem 0.8rem',
                fontSize: '0.9rem',
                border: `1px solid ${isValidEmail || recipient.trim() === '' ? 'var(--border-main, #e5e7eb)' : 'var(--error, #ef4444)'}`,
                borderRadius: '0.5rem',
                background: 'var(--bg-main, #ffffff)',
                color: 'var(--text-primary, #111827)',
              }}
            />
            {!isValidEmail && recipient.trim() !== '' && (
              <p style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: 'var(--error, #ef4444)' }}>
                Please enter a valid email address.
              </p>
            )}
          </div>

          {/* Services selection */}
          <div style={{ marginBottom: '1rem' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.5rem',
              }}
            >
              <label
                style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary, #111827)' }}
              >
                Select services ({selectedIds.size} of {shareableServices.length})
              </label>
              {shareableServices.length > 0 && (
                <button
                  type="button"
                  onClick={handleSelectAll}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '0.8rem',
                    color: 'var(--accent-main, #0ea5e9)',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  {selectedIds.size === shareableServices.length ? 'Select none' : 'Select all'}
                </button>
              )}
            </div>

            <div
              style={{
                maxHeight: '200px',
                overflowY: 'auto',
                border: '1px solid var(--border-light, #e5e7eb)',
                borderRadius: '0.5rem',
                background: 'var(--bg-main, #ffffff)',
              }}
            >
              {shareableServices.length === 0 && (
                <div style={{ padding: '1rem', color: 'var(--text-secondary, #6b7280)', fontSize: '0.875rem', textAlign: 'center' }}>
                  No services available to share.
                </div>
              )}
              {shareableServices.map((svc) => {
                const isSelected = selectedIds.has(svc.id);
                return (
                  <label
                    key={svc.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.6rem 0.8rem',
                      borderBottom: '1px solid var(--border-light, #e5e7eb)',
                      cursor: 'pointer',
                      background: isSelected ? 'rgba(14, 165, 233, 0.05)' : 'transparent',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleService(svc.id)}
                      style={{ accentColor: 'var(--accent-main, #0ea5e9)' }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary, #111827)' }}>
                        {svc.name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary, #9ca3af)' }}>
                        {svc.category || ''}{svc.department ? ` · ${svc.department}` : ''}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Note */}
          <div style={{ marginBottom: '1rem' }}>
            <label
              style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-primary, #111827)' }}
            >
              Optional note
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={SHARE_NOTE_MAX_LENGTH}
              rows={3}
              placeholder="Add a personal note (optional)..."
              style={{
                width: '100%',
                padding: '0.6rem 0.8rem',
                fontSize: '0.9rem',
                border: '1px solid var(--border-main, #e5e7eb)',
                borderRadius: '0.5rem',
                background: 'var(--bg-main, #ffffff)',
                color: 'var(--text-primary, #111827)',
                resize: 'vertical',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem' }}>
              <span style={{ fontSize: '0.75rem', color: noteRemaining < 0 ? 'var(--error, #ef4444)' : 'var(--text-tertiary, #9ca3af)' }}>
                {noteRemaining} characters remaining
              </span>
            </div>
            {noteRemaining < 0 && (
              <p style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: 'var(--error, #ef4444)' }}>
                Note is too long. Please shorten it to {SHARE_NOTE_MAX_LENGTH} characters or fewer.
              </p>
            )}
          </div>

          {/* Privacy note */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.5rem',
              padding: '0.75rem',
              background: 'rgba(14, 165, 233, 0.05)',
              border: '1px solid rgba(14, 165, 233, 0.15)',
              borderRadius: '0.5rem',
              marginBottom: '1rem',
            }}
          >
            <ShieldCheck size={16} color="#0ea5e9" />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #6b7280)', lineHeight: 1.4 }}>
              Only service names, descriptions, official links, and verification dates are sent. Your saved-service history and profile details are not shared.
            </span>
          </div>
        </div>

        {/* Send result */}
        {sendResult && (
          <div
            style={{
              padding: '0.75rem 1.5rem',
              borderTop: '1px solid var(--border-light, #e5e7eb)',
              background: sendResult.type === 'success' ? 'rgba(34, 197, 94, 0.05)' : 'rgba(239, 68, 68, 0.05)',
              borderBottom: sendResult.type === 'success' ? '1px solid rgba(34, 197, 94, 0.15)' : '1px solid rgba(239, 68, 68, 0.15)',
            }}
          >
            <span
              style={{
                fontSize: '0.85rem',
                fontWeight: 600,
                color: sendResult.type === 'success' ? '#15803d' : '#b91c1c',
              }}
            >
              {sendResult.message}
            </span>
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border-light, #e5e7eb)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.5rem',
            background: 'var(--bg-main, #ffffff)',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            style={{
              padding: '0.55rem 1.25rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--border-main, #e5e7eb)',
              background: 'transparent',
              color: 'var(--text-primary, #111827)',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend || sending}
            style={{
              padding: '0.55rem 1.25rem',
              borderRadius: '0.5rem',
              border: 'none',
              background: canSend ? 'var(--accent-main, #0ea5e9)' : 'var(--border-main, #e5e7eb)',
              color: canSend ? '#ffffff' : 'var(--text-tertiary, #9ca3af)',
              cursor: canSend ? 'pointer' : 'not-allowed',
              fontSize: '0.875rem',
              fontWeight: 600,
            }}
          >
            {sending ? 'Sending...' : <><Send size={16} /> Send email</>}
          </button>
        </div>
      </div>
    </div>
  );
}
