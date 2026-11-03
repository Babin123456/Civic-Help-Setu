import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  FileText,
  CheckCircle2,
  XCircle,
  HelpCircle,
  RefreshCw,
  ExternalLink,
  Info,
  X,
} from 'lucide-react';
import {
  buildReadinessQuestionnaire,
  evaluateApplicationReadiness,
} from '../../services/applicationReadinessCheckerService';

export default function ApplicationReadinessCheckerModal({ isOpen, onClose, service }) {
  const [answers, setAnswers] = useState({});
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'eligibility', 'documents'

  const questionnaire = useMemo(() => {
    return buildReadinessQuestionnaire(service);
  }, [service]);

  const evaluation = useMemo(() => {
    return evaluateApplicationReadiness(service, answers);
  }, [service, answers]);

  if (!isOpen || !service) return null;

  const handleSelectAnswer = (questionId, value) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  };

  const handleReset = () => {
    setAnswers({});
  };

  const filteredQuestions = questionnaire.questions.filter((q) => {
    if (activeTab === 'eligibility') return q.type === 'eligibility';
    if (activeTab === 'documents') return q.type === 'document';
    return true;
  });

  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(4px)',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="readiness-checker-title"
    >
      <div
        className="modal-container w-full max-w-3xl rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        style={{
          backgroundColor: 'var(--bg-surface, #ffffff)',
          color: 'var(--text-primary, #0f172a)',
          border: '1px solid var(--border-color, #e2e8f0)',
        }}
      >
        {/* Header */}
        <div
          className="modal-header px-6 py-4 flex items-center justify-between border-b"
          style={{ borderColor: 'var(--border-color, #e2e8f0)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="p-2 rounded-lg"
              style={{
                backgroundColor: 'rgba(14, 165, 233, 0.1)',
                color: '#0284c7',
              }}
            >
              <ShieldCheck size={22} />
            </div>
            <div>
              <h2
                id="readiness-checker-title"
                className="text-lg font-bold flex items-center gap-2"
              >
                AI Application Readiness Checker
              </h2>
              <p
                className="text-xs"
                style={{ color: 'var(--text-secondary, #64748b)' }}
              >
                Pre-flight checklist grounded in official catalogue rules for{' '}
                <span className="font-semibold">{service.name}</span>
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

        {/* Disclaimer Banner */}
        <div
          className="px-6 py-2.5 text-xs flex items-start gap-2 border-b"
          style={{
            backgroundColor: 'rgba(245, 158, 11, 0.08)',
            borderColor: 'rgba(245, 158, 11, 0.2)',
            color: '#b45309',
          }}
        >
          <Info size={16} className="shrink-0 mt-0.5" />
          <div>
            <strong>Informational Guidance Only:</strong> This tool performs a
            client-side pre-flight check against published catalogue guidelines.
            It does not submit any application or guarantee eligibility.
            Answers are never saved to your profile without consent.
          </div>
        </div>

        {/* Body Content */}
        <div className="modal-body p-6 overflow-y-auto space-y-6">
          {/* Contradiction / Abstention Notice */}
          {evaluation.status.startsWith('ABSTAINED') ? (
            <div
              className="p-4 rounded-lg border flex flex-col gap-2"
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.05)',
                borderColor: 'rgba(239, 68, 68, 0.3)',
                color: '#b91c1c',
              }}
            >
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle size={18} />
                <span>Readiness Check Abstained</span>
              </div>
              <p className="text-sm">{evaluation.abstainReason}</p>
              {evaluation.contradictions?.length > 0 && (
                <ul className="text-xs list-disc pl-5 mt-1 space-y-1">
                  {evaluation.contradictions.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              )}
              {evaluation.officialSource && (
                <a
                  href={evaluation.officialSource}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs inline-flex items-center gap-1 font-medium underline mt-2 text-blue-600"
                >
                  Verify directly at official website{' '}
                  <ExternalLink size={12} />
                </a>
              )}
            </div>
          ) : (
            <>
              {/* Readiness Score Summary Card */}
              <div
                className="p-4 rounded-xl border flex flex-col md:flex-row items-center justify-between gap-4"
                style={{
                  backgroundColor: 'var(--bg-card, #f8fafc)',
                  borderColor: 'var(--border-color, #e2e8f0)',
                }}
              >
                <div className="flex items-center gap-4">
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center font-bold text-lg border-4"
                    style={{
                      borderColor:
                        evaluation.score === 100
                          ? '#10b981'
                          : evaluation.score >= 50
                            ? '#f59e0b'
                            : '#ef4444',
                      color:
                        evaluation.score === 100
                          ? '#10b981'
                          : evaluation.score >= 50
                            ? '#f59e0b'
                            : '#ef4444',
                    }}
                  >
                    {evaluation.score}%
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">
                      Readiness Status:{' '}
                      <span
                        className="font-bold"
                        style={{
                          color:
                            evaluation.status === 'READY'
                              ? '#059669'
                              : evaluation.status === 'NEEDS_DOCUMENTS'
                                ? '#d97706'
                                : evaluation.status === 'CONDITIONAL_UNCERTAIN'
                                  ? '#d97706'
                                  : '#dc2626',
                        }}
                      >
                        {evaluation.status.replace(/_/g, ' ')}
                      </span>
                    </h3>
                    <p
                      className="text-xs"
                      style={{ color: 'var(--text-secondary, #64748b)' }}
                    >
                      Answered {evaluation.answeredCount} of{' '}
                      {evaluation.totalQuestions} requirements
                      {evaluation.unansweredCount > 0 &&
                        ` (${evaluation.unansweredCount} remaining)`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleReset}
                    className="text-xs px-3 py-1.5 rounded-lg border flex items-center gap-1.5 transition-colors hover:bg-slate-200"
                    style={{
                      borderColor: 'var(--border-color, #cbd5e1)',
                      color: 'var(--text-secondary, #475569)',
                    }}
                  >
                    <RefreshCw size={12} />
                    Reset Answers
                  </button>
                </div>
              </div>

              {/* Missing Requirements or Unmet Conditions Alert */}
              {(evaluation.unmetConditions.length > 0 ||
                evaluation.missingDocuments.length > 0) && (
                <div
                  className="p-4 rounded-lg border space-y-2"
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.05)',
                    borderColor: 'rgba(239, 68, 68, 0.2)',
                  }}
                >
                  <h4 className="text-xs font-bold text-red-700 flex items-center gap-1.5 uppercase tracking-wider">
                    <XCircle size={14} /> Attention Needed Before Applying
                  </h4>

                  {evaluation.unmetConditions.map((u, idx) => (
                    <div
                      key={`unmet-${idx}`}
                      className="text-xs text-red-800 bg-red-100/60 p-2 rounded flex flex-col gap-1"
                    >
                      <span className="font-semibold">
                        Unmet Condition: {u.label}
                      </span>
                      <span className="text-[11px] text-red-700">
                        {u.remediation}
                      </span>
                    </div>
                  ))}

                  {evaluation.missingDocuments.map((m, idx) => (
                    <div
                      key={`missing-${idx}`}
                      className="text-xs text-red-800 bg-red-100/60 p-2 rounded flex flex-col gap-1"
                    >
                      <span className="font-semibold">
                        Missing Required Document: {m.label}
                      </span>
                      <span className="text-[11px] text-red-700">
                        Source:{' '}
                        {m.citation.officialWebsite ? (
                          <a
                            href={m.citation.officialWebsite}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline"
                          >
                            {m.citation.serviceName}
                          </a>
                        ) : (
                          m.citation.serviceName
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Questionnaire Filter Tabs */}
              <div
                className="flex items-center gap-2 border-b pb-2 text-xs font-medium"
                style={{ borderColor: 'var(--border-color, #e2e8f0)' }}
              >
                <button
                  type="button"
                  onClick={() => setActiveTab('all')}
                  className={`px-3 py-1.5 rounded-lg transition-colors ${
                    activeTab === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'hover:bg-slate-100 text-slate-600'
                  }`}
                >
                  All Questions ({questionnaire.questions.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('eligibility')}
                  className={`px-3 py-1.5 rounded-lg transition-colors ${
                    activeTab === 'eligibility'
                      ? 'bg-blue-600 text-white'
                      : 'hover:bg-slate-100 text-slate-600'
                  }`}
                >
                  Eligibility (
                  {
                    questionnaire.questions.filter((q) => q.type === 'eligibility')
                      .length
                  }
                  )
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('documents')}
                  className={`px-3 py-1.5 rounded-lg transition-colors ${
                    activeTab === 'documents'
                      ? 'bg-blue-600 text-white'
                      : 'hover:bg-slate-100 text-slate-600'
                  }`}
                >
                  Documents (
                  {
                    questionnaire.questions.filter((q) => q.type === 'document')
                      .length
                  }
                  )
                </button>
              </div>

              {/* Questions List */}
              <div className="space-y-4">
                {filteredQuestions.map((q) => {
                  const currentAnswer = answers[q.id];

                  return (
                    <div
                      key={q.id}
                      className="p-4 rounded-lg border transition-all space-y-3"
                      style={{
                        backgroundColor:
                          currentAnswer === 'yes'
                            ? 'rgba(16, 185, 129, 0.04)'
                            : currentAnswer === 'no' ||
                                currentAnswer === 'missing'
                              ? 'rgba(239, 68, 68, 0.04)'
                              : 'var(--bg-surface, #ffffff)',
                        borderColor:
                          currentAnswer === 'yes'
                            ? 'rgba(16, 185, 129, 0.3)'
                            : currentAnswer === 'no' ||
                                currentAnswer === 'missing'
                              ? 'rgba(239, 68, 68, 0.3)'
                              : 'var(--border-color, #e2e8f0)',
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2">
                          {q.type === 'eligibility' ? (
                            <HelpCircle
                              size={18}
                              className="text-blue-500 mt-0.5 shrink-0"
                            />
                          ) : (
                            <FileText
                              size={18}
                              className="text-amber-500 mt-0.5 shrink-0"
                            />
                          )}
                          <div>
                            <p className="text-sm font-semibold">{q.prompt}</p>
                            <p
                              className="text-[11px] mt-0.5"
                              style={{ color: 'var(--text-secondary, #64748b)' }}
                            >
                              Rule derived from catalogue field: [{q.citation.sourceField}]
                            </p>
                          </div>
                        </div>

                        {currentAnswer === 'yes' && (
                          <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1 shrink-0">
                            <CheckCircle2 size={14} /> Ready
                          </span>
                        )}
                        {(currentAnswer === 'no' ||
                          currentAnswer === 'missing') && (
                          <span className="text-xs text-red-600 font-semibold flex items-center gap-1 shrink-0">
                            <XCircle size={14} /> Unmet
                          </span>
                        )}
                      </div>

                      {/* Interactive Radio Options */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                        {q.options.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => handleSelectAnswer(q.id, opt.value)}
                            className={`px-3 py-2 text-xs rounded-lg border text-left font-medium transition-all ${
                              currentAnswer === opt.value
                                ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm ring-1 ring-blue-500'
                                : 'hover:bg-slate-50 border-slate-200 text-slate-700'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div
          className="modal-footer px-6 py-4 border-t flex items-center justify-between"
          style={{ borderColor: 'var(--border-color, #e2e8f0)' }}
        >
          <div className="text-xs text-slate-500">
            {service.officialWebsite ? (
              <a
                href={service.officialWebsite}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-blue-600 hover:underline"
              >
                Official Portal <ExternalLink size={12} />
              </a>
            ) : (
              'Refer to physical CSC or department counter'
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            Done Reviewing
          </button>
        </div>
      </div>
    </div>
  );
}

