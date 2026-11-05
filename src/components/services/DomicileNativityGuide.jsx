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
  GraduationCap,
  Scale
} from 'lucide-react';

/**
 * DomicileNativityGuide Component
 *
 * Implements Issue #508: Scannable citizen guide for Domicile, Permanent Residence,
 * and Nativity Certificates, single domicile legal principle, state residency years (5, 10, 15 yrs),
 * education quota vs ordinary residence, and revenue authority verification.
 */
export default function DomicileNativityGuide({ service, onBack }) {
  const [selectedState, setSelectedState] = useState('Standard Framework');
  const [selectedTab, setSelectedTab] = useState('overview'); // 'overview' | 'comparison' | 'residence' | 'steps' | 'documents'

  const stateProvisions = {
    'Standard Framework': {
      authority: 'Sub-Divisional Magistrate (SDM) / Tehsildar / District Magistrate',
      portal: 'https://services.india.gov.in',
      residencyYears: 'Varies from 3 to 15 years depending on the State/UT rules',
      validity: 'Lifetime validity (Unless individual permanently relocates or renounces domicile)',
      processingTime: '15 to 30 working days'
    },
    'Maharashtra': {
      authority: 'Tehsildar / Sub-Divisional Officer (SDO)',
      portal: 'https://aaplesarkar.mahaonline.gov.in',
      residencyYears: 'Minimum 15 years of continuous residence in Maharashtra',
      validity: 'Lifetime (Combined Age, Nationality and Domicile Certificate)',
      processingTime: '15 working days under RTS Act'
    },
    'Tamil Nadu (Nativity)': {
      authority: 'Tahsildar / Zonal Deputy Tahsildar (Revenue Department)',
      portal: 'https://www.tnesevai.tn.gov.in',
      residencyYears: 'Born in TN or continuous residence for minimum 5 years',
      validity: 'Permanent / Lifetime for genuine natives',
      processingTime: '15 working days'
    }
  };

  const currentJurisdiction = stateProvisions[selectedState] || stateProvisions['Standard Framework'];

  return (
    <div className="domicile-nativity-guide max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 mb-2">
              <ShieldCheck className="w-3.5 h-3.5" /> State Quota &amp; Residence Proof
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Domicile &amp; Nativity Certificate Guide
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Plain-language distinction between Domicile, Nativity, and Ordinary Residence certificates, state duration rules, and college quota applicability.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase">
              State / UT:
            </label>
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="text-xs font-medium bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="Standard Framework">Standard Framework</option>
              <option value="Maharashtra">Maharashtra (Aaple Sarkar)</option>
              <option value="Tamil Nadu (Nativity)">Tamil Nadu (Nativity)</option>
            </select>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 pt-6 border-t border-slate-200 dark:border-slate-800 mt-6">
          {[
            { id: 'overview', label: 'Overview & Single Domicile', icon: FileText },
            { id: 'comparison', label: 'Domicile vs Nativity vs Residence', icon: Scale },
            { id: 'residence', label: 'State Residency Rules', icon: MapPin },
            { id: 'steps', label: 'Application Journey', icon: Building },
            { id: 'documents', label: 'Required Evidence', icon: CheckCircle }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = selectedTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedTab(tab.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm'
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

      {/* Tab 1: Overview & Single Domicile */}
      {selectedTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              What a Domicile Certificate Does
            </h3>
            <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed">
              <li>• Certifies an applicant’s permanent residence and intent to permanently settle in a specific State/UT.</li>
              <li>• Mandatory for claiming the 85% State Quota in medical (NEET) and engineering admissions, state government jobs, and fee concessions.</li>
              <li>• Issued by the designated revenue executive (Tehsildar / SDM) after rigorous inquiry into schooling and property.</li>
            </ul>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
              <Scale className="w-4 h-4" />
              The Supreme Court Single Domicile Principle
            </h3>
            <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed">
              <li>• Under Indian constitutional law (<em>Pradeep Jain v. UOI</em>), there is only one Indian citizenship.</li>
              <li>• A citizen can have only <strong>ONE domicile of choice</strong> at any given time.</li>
              <li>• Holding domicile certificates from two different states simultaneously is illegal and leads to immediate disqualification in university admissions.</li>
            </ul>
          </div>
        </div>
      )}

      {/* Tab 2: Comparison */}
      {selectedTab === 'comparison' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Do Not Confuse These Three Documents
            </h3>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700">
                <span className="font-bold text-slate-900 dark:text-slate-100 block mb-1">
                  1. Domicile Certificate (Permanent Home &amp; Intention)
                </span>
                <p className="text-slate-600 dark:text-slate-400">
                  Proves long-term continuous residence (e.g. 15 yrs in Maharashtra, 10 yrs in UP). Needed for State Quotas in university admissions and government recruitment.
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700">
                <span className="font-bold text-slate-900 dark:text-slate-100 block mb-1">
                  2. Nativity Certificate (Place of Origin / Birth)
                </span>
                <p className="text-slate-600 dark:text-slate-400">
                  Certifies that the candidate or their parents were born in the state, even if they have relocated elsewhere for education or employment.
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700">
                <span className="font-bold text-slate-900 dark:text-slate-100 block mb-1">
                  3. Ordinary Residence Certificate (Current Physical Address)
                </span>
                <p className="text-slate-600 dark:text-slate-400">
                  Certifies where you currently sleep and live (e.g. rented apartment for 6 months). Useful for local voter ID or electricity meters, but does NOT grant state educational quota rights.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: State Residency Rules */}
      {selectedTab === 'residence' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <MapPin className="w-5 h-5 text-indigo-600" />
              Minimum Residence Requirements by State/UT
            </h3>

            <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/40 rounded-lg text-xs space-y-1">
              <span className="font-bold text-indigo-900 dark:text-indigo-200 block">
                Selected Jurisdiction: {selectedState}
              </span>
              <p className="text-indigo-800 dark:text-indigo-300">
                Required Continuous Residence: <strong>{currentJurisdiction.residencyYears}</strong>
              </p>
            </div>

            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                    <th className="p-2.5 font-semibold">State / Region</th>
                    <th className="p-2.5 font-semibold">Statutory Residence Requirement</th>
                    <th className="p-2.5 font-semibold">Special Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-600 dark:text-slate-300">
                  <tr>
                    <td className="p-2.5 font-medium">Maharashtra</td>
                    <td className="p-2.5">15 Continuous Years</td>
                    <td className="p-2.5">Strict school bonafide certificates required</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-medium">Karnataka</td>
                    <td className="p-2.5">7 to 10 Academic Years</td>
                    <td className="p-2.5">Continuous study from 1st to 10th/12th std</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-medium">Tamil Nadu</td>
                    <td className="p-2.5">5 Years / Birth Nativity</td>
                    <td className="p-2.5">Nativity Certificate is permanent</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-medium">Jammu &amp; Kashmir</td>
                    <td className="p-2.5">15 Years or 7 Yrs Schooling</td>
                    <td className="p-2.5">Subject to UT Domicile Certificate Rules</td>
                  </tr>
                </tbody>
              </table>
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
                <strong>Gather Schooling &amp; Residence Records:</strong> Collect school bonafide certificates proving continuous education across the mandatory statutory years.
              </li>
              <li>
                <strong>Submit Application on State Portal:</strong> File application on the State e-District / Citizen portal ({currentJurisdiction.portal}) or through a local revenue center.
              </li>
              <li>
                <strong>Revenue Verification:</strong> Talathi / Village Administrative Officer conducts inquiry into continuous residence and verifies ancestral land records.
              </li>
              <li>
                <strong>Digital Certificate Approval:</strong> Tehsildar / Sub-Divisional Magistrate issues the digitally signed Domicile Certificate with QR code authentication.
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
              Required Evidence Checklist
            </h3>

            <div className="space-y-3">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    School Bonafide / Study Certificates (Covering Prescribed Period)
                  </span>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded">
                    Mandatory
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Issued by headmasters proving continuous education across the statutory minimum years.
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Property Tax / Electricity Bills of Residence
                  </span>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded">
                    Mandatory
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Municipal tax receipts, electricity bills, or registered lease deed in the family's name.
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Sworn Domicile Affidavit &amp; Self-Declaration
                  </span>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded">
                    Mandatory
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Affirming continuous residence and confirming applicant does not hold domicile in any other State.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footnote */}
      <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
        This informational guide is grounded in state citizen charters and Supreme Court domicile rulings. Verified on 5 November 2026. Civic Help Setu does not issue certificates or determine state quota eligibility.
      </div>
    </div>
  );
}
