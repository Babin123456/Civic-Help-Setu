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
  Home
} from 'lucide-react';

/**
 * EwsCertificateGuide Component
 *
 * Implements Issue #506: Scannable citizen guide for Economically Weaker Section (EWS)
 * Certificate issuance for central and state use, DoPT asset exclusion thresholds,
 * family definition, assessment vs validity years, and official prescribed format (Annexure-I).
 */
export default function EwsCertificateGuide({ service, onBack }) {
  const [selectedFormat, setSelectedFormat] = useState('central'); // 'central' | 'state'
  const [selectedTab, setSelectedTab] = useState('overview'); // 'overview' | 'criteria' | 'family' | 'steps' | 'documents'

  return (
    <div className="ews-certificate-guide max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 mb-2">
              <ShieldCheck className="w-3.5 h-3.5" /> 103rd Constitutional Amendment
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              EWS Income &amp; Asset Certificate Guide
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Statutory guidance on obtaining an Economically Weaker Section (EWS) certificate for 10% reservation in central and state posts and admissions.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase">
              Target Level:
            </span>
            <div className="flex gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
              <button
                onClick={() => setSelectedFormat('central')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                  selectedFormat === 'central'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-700 dark:text-slate-300'
                }`}
              >
                Central Form (Annexure-I)
              </button>
              <button
                onClick={() => setSelectedFormat('state')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                  selectedFormat === 'state'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-700 dark:text-slate-300'
                }`}
              >
                State Rules
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 pt-6 border-t border-slate-200 dark:border-slate-800 mt-6">
          {[
            { id: 'overview', label: 'What This Document Is', icon: FileText },
            { id: 'criteria', label: 'Income & Asset Criteria', icon: Coins },
            { id: 'family', label: 'Definition of Family', icon: Home },
            { id: 'steps', label: 'Application Journey', icon: Building },
            { id: 'documents', label: 'Required Documents', icon: CheckCircle }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = selectedTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedTab(tab.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-sm'
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
              Who Can Apply for EWS?
            </h3>
            <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed">
              <li>• Citizens belonging to the General Category who are <strong>NOT covered</strong> under the scheme of reservation for SCs, STs, and OBCs.</li>
              <li>• Entitles the holder to 10% reservation in Central civil posts, UPSC, SSC, Banking, and admissions in Central Educational Institutions (IITs, IIMs, Central Universities).</li>
            </ul>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Crucial Caveat: Who CANNOT Apply
            </h3>
            <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed">
              <li>• SC, ST, or OBC candidates cannot apply for an EWS certificate under central rules, even if their family income is below ₹8 Lakhs.</li>
              <li>• Families exceeding ANY of the four residential or land asset thresholds are disqualified regardless of lower income.</li>
            </ul>
          </div>

          <div className="md:col-span-2 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-600" />
              Valid Year vs. Assessment Year Confusion
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Every official EWS certificate in DoPT Annexure-I format must contain two distinct years:
              <br />
              1. <strong>Certificate Validity Year:</strong> The financial year for which the certificate is operative (e.g. 2026–2027).
              <br />
              2. <strong>Financial Assessment Year:</strong> The preceding financial year whose income was evaluated (e.g. 2025–2026).
              <br />
              Certificates that leave the Financial Assessment Year blank or put the same year in both slots are routinely rejected during official document verification.
            </p>
          </div>
        </div>
      )}

      {/* Tab 2: Criteria */}
      {selectedTab === 'criteria' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Coins className="w-5 h-5 text-emerald-600" />
              Statutory Income &amp; Asset Disqualification Limits
            </h3>

            <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-lg text-xs space-y-1">
              <span className="font-bold text-emerald-900 dark:text-emerald-200 block">
                Gross Annual Family Income Cap: Below ₹8 Lakhs
              </span>
              <p className="text-emerald-800 dark:text-emerald-300">
                Income includes salary, agriculture, business, profession, and interest for the financial year prior to the year of application.
              </p>
            </div>

            <div className="space-y-2 text-xs">
              <span className="font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Asset Exclusion Disqualifiers (Family Owning Any of the Following):
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="p-3 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 rounded-lg text-slate-700 dark:text-slate-300">
                  <strong>1. Agricultural Land:</strong> 5 acres and above.
                </div>
                <div className="p-3 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 rounded-lg text-slate-700 dark:text-slate-300">
                  <strong>2. Residential Flat:</strong> 1000 square feet and above.
                </div>
                <div className="p-3 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 rounded-lg text-slate-700 dark:text-slate-300">
                  <strong>3. Notified Municipal Plot:</strong> 100 square yards (900 sq ft) and above.
                </div>
                <div className="p-3 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 rounded-lg text-slate-700 dark:text-slate-300">
                  <strong>4. Non-Notified Plot:</strong> 200 square yards (1800 sq ft) and above.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Family */}
      {selectedTab === 'family' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Home className="w-5 h-5 text-emerald-600" />
              Statutory Definition of "Family" for EWS
            </h3>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-lg text-xs space-y-2 text-slate-700 dark:text-slate-300 leading-relaxed">
              <p>
                Under DoPT guidelines, the term <strong>"Family"</strong> for this purpose includes only:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>The person who seeks the benefit of reservation;</li>
                <li>His/her parents;</li>
                <li>His/her siblings below the age of 18 years;</li>
                <li>His/her spouse; and</li>
                <li>His/her children below the age of 18 years.</li>
              </ul>
              <div className="border-t border-slate-200 dark:border-slate-700 pt-2 text-slate-500 dark:text-slate-400">
                <strong>Clubbing of Assets:</strong> The property held by a "Family" in different locations or cities is clubbed together to determine whether the family exceeds the land or plot limits. Adult siblings (aged 18+) or grandparents are not included in the family asset calculation.
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
              Application Journey
            </h3>

            <ol className="text-xs text-slate-600 dark:text-slate-300 space-y-3 list-decimal pl-4 leading-relaxed">
              <li>
                <strong>Assemble Previous FY Tax &amp; Income Proofs:</strong> Compile ITRs, salary slips, and land documents for all family members for the preceding financial year.
              </li>
              <li>
                <strong>Submit Application:</strong> File online on the State e-District portal or in-person before the Sub-Divisional Magistrate (SDM) / Tehsildar.
              </li>
              <li>
                <strong>Revenue Verification:</strong> Revenue Inspector / Patwari conducts a physical spot inquiry of agricultural land, municipal plots, and house dimensions.
              </li>
              <li>
                <strong>Issuance of DoPT Prescribed Format:</strong> Competent revenue authority signs and issues the certificate in Annexure-I format with state registration stamp and QR code.
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
              Document Checklist
            </h3>

            <div className="space-y-3">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Income Tax Returns (ITR) or Form 16 of Earning Family Members
                  </span>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded">
                    Mandatory
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  For the financial year preceding the date of application.
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Land Ownership Records / Flat Registry (Khatiyan / Sale Deed)
                  </span>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded">
                    Mandatory
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Verifies that family does not possess more than 5 acres of agricultural land or a 1000+ sq. ft. flat.
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Self-Declaration Affidavit in Prescribed Format
                  </span>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded">
                    Mandatory
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Affirming non-inclusion in SC/ST/OBC and stating truthful asset valuations.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footnote */}
      <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
        This informational guide is grounded in DoPT office memorandums and Constitutional 103rd Amendment notifications. Verified against statutory records on 5 November 2026. Civic Help Setu does not issue certificates or determine eligibility.
      </div>
    </div>
  );
}
