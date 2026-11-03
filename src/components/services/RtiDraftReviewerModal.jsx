import React, { useState } from 'react';
import {
  HelpCircle,
  FileCheck2,
  AlertTriangle,
  Scale,
  Sparkles,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  X,
  ArrowRight,
  Info,
} from 'lucide-react';
import {
  reviewRtiDraft,
  SAMPLE_RTI_DRAFTS,
} from '../../services/rtiDraftReviewerService';

export default function RtiDraftReviewerModal({
  isOpen,
  onClose,
  initialQuestions = [],
  defaultAuthority = '',
  onAdoptRewording = () => {},
}) {
  const [authority, setAuthority] = useState(defaultAuthority);
  const [timePeriod, setTimePeriod] = useState('');
  const [questionsText, setQuestionsText] = useState(
    Array.isArray(initialQuestions) ? initialQuestions.join('\n') : ''
  );
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const questionsList = questionsText
    .split(/\n+/)
    .map((q) => q.trim())
    .filter((q) => q.length > 0);

  const reviewReport = reviewRtiDraft({
    questions: questionsList,
    publicAuthority: authority,
    timePeriod,
  });

  const handleSelectSample = (sampleId) => {
    const sample = SAMPLE_RTI_DRAFTS.find((s) => s.id === sampleId);
    if (sample) {
      setAuthority(sample.authority);
      setTimePeriod(sample.timePeriod || '');
      setQuestionsText(sample.questions.join('\n'));
    }
  };

  const handleApplyRewording = (original, suggested) => {
    const updated = questionsText.replace(original, suggested);
    setQuestionsText(updated);
    onAdoptRewording(suggested);
  };

  const handleCopyReview = async () => {
    if (!reviewReport.isValid) return;

    const summary = `Right to Information (RTI) Application Draft
To: The Public Information Officer (PIO), ${authority || '[Department Name]'}
Specified Period: ${timePeriod || '[Specified Date Bracket]'}

Questions under Section 6(1):
${questionsList.map((q, i) => `${i + 1}. ${q}`).join('\n')}

Format: Certified copies under Section 2(j)(ii) of the RTI Act 2005.`;

    try {
      await navigator.clipboard.writeText(summary);
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
      aria-labelledby="rti-reviewer-title"
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
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                color: '#2563eb',
              }}
            >
              <Scale size={22} />
            </div>
            <div>
              <h2 id="rti-reviewer-title" className="text-base font-bold">
                AI RTI Draft Clarity & Section 2(f) Compliance Reviewer
              </h2>
              <p
                className="text-xs"
                style={{ color: 'var(--text-secondary, #64748b)' }}
              >
                Audits questions to prevent rejection under Section 2(f) and suggests record-based rewording
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
          {/* Top Particulars Form */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl border bg-slate-50">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Target Public Authority / Department
              </label>
              <input
                type="text"
                value={authority}
                onChange={(e) => setAuthority(e.target.value)}
                placeholder="e.g. Public Works Department / Municipal Corp"
                className="w-full text-xs p-2 rounded-lg border bg-white border-slate-300 text-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Specified Time Period / Date Range
              </label>
              <input
                type="text"
                value={timePeriod}
                onChange={(e) => setTimePeriod(e.target.value)}
                placeholder="e.g. 01/01/2023 to 31/12/2023 or FY 2023-24"
                className="w-full text-xs p-2 rounded-lg border bg-white border-slate-300 text-slate-800"
              />
            </div>
          </div>

          {/* Questions Input Area */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="rti-questions-input"
                className="text-xs font-bold text-slate-700"
              >
                Point-Wise Questions (One per line):
              </label>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-500">Sample RTI:</span>
                <select
                  onChange={(e) => handleSelectSample(e.target.value)}
                  className="text-xs p-1 border rounded bg-white text-slate-700"
                  defaultValue=""
                >
                  <option value="" disabled>
                    Select sample draft...
                  </option>
                  {SAMPLE_RTI_DRAFTS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <textarea
              id="rti-questions-input"
              rows={4}
              value={questionsText}
              onChange={(e) => setQuestionsText(e.target.value)}
              placeholder="1. Why was my road repair delayed?&#10;2. Who is responsible for incomplete drainage?"
              className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 text-slate-800"
            />
          </div>

          {/* Audit Results */}
          {reviewReport.isValid ? (
            <div className="space-y-4">
              {/* Score and Status Banner */}
              <div
                className="p-4 rounded-xl border flex items-center justify-between"
                style={{
                  backgroundColor:
                    reviewReport.status === 'READY_TO_SUBMIT'
                      ? 'rgba(16, 185, 129, 0.08)'
                      : reviewReport.status === 'NEEDS_REWORDING'
                        ? 'rgba(239, 68, 68, 0.08)'
                        : 'rgba(245, 158, 11, 0.08)',
                  borderColor:
                    reviewReport.status === 'READY_TO_SUBMIT'
                      ? 'rgba(16, 185, 129, 0.3)'
                      : reviewReport.status === 'NEEDS_REWORDING'
                        ? 'rgba(239, 68, 68, 0.3)'
                        : 'rgba(245, 158, 11, 0.3)',
                }}
              >
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Draft Compliance Score
                  </span>
                  <div className="text-2xl font-black mt-0.5">
                    {reviewReport.complianceScore}%
                  </div>
                  <div className="text-xs font-bold mt-1">
                    Status: {reviewReport.status.replace(/_/g, ' ')}
                  </div>
                </div>

                <div className="text-right text-xs text-slate-600 max-w-xs leading-relaxed">
                  {reviewReport.status === 'READY_TO_SUBMIT'
                    ? 'All questions seek material records and satisfy Section 2(f).'
                    : reviewReport.status === 'NEEDS_REWORDING'
                      ? 'Questions asking "Why" or opinions detected. Adopting record-based phrasing prevents rejection.'
                      : 'Missing particulars (time period or authority) should be added.'}
                </div>
              </div>

              {/* Section 2(f) Rewording Suggestions Card */}
              {reviewReport.suggestions.length > 0 && (
                <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/50 space-y-3">
                  <h4 className="text-xs font-bold text-rose-800 uppercase tracking-wider flex items-center gap-1.5">
                    <AlertTriangle size={15} />
                    Section 2(f) Rejection Risk & Recommended Material Rewording
                  </h4>

                  <div className="space-y-3">
                    {reviewReport.suggestions.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-lg border border-rose-200 bg-white text-xs space-y-2"
                      >
                        <div className="text-slate-500">
                          <span className="font-semibold text-rose-700">Question {item.questionIndex} (Risk):</span>{' '}
                          "{item.original}"
                        </div>

                        <div className="p-2 rounded bg-emerald-50 border border-emerald-200 text-emerald-900 font-medium">
                          <span className="font-bold text-emerald-800 block text-[11px] mb-0.5">
                            Suggested Record-Based Phrasing (Section 2(f) Compliant):
                          </span>
                          "{item.suggested}"
                        </div>

                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => handleApplyRewording(item.original, item.suggested)}
                            className="px-2.5 py-1 text-xs rounded bg-emerald-600 text-white font-semibold flex items-center gap-1 hover:bg-emerald-700 transition-colors"
                          >
                            <Sparkles size={12} /> Adopt This Rewording
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Structural Particulars Checklist */}
              {reviewReport.structuralDeficiencies.length > 0 && (
                <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 space-y-2">
                  <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Info size={15} />
                    Missing Essential Particulars
                  </h4>

                  <ul className="text-xs text-amber-900 space-y-1.5 list-disc pl-5">
                    {reviewReport.structuralDeficiencies.map((def, idx) => (
                      <li key={idx}>
                        <strong>{def.title}:</strong> {def.guidance}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Legal Disclaimer */}
              <p className="text-[11px] text-slate-500 italic">
                {reviewReport.statutoryDisclaimer}
              </p>
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-slate-400 border border-dashed rounded-xl">
              Enter or choose questions above to review draft clarity, eliminate Section 2(f) rejection risks, and generate certified record wording.
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-6 py-4 border-t flex items-center justify-between"
          style={{ borderColor: 'var(--border-color, #e2e8f0)' }}
        >
          {reviewReport.isValid ? (
            <button
              type="button"
              onClick={handleCopyReview}
              className="px-3 py-1.5 text-xs rounded-lg border flex items-center gap-1.5 hover:bg-slate-100 transition-colors"
            >
              {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              <span>{copied ? 'Draft Copied!' : 'Copy Reviewed Application'}</span>
            </button>
          ) : (
            <div />
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 text-white hover:bg-slate-900 transition-colors"
          >
            Done Reviewing
          </button>
        </div>
      </div>
    </div>
  );
}
