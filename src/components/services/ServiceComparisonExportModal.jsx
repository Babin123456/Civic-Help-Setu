import { useState, useMemo } from 'react';
import {
  X,
  FileDown,
  Copy,
  Check,
  Printer,
  FileText,
  Layers,
  Download,
} from 'lucide-react';
import {
  generateComparisonMarkdown,
  generateComparisonPlainText,
  analyzeDocumentDifferences,
  downloadTextBlob,
} from '../../services/serviceComparisonExportService.js';

/**
 * Service Comparison Export Modal (#436)
 *
 * Provides citizens with structured markdown and plain text exports of
 * compared citizen services, including document intersection analysis,
 * suitable for printing, saving locally, or sharing via WhatsApp/SMS.
 */
const ServiceComparisonExportModal = ({ isOpen, onClose, comparedServices = [] }) => {
  const [exportFormat, setExportFormat] = useState('markdown'); // 'markdown' | 'plaintext'
  const [copied, setCopied] = useState(false);

  const markdownContent = useMemo(() => {
    return generateComparisonMarkdown(comparedServices);
  }, [comparedServices]);

  const plainTextContent = useMemo(() => {
    return generateComparisonPlainText(comparedServices);
  }, [comparedServices]);

  const docDiff = useMemo(() => {
    return analyzeDocumentDifferences(comparedServices);
  }, [comparedServices]);

  if (!isOpen || comparedServices.length === 0) return null;

  const currentContent = exportFormat === 'markdown' ? markdownContent : plainTextContent;

  const handleCopy = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(currentContent).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const ext = exportFormat === 'markdown' ? 'md' : 'txt';
    const mime = exportFormat === 'markdown' ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8';
    const filename = `civic-service-comparison-${new Date().toISOString().slice(0, 10)}.${ext}`;
    downloadTextBlob(currentContent, filename, mime);
  };

  const handlePrint = () => {
    if (typeof window !== 'undefined' && window.print) {
      window.print();
    }
  };

  return (
    <div
      className="modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-modal-title"
    >
      <div
        className="glass-panel animate-scale-up"
        style={{
          width: '100%',
          maxWidth: '820px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '1rem',
          background: 'var(--bg-card, #1e293b)',
          border: '1px solid var(--border-light)',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-light)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'rgba(56, 189, 248, 0.12)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FileDown size={18} color="var(--accent-main)" />
            </div>
            <div>
              <h2
                id="export-modal-title"
                style={{
                  fontSize: '1.15rem',
                  fontWeight: '700',
                  margin: 0,
                  color: 'var(--text-primary)',
                }}
              >
                Export Comparison Dossier
              </h2>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                Download offline reports, print comparison tables, or share via messaging
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close export dialog"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '4px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Toolbar & Overlap Pill */}
        <div
          style={{
            padding: '0.85rem 1.5rem',
            background: 'rgba(255, 255, 255, 0.02)',
            borderBottom: '1px solid var(--border-light)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          {/* Format Tabs */}
          <div style={{ display: 'flex', gap: '0.35rem' }}>
            <button
              type="button"
              onClick={() => setExportFormat('markdown')}
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.8rem',
                borderRadius: '6px',
                fontWeight: exportFormat === 'markdown' ? '700' : '500',
                background: exportFormat === 'markdown' ? 'var(--accent-main)' : 'transparent',
                color: exportFormat === 'markdown' ? '#000000' : 'var(--text-secondary)',
                border: exportFormat === 'markdown' ? '1px solid var(--accent-main)' : '1px solid var(--border-light)',
                cursor: 'pointer',
              }}
            >
              Markdown (.md)
            </button>
            <button
              type="button"
              onClick={() => setExportFormat('plaintext')}
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.8rem',
                borderRadius: '6px',
                fontWeight: exportFormat === 'plaintext' ? '700' : '500',
                background: exportFormat === 'plaintext' ? 'var(--accent-main)' : 'transparent',
                color: exportFormat === 'plaintext' ? '#000000' : 'var(--text-secondary)',
                border: exportFormat === 'plaintext' ? '1px solid var(--accent-main)' : '1px solid var(--border-light)',
                cursor: 'pointer',
              }}
            >
              Plain Text (.txt)
            </button>
          </div>

          {/* Overlap Summary */}
          {docDiff.commonDocuments.length > 0 && (
            <div
              style={{
                fontSize: '0.75rem',
                padding: '0.2rem 0.6rem',
                borderRadius: '9999px',
                background: 'rgba(34, 197, 94, 0.12)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                color: '#22c55e',
                fontWeight: '600',
              }}
            >
              {docDiff.commonDocuments.length} shared document requirements identified
            </div>
          )}
        </div>

        {/* Content Preview Box */}
        <div style={{ padding: '1rem 1.5rem', overflowY: 'auto', flex: 1 }}>
          <pre
            style={{
              margin: 0,
              padding: '1rem',
              borderRadius: '0.5rem',
              background: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid var(--border-light)',
              color: 'var(--text-primary)',
              fontSize: '0.78rem',
              fontFamily: 'monospace',
              lineHeight: '1.5',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              maxHeight: '380px',
              overflowY: 'auto',
            }}
          >
            {currentContent}
          </pre>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '0.85rem 1.5rem',
            borderTop: '1px solid var(--border-light)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.5rem',
            background: 'rgba(0, 0, 0, 0.15)',
          }}
        >
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleCopy}
              className="btn btn-secondary"
              style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              <span>{copied ? 'Copied' : 'Copy Content'}</span>
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="btn btn-primary"
              style={{ fontSize: '0.8rem', padding: '0.35rem 0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <Download size={14} />
              <span>Download .{exportFormat === 'markdown' ? 'md' : 'txt'}</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="btn btn-secondary"
              style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <Printer size={14} />
              <span>Print</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary"
            style={{ fontSize: '0.8rem', padding: '0.35rem 0.85rem' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ServiceComparisonExportModal;
