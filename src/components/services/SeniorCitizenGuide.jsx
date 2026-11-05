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
  Heart,
  Bus
} from 'lucide-react';

/**
 * SeniorCitizenGuide Component
 *
 * Implements Issue #510: Scannable citizen guide for Senior Citizen Certificate / ID card
 * by state, age threshold (60+ years), transport concessions, healthcare priority,
 * state welfare department routes, and Maintenance Tribunal legal rights.
 */
export default function SeniorCitizenGuide({ service, onBack }) {
  const [selectedState, setSelectedState] = useState('Standard Guidelines');
  const [selectedTab, setSelectedTab] = useState('overview'); // 'overview' | 'benefits' | 'steps' | 'documents' | 'rights'

  const stateProvisions = {
    'Standard Guidelines': {
      authority: 'District Social Welfare Officer / Sub-Divisional Magistrate (SDM)',
      portal: 'https://services.india.gov.in',
      validity: 'Lifetime validity from age 60',
      fees: 'Free of Cost (Do not pay touts)',
      processingTime: '15 to 21 working days'
    },
    'Delhi': {
      authority: 'Sub-Divisional Magistrate (Revenue Department / e-District Delhi)',
      portal: 'https://edistrict.delhigovt.nic.in',
      validity: 'Permanent laminated card',
      fees: 'Free on e-District',
      processingTime: '14 working days under Right to Public Service'
    },
    'Maharashtra': {
      authority: 'Tehsildar / District Social Welfare Officer (Aaple Sarkar)',
      portal: 'https://aaplesarkar.mahaonline.gov.in',
      validity: 'Lifetime validity',
      fees: '₹20 nominal portal charge',
      processingTime: '15 working days'
    }
  };

  const currentJurisdiction = stateProvisions[selectedState] || stateProvisions['Standard Guidelines'];

  return (
    <div className="senior-citizen-guide max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 mb-2">
              <ShieldCheck className="w-3.5 h-3.5" /> Maintenance &amp; Welfare of Senior Citizens Act
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Senior Citizen Certificate &amp; ID Card Guide
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              State-by-state instructions for obtaining official Senior Citizen Identity Cards, transit concessions, healthcare priorities, and statutory welfare entitlements.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase">
              State:
            </label>
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="text-xs font-medium bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="Standard Guidelines">Standard Central Framework</option>
              <option value="Delhi">Delhi (e-District SDM)</option>
              <option value="Maharashtra">Maharashtra (Aaple Sarkar)</option>
            </select>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 pt-6 border-t border-slate-200 dark:border-slate-800 mt-6">
          {[
            { id: 'overview', label: 'What This Document Is', icon: FileText },
            { id: 'benefits', label: 'Concessions & Benefits', icon: Heart },
            { id: 'steps', label: 'Application Journey', icon: Building },
            { id: 'documents', label: 'Documents & Age Proof', icon: CheckCircle },
            { id: 'rights', label: 'Maintenance & Legal Rights', icon: AlertTriangle }
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
              Purpose of the Card / Certificate
            </h3>
            <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed">
              <li>• Official state-issued credential verifying that the citizen has attained the age of 60 years.</li>
              <li>• Provides simplified access to state bus transport concessions, hospital fast-track counters, and local municipal recreation facilities.</li>
              <li>• Lifetime validity once issued—no periodic renewals are necessary.</li>
            </ul>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Crucial Clarification: Not a Uniform National Card
            </h3>
            <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed">
              <li>• <strong>No Single Central ID:</strong> The Union Government does not issue a mandatory standalone "National Senior ID". Standard age verification can also be established using Aadhaar, Passport, or PAN card.</li>
              <li>• <strong>State Scheme Document:</strong> State cards are optional but highly practical for obtaining state-specific welfare subsidies without carrying original passports or birth certificates.</li>
            </ul>
          </div>
        </div>
      )}

      {/* Tab 2: Benefits */}
      {selectedTab === 'benefits' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Heart className="w-5 h-5 text-rose-500" />
              State &amp; Central Senior Citizen Concessions
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700">
                <span className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 mb-1">
                  <Bus className="w-4 h-4 text-blue-600" /> Public Transit &amp; Bus Travel
                </span>
                <p className="text-slate-600 dark:text-slate-400">
                  State Road Transport Corporation (SRTC) buses offer designated reserved front seats and fare subsidies (up to 50% discount or free local city bus passes depending on the municipal policy).
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700">
                <span className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 mb-1">
                  <Building className="w-4 h-4 text-emerald-600" /> Healthcare &amp; Government Hospitals
                </span>
                <p className="text-slate-600 dark:text-slate-400">
                  Separate registration queues, priority OPD consultation, and subsidized diagnostic tests under the National Programme for the Health Care of the Elderly (NPHCE).
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700">
                <span className="font-bold text-slate-900 dark:text-slate-100 block mb-1">
                  Banking &amp; Higher Deposit Returns
                </span>
                <p className="text-slate-600 dark:text-slate-400">
                  0.50% to 0.75% additional interest rate on Fixed Deposits across nationalized banks, and high returns under the Senior Citizen Savings Scheme (SCSS).
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700">
                <span className="font-bold text-slate-900 dark:text-slate-100 block mb-1">
                  Income Tax Exemption Limits (Section 80TTB)
                </span>
                <p className="text-slate-600 dark:text-slate-400">
                  Deduction up to ₹50,000 on interest income earned from savings accounts and fixed deposits under Section 80TTB of the Income Tax Act.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Application Journey */}
      {selectedTab === 'steps' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Application Journey &amp; Card Delivery
            </h3>

            <ol className="text-xs text-slate-600 dark:text-slate-300 space-y-3 list-decimal pl-4 leading-relaxed">
              <li>
                <strong>Access State Citizen Portal:</strong> Open the official state revenue / e-District portal ({currentJurisdiction.portal}) or visit a local Citizen Service Center (CSC / e-Sevai / Citizen Facilitation Centre).
              </li>
              <li>
                <strong>Upload Age &amp; Residence Proofs:</strong> Submit self-attested copies of Aadhaar, voter card, and birth or matriculation certificate confirming age ≥ 60.
              </li>
              <li>
                <strong>Provide Emergency &amp; Medical Contact:</strong> Enter primary emergency contact, residential address, and doctor-certified blood group.
              </li>
              <li>
                <strong>Revenue / Social Welfare Scrutiny:</strong> The District Social Welfare Officer / SDM verifies the age and local residence particulars.
              </li>
              <li>
                <strong>Card Download or Home Delivery:</strong> Once approved, the digital ID card with QR code is downloadable online or delivered by post.
              </li>
            </ol>
          </div>
        </div>
      )}

      {/* Tab 4: Documents */}
      {selectedTab === 'documents' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Documents to Keep Ready
            </h3>

            <div className="space-y-3">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Age Verification Document (Age ≥ 60 Years)
                  </span>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded">
                    Mandatory
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Birth Certificate, School Leaving Certificate, Passport, PAN Card, or Voter ID showing full date of birth.
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Local Residence Proof in the State
                  </span>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded">
                    Mandatory
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Aadhaar Card, recent electricity bill, water connection slip, or registered rent agreement.
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Passport-Size Photos &amp; Blood Group Memo
                  </span>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded">
                    Mandatory
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Recent color photographs; doctor's slip or pathology test report confirming blood group for the emergency card back.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Rights */}
      {selectedTab === 'rights' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Statutory Protection: Maintenance of Parents Act, 2007
            </h3>

            <div className="p-4 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-lg text-xs space-y-2 text-slate-700 dark:text-slate-300 leading-relaxed">
              <p>
                <strong>Legal Protection Against Abandonment:</strong> Under the <em>Maintenance and Welfare of Parents and Senior Citizens Act, 2007</em>, senior citizens who are unable to maintain themselves can file an application before a summary <strong>Maintenance Tribunal</strong> headed by the Sub-Divisional Magistrate (SDM).
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Tribunals can order children or legal heirs to provide monthly maintenance allowances (up to statutory ceilings).</li>
                <li>Transfer of property (gift deeds/wills) made subject to condition of maintenance can be declared void by the Tribunal if the children fail to provide basic physical needs.</li>
                <li>Abandonment of senior citizens by caregivers is a cognizable criminal offense punishable with imprisonment up to 3 months.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Footnote */}
      <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
        This informational guide is grounded in state citizen charters and the Maintenance and Welfare of Parents and Senior Citizens Act, 2007. Verified on 5 November 2026. Civic Help Setu does not process applications or store citizen records.
      </div>
    </div>
  );
}
