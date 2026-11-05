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
  GraduationCap
} from 'lucide-react';

/**
 * IncomeCertificateGuide Component
 *
 * Implements Issue #507: Scannable citizen guide for Income Certificate application,
 * income sources computation, assessment period vs issue date, field inquiry by revenue officers,
 * scholarship requirements, and state-level validity periods.
 */
export default function IncomeCertificateGuide({ service, onBack }) {
  const [selectedState, setSelectedState] = useState('Standard State Rules');
  const [selectedTab, setSelectedTab] = useState('overview'); // 'overview' | 'sources' | 'validity' | 'steps' | 'documents'

  const stateProvisions = {
    'Standard State Rules': {
      authority: 'Tehsildar / Sub-Divisional Magistrate (SDM) / Revenue Circle Officer',
      portal: 'https://services.india.gov.in',
      validity: '1 Financial Year (1 April to 31 March) or 6 months depending on local state rule',
      processingTime: '7 to 15 working days under Public Service Guarantee Acts',
      fee: 'Nominal court stamp fee (₹10 to ₹50) or free on citizen portal'
    },
    'Tamil Nadu': {
      authority: 'Zonal Deputy Tahsildar / Tahsildar (Revenue Department)',
      portal: 'https://www.tnesevai.tn.gov.in',
      validity: '6 Months from the date of issuance',
      processingTime: '15 working days',
      fee: '₹60 e-Sevai citizen service charge'
    },
    'Uttar Pradesh': {
      authority: 'Tehsildar / Revenue Inspector (e-Sathi UP)',
      portal: 'https://esathi.up.gov.in',
      validity: '3 Years from the date of issue (for state welfare/scholarships)',
      processingTime: '7 working days',
      fee: '₹15 online portal fee'
    }
  };

  const currentJurisdiction = stateProvisions[selectedState] || stateProvisions['Standard State Rules'];

  return (
    <div className="income-certificate-guide max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 mb-2">
              <ShieldCheck className="w-3.5 h-3.5" /> Revenue Department Civic Guide
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Income Certificate Application &amp; Assessment Guide
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Plain-language instructions for obtaining an Income Certificate from the revenue department, understanding assessment periods, and meeting scholarship deadlines.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase">
              State Rule:
            </label>
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="text-xs font-medium bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="Standard State Rules">Standard State Rules</option>
              <option value="Tamil Nadu">Tamil Nadu (TNeGA e-Sevai)</option>
              <option value="Uttar Pradesh">Uttar Pradesh (e-Sathi)</option>
            </select>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 pt-6 border-t border-slate-200 dark:border-slate-800 mt-6">
          {[
            { id: 'overview', label: 'What This Document Is', icon: FileText },
            { id: 'sources', label: 'Income Sources Counted', icon: Coins },
            { id: 'validity', label: 'Assessment Period & Validity', icon: Clock },
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
                    ? 'bg-teal-600 text-white shadow-sm'
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
              What an Income Certificate Proves
            </h3>
            <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed">
              <li>• Official declaration of the cumulative annual earnings of an applicant and their dependent family from all verified sources.</li>
              <li>• Required for post-matric and national merit-cum-means scholarships, tuition fee reimbursements, subsidized loans, and government welfare cards.</li>
            </ul>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400 flex items-center gap-2">
              <GraduationCap className="w-4 h-4" />
              Scholarships &amp; Welfare Caps
            </h3>
            <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed">
              <li>• Most Central/State scholarships have statutory income caps (e.g. ₹2.5 Lakhs for SC/ST Post-Matric, ₹1.5 Lakhs for pre-matric, or ₹8 Lakhs for higher education interest subsidies).</li>
              <li>• The income period required by the scholarship scheme must match the assessment period on your certificate.</li>
            </ul>
          </div>
        </div>
      )}

      {/* Tab 2: Sources */}
      {selectedTab === 'sources' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Coins className="w-5 h-5 text-teal-600" />
              How Is Annual Family Income Calculated?
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700">
                <span className="font-bold text-slate-900 dark:text-slate-100 block mb-1">
                  1. Salaried Individuals
                </span>
                <p className="text-slate-600 dark:text-slate-400">
                  Gross annual salary evidenced by Form 16 or monthly salary slips from employer showing base pay, allowances, and bonuses.
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700">
                <span className="font-bold text-slate-900 dark:text-slate-100 block mb-1">
                  2. Business &amp; Self-Employed
                </span>
                <p className="text-slate-600 dark:text-slate-400">
                  Net taxable income declared in Income Tax Returns (ITR-V) or verified profit statements from commercial turnover.
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700">
                <span className="font-bold text-slate-900 dark:text-slate-100 block mb-1">
                  3. Agriculture &amp; Land Revenue
                </span>
                <p className="text-slate-600 dark:text-slate-400">
                  Estimated agricultural yield computed by the Patwari / Village Officer based on acreage, irrigation, and district crop norms.
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700">
                <span className="font-bold text-slate-900 dark:text-slate-100 block mb-1">
                  4. Daily Wage &amp; Informal Labor
                </span>
                <p className="text-slate-600 dark:text-slate-400">
                  Determined through local revenue field inquiry, ward member endorsement, or self-declaration affidavit.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Validity & Assessment */}
      {selectedTab === 'validity' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-teal-600" />
              Assessment Period vs. Issue Date &amp; Validity
            </h3>

            <div className="p-4 bg-teal-50/50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-900/40 rounded-lg text-xs space-y-2 text-slate-700 dark:text-slate-300 leading-relaxed">
              <p>
                <strong>Understanding the Difference:</strong>
                <br />
                • <strong>Issue Date:</strong> The day the revenue authority digitally signs the certificate.
                <br />
                • <strong>Financial Assessment Year:</strong> The financial period (1 April to 31 March) whose income was evaluated (e.g. FY 2025-26).
              </p>
              <p>
                <strong>Statutory Validity:</strong> Validity periods vary by state rules:
                <br />
                • In Tamil Nadu, income certificates are valid for <strong>6 months</strong> from issuance.
                <br />
                • In Central schemes and Maharashtra/Delhi, they are typically valid for the <strong>current financial year</strong> ending 31 March.
                <br />
                • In Uttar Pradesh, certificates remain valid for <strong>3 years</strong> for state education schemes.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Steps */}
      {selectedTab === 'steps' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Application Journey &amp; Field Verification
            </h3>

            <ol className="text-xs text-slate-600 dark:text-slate-300 space-y-3 list-decimal pl-4 leading-relaxed">
              <li>
                <strong>Online Application:</strong> Apply on the designated State e-District portal ({currentJurisdiction.portal}) or through a local Citizen Service Center.
              </li>
              <li>
                <strong>Revenue Verification:</strong> The request is assigned to the local Village Administrative Officer (VAO) / Patwari / Lekhpal.
              </li>
              <li>
                <strong>Field Inquiry:</strong> Revenue officer verifies residence, family ration card, electricity bills, and assets to confirm declared income.
              </li>
              <li>
                <strong>Approval by Tehsildar:</strong> Competent authority reviews the inspection report and issues the digitally signed certificate with an authentic QR code.
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
              Required Documents
            </h3>

            <div className="space-y-3">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Proof of Income (Salary Slip, Form 16, or ITR-V)
                  </span>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded">
                    Mandatory for Salaried/Business
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Salary certificate from employer or latest Income Tax Return acknowledgement.
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Self-Declaration Affidavit of Income
                  </span>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded">
                    Mandatory for Informal Workers
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Sworn affidavit stating monthly earnings, family size, and occupation under penalty of perjury.
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Ration Card / Family Member Details
                  </span>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded">
                    Mandatory
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Proves dependent family members whose cumulative earnings must be calculated.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footnote */}
      <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
        This informational guide is grounded in state revenue citizen charters and public service guarantee rules. Verified on 5 November 2026. Civic Help Setu does not issue certificates or calculate income.
      </div>
    </div>
  );
}
