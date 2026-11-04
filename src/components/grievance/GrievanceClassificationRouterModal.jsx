import React, { useState } from 'react';
import {
  HelpCircle,
  Building2,
  AlertCircle,
  CheckCircle2,
  Clock,
  ChevronRight,
  ExternalLink,
  Copy,
  Check,
  X,
  Sparkles,
  ShieldCheck,
  Camera,
} from 'lucide-react';
import {
  classifyGrievance,
  SAMPLE_GRIEVANCES,
} from '../../services/grievanceClassificationService';

export default function GrievanceClassificationRouterModal({
  isOpen,
  onClose,
  initialText = '',
}) {
  const [complaintText, setComplaintText] = useState(initialText);
  const [copied, setCopied] = useState(false);
  const [checkedEvidence, setCheckedEvidence] = useState({});

  if (!isOpen) return null;

  const result = classifyGrievance(complaintText);

  const handleSelectSample = (sampleId) => {
    const sample = SAMPLE_GRIEVANCES.find((s) => s.id === sampleId);
    if (sample) {
      setComplaintText(sample.text);
      setCheckedEvidence({});
    }
  };

  const toggleEvidence = (index) => {
    setCheckedEvidence((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const handleCopyRouting = async () => {
    if (!result?.isValid) return;
    const brief = `Civic Help Setu - Grievance Routing Brief
Department: ${result.department}
Jurisdiction: ${result.jurisdictionLevel}
Statutory Resolution SLA: ${result.slaDays} Days (${result.urgency})

Why this Department:
${result.whyThisDepartment}

Recommended Evidence to Gather:
${result.evidenceToGather.map((e, i) => `${i + 1}. ${e}`).join('\n')}

Escalation Ladder:
${result.escalationLadder.join(' -> ')}`;

    try {
      await navigator.clipboard.writeText(brief);
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
      aria-labelledby="grievance-router-title"
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
                backgroundColor: 'rgba(234, 88, 12, 0.1)',
                color: '#ea580c',
              }}
            >
              <Building2 size={22} />
            </div>
            <div>
              <h2 id="grievance-router-title" className="text-base font-bold">
                Civic Grievance Classifier & Department Router
              </h2>
              <p
                className="text-xs"
                style={{ color: 'var(--text-secondary, #64748b)' }}
              >
                Identifies the correct civic department, statutory SLA, and required evidence
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
          {/* Complaint Text Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="grievance-input"
                className="text-xs font-bold text-slate-700"
              >
                Describe your civic problem or issue:
              </label>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-500">Sample issue:</span>
                <select
                  onChange={(e) => handleSelectSample(e.target.value)}
                  className="text-xs p-1 border rounded bg-white text-slate-700"
                  defaultValue=""
                >
                  <option value="" disabled>
                    Select common problem...
                  </option>
                  {SAMPLE_GRIEVANCES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <textarea
              id="grievance-input"
              rows={3}
              value={complaintText}
              onChange={(e) => {
                setComplaintText(e.target.value);
                setCheckedEvidence({});
              }}
              placeholder="e.g. 'Deep pothole on the main road outside school' or 'Dirty brown tap water for 3 days' or 'Garbage dumped in Ward 12 uncollected'..."
              className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 text-slate-800"
            />
          </div>

          {/* Classification Output */}
          {result?.isValid ? (
            <div className="space-y-4">
              {/* Department Recommendation Card */}
              <div
                className="p-4 rounded-xl border space-y-2"
                style={{
                  backgroundColor: 'rgba(234, 88, 12, 0.04)',
                  borderColor: 'rgba(234, 88, 12, 0.25)',
                }}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-orange-600 tracking-wider">
                      Recommended Responsible Authority
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 mt-0.5">
                      {result.department}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-orange-100 text-orange-800 flex items-center gap-1">
                      <Clock size={12} /> {result.slaDays} Days Statutory SLA
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed pt-1">
                  <strong>Administrative Mandate:</strong> {result.whyThisDepartment}
                </p>

                {result.secondaryNotice && (
                  <div className="p-2.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-xs">
                    <AlertCircle size={14} className="inline mr-1" />
                    {result.secondaryNotice}
                  </div>
                )}
              </div>

              {/* Evidence to Gather Checklist */}
              <div className="p-4 rounded-xl border bg-slate-50 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Camera size={14} className="text-blue-600" />
                    Essential Evidence to Attach Before Filing
                  </h4>
                  <span className="text-[11px] text-slate-500">
                    Check off as you gather
                  </span>
                </div>

                <div className="space-y-2">
                  {result.evidenceToGather.map((item, idx) => (
                    <label
                      key={idx}
                      className={`flex items-start gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                        checkedEvidence[idx]
                          ? 'bg-emerald-50/60 border-emerald-300 text-emerald-900'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(checkedEvidence[idx])}
                        onChange={() => toggleEvidence(idx)}
                        className="mt-0.5 rounded text-emerald-600"
                      />
                      <span className={checkedEvidence[idx] ? 'line-through text-slate-500' : 'font-medium'}>
                        {item}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Escalation Ladder Hierarchy */}
              <div className="p-4 rounded-xl border bg-white space-y-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Statutory Escalation Ladder (If Unresolved)
                </span>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-700">
                  {result.escalationLadder.map((step, idx) => (
                    <React.Fragment key={idx}>
                      <span className="px-2.5 py-1 rounded-lg bg-slate-100 font-semibold text-slate-800">
                        {step}
                      </span>
                      {idx < result.escalationLadder.length - 1 && (
                        <ChevronRight size={14} className="text-slate-400 shrink-0" />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* Official Portals Direct Links */}
              <div className="flex items-center gap-3 pt-1">
                <span className="text-xs text-slate-500">Submit on Portal:</span>
                <div className="flex flex-wrap gap-2">
                  {result.officialPortals.map((portal, idx) => (
                    <a
                      key={idx}
                      href={portal.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-blue-600 hover:underline inline-flex items-center gap-1"
                    >
                      {portal.name} <ExternalLink size={12} />
                    </a>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-slate-400 border border-dashed rounded-xl">
              Type or select a civic issue above to see the responsible department, required evidence, and resolution timeline.
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-6 py-4 border-t flex items-center justify-between"
          style={{ borderColor: 'var(--border-color, #e2e8f0)' }}
        >
          {result?.isValid ? (
            <button
              type="button"
              onClick={handleCopyRouting}
              className="px-3 py-1.5 text-xs rounded-lg border flex items-center gap-1.5 hover:bg-slate-100 transition-colors"
            >
              {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              <span>{copied ? 'Brief Copied!' : 'Copy Routing Brief'}</span>
            </button>
          ) : (
            <div />
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 text-white hover:bg-slate-900 transition-colors"
          >
            Close Router
          </button>
        </div>
      </div>
    </div>
  );
}
