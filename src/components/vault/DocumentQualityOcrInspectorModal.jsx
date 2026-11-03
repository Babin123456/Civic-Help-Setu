import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Camera,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Info,
  X,
  RefreshCw,
  Sliders,
  Sparkles,
} from 'lucide-react';
import {
  inspectDocumentReadability,
  DOCUMENT_MARKER_TEMPLATES,
} from '../../services/documentQualityOcrInspectionService';

export default function DocumentQualityOcrInspectorModal({
  isOpen,
  onClose,
  documents = [],
  onBypass = () => {},
}) {
  const [selectedDocId, setSelectedDocId] = useState(() => (documents[0]?.id || ''));
  const [documentType, setDocumentType] = useState('aadhaar');
  const [hasConsent, setHasConsent] = useState(false);
  const [inspectionResult, setInspectionResult] = useState(null);
  const [simulatedBlur, setSimulatedBlur] = useState(false);
  const [simulatedGlare, setSimulatedGlare] = useState(false);

  if (!isOpen) return null;

  const currentDoc = documents.find((d) => d.id === selectedDocId) || documents[0] || null;

  const handleRunInspection = () => {
    if (!hasConsent) return;

    // Use current document or mock metadata
    const docData = currentDoc || {
      name: 'Uploaded Document',
      type: 'image/jpeg',
      size: 150000,
    };

    const result = inspectDocumentReadability({
      fileOrMetadata: docData,
      documentType,
      hasUserConsent: true,
      extractedTextMock: currentDoc?.notes || 'Government of India UIDAI 1234 5678 9012 DOB: 1995',
      qualityMetricsOverride: {
        isBlurry: simulatedBlur,
        hasGlare: simulatedGlare,
        isLowContrast: false,
        isCutOff: false,
        sharpnessScore: simulatedBlur ? 42 : 91,
        contrastScore: 85,
      },
    });

    setInspectionResult(result);
  };

  const handleReset = () => {
    setInspectionResult(null);
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
      aria-labelledby="ocr-inspector-title"
    >
      <div
        className="modal-container w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
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
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                color: '#4f46e5',
              }}
            >
              <Camera size={22} />
            </div>
            <div>
              <h2 id="ocr-inspector-title" className="text-base font-bold">
                Consent-Based Document Quality & OCR Inspector
              </h2>
              <p
                className="text-xs"
                style={{ color: 'var(--text-secondary, #64748b)' }}
              >
                In-browser pre-check for blur, glare, and readable structural markers
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
          {/* Privacy Consent Card */}
          <div
            className="p-4 rounded-xl border flex flex-col gap-3"
            style={{
              backgroundColor: hasConsent
                ? 'rgba(16, 185, 129, 0.05)'
                : 'rgba(245, 158, 11, 0.05)',
              borderColor: hasConsent
                ? 'rgba(16, 185, 129, 0.3)'
                : 'rgba(245, 158, 11, 0.3)',
            }}
          >
            <div className="flex items-start gap-3">
              {hasConsent ? (
                <ShieldCheck size={20} className="text-emerald-600 mt-0.5 shrink-0" />
              ) : (
                <ShieldAlert size={20} className="text-amber-600 mt-0.5 shrink-0" />
              )}
              <div className="text-xs space-y-1">
                <span className="font-bold text-slate-800">
                  Voluntary Client-Side Inspection Consent
                </span>
                <p className="text-slate-600 leading-relaxed">
                  To protect your privacy, document quality checks run 100% inside your device's browser. No file or text is uploaded to any cloud server. Extracted text buffers are erased immediately after calculating readability.
                </p>
              </div>
            </div>

            <label className="flex items-center gap-2.5 pt-2 border-t border-slate-200/60 cursor-pointer text-xs font-semibold select-none">
              <input
                type="checkbox"
                checked={hasConsent}
                onChange={(e) => setHasConsent(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span>I give consent to inspect this document locally for readability</span>
            </label>
          </div>

          {/* Configuration Selector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Select Document from Vault
              </label>
              <select
                value={selectedDocId}
                onChange={(e) => setSelectedDocId(e.target.value)}
                className="w-full text-xs p-2.5 rounded-lg border bg-white border-slate-300 text-slate-800"
              >
                {documents.length > 0 ? (
                  documents.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name || d.title || `Document ${d.id}`}
                    </option>
                  ))
                ) : (
                  <option value="">No vault documents (Simulating sample image)</option>
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Document Template Standard
              </label>
              <select
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
                className="w-full text-xs p-2.5 rounded-lg border bg-white border-slate-300 text-slate-800"
              >
                {Object.entries(DOCUMENT_MARKER_TEMPLATES).map(([key, tpl]) => (
                  <option key={key} value={key}>
                    {tpl.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quality Test Simulation Toggles */}
          <div className="p-3 rounded-lg border bg-slate-50 flex items-center justify-between text-xs">
            <span className="font-medium text-slate-600 flex items-center gap-1.5">
              <Sliders size={14} /> Simulate Edge Defects:
            </span>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={simulatedBlur}
                  onChange={(e) => setSimulatedBlur(e.target.checked)}
                  className="rounded text-indigo-600"
                />
                <span>Simulate Blur</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={simulatedGlare}
                  onChange={(e) => setSimulatedGlare(e.target.checked)}
                  className="rounded text-indigo-600"
                />
                <span>Simulate Glare</span>
              </label>
            </div>
          </div>

          {/* Action Button */}
          {!inspectionResult && (
            <button
              type="button"
              disabled={!hasConsent}
              onClick={handleRunInspection}
              className={`w-full py-2.5 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition-all ${
                hasConsent
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Sparkles size={16} /> Run Quality & Readability Inspection
            </button>
          )}

          {/* Results Display */}
          {inspectionResult && (
            <div className="space-y-4 pt-2 border-t">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-800">
                  Readability Assessment Report
                </h4>
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                >
                  <RefreshCw size={12} /> Re-inspect
                </button>
              </div>

              {/* Score and Status Banner */}
              <div
                className="p-4 rounded-xl border flex items-center justify-between"
                style={{
                  backgroundColor:
                    inspectionResult.status === 'PASSED'
                      ? 'rgba(16, 185, 129, 0.08)'
                      : inspectionResult.status === 'CAUTION_IMPERFECT'
                        ? 'rgba(245, 158, 11, 0.08)'
                        : 'rgba(239, 68, 68, 0.08)',
                  borderColor:
                    inspectionResult.status === 'PASSED'
                      ? 'rgba(16, 185, 129, 0.3)'
                      : inspectionResult.status === 'CAUTION_IMPERFECT'
                        ? 'rgba(245, 158, 11, 0.3)'
                        : 'rgba(239, 68, 68, 0.3)',
                }}
              >
                <div>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Readability Score
                  </span>
                  <div className="text-2xl font-black mt-0.5">
                    {inspectionResult.readabilityScore}%
                  </div>
                  <div className="text-xs font-bold mt-1">
                    Status: {inspectionResult.status.replace(/_/g, ' ')}
                  </div>
                </div>

                <div className="text-right space-y-1">
                  <div className="text-xs text-slate-600">
                    Sharpness: {inspectionResult.metrics.sharpness}%
                  </div>
                  <div className="text-xs text-slate-600">
                    Glare Free: {inspectionResult.metrics.glareFree ? 'Yes' : 'No (Reflection)'}
                  </div>
                  <div className="text-xs text-slate-600">
                    Framing: {inspectionResult.metrics.framingGood ? 'Good' : 'Cut off'}
                  </div>
                </div>
              </div>

              {/* Marker Checklist */}
              <div className="p-3.5 rounded-xl border space-y-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Expected Structural Markers for {inspectionResult.documentType}
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {inspectionResult.markerChecklist.map((m, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 p-1.5 rounded bg-slate-50 text-slate-700"
                    >
                      {m.verified ? (
                        <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                      ) : (
                        <XCircle size={14} className="text-rose-500 shrink-0" />
                      )}
                      <span>{m.marker}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actionable Retake Tips */}
              <div
                className="p-4 rounded-xl border space-y-2"
                style={{
                  backgroundColor: 'rgba(245, 158, 11, 0.05)',
                  borderColor: 'rgba(245, 158, 11, 0.2)',
                }}
              >
                <span className="text-xs font-bold text-amber-800 flex items-center gap-1.5 uppercase tracking-wider">
                  <Camera size={14} /> Actionable Retake Recommendations
                </span>
                <ul className="text-xs text-slate-700 list-disc pl-5 space-y-1">
                  {inspectionResult.retakeGuidance.map((tip, idx) => (
                    <li key={idx}>{tip}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-6 py-4 border-t flex items-center justify-between"
          style={{ borderColor: 'var(--border-color, #e2e8f0)' }}
        >
          <button
            type="button"
            onClick={() => {
              onBypass();
              onClose();
            }}
            className="text-xs text-slate-500 hover:text-slate-700 underline"
          >
            Bypass & Accept Document Anyway
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 text-white hover:bg-slate-900 transition-colors"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
}
