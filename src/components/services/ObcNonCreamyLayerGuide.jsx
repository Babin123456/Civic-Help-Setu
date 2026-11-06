import React, { useState } from 'react';
import {
  FileText,
  Calendar,
  Clock,
  AlertTriangle,
  Building,
  UserCheck,
  CheckCircle,
  HelpCircle,
  ShieldCheck,
  MapPin,
  ExternalLink,
  Coins,
  RefreshCw
} from 'lucide-react';

/**
 * ObcNonCreamyLayerGuide Component
 *
 * Implements Issue #505: Dedicated scannable citizen guide for OBC Non-Creamy Layer (NCL)
 * certificates, validity periods (Financial Year basis), Central vs State lists,
 * parental income ceiling test, and renewal procedures.
 */
export default function ObcNonCreamyLayerGuide({ service, onBack }) {
  const [selectedFormat, setSelectedFormat] = useState('central'); // 'central' | 'state'
  const [selectedTab, setSelectedTab] = useState('overview'); // 'overview' | 'validity' | 'income' | 'steps' | 'documents'

  return (
    <div className="obc-ncl-guide max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 mb-2">
              <ShieldCheck className="w-3.5 h-3.5" /> Backward Class Reservation Guide
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              OBC Non-Creamy Layer (NCL) Certificate Guide
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Plain-language breakdown of Central vs. State OBC certificates, financial year validity rules, parental income criteria, and renewal schedules.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase">
              Target List:
            </span>
            <div className="flex gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
              <button
                onClick={() => setSelectedFormat('central')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                  selectedFormat === 'central'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-slate-700 dark:text-slate-300'
                }`}
              >
                Central Government (NCBC)
              </button>
              <button
                onClick={() => setSelectedFormat('state')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                  selectedFormat === 'state'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-slate-700 dark:text-slate-300'
                }`}
              >
                State Government (BC/MBC)
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 pt-6 border-t border-slate-200 dark:border-slate-800 mt-6">
          {[
            { id: 'overview', label: 'Caste vs. NCL Certificate', icon: FileText },
            { id: 'validity', label: 'Validity & Financial Year', icon: Clock },
            { id: 'income', label: 'Parental Income Test', icon: Coins },
            { id: 'steps', label: 'Application Journey', icon: Building },
            { id: 'documents', label: 'Documents & Evidence', icon: CheckCircle }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = selectedTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedTab(tab.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab 1: Overview */}
      {selectedTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              OBC Caste Certificate vs. NCL Certificate
            </h3>
            <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed">
              <li>• <strong>OBC Caste / Community Certificate:</strong> Proves social origin and community name. Typically does NOT expire.</li>
              <li>• <strong>OBC Non-Creamy Layer (NCL) Certificate:</strong> Proves that the applicant's parents do NOT fall into the affluent "Creamy Layer" bracket.</li>
              <li>• Reservation benefits in Central admissions (NEET, JEE, UPSC) are only granted on presenting an <strong>active NCL certificate</strong>.</li>
            </ul>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Central vs. State List Warnings
            </h3>
            <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed">
              <li>• Certain communities are included in a State's BC/MBC list but NOT in the Central NCBC list.</li>
              <li>• Always verify your caste spelling at the official NCBC portal (<a href="https://www.ncbc.nic.in" target="_blank" rel="noreferrer" className="underline">ncbc.nic.in</a>) before applying for central exams.</li>
              <li>• A certificate issued strictly in State format cannot be used for Union government recruitments.</li>
            </ul>
          </div>
        </div>
      )}

      {/* Tab 2: Validity & Financial Year */}
      {selectedTab === 'validity' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-600" />
              Validity Period &amp; Financial Year Rules (DoPT Standard)
            </h3>

            <div className="p-4 rounded-lg bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-xs text-slate-700 dark:text-slate-300 space-y-2 leading-relaxed">
              <p>
                <strong>The 1-Year Financial Year Rule:</strong> An OBC-NCL certificate is valid for the <strong>financial year (1 April to 31 March)</strong> during which it is issued, based on parental income of the preceding three financial years.
              </p>
              <p>
                For example: An OBC-NCL certificate issued on 15 July 2026 evaluates parental income from FY 2023-24, 2024-25, and 2025-26, and remains valid for central admissions until 31 March 2027.
              </p>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300">
              <span className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
                Do I Need to Re-Apply Every Year?
              </span>
              Yes. For competitive exams, admissions, or recruitment notifications issued in a new financial year, an updated OBC-NCL certificate issued on or after 1 April of that financial year is mandatory.
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Parental Income Test */}
      {selectedTab === 'income' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Coins className="w-5 h-5 text-amber-600" />
              Creamy Layer Income Test: Whose Income is Counted?
            </h3>

            <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/30 rounded-lg border border-slate-200 dark:border-slate-800">
                <span className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
                  1. Parents' Income ONLY (Candidate's salary is EXCLUDED)
                </span>
                Under DoPT Office Memorandum No. 36033/1/2013-Estt.(Res.), the creamy layer status is determined solely by the status and gross annual income of the <strong>parents</strong>. The candidate’s own earnings or their spouse’s income are strictly excluded.
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/30 rounded-lg border border-slate-200 dark:border-slate-800">
                <span className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
                  2. Income Ceiling Limit (₹8 Lakhs per Annum)
                </span>
                The current statutory ceiling is ₹8 Lakhs gross annual income for three consecutive financial years from sources other than agricultural land and regular salaries.
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/30 rounded-lg border border-slate-200 dark:border-slate-800">
                <span className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
                  3. Direct Rule of Exclusion (Category I &amp; II)
                </span>
                Children of persons holding constitutional posts (President, Judges, UPSC members) or Class I / Group A officers directly recruited before age 40 fall into the Creamy Layer regardless of specific income declarations.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Steps */}
      {selectedTab === 'steps' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Application Steps &amp; Renewal Process
            </h3>

            <ol className="text-xs text-slate-600 dark:text-slate-300 space-y-3 list-decimal pl-4 leading-relaxed">
              <li>
                <strong>Check NCBC List Entry:</strong> Confirm the candidate's caste is present in the Central List of OBCs for their native state at <a href="https://www.ncbc.nic.in" target="_blank" rel="noreferrer" className="underline font-semibold text-amber-600">ncbc.nic.in</a>.
              </li>
              <li>
                <strong>Gather Parental ITRs:</strong> Collect Income Tax Returns (ITR-V) or Form 16 of both parents for the last 3 financial years.
              </li>
              <li>
                <strong>Apply on State Revenue Portal:</strong> Submit online via the state e-District portal or local Tahsildar / Sub-Divisional Officer (SDO) revenue office.
              </li>
              <li>
                <strong>Revenue Verification:</strong> Revenue Inspector / Patwari verifies parental occupation, agricultural holding, and income claims.
              </li>
              <li>
                <strong>Issuance of DoPT Prescribed Certificate:</strong> Tehsildar / SDO signs the certificate specifying that the candidate does not belong to the Creamy Layer.
              </li>
            </ol>
          </div>
        </div>
      )}

      {/* Tab 5: Documents */}
      {selectedTab === 'documents' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Document Checklist for OBC-NCL
            </h3>

            <div className="space-y-3">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Existing OBC Community Certificate of Candidate or Father
                  </span>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded">
                    Mandatory
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Proves social classification in the recognized backward class list.
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Parents' Income Tax Returns (ITR-V) / Salary Certificates (3 FYs)
                  </span>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded">
                    Mandatory
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  ITR acknowledgements or Form 16 showing parents' annual income for the preceding three financial years.
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Non-Creamy Layer Self-Declaration Affidavit
                  </span>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded">
                    Mandatory
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Standard DoPT declaration format affirming that the applicant does not fall in the Creamy Layer.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footnote */}
      <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
        This informational guide is grounded in DoPT office memorandums and NCBC guidelines. Verified against statutory records on 5 November 2026. Civic Help Setu does not process applications or store citizen records.
      </div>
    </div>
  );
}
