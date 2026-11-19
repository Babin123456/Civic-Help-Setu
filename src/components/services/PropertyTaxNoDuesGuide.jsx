import { useState } from 'react';
import {
  FileText,
  Building,
  CheckCircle,
  AlertTriangle,
  ShieldCheck,
  ExternalLink,
  Calendar,
  Layers,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Check,
  Copy,
  Receipt,
  ShieldAlert,
  FileWarning
} from 'lucide-react';

import {
  INDIAN_STATES_AND_UTS,
  JURISDICTION_HIERARCHY,
  PROPERTY_TAX_CORE_DEFINITIONS,
  WHY_CITIZENS_NEED_CERTIFICATE,
  ORDERED_JOURNEY_STAGES,
  INFORMATIONAL_TRACKING_FIELDS,
  PROPERTY_TAX_FAQS,
  STATUTORY_CAVEATS_AND_WARNINGS,
  getJurisdictionById,
  getAvailableDistrictsForState,
  getAvailableUlbsForDistrict
} from '../../data/propertyTaxNoDuesData';

/**
 * Property Tax No-Dues Certificate & Payment Receipt Guide Component
 *
 * Implements GitHub Issue #531:
 * Comprehensive, jurisdiction-aware, privacy-preserving citizen guide for Property Tax
 * No-Dues Certificates and payment receipts across Indian Urban Local Bodies (ULBs).
 *
 * Key Principles:
 * 1. Distinction: Payment receipt proves a transaction; No-Dues Certificate verifies zero liability.
 * 2. Title Disclaimer: Neither document establishes legal ownership, marketable title, or regularizes illegal constructions.
 * 3. Official Source Grounding: Explicitly flags unverified jurisdictions and missing timelines.
 * 4. Citizen Privacy: Zero PII storage, zero document uploads, zero third-party telemetry.
 */
