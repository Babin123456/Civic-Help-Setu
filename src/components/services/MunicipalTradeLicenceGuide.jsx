import { useState } from 'react';
import {
  FileText,
  Building,
  CheckCircle,
  Clock,
  AlertTriangle,
  ShieldCheck,
  ExternalLink,
  Calendar,
  ShieldAlert,
  Lock,
  Layers,
  FileCheck2,
  FileQuestion,
  Info
} from 'lucide-react';

import {
  MUNICIPAL_JURISDICTIONS,
  MANDATORY_DOCUMENTS,
  CONDITIONAL_DOCUMENTS,
  OPTIONAL_DOCUMENTS,
  ORDERED_JOURNEY_STAGES
} from '../../data/municipalTradeLicenceData';

/**
 * Municipal Trade Licence Citizen Guide Component
 *
 * Provides a comprehensive, jurisdiction-aware, plain-language citizen guide
 * for acquiring and renewing a Municipal Trade / Business Licence across Indian Urban Local Bodies (ULBs).
 *
 * Strictly adheres to civic integrity rules:
 * - Differentiates Urban Local Bodies (MCD, GCC, BBMP, KMC, BMC).
 * - Distinguishes mandatory vs conditional vs optional documents.
 * - Handles missing official sources and unavailable fees/timelines with:
 *   "Not specified by the linked official source."
 * - Separates application, acknowledgement, appointment, verification, issue, validity, and renewal dates.
 * - Discloses legal caveats: mutation/trade licence != title guarantee or regularization of unauthorized construction.
 * - Protects citizen privacy: zero identity-document storage, zero portal automation.
 */

