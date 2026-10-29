import { useState } from 'react';
import { Copy, Printer, Check, Download, AlertTriangle } from 'lucide-react';
import { buildLetterPrintHtml } from '../../utils/printHtml';

export default function RtiPreviewLetter({ rtiResult }) {
  const [copied, setCopied] = useState(false);

  if (!rtiResult || !rtiResult.applicationText) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(rtiResult.applicationText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(buildLetterPrintHtml('RTI Application Form', rtiResult.applicationText));
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => printWindow.print(), 300);
    }
  };

  return (
    <div style={{ marginTop: '16px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
      {/* Warning notices if audit found issues */}
      {rtiResult.audit?.issues?.length > 0 && (
        <div style={{ background: '#fef3c7', padding: '12px', borderRadius: '8px', border: '1px solid #fde68a', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#92400e', fontWeight: 700, fontSize: '0.84rem' }}>
            <AlertTriangle size={16} />
            <span>Pre-filing Formulation Advisory</span>
          </div>
          <ul style={{ margin: '6px 0 0 0', paddingLeft: '20px', fontSize: '0.78rem', color: '#78350f' }}>
            {rtiResult.audit.issues.map((iss, i) => (
              <li key={i}>{iss.warning}</li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e293b' }}>
            Statutory RTI Form 6(1) Draft
          </span>
          {rtiResult.exemptionDetails?.isExempt && (
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '4px',
                background: '#dcfce7',
                color: '#15803d',
              }}
            >
              BPL Fee Exempt (Sec 7(5))
            </span>
          )}
          {rtiResult.isLifeOrLiberty && (
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '4px',
                background: '#fee2e2',
                color: '#b91c1c',
              }}
            >
              48-Hour Life/Liberty
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={handleCopy}
            style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            {copied ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
            <span>{copied ? 'Copied' : 'Copy Application'}</span>
          </button>
          <button
            type="button"
            onClick={handlePrint}
            style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', background: '#2563eb', color: '#fff', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <Printer size={14} />
            <span>Print for Post</span>
          </button>
        </div>
      </div>

      <pre style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.82rem', whiteSpace: 'pre-wrap', maxHeight: '280px', overflowY: 'auto', color: '#0f172a', fontFamily: 'monospace' }}>
        {rtiResult.applicationText}
      </pre>
    </div>
  );
}
