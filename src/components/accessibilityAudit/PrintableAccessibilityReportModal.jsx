import { useState } from 'react';
import {
  Printer,
  Copy,
  Download,
  CheckCircle,
  X,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import {
  generatePrintableRemediationReport,
  PRELIMINARY_SCREENING_DISCLAIMER,
} from '../../services/accessibilityAuditService.js';

export default function PrintableAccessibilityReportModal({
  isOpen,
  onClose,
  auditRecord = {},
  evaluatedAudit = {},
  remediationPlan = [],
}) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const markdownReport = generatePrintableRemediationReport(
    auditRecord,
    evaluatedAudit,
    remediationPlan
  );

  const handleCopyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(markdownReport);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard fallback
    }
  };

  const handleDownloadText = () => {
    const blob = new Blob([markdownReport], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `accessibility-audit-report-${(auditRecord.facilityName || 'facility').replace(/[^a-zA-Z0-9_-]/g, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(15, 23, 42, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        style={{
          background: 'var(--surface-color, #ffffff)',
          borderRadius: '14px',
          width: '100%',
          maxWidth: '850px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
          overflow: 'hidden',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '1rem 1.25rem',
            borderBottom: '1px solid var(--border-color, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-card-subtle, #f8fafc)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText size={20} color="#0284c7" />
            <h3 id="report-modal-title" style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-primary, #0f172a)' }}>
              Printable Accessibility Audit &amp; Remediation Report
            </h3>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <button
              type="button"
              onClick={handlePrint}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                padding: '0.4rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid var(--border-color, #cbd5e1)',
                background: '#ffffff',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Printer size={14} /> Print
            </button>

            <button
              type="button"
              onClick={handleCopyMarkdown}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                padding: '0.4rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid #0284c7',
                background: '#e0f2fe',
                color: '#0369a1',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {copied ? <CheckCircle size={14} /> : <Copy size={14} />}
              {copied ? 'Copied' : 'Copy MD'}
            </button>

            <button
              type="button"
              onClick={handleDownloadText}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                padding: '0.4rem 0.75rem',
                borderRadius: '6px',
                border: 'none',
                background: '#0284c7',
                color: '#ffffff',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Download size={14} /> Download
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close report modal"
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-secondary, #64748b)',
                padding: '4px',
                marginLeft: '0.5rem',
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, fontSize: '0.88rem', color: 'var(--text-primary, #0f172a)' }}>
          {/* Statutory Caveat Alert */}
          <div
            style={{
              padding: '0.85rem 1rem',
              background: '#fef3c7',
              border: '1px solid #fde68a',
              borderRadius: '8px',
              color: '#92400e',
              fontSize: '0.8rem',
              marginBottom: '1.25rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.5rem',
            }}
          >
            <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong>Statutory Caveat:</strong> {PRELIMINARY_SCREENING_DISCLAIMER}
            </div>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.3rem 0' }}>
              Facility Accessibility Audit: {auditRecord.facilityName || 'Public Facility'}
            </h2>
            <div style={{ color: 'var(--text-secondary, #64748b)', fontSize: '0.85rem' }}>
              Location: {auditRecord.district || 'District / State'} • Date: {auditRecord.createdAt ? new Date(auditRecord.createdAt).toLocaleDateString() : 'Current Date'}
            </div>
          </div>

          {/* Scorecard Summary */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: '0.75rem',
              marginBottom: '1.5rem',
            }}
          >
            <div style={{ padding: '0.75rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0284c7' }}>
                {evaluatedAudit.score !== null ? `${evaluatedAudit.score}%` : 'N/A'}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Screening Score</div>
            </div>

            <div style={{ padding: '0.75rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#166534' }}>
                {evaluatedAudit.compliantCount || 0}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#166534' }}>Compliant Items</div>
            </div>

            <div style={{ padding: '0.75rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#991b1b' }}>
                {evaluatedAudit.nonCompliantCount || 0}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#991b1b' }}>Non-Compliant Gaps</div>
            </div>

            <div style={{ padding: '0.75rem', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#dc2626' }}>
                {evaluatedAudit.criticalHazards?.length || 0}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#dc2626' }}>Critical Hazards</div>
            </div>
          </div>

          {/* Raw Markdown Output Preview */}
          <h4 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>Formatted Report Content</h4>
          <pre
            style={{
              padding: '1rem',
              background: 'var(--bg-card-subtle, #f8fafc)',
              border: '1px solid var(--border-color, #e2e8f0)',
              borderRadius: '8px',
              fontSize: '0.78rem',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontFamily: 'monospace',
              maxHeight: '350px',
              overflowY: 'auto',
            }}
          >
            {markdownReport}
          </pre>
        </div>
      </div>
    </div>
  );
}
