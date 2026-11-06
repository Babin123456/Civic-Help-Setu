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
  Plane,
  CreditCard,
  Shield,
  FileCheck
} from 'lucide-react';

/**
 * PassportGuide Component
 *
 * Implements Issue #514: Dedicated scannable citizen guide for Indian Passport issuance & re-issue,
 * Passport Seva Portal (passportindia.gov.in), Normal vs Tatkaal scheme fees, PSK/POPSK appointment
 * milestones (Counters A, B, C), and Police Verification (PVR) regimes.
 */
export default function PassportGuide({ service, onBack }) {
  const [selectedScheme, setSelectedScheme] = useState('normal'); // 'normal' | 'tatkaal'
  const [selectedTab, setSelectedTab] = useState('overview'); // 'overview' | 'appointment' | 'police' | 'steps' | 'documents'

  return (
    <div className="passport-guide max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 mb-2">
              <ShieldCheck className="w-3.5 h-3.5" /> Ministry of External Affairs (Passports Act, 1967)
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Indian Passport Issuance &amp; Re-issue Guide
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Plain-language instructions for fresh passport application, re-issue, Normal vs Tatkaal schemes, PSK appointment milestones, and police verification.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase">
              Official Portal:
            </span>
            <a
              href="https://www.passportindia.gov.in"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors"
            >
              Passport Seva <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Scheme Selector */}
        <div className="mt-4 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Select Application Scheme:
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedScheme('normal')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                selectedScheme === 'normal'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              Normal Scheme (₹1,500 / 36 Pages)
            </button>
            <button
              onClick={() => setSelectedScheme('tatkaal')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                selectedScheme === 'tatkaal'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              Tatkaal Scheme (₹3,500 / Fast-Track)
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 pt-6 border-t border-slate-200 dark:border-slate-800 mt-6">
          {[
            { id: 'overview', label: 'What This Document Is', icon: FileText },
            { id: 'appointment', label: 'PSK Visit (Counters A, B, C)', icon: Building },
            { id: 'police', label: 'Police Verification (PVR)', icon: Shield },
            { id: 'steps', label: 'Application Steps', icon: Calendar },
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
                    ? 'bg-blue-600 text-white shadow-sm'
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
              What the Passport Proves
            </h3>
            <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed">
              <li>• Sovereign travel document certifying Indian nationality, identity, and citizenship worldwide.</li>
              <li>• Conclusive proof of date of birth, place of birth, and permanent address across Indian civil authorities.</li>
              <li>• Standard validity of <strong>10 years</strong> for adults (5 years for minors under age 15).</li>
            </ul>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Dual Citizenship Prohibition
            </h3>
            <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed">
              <li>• Under Article 9 of the Constitution of India, dual citizenship is strictly prohibited.</li>
              <li>• Indian citizens who acquire foreign citizenship must immediately surrender their Indian passport under penalty of law.</li>
            </ul>
          </div>
        </div>
      )}

      {/* Tab 2: PSK Appointment */}
      {selectedTab === 'appointment' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Building className="w-5 h-5 text-blue-600" />
              What Happens at the Passport Seva Kendra (PSK / POPSK)?
            </h3>

            <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded-lg">
                <span className="font-bold text-blue-900 dark:text-blue-200 block mb-1">
                  1. Counter A (Citizen Service Executive / TCS)
                </span>
                Biometric scanning (ten fingerprints), digital high-resolution facial photograph, electronic signature capture, and document digitisation. The applicant reviews personal details on a citizen-facing screen.
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-lg">
                <span className="font-bold text-slate-900 dark:text-slate-100 block mb-1">
                  2. Counter B (Government Verification Officer)
                </span>
                Original document inspection. The verification officer physically checks your original birth certificate, 10th marksheet (for Non-ECR status), and current residential address proofs.
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-lg">
                <span className="font-bold text-slate-900 dark:text-slate-100 block mb-1">
                  3. Counter C (Granting Officer / RPO Executive)
                </span>
                Final approval or referral. The Granting Officer decides whether the passport is "Granted with Pre-Police Verification", "Granted with Post-Police Verification", or referred for clarification. An exit slip is issued.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Police Verification */}
      {selectedTab === 'police' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-600" />
              Police Verification Report (PVR) Categories
            </h3>

            <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/30 rounded-lg border border-slate-200 dark:border-slate-800">
                <span className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
                  Pre-Police Verification:
                </span>
                The local police station receives an electronic dossier. A police officer visits your address or calls you with two neighborhood witnesses and ID proofs. The passport is printed only after a "Clear" report is submitted to the RPO.
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/30 rounded-lg border border-slate-200 dark:border-slate-800">
                <span className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
                  Post-Police Verification:
                </span>
                Applied under Tatkaal or specific government employee categories. The passport is printed and dispatched immediately; verification happens after delivery.
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/30 rounded-lg border border-slate-200 dark:border-slate-800">
                <span className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
                  No Police Verification:
                </span>
                Applicable to re-issues before expiry where address has not changed and previous records are clear, or for minor children where parents hold valid passports with endorsed names.
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
              Application Journey: Online Registration to Speed Post Delivery
            </h3>

            <ol className="text-xs text-slate-600 dark:text-slate-300 space-y-3 list-decimal pl-4 leading-relaxed">
              <li>
                <strong>Register on Passport Seva Portal:</strong> Create account on <a href="https://www.passportindia.gov.in" target="_blank" rel="noreferrer" className="underline text-blue-600 font-semibold">passportindia.gov.in</a> and select "Apply for Fresh Passport / Re-issue".
              </li>
              <li>
                <strong>Fill Application &amp; Select Scheme:</strong> Choose Normal or Tatkaal scheme, booklet size (36 vs 60 pages), and enter personal/family details.
              </li>
              <li>
                <strong>Pay Fee &amp; Book Appointment:</strong> Make online payment (₹1,500 for normal 36 pages; ₹3,500 for Tatkaal) and book an appointment slot at the nearest PSK or Post Office Passport Seva Kendra (POPSK).
              </li>
              <li>
                <strong>Attend Appointment with Originals:</strong> Visit PSK with appointment receipt and original documents. Complete Counters A, B, and C.
              </li>
              <li>
                <strong>Police Verification &amp; Printing:</strong> Complete local police enquiry. RPO prints the passport booklet.
              </li>
              <li>
                <strong>Speed Post Dispatch:</strong> Passport is dispatched directly by India Post with tracking SMS alerts.
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
              Mandatory Documents to Carry (Originals + 1 Set Self-Attested Photocopies)
            </h3>

            <div className="space-y-3">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Proof of Current Address (Where You Reside)
                  </span>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded">
                    Mandatory
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Aadhaar Card, active bank passbook with photo from scheduled public/private bank, electricity bill, or registered rent agreement.
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Proof of Date of Birth
                  </span>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded">
                    Mandatory
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Birth Certificate issued by Registrar of Births and Deaths, 10th School Passing Certificate, or PAN Card.
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Non-ECR (Emigration Check Not Required) Proof
                  </span>
                  <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded">
                    Recommended
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Class 10 (Matriculation) or higher educational degree certificate. Eliminates emigration check clearance for employment travel in 18 notified countries.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footnote */}
      <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
        This informational guide is grounded in the Passports Act, 1967 and official Passport Seva guidelines. Verified on 5 November 2026. Civic Help Setu does not process passport applications or collect passport credentials.
      </div>
    </div>
  );
}
