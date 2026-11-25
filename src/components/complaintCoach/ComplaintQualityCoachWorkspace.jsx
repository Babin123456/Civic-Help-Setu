import React, { useState, useId } from 'react';
import {
  COMPLAINT_CATEGORIES,
  COMPLAINT_CATEGORY_LABELS,
  SYNTHETIC_COMPLAINT_FIXTURES,
  CATEGORY_REQUIREMENTS,
} from '../../data/complaintQualityContract.js';
import { analyzeComplaintQuality } from '../../services/complaintQualityCoachService.js';
import {
  AlertTriangle,
  CheckCircle,
  ShieldCheck,
  FileText,
  Copy,
  RotateCcw,
  Sparkles,
  Info,
  Calendar,
  MapPin,
  FileCheck,
} from 'lucide-react';

export default function ComplaintQualityCoachWorkspace() {
  const [category, setCategory] = useState(COMPLAINT_CATEGORIES.MUNICIPAL_SERVICES);
  const [rawText, setRawText] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const [editedDraft, setEditedDraft] = useState('');
  const [activeTab, setActiveTab] = useState('analysis'); // 'analysis' | 'draft' | 'privacy'

  const categorySelectId = useId();
  const rawTextInputId = useId();
  const fixtureSelectId = useId();

  const handleSelectFixture = (e) => {
    const fixtureId = e.target.value;
    if (!fixtureId) return;
    const fixture = SYNTHETIC_COMPLAINT_FIXTURES.find((f) => f.id === fixtureId);
    if (fixture) {
      setCategory(fixture.category);
      setRawText(fixture.rawText);
      setAnalysis(null);
      setErrorMsg('');
      setEditedDraft('');
    }
  };

  const handleAnalyze = () => {
    setErrorMsg('');
    if (!rawText.trim()) {
      setErrorMsg('Please enter complaint text or load a synthetic fixture.');
      return;
    }

    setIsAnalyzing(true);
    try {
      const res = analyzeComplaintQuality({ category, rawText });
      if (!res.success) {
        setErrorMsg(res.error || (res.errors && res.errors.join(', ')) || 'Analysis failed.');
        setAnalysis(null);
      } else {
        setAnalysis(res);
        setEditedDraft(res.polishedDraft || '');
        setActiveTab('analysis');
      }
    } catch (err) {
      setErrorMsg(err.message || 'An unexpected error occurred during analysis.');
      setAnalysis(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCopyDraft = async () => {
    if (!editedDraft) return;
    try {
      await navigator.clipboard.writeText(editedDraft);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleReset = () => {
    setRawText('');
    setAnalysis(null);
    setErrorMsg('');
    setEditedDraft('');
  };

  const currentReq = CATEGORY_REQUIREMENTS[category] || {};

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8 font-sans">
      {/* Header & Governance Banner */}
      <header className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-100 text-blue-800 rounded-xl">
            <Sparkles className="w-7 h-7" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
              Agentic Civic Complaint Quality & Completeness Coach
            </h1>
            <p className="text-sm sm:text-base text-gray-600">
              Identify missing dates, locations, reference IDs and evidence before submitting complaints.
            </p>
          </div>
        </div>

        {/* Human in the loop & Non-official disclaimer */}
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs sm:text-sm flex items-start gap-3">
          <Info className="w-5 h-5 flex-shrink-0 text-amber-700 mt-0.5" aria-hidden="true" />
          <div>
            <strong className="font-semibold">Civic Governance Notice:</strong> This coach provides automated quality feedback and privacy redaction previews. It <em>does not</em> autonomously submit complaints to government departments, nor does it guarantee grievance resolution or official statutory verification.
          </div>
        </div>
      </header>

      {/* Main Form Section */}
      <section className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Category Selector */}
          <div>
            <label htmlFor={categorySelectId} className="block text-sm font-semibold text-gray-800 mb-1">
              Select Civic Department / Category <span className="text-red-500">*</span>
            </label>
            <select
              id={categorySelectId}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm bg-white"
            >
              {Object.keys(COMPLAINT_CATEGORIES).map((catKey) => (
                <option key={catKey} value={catKey}>
                  {COMPLAINT_CATEGORY_LABELS[catKey]}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Required fields for this category: {currentReq.requiredFields?.join(', ')}.
            </p>
          </div>

          {/* Synthetic Fixture Loader */}
          <div>
            <label htmlFor={fixtureSelectId} className="block text-sm font-semibold text-gray-800 mb-1">
              Load Synthetic Demo Complaint (Safe Test Cases)
            </label>
            <select
              id={fixtureSelectId}
              onChange={handleSelectFixture}
              defaultValue=""
              className="w-full px-3 py-2 border border-dashed border-blue-300 bg-blue-50/50 rounded-lg text-sm text-blue-900 focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Choose a synthetic fixture --</option>
              {SYNTHETIC_COMPLAINT_FIXTURES.map((f) => (
                <option key={f.id} value={f.id}>
                  [{f.language.toUpperCase()}] {f.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Loads pre-packaged synthetic examples to inspect missing facts, ambiguous dates, or injections.
            </p>
          </div>
        </div>

        {/* Complaint Text Area */}
        <div>
          <label htmlFor={rawTextInputId} className="block text-sm font-semibold text-gray-800 mb-1">
            Describe Your Complaint / Issue <span className="text-red-500">*</span>
          </label>
          <textarea
            id={rawTextInputId}
            rows={5}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="E.g., On 15th October 2026, streetlights on 5th Main Road Ward 12 stopped working..."
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
          />
          <div className="flex justify-between items-center text-xs text-gray-500 mt-1">
            <span>Character count: {rawText.length}</span>
            <span>Recommended evidence: {currentReq.evidenceSuggestions?.join(', ')}</span>
          </div>
        </div>

        {/* Error notification */}
        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-sm flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 text-red-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            {isAnalyzing ? 'Evaluating Quality...' : 'Analyze Complaint Quality'}
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2.5 border border-gray-300 text-gray-700 hover:bg-gray-100 font-medium rounded-lg text-sm transition-colors flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
        </div>
      </section>

      {/* Analysis Results Display */}
      {analysis && (
        <section className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden space-y-6 p-6">
          {/* Header Score & Tabs */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-gray-200">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-gray-900">Quality Score: {analysis.score}/100</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    analysis.grade === 'EXCELLENT'
                      ? 'bg-green-100 text-green-800'
                      : analysis.grade === 'GOOD'
                      ? 'bg-blue-100 text-blue-800'
                      : analysis.grade === 'NEEDS_ATTENTION'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {analysis.grade.replace(/_/g, ' ')}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Evaluated against schema standard: {analysis.schemaVersion}
              </p>
            </div>

            {/* Sub-Tabs */}
            <div className="flex rounded-lg bg-gray-100 p-1 text-xs sm:text-sm font-medium">
              <button
                type="button"
                onClick={() => setActiveTab('analysis')}
                className={`px-3 py-1.5 rounded-md transition ${
                  activeTab === 'analysis' ? 'bg-white shadow text-blue-700' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Completeness Checklist
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('draft')}
                className={`px-3 py-1.5 rounded-md transition ${
                  activeTab === 'draft' ? 'bg-white shadow text-blue-700' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Editable Draft & Preview
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('privacy')}
                className={`px-3 py-1.5 rounded-md transition ${
                  activeTab === 'privacy' ? 'bg-white shadow text-blue-700' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Privacy Preview ({analysis.privacyPreview?.piiCount} Redactions)
              </button>
            </div>
          </div>

          {/* TAB 1: Completeness Checklist */}
          {activeTab === 'analysis' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Specific Metric Cards */}
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-1">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    <span>Date of Incident</span>
                  </div>
                  <p className="text-xs text-gray-600">
                    {analysis.dateAnalysis.hasSpecificDate
                      ? `Found: "${analysis.dateAnalysis.foundDateMatch}"`
                      : analysis.dateAnalysis.hasAmbiguousDate
                      ? 'Ambiguous timeline terms found. Please be specific.'
                      : 'Missing explicit date.'}
                  </p>
                </div>

                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-1">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                    <MapPin className="w-4 h-4 text-green-600" />
                    <span>Location Specificity</span>
                  </div>
                  <p className="text-xs text-gray-600">
                    {analysis.locationAnalysis.hasSpecificLocation
                      ? 'Identified specific landmark, street, ward or sector.'
                      : 'Missing or vague landmark.'}
                  </p>
                </div>

                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-1">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                    <FileCheck className="w-4 h-4 text-purple-600" />
                    <span>Prior Reference / Consumer ID</span>
                  </div>
                  <p className="text-xs text-gray-600">
                    {analysis.referenceAnalysis.hasReferenceNumber
                      ? `Extracted ID(s): ${analysis.referenceAnalysis.extractedReferences.join(', ')}`
                      : 'No prior reference token provided.'}
                  </p>
                </div>

                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-1">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                    <FileText className="w-4 h-4 text-amber-600" />
                    <span>Evidence Attachments</span>
                  </div>
                  <p className="text-xs text-gray-600">
                    {analysis.evidenceAnalysis.hasEvidenceMention
                      ? `Mentioned: ${analysis.evidenceAnalysis.foundTypes.join(', ')}`
                      : 'No supporting documentation or photo mentioned.'}
                  </p>
                </div>
              </div>

              {/* Checklist Breakdown */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                  Detailed Completeness Items
                </h3>
                <ul className="space-y-2">
                  {analysis.checklist.map((item, idx) => (
                    <li
                      key={idx}
                      className={`p-3 rounded-lg border text-sm flex items-start gap-3 ${
                        item.status === 'PASS'
                          ? 'bg-green-50/70 border-green-200 text-green-900'
                          : item.status === 'WARN'
                          ? 'bg-amber-50/70 border-amber-200 text-amber-900'
                          : item.status === 'FAIL'
                          ? 'bg-red-50/70 border-red-200 text-red-900'
                          : 'bg-blue-50/70 border-blue-200 text-blue-900'
                      }`}
                    >
                      {item.status === 'PASS' ? (
                        <CheckCircle className="w-5 h-5 flex-shrink-0 text-green-600 mt-0.5" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-600 mt-0.5" />
                      )}
                      <div>
                        <div className="font-semibold">{item.label}</div>
                        {item.advice && <div className="text-xs mt-0.5 opacity-90">{item.advice}</div>}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Unsupported Allegation Warning */}
              {analysis.allegationAnalysis.hasUnsupportedAllegations && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg space-y-2">
                  <div className="flex items-center gap-2 text-sm font-bold text-red-900">
                    <AlertTriangle className="w-4 h-4 text-red-700" />
                    <span>Unsupported Allegations Detected</span>
                  </div>
                  <p className="text-xs text-red-800">
                    Unsubstantiated criminal or corruption accusations in public service complaints often lead to automatic rejection or defamation risks without registered vigilance records.
                  </p>
                  <ul className="list-disc list-inside text-xs text-red-700 space-y-1">
                    {analysis.allegationAnalysis.allegations.map((a, i) => (
                      <li key={i}>{a.warning}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Editable Polished Draft */}
          {activeTab === 'draft' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-gray-800">
                  Polished Objective Draft (Editable by Citizen)
                </span>
                <button
                  type="button"
                  onClick={handleCopyDraft}
                  className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md font-medium flex items-center gap-1.5 transition"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copied ? 'Copied!' : 'Copy Draft'}
                </button>
              </div>

              <textarea
                rows={12}
                value={editedDraft}
                onChange={(e) => setEditedDraft(e.target.value)}
                className="w-full p-4 font-mono text-xs sm:text-sm bg-gray-50 border border-gray-300 rounded-lg leading-relaxed focus:ring-2 focus:ring-blue-500"
              />

              {/* Provenance Tag */}
              <div className="p-3 bg-gray-100 rounded-lg border border-gray-200 text-xs text-gray-600 space-y-1">
                <div className="font-semibold text-gray-800">Proposal Provenance & Verification Metadata:</div>
                <div>Generator: {analysis.provenance.generator}</div>
                <div>Timestamp: {analysis.provenance.timestamp}</div>
                <div className="text-gray-500 italic">{analysis.provenance.disclaimer}</div>
              </div>
            </div>
          )}

          {/* TAB 3: Privacy Preview */}
          {activeTab === 'privacy' && (
            <div className="space-y-4">
              <div className="p-3 bg-blue-50 border border-blue-200 text-blue-900 rounded-lg text-xs">
                <ShieldCheck className="w-4 h-4 inline-block mr-1 text-blue-700" />
                <strong>Privacy Preview:</strong> Demonstrates local client-side redaction of sensitive identifiers (Aadhaar, PAN, phone numbers, bank accounts) before transmission.
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold text-gray-700">
                  PII Categories Scrubbed: {analysis.privacyPreview?.piiCategories?.join(', ') || 'None'}
                </div>
                <textarea
                  readOnly
                  rows={8}
                  value={analysis.privacyPreview?.redactedText || ''}
                  className="w-full p-3 font-mono text-xs bg-gray-50 border border-gray-300 rounded-lg text-gray-700"
                />
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
