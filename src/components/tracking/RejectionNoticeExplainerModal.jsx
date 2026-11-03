import React, { useState } from 'react';
import {
  HelpCircle,
  FileText,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Copy,
  Check,
  Scale,
  ExternalLink,
  X,
  Sparkles,
} from 'lucide-react';
import {
  explainRejectionNotice,
  getStatutoryAppealRights,
  SAMPLE_REJECTION_NOTICES,
} from '../../services/rejectionNoticeExplainerService';

export default function RejectionNoticeExplainerModal({
  isOpen,
  onClose,
  initialNotice = '',
  application = null,
}) {
  const [noticeText, setNoticeText] = useState(initialNotice);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const serviceContext = {
    name: application?.serviceName || 'Civic Service',
    officialWebsite: application?.officialWebsite || application?.portalUrl || null,
  };

  const explanation = explainRejectionNotice(noticeText, serviceContext);
  const appealRights = getStatutoryAppealRights(serviceContext.name);

  const handleSelectSample = (sampleId) => {
    const sample = SAMPLE_REJECTION_NOTICES.find((s) => s.id === sampleId);
    if (sample) {
      setNoticeText(sample.rawNotice);
    }
  };

  const handleCopyGuidance = async () => {
    if (!explanation?.isValid) return;
    const textToCopy = `Civic Help Setu - Plain Language Rejection Guidance
Service: ${serviceContext.name}
Issue: ${explanation.title}

Plain Language Explanation:
${explanation.plainLanguageExplanation}

Actionable Steps:
${explanation.remediationSteps.map((s, i) => `${i + 1}. ${s}`).join('\n')}

Deadline: ${explanation.statutoryDeadline}`;

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
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
      aria-labelledby="rejection-explainer-title"
    >
      <div
        className="modal-container w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
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
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                color: '#dc2626',
              }}
            >
              <FileText size={22} />
            </div>
            <div>
              <h2 id="rejection-explainer-title" className="text-base font-bold">
                Plain-Language Rejection & Objection Explainer
              </h2>
              <p
                className="text-xs"
                style={{ color: 'var(--text-secondary, #64748b)' }}
              >
                Translates legalistic departmental rejection memos into clear, actionable steps
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
          {/* Input Area */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="rejection-notice-input"
                className="text-xs font-bold text-slate-700"
              >
                Paste Official Rejection Notice or Deficiency Remarks:
              </label>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-500">Try sample:</span>
                <select
                  onChange={(e) => handleSelectSample(e.target.value)}
                  className="text-xs p-1 border rounded bg-white text-slate-700"
                  defaultValue=""
                >
                  <option value="" disabled>
                    Choose sample notice...
                  </option>
                  {SAMPLE_REJECTION_NOTICES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.service} ({s.id.replace('sample-', '')})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <textarea
              id="rejection-notice-input"
              rows={3}
              value={noticeText}
              onChange={(e) => setNoticeText(e.target.value)}
              placeholder="e.g. 'Deficiency observed in Annexure IV. Income certificate validity expired. File halted under objection.'"
              className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 text-slate-800"
            />
          </div>

          {/* Analysis Output */}
          {explanation?.isValid ? (
            <div className="space-y-4">
              {/* Plain Language Translation Card */}
              <div
                className="p-4 rounded-xl border space-y-2"
                style={{
                  backgroundColor: 'rgba(56, 189, 248, 0.05)',
                  borderColor: 'rgba(56, 189, 248, 0.3)',
                }}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-sky-900 flex items-center gap-1.5">
                    <Sparkles size={16} className="text-sky-600" />
                    {explanation.title}
                  </h3>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800">
                    Plain-Language Summary
                  </span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  {explanation.plainLanguageExplanation}
                </p>
              </div>

              {/* Actionable Remediation Steps */}
              <div className="p-4 rounded-xl border bg-slate-50 space-y-3">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 size={15} className="text-emerald-600" />
                  Recommended Actionable Steps to Rectify
                </h4>
                <ol className="text-xs text-slate-700 space-y-2 list-decimal pl-5 leading-relaxed">
                  {explanation.remediationSteps.map((step, idx) => (
                    <li key={idx} className="font-medium">
                      {step}
                    </li>
                  ))}
                </ol>
              </div>

              {/* Deadline & Statutory Appeal Rights */}
              <div
                className="p-4 rounded-xl border space-y-2"
                style={{
                  backgroundColor: 'rgba(245, 158, 11, 0.05)',
                  borderColor: 'rgba(245, 158, 11, 0.25)',
                }}
              >
                <div className="flex items-center gap-2 text-xs font-bold text-amber-800 uppercase tracking-wider">
                  <Scale size={15} />
                  Statutory Correction Deadline & Legal Recourse
                </div>
                <p className="text-xs text-slate-700">
                  <strong>Correction Window:</strong> {explanation.statutoryDeadline}
                </p>
                <p className="text-xs text-slate-600">
                  <strong>Legal Protection:</strong> {appealRights.description}
                </p>
              </div>

              {/* Legal Disclaimer */}
              <p className="text-[11px] text-slate-500 italic">
                {explanation.disclaimer}
              </p>
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-slate-400 border border-dashed rounded-xl">
              Paste or select an official rejection notice above to generate plain-language explanations and remediation steps.
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-6 py-4 border-t flex items-center justify-between"
          style={{ borderColor: 'var(--border-color, #e2e8f0)' }}
        >
          {explanation?.isValid ? (
            <button
              type="button"
              onClick={handleCopyGuidance}
              className="px-3 py-1.5 text-xs rounded-lg border flex items-center gap-1.5 hover:bg-slate-100 transition-colors"
            >
              {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              <span>{copied ? 'Guidance Copied!' : 'Copy Remediation Plan'}</span>
            </button>
          ) : (
            <div />
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 text-white hover:bg-slate-900 transition-colors"
          >
            Close Explainer
          </button>
        </div>
      </div>
    </div>
  );
}