export default function MunicipalTradeLicenceGuide({
  initialJurisdictionId = 'delhi',
  initialTab = 'overview'
} = {}) {
  const [selectedJurisdictionId, setSelectedJurisdictionId] = useState(initialJurisdictionId);
  const [activeTab, setActiveTab] = useState(initialTab); // 'overview' | 'jurisdictions' | 'journey' | 'documents' | 'dates' | 'caveats'

  // Date calculator & tracker state (purely client-side, zero storage)
  const [trackerIssueDate, setTrackerIssueDate] = useState('');
  const [trackerCalculatedDates, setTrackerCalculatedDates] = useState(null);

  const currentJurisdiction =
    MUNICIPAL_JURISDICTIONS.find((j) => j.id === selectedJurisdictionId) ||
    MUNICIPAL_JURISDICTIONS[0];

  const handleCalculateDates = (e) => {
    e.preventDefault();
    if (!trackerIssueDate) return;

    const issue = new Date(trackerIssueDate);
    if (isNaN(issue.getTime())) return;

    // Standard Indian municipal practice: Trade licence runs on financial year basis (expiring 31 March)
    let expiryYear = issue.getFullYear();
    // If issued between January and March, it typically expires on 31 March of that same year,
    // or if issued after 1 April, it expires on 31 March of next calendar year.
    if (issue.getMonth() >= 3) {
      expiryYear += 1;
    }
    const expiryDate = new Date(Date.UTC(expiryYear, 2, 31)); // 31 March
    const renewalWindowStart = new Date(Date.UTC(expiryYear, 0, 1)); // 1 January
    const latePenaltyCutoff = new Date(Date.UTC(expiryYear, 3, 1)); // 1 April

    setTrackerCalculatedDates({
      applicationDate: trackerIssueDate,
      issueDate: trackerIssueDate,
      validityExpiryDate: expiryDate.toISOString().split('T')[0],
      renewalWindowDate: `${renewalWindowStart.toISOString().split('T')[0]} to ${expiryDate.toISOString().split('T')[0]}`,
      lateRenewalPenaltyDate: latePenaltyCutoff.toISOString().split('T')[0]
    });
  };

  return (
    <div className="municipal-trade-licence-guide max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 mb-2">
              <ShieldCheck className="w-3.5 h-3.5" /> Urban Local Body (ULB) Statutory Guide
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Municipal Trade Licence Application &amp; Renewal Guide
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Plain-language municipal guidance on obtaining commercial trade permissions, understanding fee schedules, verifying mandatory premises documents, and avoiding late renewal penalties.
            </p>
          </div>

          <div className="flex flex-col items-start sm:items-end gap-1.5">
            <label
              htmlFor="jurisdiction-select"
              className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider"
            >
              Select Municipal Body:
            </label>
            <select
              id="jurisdiction-select"
              value={selectedJurisdictionId}
              onChange={(e) => setSelectedJurisdictionId(e.target.value)}
              className="text-xs font-medium bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Select Municipal Corporation Jurisdiction"
            >
              {MUNICIPAL_JURISDICTIONS.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.localBody} ({j.state})
                </option>
              ))}
            </select>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {currentJurisdiction.verified ? '✓ Official Verified ULB' : '⚠ Unverified Local Body'}
            </span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div
          role="tablist"
          aria-label="Trade Licence Guide Sections"
          className="flex flex-wrap gap-2 pt-6 border-t border-slate-200 dark:border-slate-800 mt-6"
        >
          {[
            { id: 'overview', label: 'Overview & Legal Scope', icon: FileText },
            { id: 'jurisdictions', label: 'Municipal Body Details', icon: Building },
            { id: 'journey', label: 'Application & Renewal Journey', icon: Layers },
            { id: 'documents', label: 'Required vs. Optional Documents', icon: CheckCircle },
            { id: 'dates', label: 'Date Tracker & Renewal Windows', icon: Calendar },
            { id: 'caveats', label: 'Warnings & Conflicting Rules', icon: AlertTriangle }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                id={`tab-${tab.id}`}
                aria-selected={isActive}
                aria-controls={`panel-${tab.id}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Panels */}

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div
          id="panel-overview"
          role="tabpanel"
          aria-labelledby="tab-overview"
          className="space-y-6"
        >
          {/* Critical Caveat Banner */}
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl p-5 text-amber-900 dark:text-amber-200">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm space-y-1">
                <p className="font-semibold text-base">
                  Critical Municipal Principle: Trade Licence ≠ Property Ownership or Title Guarantee
                </p>
                <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-300">
                  A Municipal Trade Licence is solely a regulatory permission granting authorization to carry on a specific commercial activity at a defined premises without causing public nuisance, fire hazards, or sanitary violations. <strong>It does not confer legal ownership, does not regularize illegal or unauthorized constructions, and does not override Master Plan zoning violations.</strong>
                </p>
              </div>
            </div>
          </div>

          {/* Core Concept Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-slate-900 dark:text-white font-semibold text-base">
                <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                What a Trade Licence Regulates
              </div>
              <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-2 list-disc list-inside">
                <li>Ensures commercial activities do not create unbearable smoke, noise, chemical effluents, or traffic hazards.</li>
                <li>Verifies fire safety precautions and minimum required escape routes for high-occupancy establishments.</li>
                <li>Enforces public health and food safety standards under municipal and FSSAI health mandates.</li>
                <li>Imposes statutory fee contribution for municipal infrastructure, solid waste clearance, and roads.</li>
              </ul>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-slate-900 dark:text-white font-semibold text-base">
                <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                What a Trade Licence Does NOT Do
              </div>
              <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-2 list-disc list-inside">
                <li>Does NOT guarantee business profit, bank loan sanction, or protection from civil litigation.</li>
                <li>Does NOT prevent municipal demolition or sealing if the premises violates city Master Plan land-use zoning.</li>
                <li>Does NOT condone encroachments onto public roads, footpaths, or government land.</li>
                <li>Cannot be transferred to another physical address without formal municipal modification.</li>
              </ul>
            </div>
          </div>

          {/* Trade Category Scopes */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Primary Trade Licence Classifications in Indian Municipalities
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-3 bg-slate-50 dark:bg-slate-800/40">
                <span className="font-semibold text-slate-900 dark:text-white block mb-1">
                  1. General Commercial Trade
                </span>
                <p className="text-slate-600 dark:text-slate-400">
                  Retail shops, apparel stores, stationery, hardware, electronics, salons, and non-hazardous business offices.
                </p>
              </div>
              <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-3 bg-slate-50 dark:bg-slate-800/40">
                <span className="font-semibold text-slate-900 dark:text-white block mb-1">
                  2. Food &amp; Health Establishments
                </span>
                <p className="text-slate-600 dark:text-slate-400">
                  Restaurants, cafes, bakeries, sweetshops, catering units, canteens, and food packaging centers (requires FSSAI alignment).
                </p>
              </div>
              <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-3 bg-slate-50 dark:bg-slate-800/40">
                <span className="font-semibold text-slate-900 dark:text-white block mb-1">
                  3. Dangerous &amp; Offensive (D&amp;O) Trades
                </span>
                <p className="text-slate-600 dark:text-slate-400">
                  Chemical manufacturing, metal workshops, sawmills, timber yards, battery storage, and dry cleaners (requires Fire &amp; Pollution NOCs).
                </p>
              </div>
              <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-3 bg-slate-50 dark:bg-slate-800/40">
                <span className="font-semibold text-slate-900 dark:text-white block mb-1">
                  4. Veterinary &amp; Pet Establishments
                </span>
                <p className="text-slate-600 dark:text-slate-400">
                  Pet clinics, grooming parlours, kennels, and aquariums subject to municipal veterinary bylaws.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: JURISDICTIONS */}
      {activeTab === 'jurisdictions' && (
        <div
          id="panel-jurisdictions"
          role="tabpanel"
          aria-labelledby="tab-jurisdictions"
          className="space-y-6"
        >
          {/* Active Jurisdiction Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 gap-2">
              <div>
                <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                  Active Urban Local Body Profile
                </span>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
                  {currentJurisdiction.localBody}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {currentJurisdiction.district}, {currentJurisdiction.state}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {currentJurisdiction.verified ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    <CheckCircle className="w-3.5 h-3.5" /> Official Verified Source
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                    <AlertTriangle className="w-3.5 h-3.5" /> Unverified Authority
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <span className="font-semibold text-slate-700 dark:text-slate-300 block">
                  Responsible Department:
                </span>
                <p className="text-slate-600 dark:text-slate-400">
                  {currentJurisdiction.department}
                </p>
              </div>

              <div className="space-y-1">
                <span className="font-semibold text-slate-700 dark:text-slate-300 block">
                  Statutory Governing Act:
                </span>
                <p className="text-slate-600 dark:text-slate-400">
                  {currentJurisdiction.statutoryAct}
                </p>
              </div>

              <div className="space-y-1">
                <span className="font-semibold text-slate-700 dark:text-slate-300 block">
                  Official Portal URL:
                </span>
                {currentJurisdiction.portalUrl ? (
                  <a
                    href={currentJurisdiction.portalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 font-medium break-all"
                  >
                    {currentJurisdiction.portalUrl}
                    <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  </a>
                ) : (
                  <span className="text-slate-500 italic">
                    Not specified by the linked official source.
                  </span>
                )}
              </div>

              <div className="space-y-1">
                <span className="font-semibold text-slate-700 dark:text-slate-300 block">
                  Last Source Verification Date:
                </span>
                <p className="text-slate-600 dark:text-slate-400">
                  {currentJurisdiction.lastVerified}
                </p>
              </div>

              <div className="space-y-1 md:col-span-2">
                <span className="font-semibold text-slate-700 dark:text-slate-300 block">
                  Official Processing Timeline:
                </span>
                <p className="text-slate-600 dark:text-slate-400">
                  {currentJurisdiction.processingTime}
                </p>
              </div>

              <div className="space-y-1 md:col-span-2">
                <span className="font-semibold text-slate-700 dark:text-slate-300 block">
                  Statutory Fee Assessment Rule:
                </span>
                <p className="text-slate-600 dark:text-slate-400">
                  {currentJurisdiction.feeStructure}
                </p>
              </div>

              <div className="space-y-1 md:col-span-2">
                <span className="font-semibold text-slate-700 dark:text-slate-300 block">
                  Validity &amp; Renewal Cycle:
                </span>
                <p className="text-slate-600 dark:text-slate-400">
                  {currentJurisdiction.validityPeriod} | Renewal: {currentJurisdiction.renewalWindow}
                </p>
              </div>

              <div className="space-y-1 md:col-span-2">
                <span className="font-semibold text-slate-700 dark:text-slate-300 block">
                  Field Inspection Requirement:
                </span>
                <p className="text-slate-600 dark:text-slate-400">
                  {currentJurisdiction.inspectionNote}
                </p>
              </div>
            </div>
          </div>

          {/* Quick Jurisdiction Switcher Grid */}
          <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
            <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Compare Major Indian Municipal Corporations
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
              {MUNICIPAL_JURISDICTIONS.map((j) => (
                <button
                  key={j.id}
                  type="button"
                  onClick={() => setSelectedJurisdictionId(j.id)}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    j.id === selectedJurisdictionId
                      ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 font-semibold'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                  }`}
                >
                  <span className="block font-medium">{j.localBody}</span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                    {j.state}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: JOURNEY */}
      {activeTab === 'journey' && (
        <div
          id="panel-journey"
          role="tabpanel"
          aria-labelledby="tab-journey"
          className="space-y-6"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm space-y-4">
            <div className="pb-3 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Ordered Application &amp; Renewal Journey
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Standard sequential steps for fresh municipal trade registration and compulsory annual renewal cycles.
              </p>
            </div>

            <div className="space-y-4">
              {ORDERED_JOURNEY_STAGES.map((s) => (
                <div
                  key={s.stage}
                  className="flex items-start gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30"
                >
                  <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                    {s.stage}
                  </div>
                  <div className="space-y-1 flex-1 text-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <h3 className="font-semibold text-sm text-slate-900 dark:text-white">
                        {s.title}
                      </h3>
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded">
                        <Clock className="w-3 h-3" /> {s.dateLabel}
                      </span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300">
                      {s.description}
                    </p>
                    <div className="pt-1 text-[11px] text-slate-500 dark:text-slate-400">
                      <strong>Milestone:</strong> {s.milestone}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: DOCUMENTS */}
      {activeTab === 'documents' && (
        <div
          id="panel-documents"
          role="tabpanel"
          aria-labelledby="tab-documents"
          className="space-y-6"
        >
          {/* Mandatory Documents */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
              <FileCheck2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  1. Mandatory Documents (Required for All Applicants)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Every business applicant must furnish these core proofs regardless of trade nature.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {MANDATORY_DOCUMENTS.map((doc) => (
                <div
                  key={doc.id}
                  className="p-3.5 rounded-lg border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/30 dark:bg-emerald-950/20 space-y-1 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {doc.title}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200">
                      Mandatory
                    </span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300">
                    {doc.description}
                  </p>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                    <strong>Statutory Rationale:</strong> {doc.officialBasis}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Conditional Documents */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
              <FileQuestion className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  2. Conditional Requirements (Trade-Specific Clearances &amp; NOCs)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Mandatory only when your specific commercial category triggers statutory health, fire, or environmental thresholds.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {CONDITIONAL_DOCUMENTS.map((doc) => (
                <div
                  key={doc.id}
                  className="p-3.5 rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50/30 dark:bg-amber-950/20 space-y-1 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {doc.title}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200">
                      Conditional
                    </span>
                  </div>
                  <p className="text-amber-800 dark:text-amber-300 font-medium">
                    Trigger Condition: {doc.condition}
                  </p>
                  <p className="text-slate-600 dark:text-slate-300">
                    {doc.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Optional Supporting Documents */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
              <Info className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  3. Optional / Voluntary Supporting Documents
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Non-compulsory documents that expedite business onboarding or prove voluntary tax compliance.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {OPTIONAL_DOCUMENTS.map((doc) => (
                <div
                  key={doc.id}
                  className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-1 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {doc.title}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                      Optional
                    </span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300">
                    {doc.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: DATES & RENEWAL TRACKER */}
      {activeTab === 'dates' && (
        <div
          id="panel-dates"
          role="tabpanel"
          aria-labelledby="tab-dates"
          className="space-y-6"
        >
          {/* Separate Date Labels Description */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm space-y-4">
            <div className="pb-3 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Statutory Milestone Date Fields
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Every municipal trade record contains separate dates with distinct legal consequences. Keep note of each date.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                <span className="font-bold text-slate-900 dark:text-white block mb-0.5">
                  1. Application Date
                </span>
                <p className="text-slate-600 dark:text-slate-400">
                  The date the citizen submits the electronic form on the municipal portal.
                </p>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                <span className="font-bold text-slate-900 dark:text-white block mb-0.5">
                  2. Acknowledgement Date
                </span>
                <p className="text-slate-600 dark:text-slate-400">
                  The date the municipal server records the application and generates the provisional tracking token.
                </p>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                <span className="font-bold text-slate-900 dark:text-white block mb-0.5">
                  3. Appointment / Inspection Date
                </span>
                <p className="text-slate-600 dark:text-slate-400">
                  The scheduled date when the Sanitary Inspector (SI) or Junior Engineer conducts on-site verification.
                </p>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                <span className="font-bold text-slate-900 dark:text-white block mb-0.5">
                  4. Verification Date
                </span>
                <p className="text-slate-600 dark:text-slate-400">
                  The date departmental verification report is uploaded and cleared by the licensing authority.
                </p>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                <span className="font-bold text-slate-900 dark:text-white block mb-0.5">
                  5. Issue Date
                </span>
                <p className="text-slate-600 dark:text-slate-400">
                  The date the final Trade Certificate is digitally signed and released for public download.
                </p>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                <span className="font-bold text-slate-900 dark:text-white block mb-0.5">
                  6. Validity Expiry Date
                </span>
                <p className="text-slate-600 dark:text-slate-400">
                  Typically 31st March of the financial year. The licence ceases to be legally valid after this date.
                </p>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                <span className="font-bold text-slate-900 dark:text-white block mb-0.5">
                  7. Renewal Window Date
                </span>
                <p className="text-slate-600 dark:text-slate-400">
                  The statutory 90-day window (1 January to 31 March) during which renewals must be filed.
                </p>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                <span className="font-bold text-slate-900 dark:text-white block mb-0.5">
                  8. Late Renewal Penalty Date
                </span>
                <p className="text-slate-600 dark:text-slate-400">
                  Cut-off date (1 April onwards) where penal surcharge (20% to 50% or daily fines) is levied.
                </p>
              </div>
            </div>
          </div>

          {/* Interactive Date & Renewal Calculator */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
              <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Client-Side Validity &amp; Renewal Window Calculator
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Calculate statutory 31st March financial year cut-offs for timely renewal without late surcharges.
                </p>
              </div>
            </div>

            <form onSubmit={handleCalculateDates} className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <label htmlFor="issue-date-input" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Enter Licence Issue Date:
                </label>
                <input
                  id="issue-date-input"
                  type="date"
                  value={trackerIssueDate}
                  onChange={(e) => setTrackerIssueDate(e.target.value)}
                  className="text-xs p-2 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  required
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors"
                >
                  Calculate Renewal Schedule
                </button>
              </div>
            </form>

            {trackerCalculatedDates && (
              <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/40 dark:bg-blue-950/20 space-y-3 text-xs">
                <h4 className="font-bold text-blue-900 dark:text-blue-200">
                  Calculated Statutory Schedule:
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <span className="text-slate-600 dark:text-slate-400 block">Licence Issue Date:</span>
                    <strong className="text-slate-900 dark:text-white">{trackerCalculatedDates.issueDate}</strong>
                  </div>
                  <div>
                    <span className="text-slate-600 dark:text-slate-400 block">Validity Expiry Date:</span>
                    <strong className="text-rose-600 dark:text-rose-400">{trackerCalculatedDates.validityExpiryDate} (Financial Year End)</strong>
                  </div>
                  <div>
                    <span className="text-slate-600 dark:text-slate-400 block">Timely Renewal Window:</span>
                    <strong className="text-emerald-700 dark:text-emerald-400">{trackerCalculatedDates.renewalWindowDate}</strong>
                  </div>
                  <div>
                    <span className="text-slate-600 dark:text-slate-400 block">Late Penalty Date (Surcharges Apply):</span>
                    <strong className="text-amber-700 dark:text-amber-400">{trackerCalculatedDates.lateRenewalPenaltyDate} onwards</strong>
                  </div>
                </div>
              </div>
            )}

            {/* Privacy notice */}
            <div className="flex items-center gap-2 pt-2 text-[11px] text-slate-500 dark:text-slate-400">
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              <span>
                Privacy Guarantee: This calculation runs entirely in your local browser. No dates, identity documents, or personal data are stored or uploaded.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: CAVEATS & CONFLICTS */}
      {activeTab === 'caveats' && (
        <div
          id="panel-caveats"
          role="tabpanel"
          aria-labelledby="tab-caveats"
          className="space-y-6"
        >
          {/* Conflicting Blog Claims vs Statutory Facts */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              Flagged Conflicting &amp; Misleading Online Information
            </h2>
            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-1">
                <span className="font-semibold text-rose-600 dark:text-rose-400 block">
                  Myth: "A Municipal Trade Licence has Lifetime Validity."
                </span>
                <p className="text-slate-600 dark:text-slate-300">
                  <strong>Statutory Fact:</strong> False. Municipal Trade Licences across Indian urban bodies (MCD, GCC, BBMP, KMC, BMC) are strictly period-bound, overwhelmingly based on the financial year ending 31 March (or occasionally 1 to 3 years multi-year options). Operating past 31 March without renewal constitutes an unlicensed commercial trade liable for daily fines and sealing notices.
                </p>
              </div>

              <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-1">
                <span className="font-semibold text-rose-600 dark:text-rose-400 block">
                  Myth: "One Trade Licence fee applies uniformly across all of India."
                </span>
                <p className="text-slate-600 dark:text-slate-300">
                  <strong>Statutory Fact:</strong> False. There is no nationwide flat fee. Every local municipal corporation publishes its own tariff schedule based on covered carpet area, street category, and installed electric power. Any blog asserting a universal "₹500 trade licence fee" is factually inaccurate.
                </p>
              </div>

              <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-1">
                <span className="font-semibold text-rose-600 dark:text-rose-400 block">
                  Myth: "Getting a Trade Licence regularizes illegal construction or allows shops on any residential street."
                </span>
                <p className="text-slate-600 dark:text-slate-300">
                  <strong>Statutory Fact:</strong> False. The Supreme Court of India and High Courts have repeatedly held that municipal trade licences do not condone building bylaw violations or land-use non-compliance. If a street is not notified for mixed or commercial use under the Master Plan, municipal enforcement squads can seal the premises regardless of trade licence possession.
                </p>
              </div>
            </div>
          </div>

          {/* Missing Information Disclosure */}
          <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-2 text-xs">
            <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Information Transparency Disclaimer
            </span>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              Whenever a specific municipal body or trade schedule does not disclose fees or turnaround times on its official government portal, this guide displays: <em>"Not specified by the linked official source."</em> We deliberately refrain from publishing estimated or fabricated numbers from unofficial commercial blogs.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
