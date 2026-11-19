import { useState, useMemo } from 'react';
import {
  X,
  Copy,
  Check,
  Download,
  FileText,
  AlertTriangle,
  Scale,
} from 'lucide-react';
import {
  generateFollowUpDraft,
  generateEscalationPetitionDraft,
} from '../../services/accessibilityEscalationService.js';

export default function FollowUpEscalationDraftModal({
  caseData,
  onClose,
}) {
  const [activeTab, setActiveTab] = useState('followUp'); // 'followUp' | 'escalation'
  const [citizenName, setCitizenName] = useState('');
  const [citizenAddress, setCitizenAddress] = useState('');
  const [customText, setCustomText] = useState(null);
  const [copied, setCopied] = useState(false);

  const defaultDraft = useMemo(() => {
    if (!caseData) return '';
    if (activeTab === 'followUp') {
      return generateFollowUpDraft(caseData, { citizenName, citizenAddress });
    }
    return generateEscalationPetitionDraft(caseData, { citizenName, citizenAddress });
  }, [caseData, activeTab, citizenName, citizenAddress]);

  const displayedText = customText !== null ? customText : defaultDraft;

  const handleTabSwitch = (tab) => {
    setActiveTab(tab);
    setCustomText(null); // Reset custom edits when switching tabs
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(displayedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback copy
    }
  };

  const handleDownload = (format = 'txt') => {
    const filename = `${caseData.title.slice(0, 30).replace(/[^a-z0-9]/gi, '_')}_${activeTab}.${format}`;
    const mime = format === 'txt' ? 'text/plain' : 'text/markdown';
    const blob = new Blob([displayedText], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!caseData) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="escalation-draft-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '1rem',
      }}
    >
      <div
        style={{
          background: 'var(--bg-modal, #1e293b)',
          borderRadius: '1rem',
          maxWidth: '850px',
          width: '100%',
          border: '1px solid var(--border-light, #334155)',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
          color: 'var(--text-main, #f8fafc)',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '92vh',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-light, #334155)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText size={20} style={{ color: '#38bdf8' }} />
            <h2
              id="escalation-draft-title"
              style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: '#ffffff' }}
            >
              Editable Follow-Up &amp; Escalation Drafter
            </h2>
          </div>
          <button
            onClick={onClose}
            type="button"
            aria-label="Close modal"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '0.2rem',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs & Content */}
        <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', flex: 1 }}>
          {/* Tab Selection */}
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              borderBottom: '1px solid var(--border-light, #334155)',
              marginBottom: '1rem',
            }}
          >
            <button
              onClick={() => handleTabSwitch('followUp')}
              type="button"
              style={{
                padding: '0.6rem 1rem',
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === 'followUp' ? '3px solid #38bdf8' : '3px solid transparent',
                color: activeTab === 'followUp' ? '#38bdf8' : '#94a3b8',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              1. Authority Follow-Up Representation
            </button>
            <button
              onClick={() => handleTabSwitch('escalation')}
              type="button"
              style={{
                padding: '0.6rem 1rem',
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === 'escalation' ? '3px solid #c084fc' : '3px solid transparent',
                color: activeTab === 'escalation' ? '#c084fc' : '#94a3b8',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
              }}
            >
              <Scale size={14} /> 2. Disabilities Commissioner Petition (RPwD Sec 75/80)
            </button>
          </div>

          {/* Non-submission Disclaimer Banner */}
          <div
            style={{
              background: 'rgba(234, 179, 8, 0.12)',
              border: '1px solid rgba(234, 179, 8, 0.3)',
              borderRadius: '0.5rem',
              padding: '0.75rem 1rem',
              marginBottom: '1rem',
              color: '#fef08a',
              fontSize: '0.8rem',
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'flex-start',
            }}
          >
            <AlertTriangle size={16} style={{ color: '#eab308', flexShrink: 0, marginTop: '0.1rem' }} />
            <div>
              <strong>Non-Automatic Submission Notice:</strong> CivicBridge generates this draft locally on your device incorporating your chronological case log and evidence proofs. This document is <strong>NOT</strong> transmitted automatically. You must review, print/sign, and deliver it to the public authority or Commissioner registry via Speed Post, email, or government grievance counter.
            </div>
          </div>

          {/* Citizen Contact Customization Strip */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '0.75rem',
              background: 'rgba(15, 23, 42, 0.5)',
              padding: '0.75rem 1rem',
              borderRadius: '0.5rem',
              border: '1px solid #334155',
              marginBottom: '1rem',
            }}
          >
            <div>
              <label
                htmlFor="citizen-name-input"
                style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.2rem' }}
              >
                Complainant / Petitioner Full Name
              </label>
              <input
                id="citizen-name-input"
                type="text"
                placeholder="e.g. Ramesh Kumar"
                value={citizenName}
                onChange={(e) => setCitizenName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.45rem 0.65rem',
                  borderRadius: '0.375rem',
                  background: 'var(--bg-input, #0f172a)',
                  border: '1px solid var(--border-light, #334155)',
                  color: 'var(--text-main, #f8fafc)',
                  fontSize: '0.85rem',
                }}
              />
            </div>

            <div>
              <label
                htmlFor="citizen-addr-input"
                style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.2rem' }}
              >
                Postal Address &amp; Contact Details
              </label>
              <input
                id="citizen-addr-input"
                type="text"
                placeholder="e.g. Flat 302, Ward 5, Central District (Mob: 98765XXXXX)"
                value={citizenAddress}
                onChange={(e) => setCitizenAddress(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.45rem 0.65rem',
                  borderRadius: '0.375rem',
                  background: 'var(--bg-input, #0f172a)',
                  border: '1px solid var(--border-light, #334155)',
                  color: 'var(--text-main, #f8fafc)',
                  fontSize: '0.85rem',
                }}
              />
            </div>
          </div>

          {/* Editable Draft Textarea */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
              <label
                htmlFor="editable-draft-textarea"
                style={{ fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1' }}
              >
                Editable Draft Representation / Statutory Petition
              </label>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                You can edit text directly below before copying or exporting
              </span>
            </div>
            <textarea
              id="editable-draft-textarea"
              value={displayedText}
              onChange={(e) => setCustomText(e.target.value)}
              rows={14}
              style={{
                width: '100%',
                padding: '0.85rem 1rem',
                borderRadius: '0.5rem',
                background: '#090d16',
                border: '1px solid #334155',
                color: '#f8fafc',
                fontFamily: 'monospace',
                fontSize: '0.82rem',
                lineHeight: 1.5,
                resize: 'vertical',
              }}
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border-light, #334155)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => handleDownload('txt')}
              type="button"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.45rem 0.85rem',
                borderRadius: '0.375rem',
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#f8fafc',
                border: '1px solid #334155',
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
            >
              <Download size={13} /> Download .txt
            </button>
            <button
              onClick={() => handleDownload('md')}
              type="button"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.45rem 0.85rem',
                borderRadius: '0.375rem',
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#f8fafc',
                border: '1px solid #334155',
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
            >
              <Download size={13} /> Download .md
            </button>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={handleCopy}
              type="button"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.5rem 1rem',
                borderRadius: '0.5rem',
                background: copied ? '#15803d' : '#2563eb',
                color: '#ffffff',
                border: 'none',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              {copied ? <Check size={15} /> : <Copy size={15} />}
              {copied ? 'Copied to Clipboard!' : 'Copy Draft Text'}
            </button>

            <button
              onClick={onClose}
              type="button"
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '0.5rem',
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#f8fafc',
                border: 'none',
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
