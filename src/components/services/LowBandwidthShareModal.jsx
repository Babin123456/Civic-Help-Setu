import { useState, useMemo } from 'react';
import {
  X,
  Copy,
  Check,
  Download,
  Share2,
  MessageSquare,
  Smartphone,
  FileText,
} from 'lucide-react';
import {
  formatForWhatsApp,
  formatForSms,
  formatForPlainTextCard,
  downloadPlainTextFile,
} from '../../services/plainTextServiceFormatter';
import { useToast } from '../../context/ToastContext';

export default function LowBandwidthShareModal({ isOpen, onClose, service }) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('whatsapp');
  const [copiedKey, setCopiedKey] = useState(null);

  const whatsappText = useMemo(() => formatForWhatsApp(service), [service]);
  const smsChunks = useMemo(() => formatForSms(service, 160), [service]);
  const plainTextCard = useMemo(() => formatForPlainTextCard(service), [service]);

  if (!isOpen || !service) return null;

  const handleCopy = async (text, key) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setCopiedKey(key);
        toast?.success?.('Copied to clipboard!');
        setTimeout(() => setCopiedKey(null), 2500);
      }
    } catch {
      toast?.error?.('Failed to copy to clipboard.');
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        padding: '1rem',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="low-bandwidth-modal-title"
    >
      <div
        style={{
          background: 'var(--card-bg, #0f172a)',
          border: '1px solid var(--border-color, #334155)',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '580px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-color, #334155)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(255, 255, 255, 0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                padding: '0.5rem',
                borderRadius: '8px',
                background: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                display: 'flex',
              }}
            >
              <Share2 size={20} />
            </div>
            <div>
              <h3
                id="low-bandwidth-modal-title"
                style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-main, #f8fafc)' }}
              >
                Low-Bandwidth & SMS Sharing
              </h3>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted, #94a3b8)' }}>
                Easily share service instructions with family or citizens without web access
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted, #94a3b8)', cursor: 'pointer' }}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Buttons */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--border-color, #334155)',
            background: 'rgba(0, 0, 0, 0.2)',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('whatsapp')}
            style={{
              flex: 1,
              padding: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              border: 'none',
              borderBottom: activeTab === 'whatsapp' ? '2px solid #22c55e' : '2px solid transparent',
              background: activeTab === 'whatsapp' ? 'rgba(34, 197, 94, 0.1)' : 'transparent',
              color: activeTab === 'whatsapp' ? '#22c55e' : 'var(--text-muted, #94a3b8)',
            }}
          >
            <MessageSquare size={16} /> WhatsApp / Chat
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sms')}
            style={{
              flex: 1,
              padding: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              border: 'none',
              borderBottom: activeTab === 'sms' ? '2px solid #38bdf8' : '2px solid transparent',
              background: activeTab === 'sms' ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
              color: activeTab === 'sms' ? '#38bdf8' : 'var(--text-muted, #94a3b8)',
            }}
          >
            <Smartphone size={16} /> SMS (160 Chars)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('offline')}
            style={{
              flex: 1,
              padding: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              border: 'none',
              borderBottom: activeTab === 'offline' ? '2px solid #f59e0b' : '2px solid transparent',
              background: activeTab === 'offline' ? 'rgba(245, 158, 11, 0.1)' : 'transparent',
              color: activeTab === 'offline' ? '#f59e0b' : 'var(--text-muted, #94a3b8)',
            }}
          >
            <FileText size={16} /> Plain Text (.txt)
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', flex: 1 }}>
          {activeTab === 'whatsapp' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted, #94a3b8)' }}>Formatted with Markdown for WhatsApp & Telegram:</span>
                <button
                  type="button"
                  onClick={() => handleCopy(whatsappText, 'whatsapp')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.35rem 0.75rem',
                    borderRadius: '6px',
                    border: '1px solid #22c55e',
                    background: 'rgba(34, 197, 94, 0.15)',
                    color: '#22c55e',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {copiedKey === 'whatsapp' ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copiedKey === 'whatsapp' ? 'Copied' : 'Copy Text'}</span>
                </button>
              </div>

              <textarea
                readOnly
                value={whatsappText}
                rows={10}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid var(--border-color, #334155)',
                  color: 'var(--text-main, #f8fafc)',
                  fontFamily: 'monospace',
                  fontSize: '0.85rem',
                  lineHeight: 1.5,
                  resize: 'none',
                }}
              />
            </div>
          )}

          {activeTab === 'sms' && (
            <div>
              <p style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', color: 'var(--text-muted, #94a3b8)' }}>
                Standard cellular SMS messages are limited to 160 characters. Each chunk below fits safely on standard feature phones without breaking:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {smsChunks.map((chunk, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '0.75rem',
                      borderRadius: '8px',
                      background: 'rgba(0, 0, 0, 0.25)',
                      border: '1px solid var(--border-color, #334155)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#38bdf8' }}>
                        SMS Part {idx + 1} ({chunk.length}/160 Chars)
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(chunk, `sms-${idx}`)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: copiedKey === `sms-${idx}` ? '#10b981' : '#38bdf8',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                        }}
                      >
                        {copiedKey === `sms-${idx}` ? <Check size={12} /> : <Copy size={12} />}
                        <span>{copiedKey === `sms-${idx}` ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                    <div style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--text-main, #f8fafc)', lineHeight: 1.4 }}>
                      {chunk}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'offline' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted, #94a3b8)' }}>Complete offline plain-text documentation:</span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => handleCopy(plainTextCard, 'offline')}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.35rem 0.65rem',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color, #475569)',
                      background: 'transparent',
                      color: 'var(--text-main, #f8fafc)',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                    }}
                  >
                    {copiedKey === 'offline' ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copiedKey === 'offline' ? 'Copied' : 'Copy'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadPlainTextFile(service)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.35rem 0.65rem',
                      borderRadius: '6px',
                      border: 'none',
                      background: 'var(--accent-main, #38bdf8)',
                      color: '#0f172a',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <Download size={14} />
                    <span>Download .txt</span>
                  </button>
                </div>
              </div>

              <textarea
                readOnly
                value={plainTextCard}
                rows={10}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid var(--border-color, #334155)',
                  color: 'var(--text-main, #f8fafc)',
                  fontFamily: 'monospace',
                  fontSize: '0.8rem',
                  lineHeight: 1.4,
                  resize: 'none',
                }}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border-color, #334155)',
            display: 'flex',
            justifyContent: 'flex-end',
            background: 'rgba(255, 255, 255, 0.02)',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.5rem 1.25rem',
              borderRadius: '8px',
              border: '1px solid var(--border-color, #475569)',
              background: 'transparent',
              color: 'var(--text-main, #f8fafc)',
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