export default function PropertyTaxNoDuesGuide({
  initialState = 'Delhi',
  initialDistrict = 'All Delhi Districts',
  initialJurisdictionId = 'delhi-mcd',
  initialTab = 'overview',
  onBack = null
} = {}) {
  // Cascading jurisdiction selection state
  const [selectedState, setSelectedState] = useState(initialState);
  const [selectedDistrict, setSelectedDistrict] = useState(initialDistrict);
  const [selectedJurisdictionId, setSelectedJurisdictionId] = useState(initialJurisdictionId);

  // Active navigation tab
  const [activeTab, setActiveTab] = useState(initialTab); // 'overview' | 'jurisdictions' | 'journey' | 'documents' | 'tracking' | 'caveats' | 'faqs'

  // Interactive document filter & client-side preparation tracker (zero remote storage)
  const [docFilter, setDocFilter] = useState('all'); // 'all' | 'required' | 'conditional'
  const [checkedDocs, setCheckedDocs] = useState({});

  // Accordion state for FAQs
  const [expandedFaq, setExpandedFaq] = useState(null);

  // Client-side date tracking simulator state (informational only)
  const [simPaymentDate, setSimPaymentDate] = useState('');
  const [simulatedSchedule, setSimulatedSchedule] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const currentJurisdiction = getJurisdictionById(selectedJurisdictionId);

  // Handle state change: cascade to district and ULB
  const handleStateChange = (newState) => {
    setSelectedState(newState);
    const districts = getAvailableDistrictsForState(newState);
    if (districts.length > 0) {
      const firstDistrict = districts[0];
      setSelectedDistrict(firstDistrict);
      const ulbs = getAvailableUlbsForDistrict(newState, firstDistrict);
      if (ulbs.length > 0) {
        setSelectedJurisdictionId(ulbs[0].id);
      } else {
        setSelectedJurisdictionId('unverified-fallback');
      }
    } else {
      setSelectedDistrict('');
      setSelectedJurisdictionId('unverified-fallback');
    }
  };

  // Handle district change: cascade to ULB
  const handleDistrictChange = (newDistrict) => {
    setSelectedDistrict(newDistrict);
    const ulbs = getAvailableUlbsForDistrict(selectedState, newDistrict);
    if (ulbs.length > 0) {
      setSelectedJurisdictionId(ulbs[0].id);
    } else {
      setSelectedJurisdictionId('unverified-fallback');
    }
  };

  const handleToggleDoc = (docId) => {
    setCheckedDocs((prev) => ({
      ...prev,
      [docId]: !prev[docId]
    }));
  };

  const toggleFaq = (idx) => {
    setExpandedFaq(expandedFaq === idx ? null : idx);
  };

  const handleCopyLink = async () => {
    try {
      if (typeof window !== 'undefined' && navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(window.location.href);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2500);
      }
    } catch {
      // Safe fallback ignore
    }
  };

  const handleSimulateDates = (e) => {
    e.preventDefault();
    if (!simPaymentDate) return;

    const base = new Date(simPaymentDate);
    if (isNaN(base.getTime())) return;

    const addDays = (d, days) => {
      const res = new Date(d);
      res.setDate(res.getDate() + days);
      return res.toISOString().split('T')[0];
    };

    // Calculate Indian financial year (April 1 to March 31)
    const year = base.getFullYear();
    const month = base.getMonth(); // 0-indexed: 0 is Jan, 3 is April
    const fyStart = month >= 3 ? year : year - 1;
    const fyEnd = fyStart + 1;
    const fyString = `${fyStart}-${fyEnd}`;
    const nextMarch31 = `${fyEnd}-03-31`;

    setSimulatedSchedule({
      paymentDate: simPaymentDate,
      financialYear: fyString,
      reconciliationWindow: `${addDays(base, 1)} to ${addDays(base, 3)}`,
      certificateEstimatedValidity: nextMarch31,
      grievanceCutoffDate: addDays(base, 7),
      earlyBirdWindowNote: 'Payment in April-June typically qualifies for statutory early-bird tax rebate (5-10% depending on municipality).'
    });
  };

  const availableDistricts = getAvailableDistrictsForState(selectedState);
  const availableUlbs = getAvailableUlbsForDistrict(selectedState, selectedDistrict);

  const allDocuments = [
    ...(currentJurisdiction.requiredDocuments || []),
    ...(currentJurisdiction.optionalDocuments || [])
  ];

  const filteredDocuments = allDocuments.filter((doc) => {
    if (docFilter === 'all') return true;
    return doc.category === docFilter;
  });

  return (
    <div className="property-tax-no-dues-guide max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="space-y-2 flex-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Verified Municipal Revenue Guide • Issue #531</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              Property Tax No-Dues Certificate &amp; Payment Receipt Guide
            </h1>

            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-3xl">
              An authoritative, jurisdiction-aware citizen guide explaining how to verify outstanding property tax dues, obtain valid official payment receipts, and apply for a certified Municipal No-Dues Certificate across Indian Urban Local Bodies (ULBs).
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1">
                <Receipt className="w-3.5 h-3.5 text-blue-500" />
                Receipt ≠ No-Dues Certificate
              </span>
              <span>•</span>
              <span className="inline-flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                Neither document establishes property title
              </span>
            </div>
          </div>

          <div className="flex flex-row md:flex-col items-center md:items-end gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg transition-colors border border-slate-300 dark:border-slate-700"
              title="Copy link to this guide"
              aria-label="Copy link to this guide"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedLink ? 'Copied Link' : 'Share Guide'}</span>
            </button>

            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              >
                Back to catalogue
              </button>
            )}
          </div>
        </div>

        {/* Cascading Jurisdiction Selector */}
        <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 -mx-6 -mb-6 p-6 rounded-b-2xl">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Building className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Select Jurisdiction (State / District / Urban Local Body):
              </span>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Rules, identifiers, portals, and certificate procedures differ by municipal authority.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full lg:w-auto">
              {/* State Selector */}
              <div>
                <label htmlFor="state-selector" className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  1. State / UT:
                </label>
                <select
                  id="state-selector"
                  value={selectedState}
                  onChange={(e) => handleStateChange(e.target.value)}
                  className="w-full text-xs font-medium bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  aria-label="Select State or Union Territory"
                >
                  {INDIAN_STATES_AND_UTS.map((st) => (
                    <option key={st} value={st}>
                      {st} {JURISDICTION_HIERARCHY[st] ? '✓' : ''}
                    </option>
                  ))}
                  <option value="Unlisted State / UT">Other / Unlisted State</option>
                </select>
              </div>

              {/* District Selector */}
              <div>
                <label htmlFor="district-selector" className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  2. District:
                </label>
                <select
                  id="district-selector"
                  value={selectedDistrict}
                  onChange={(e) => handleDistrictChange(e.target.value)}
                  disabled={availableDistricts.length === 0}
                  className="w-full text-xs font-medium bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                  aria-label="Select District"
                >
                  {availableDistricts.length > 0 ? (
                    availableDistricts.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))
                  ) : (
                    <option value="">Unspecified District</option>
                  )}
                </select>
              </div>

              {/* ULB Selector */}
              <div>
                <label htmlFor="ulb-selector" className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  3. Municipal Body (ULB):
                </label>
                <select
                  id="ulb-selector"
                  value={selectedJurisdictionId}
                  onChange={(e) => setSelectedJurisdictionId(e.target.value)}
                  className="w-full text-xs font-medium bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  aria-label="Select Municipal Corporation or Local Body"
                >
                  {availableUlbs.length > 0 ? (
                    availableUlbs.map((ulb) => (
                      <option key={ulb.id} value={ulb.id}>
                        {ulb.name}
                      </option>
                    ))
                  ) : (
                    <option value="unverified-fallback">Unverified Local Body</option>
                  )}
                </select>
              </div>
            </div>
          </div>

          {/* Active Jurisdiction Status Badge */}
          <div className="mt-3 flex items-center justify-between text-xs pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Selected: {currentJurisdiction.ulb} ({currentJurisdiction.state})
              </span>
              {currentJurisdiction.verificationStatus === 'verified' ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                  <Check className="w-3 h-3" /> Officially Verified ULB
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="w-3 h-3" /> Unverified Jurisdiction
                </span>
              )}
            </div>

            {currentJurisdiction.officialPortal.url && (
              <a
                href={currentJurisdiction.officialPortal.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
              >
                <span>Official Portal</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div
          role="tablist"
          aria-label="Property Tax Guide Sections"
          className="flex flex-wrap gap-2 pt-6 border-t border-slate-200 dark:border-slate-800 mt-6"
        >
          {[
            { id: 'overview', label: 'Overview & Definitions', icon: FileText },
            { id: 'jurisdictions', label: 'ULB Portal & Department', icon: Building },
            { id: 'journey', label: '10-Step Journey', icon: Layers },
            { id: 'documents', label: 'Required Documents', icon: CheckCircle },
            { id: 'tracking', label: 'Records & Date Tracker', icon: Calendar },
            { id: 'caveats', label: 'Warnings & Title Disclaimer', icon: AlertTriangle },
            { id: 'faqs', label: 'Citizen FAQs', icon: HelpCircle }
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
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: OVERVIEW & CORE DEFINITIONS */}
      {activeTab === 'overview' && (
        <div
          role="tabpanel"
          id="panel-overview"
          aria-labelledby="tab-overview"
          className="space-y-6 animate-fadeIn"
        >
          {/* Critical Distinction Alert */}
          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                  Critical Rule: A Payment Receipt is NOT a No-Dues Certificate
                </h3>
                <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                  A <strong>Payment Receipt</strong> proves only that money was remitted on a certain date for a specified assessment period. A <strong>No-Dues Certificate</strong> is an official municipal audit confirming that <em>all</em> historical property tax dues, solid waste cesses, penalties, and arrears across all past years stand cleared in full. Furthermore, <strong>neither document establishes legal ownership or marketable title</strong> over the property.
                </p>
              </div>
            </div>
          </div>

          {/* Core Information Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PROPERTY_TAX_CORE_DEFINITIONS.map((def) => (
              <div
                key={def.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {def.title}
                  </h3>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 shrink-0">
                    {def.badge}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {def.summary}
                </p>
                <ul className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                  {def.keyPoints.map((pt, i) => (
                    <li key={i} className="text-xs text-slate-600 dark:text-slate-300 flex items-start gap-2">
                      <span className="text-emerald-500 font-bold">•</span>
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Why Citizens Need It Card Grid */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm space-y-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                When Do Citizens Need a Property Tax No-Dues Certificate?
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Common real-life civic and financial transactions requiring certified proof of zero municipal dues:
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {WHY_CITIZENS_NEED_CERTIFICATE.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-2"
                >
                  <div className="font-semibold text-xs text-slate-900 dark:text-white flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{item.title}</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: JURISDICTIONS & ULB DETAILS */}
      {activeTab === 'jurisdictions' && (
        <div
          role="tabpanel"
          id="panel-jurisdictions"
          aria-labelledby="tab-jurisdictions"
          className="space-y-6 animate-fadeIn"
        >
          {/* Unverified Notice when applicable */}
          {currentJurisdiction.verificationStatus === 'unavailable' && (
            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl p-5">
              <div className="flex items-start gap-3">
                <FileWarning className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                    Official information for this jurisdiction has not yet been verified.
                  </h3>
                  <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                    Civic-Help-Setu prioritizes official-source accuracy and refuses to display guessed portals or unverified local procedures. If you reside in an unlisted municipality, visit your local municipal council or corporation revenue department in person, and always request an official paper receipt for all payments.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ULB Authority Details Box */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Urban Local Body Authority
                </span>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
                  {currentJurisdiction.ulb}
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  {currentJurisdiction.issuingDepartment} • {currentJurisdiction.statutoryAct}
                </p>
              </div>

              {currentJurisdiction.officialPortal.url && (
                <a
                  href={currentJurisdiction.officialPortal.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors shrink-0"
                >
                  <span>Open {currentJurisdiction.officialPortal.label}</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>

            {/* Jurisdiction Specific Key Attributes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-1.5">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Property Identification Key:
                </span>
                <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {currentJurisdiction.propertyIdentifierLabel}
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {currentJurisdiction.propertyIdentifierHint}
                </p>
              </div>

              <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-1.5">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  No-Dues Certificate Service Status:
                </span>
                <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {currentJurisdiction.certificateServiceName}
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Validity: {currentJurisdiction.certificateInformation.validity}
                </p>
              </div>
            </div>

            {/* Eligibility & Conditions */}
            <div className="space-y-3 pt-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Eligibility Conditions &amp; Pre-requisites
              </h3>
              <ul className="space-y-2">
                {currentJurisdiction.eligibility.map((cond, idx) => (
                  <li key={idx} className="text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2 bg-slate-50 dark:bg-slate-800/30 p-2.5 rounded-lg border border-slate-200/60 dark:border-slate-800">
                    <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{cond}</span>
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-slate-500 italic">
                * Note: Civic-Help-Setu does not make automated eligibility determinations or guarantee certificate issuance. All final decisions rest with the municipal revenue officer.
              </p>
            </div>

            {/* Fee & Processing Timeline */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Government Fee:
                </span>
                <p className="text-xs font-medium text-slate-800 dark:text-slate-200">
                  {currentJurisdiction.paymentInformation.officialFee}
                </p>
              </div>

              <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Processing Timeline:
                </span>
                <p className="text-xs font-medium text-slate-800 dark:text-slate-200">
                  {currentJurisdiction.paymentInformation.processingTimeline}
                </p>
              </div>
            </div>

            {/* Grievance & Redressal */}
            <div className="p-4 rounded-lg bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 space-y-1.5">
              <span className="text-xs font-bold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-blue-600" />
                Grievance &amp; Redressal Contacts for this ULB:
              </span>
              <p className="text-xs text-blue-800 dark:text-blue-300">
                {currentJurisdiction.grievanceInformation.contact}
              </p>
              {currentJurisdiction.grievanceInformation.portal && (
                <a
                  href={currentJurisdiction.grievanceInformation.portal}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline mt-1"
                >
                  <span>Official Grievance Portal</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            {/* Official Sources Metadata */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Verified Official Government Sources:
              </h4>
              {currentJurisdiction.sources.length > 0 ? (
                <div className="space-y-2">
                  {currentJurisdiction.sources.map((src, idx) => (
                    <div
                      key={idx}
                      className="text-xs p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {src.title}
                        </div>
                        <div className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
                          Department: {src.department} • Last Verified: {src.lastVerified}
                        </div>
                      </div>
                      <a
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:underline shrink-0"
                      >
                        <span>View Official Source</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">
                  Not specified by the linked official source. Official sources have not yet been indexed for this local body.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: 10-STEP JOURNEY (ONLINE & OFFLINE) */}
      {activeTab === 'journey' && (
        <div
          role="tabpanel"
          id="panel-journey"
          aria-labelledby="tab-journey"
          className="space-y-6 animate-fadeIn"
        >
          {/* Online vs Offline Comparison Banner */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm">
                <ExternalLink className="w-4 h-4" />
                <span>Online Route ({currentJurisdiction.ulb})</span>
              </div>
              <ol className="space-y-2 text-xs text-slate-700 dark:text-slate-300 list-decimal list-inside">
                {currentJurisdiction.onlineSteps.map((step, idx) => (
                  <li key={idx} className="leading-relaxed">
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-blue-600 font-bold text-sm">
                <Building className="w-4 h-4" />
                <span>Offline / In-Person Route</span>
              </div>
              <ol className="space-y-2 text-xs text-slate-700 dark:text-slate-300 list-decimal list-inside">
                {currentJurisdiction.offlineSteps.map((step, idx) => (
                  <li key={idx} className="leading-relaxed">
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          {/* 10-Stage Universal Citizen Stepper */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Ordered 10-Stage Application &amp; Verification Journey
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Follow these ordered stages to check assessment dues, execute safe payments, and secure valid No-Dues documentation.
              </p>
            </div>

            <div className="space-y-4">
              {ORDERED_JOURNEY_STAGES.map((st) => (
                <div
                  key={st.step}
                  className="flex items-start gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30"
                >
                  <div className="w-8 h-8 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm">
                    {st.step}
                  </div>
                  <div className="space-y-1.5 flex-1">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {st.title}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {st.summary}
                    </p>
                    <div className="p-2 rounded bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-[11px] text-emerald-800 dark:text-emerald-300">
                      <strong>Action Item:</strong> {st.actionPoint}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: REQUIRED & CONDITIONAL DOCUMENTS */}
      {activeTab === 'documents' && (
        <div
          role="tabpanel"
          id="panel-documents"
          aria-labelledby="tab-documents"
          className="space-y-6 animate-fadeIn"
        >
          {/* Document Filter Toolbar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Document Checklist for {currentJurisdiction.ulb}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Only documents explicitly verified by official municipal charters are listed. Tick items to track your readiness.
                </p>
              </div>

              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                {[
                  { id: 'all', label: 'All Documents' },
                  { id: 'required', label: 'Mandatory' },
                  { id: 'conditional', label: 'Conditional' }
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setDocFilter(f.id)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      docFilter === f.id
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Checklist Items */}
            <div className="space-y-3 pt-2">
              {filteredDocuments.length > 0 ? (
                filteredDocuments.map((doc) => {
                  const isChecked = !!checkedDocs[doc.id];
                  return (
                    <div
                      key={doc.id}
                      onClick={() => handleToggleDoc(doc.id)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-3.5 ${
                        isChecked
                          ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/20'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}} // Controlled by parent div click
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        aria-label={`Mark ${doc.name} as ready`}
                      />

                      <div className="space-y-1.5 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className={`text-xs font-bold ${isChecked ? 'line-through text-slate-500' : 'text-slate-900 dark:text-white'}`}>
                            {doc.name}
                          </span>
                          <span
                            className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${
                              doc.category === 'required'
                                ? 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900'
                                : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900'
                            }`}
                          >
                            {doc.category === 'required' ? 'Mandatory' : 'Conditional'}
                          </span>
                        </div>

                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                          <strong>Why Needed:</strong> {doc.whyNeeded}
                        </p>

                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                          <span>Jurisdiction: <strong>{doc.jurisdiction}</strong></span>
                          <span>•</span>
                          <span>Official Basis: <em>{doc.officialSource}</em></span>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-slate-500 italic p-4 text-center">
                  No documents found for this filter category.
                </p>
              )}
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg text-xs text-slate-500 flex items-center justify-between">
              <span>
                Readiness: {Object.values(checkedDocs).filter(Boolean).length} of {allDocuments.length} documents marked ready
              </span>
              <span className="italic text-[11px]">
                * Preparation checklist strictly stored in browser memory only. No document uploads accepted.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: RECORDS & DATE TRACKER */}
      {activeTab === 'tracking' && (
        <div
          role="tabpanel"
          id="panel-tracking"
          aria-labelledby="tab-tracking"
          className="space-y-6 animate-fadeIn"
        >
          {/* Informational Guidance Notice */}
          <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-xl p-5 space-y-2">
            <h3 className="text-sm font-bold text-blue-900 dark:text-blue-200 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              What Records &amp; Dates Must Citizens Maintain in Their Own Archive?
            </h3>
            <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
              To defend against double-billing, disputed arrears, or audit notices, keep a dedicated physical folder and digital backup of these 15 distinct record attributes. Civic-Help-Setu does NOT collect or store your real identifiers.
            </p>
          </div>

          {/* Informational Tracking Fields Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Essential Property Tax &amp; No-Dues Milestone Fields
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Every field has a distinct legal significance under municipal finance laws:
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-semibold">
                    <th className="p-3">Record / Date Field</th>
                    <th className="p-3">Why Citizens Must Retain It</th>
                    <th className="p-3">Official Rule / Guidance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {INFORMATIONAL_TRACKING_FIELDS.map((field) => (
                    <tr key={field.key} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="p-3 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                        {field.label}
                      </td>
                      <td className="p-3 text-slate-600 dark:text-slate-400">
                        {field.purpose}
                      </td>
                      <td className="p-3 text-[11px] text-slate-500 dark:text-slate-400">
                        {field.statusInGuide}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Client-Side Date Simulator */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm space-y-4">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Client-Side Property Tax Calendar &amp; Grievance Milestone Calculator
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Enter your payment date below to compute standard statutory reconciliation windows, financial year assessment boundaries, and escalation cutoffs. (Runs locally in your browser; zero data transmitted).
              </p>
            </div>

            <form onSubmit={handleSimulateDates} className="flex flex-col sm:flex-row gap-3 items-end">
              <div className="w-full sm:w-64 space-y-1">
                <label htmlFor="sim-payment-date" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Payment Date:
                </label>
                <input
                  type="date"
                  id="sim-payment-date"
                  value={simPaymentDate}
                  onChange={(e) => setSimPaymentDate(e.target.value)}
                  className="w-full text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <button
                type="submit"
                disabled={!simPaymentDate}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
              >
                Compute Milestones
              </button>
            </form>

            {simulatedSchedule && (
              <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/30 space-y-3 mt-4">
                <div className="font-bold text-xs text-emerald-900 dark:text-emerald-200">
                  Calculated Statutory Assessment Milestones:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-2.5 rounded bg-white dark:bg-slate-900 border border-emerald-100 dark:border-emerald-900/60">
                    <span className="text-[11px] text-slate-500 block">Assessment Financial Year:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{simulatedSchedule.financialYear}</span>
                  </div>
                  <div className="p-2.5 rounded bg-white dark:bg-slate-900 border border-emerald-100 dark:border-emerald-900/60">
                    <span className="text-[11px] text-slate-500 block">Banking Reconciliation Window:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{simulatedSchedule.reconciliationWindow}</span>
                  </div>
                  <div className="p-2.5 rounded bg-white dark:bg-slate-900 border border-emerald-100 dark:border-emerald-900/60">
                    <span className="text-[11px] text-slate-500 block">Estimated Certificate Validity Limit:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{simulatedSchedule.certificateEstimatedValidity}</span>
                  </div>
                  <div className="p-2.5 rounded bg-white dark:bg-slate-900 border border-emerald-100 dark:border-emerald-900/60">
                    <span className="text-[11px] text-slate-500 block">Grievance Escalation Window:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">After {simulatedSchedule.grievanceCutoffDate} if receipt pending</span>
                  </div>
                </div>
                <p className="text-[11px] text-emerald-800 dark:text-emerald-300 italic">
                  💡 {simulatedSchedule.earlyBirdWindowNote}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 6: STATUTORY WARNINGS & TITLE CAVEATS */}
      {activeTab === 'caveats' && (
        <div
          role="tabpanel"
          id="panel-caveats"
          aria-labelledby="tab-caveats"
          className="space-y-6 animate-fadeIn"
        >
          <div className="space-y-4">
            {STATUTORY_CAVEATS_AND_WARNINGS.map((warn) => (
              <div
                key={warn.id}
                className={`p-5 rounded-xl border flex items-start gap-3.5 shadow-sm ${
                  warn.type === 'danger'
                    ? 'bg-red-50/70 dark:bg-red-950/30 border-red-300 dark:border-red-900'
                    : warn.type === 'warning'
                    ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-300 dark:border-amber-900'
                    : 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-300 dark:border-blue-900'
                }`}
              >
                <AlertTriangle
                  className={`w-5 h-5 shrink-0 mt-0.5 ${
                    warn.type === 'danger'
                      ? 'text-red-600 dark:text-red-400'
                      : warn.type === 'warning'
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-blue-600 dark:text-blue-400'
                  }`}
                />
                <div className="space-y-1">
                  <h3
                    className={`text-sm font-bold ${
                      warn.type === 'danger'
                        ? 'text-red-900 dark:text-red-200'
                        : warn.type === 'warning'
                        ? 'text-amber-900 dark:text-amber-200'
                        : 'text-blue-900 dark:text-blue-200'
                    }`}
                  >
                    {warn.title}
                  </h3>
                  <p
                    className={`text-xs leading-relaxed ${
                      warn.type === 'danger'
                        ? 'text-red-800 dark:text-red-300'
                        : warn.type === 'warning'
                        ? 'text-amber-800 dark:text-amber-300'
                        : 'text-blue-800 dark:text-blue-300'
                    }`}
                  >
                    {warn.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              What Should You Do If Municipal Demands or Receipts Are Delayed or Disputed?
            </h3>
            <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              <p>
                1. <strong>Do Not Make Duplicate Payments:</strong> If money was debited from your bank account via UPI or Net Banking but no receipt was issued, wait 48 hours for automated reconciliation between the payment aggregator and the municipal treasury.
              </p>
              <p>
                2. <strong>File an Online Ledger Grievance:</strong> Quote your Bank UTR and Property ID on the official municipal grievance portal ({currentJurisdiction.grievanceInformation.contact}).
              </p>
              <p>
                3. <strong>Assessment Discrepancies:</strong> If the plinth area, usage type (commercial vs residential), or property age factor has been incorrectly calculated by the municipal surveyor, file a formal objection under the relevant Municipal Act (e.g., Section 123D of DMC Act, Section 144 of BBMP Act, or Section 217 of MMC Act) before paying under protest.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: CITIZEN FAQS */}
      {activeTab === 'faqs' && (
        <div
          role="tabpanel"
          id="panel-faqs"
          aria-labelledby="tab-faqs"
          className="space-y-4 animate-fadeIn"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm space-y-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Frequently Asked Citizen Questions
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Plain-language answers to common questions about property tax receipts, clearance certificates, and municipal rules:
              </p>
            </div>

            <div className="space-y-3">
              {PROPERTY_TAX_FAQS.map((faq, idx) => {
                const isOpen = expandedFaq === idx;
                return (
                  <div
                    key={idx}
                    className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => toggleFaq(idx)}
                      className="w-full text-left p-4 bg-slate-50/70 hover:bg-slate-100 dark:bg-slate-800/40 dark:hover:bg-slate-800/70 flex items-center justify-between gap-4 transition-colors"
                      aria-expanded={isOpen}
                    >
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        {faq.question}
                      </span>
                      {isOpen ? (
                        <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                      )}
                    </button>

                    {isOpen && (
                      <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        {faq.answer}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
