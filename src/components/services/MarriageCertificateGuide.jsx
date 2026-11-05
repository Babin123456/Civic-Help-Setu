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
  Users
} from 'lucide-react';

/**
 * MarriageCertificateGuide Component
 *
 * Implements Issue #503: Citizen-friendly Marriage Registration Certificate Guide
 * covering Personal Laws vs Special Marriage Act, witnesses, jurisdiction,
 * state portals (TNREGINET, Delhi e-District, etc.), and document requirements.
 */
export default function MarriageCertificateGuide({ service, onBack }) {
  const [selectedRoute, setSelectedRoute] = useState('hindu'); // 'hindu' | 'special'
  const [selectedState, setSelectedState] = useState('All-India Standard');
  const [selectedTab, setSelectedTab] = useState('overview'); // 'overview' | 'steps' | 'documents' | 'witnesses' | 'faq'

  const stateProvisions = {
    'All-India Standard': {
      authority: 'Sub-Registrar of Assurances / Marriage Officer under Revenue Department',
      portal: 'https://services.india.gov.in',
      statutoryNoticeDays: '30 days notice mandatory under Special Marriage Act; none for already solemnised religious marriages',
      appointmentRequired: 'Yes, both parties and witnesses must appear before the Marriage Officer.',
      feeRange: '₹50 to ₹500 depending on state rule schedule'
    },
    'Tamil Nadu': {
      authority: 'Sub-Registrar Office (Commercial Taxes and Registration Department)',
      portal: 'https://tnreginet.gov.in',
      statutoryNoticeDays: 'Online booking via TNREGINET followed by Sub-Registrar appearance',
      appointmentRequired: 'Yes, mandatory physical biometrics and signatures in SRO.',
      feeRange: 'Nominal statutory stamp fee + user charges published on TNREGINET'
    },
    'Delhi': {
      authority: 'Sub-Divisional Magistrate (SDM) / Marriage Registrar Office',
      portal: 'https://edistrict.delhigovt.nic.in',
      statutoryNoticeDays: '14 to 30 days scheduling via e-District Delhi portal',
      appointmentRequired: 'Yes, mandatory appointment with SDM.',
      feeRange: '₹100 to ₹1500 (Tatkal appointment available with surcharge)'
    }
  };

  const currentJurisdiction = stateProvisions[selectedState] || stateProvisions['All-India Standard'];

  return (
    <div className="marriage-certificate-guide max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 mb-2">
              <ShieldCheck className="w-3.5 h-3.5" /> Statutory Civil Marriage Guide
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Marriage Registration Certificate Guide
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Plain-language procedures for registering marriages under the Hindu Marriage Act, Special Marriage Act, and state compulsory registration rules.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase">
              State / UT:
            </label>
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="text-xs font-medium bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500"
            >
              <option value="All-India Standard">All-India Standard</option>
              <option value="Tamil Nadu">Tamil Nadu (TNREGINET)</option>
              <option value="Delhi">Delhi (e-District SDM)</option>
            </select>
          </div>
        </div>

        {/* Route selector: Personal Law vs Special Marriage */}
        <div className="mt-4 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Select Applicable Statutory Route:
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedRoute('hindu')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                selectedRoute === 'hindu'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              Religious Personal Law (e.g. Hindu Marriage Act)
            </button>
            <button
              onClick={() => setSelectedRoute('special')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                selectedRoute === 'special'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              Civil Marriage (Special Marriage Act, 1954)
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 pt-6 border-t border-slate-200 dark:border-slate-800 mt-6">
          {[
            { id: 'overview', label: 'What This Document Is', icon: FileText },
            { id: 'steps', label: 'Application Steps', icon: Building },
            { id: 'documents', label: 'Evidence & Documents', icon: CheckCircle },
            { id: 'witnesses', label: 'Witness Obligations', icon: Users },
            { id: 'faq', label: 'Mistakes to Avoid', icon: AlertTriangle }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = selectedTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedTab(tab.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-rose-600 text-white shadow-sm'
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
              What the Certificate Proves
            </h3>
            <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed">
              <li>• Conclusive legal document certifying that marriage was validly solemnised and entered into the civil register.</li>
              <li>• Universally recognized for spouse passport endorsement, spouse visas, joint property registrations, and nominee transfers.</li>
              <li>• Required under Supreme Court directives making marriage registration compulsory across Indian states.</li>
            </ul>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Solemnisation vs. Registration
            </h3>
            <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed">
              <li>• <strong>Solemnisation:</strong> The performance of wedding ceremonies, rituals, or statutory declarations (e.g., Saptapadi, Anand Karaj, Nikah, church ceremonies, or civil declaration).</li>
              <li>• <strong>Registration:</strong> The legal act of recording the event before a government Marriage Registrar. Solemnisation without registration lacks civil documentation.</li>
            </ul>
          </div>

          <div className="md:col-span-2 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <MapPin className="w-4 h-4 text-rose-600" />
              Jurisdiction Rules
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              You may apply in the jurisdiction of the Sub-Registrar / Marriage Officer:
              <br />
              1. Where the marriage was solemnised, OR
              <br />
              2. Where either spouse has resided continuously for at least 6 months (or minimum residency prescribed by state rules, typically 30 to 60 days).
            </p>
          </div>
        </div>
      )}

      {/* Tab 2: Application Steps */}
      {selectedTab === 'steps' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Application Journey ({selectedRoute === 'special' ? 'Special Marriage Act' : 'Personal Law Registration'})
            </h3>

            {selectedRoute === 'special' ? (
              <ol className="text-xs text-slate-600 dark:text-slate-300 space-y-3 list-decimal pl-4 leading-relaxed">
                <li>
                  <strong>Submission of Notice of Intended Marriage:</strong> Both parties submit Form I notice to the Marriage Officer of the district where at least one party has resided for not less than 30 days.
                </li>
                <li>
                  <strong>Mandatory 30-Day Objection Notice:</strong> Notice is published at the Marriage Officer's office. If no valid legal objection is received within 30 days, registration proceeds.
                </li>
                <li>
                  <strong>Physical Appearance with 3 Witnesses:</strong> Bride, groom, and 3 adult witnesses appear before the Marriage Officer to sign declarations and complete biometric verification.
                </li>
                <li>
                  <strong>Issuance of Certificate:</strong> Certificate of Marriage is signed and issued immediately in the Marriage Certificate Book.
                </li>
              </ol>
            ) : (
              <ol className="text-xs text-slate-600 dark:text-slate-300 space-y-3 list-decimal pl-4 leading-relaxed">
                <li>
                  <strong>Pre-registration / Online Booking:</strong> File application on the state portal ({currentJurisdiction.portal}) and book an appointment slot at the jurisdictional Sub-Registrar Office.
                </li>
                <li>
                  <strong>Document Assembly:</strong> Prepare proof of age, proof of address, wedding invitation, priest certificate/receipt, and joint photos.
                </li>
                <li>
                  <strong>Appearance on Appointment Date:</strong> Bride, groom, and required witnesses (typically 2 or 3) present original documents before the Sub-Registrar.
                </li>
                <li>
                  <strong>Digital Endorsement &amp; Download:</strong> Certificate is recorded, digitally signed, and delivered or made downloadable online.
                </li>
              </ol>
            )}

            <div className="border-t border-slate-200 dark:border-slate-800 pt-4 text-xs space-y-1">
              <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                Official Department Portal:
              </span>
              <a
                href={currentJurisdiction.portal}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-rose-600 hover:text-rose-700 underline font-semibold"
              >
                {currentJurisdiction.portal} <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Documents */}
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
                    Age Verification of Bride and Groom
                  </span>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded">
                    Mandatory
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Birth Certificate, 10th School Passing Certificate, or Valid Passport. Groom must be ≥ 21 years; bride must be of statutory legal age.
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Jurisdiction Residential Address Proof
                  </span>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded">
                    Mandatory
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Voter ID, Aadhaar Card, Electricity Bill, or Registered Rent Agreement proving residence within the Sub-Registrar’s boundaries.
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Solemnisation Evidence (For Religious Route)
                  </span>
                  <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded">
                    Applicable to Personal Law Registrations
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Original wedding invitation card, marriage hall booking receipt, or priest/temple/church/gurdwara/qazi marriage solemnisation slip.
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Photographs &amp; Marital Status Affidavits
                  </span>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded">
                    Mandatory
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Joint post-ceremony photo, individual passport-size photos, and sworn affidavit confirming neither party has an undissolved prior marriage.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Witnesses */}
      {selectedTab === 'witnesses' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-rose-600" />
              Witness Obligations &amp; Number Requirements
            </h3>

            <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/30 rounded-lg border border-slate-200 dark:border-slate-800">
                <span className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
                  Who Can Be a Witness?
                </span>
                Any adult citizen (aged 18 or above) with mental competence who witnessed the marriage or personal declaration. They can be parents, siblings, relatives, friends, or colleagues.
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/30 rounded-lg border border-slate-200 dark:border-slate-800">
                <span className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
                  Number of Witnesses Required:
                </span>
                • <strong>Special Marriage Act, 1954:</strong> Strictly 3 adult witnesses must be physically present at the office.
                <br />
                • <strong>Hindu Marriage Act &amp; State Acts:</strong> Typically 2 or 3 adult witnesses depending on individual State Marriage Registration Rules.
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/30 rounded-lg border border-slate-200 dark:border-slate-800">
                <span className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
                  Witness Documents to Carry:
                </span>
                Each witness must present an original photo ID (Aadhaar, Passport, Voter ID) and address proof, along with a self-attested photocopy and passport photograph.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: FAQ & Prevention Tips */}
      {selectedTab === 'faq' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Common Mistakes to Avoid
            </h3>

            <div className="space-y-3">
              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 text-xs space-y-1">
                <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                  1. Underage Marriage or Incomplete Age Verification
                </span>
                <p className="text-slate-600 dark:text-slate-400">
                  Marriage registration is refused if either party does not meet statutory minimum age on the date of marriage. Affidavits cannot override birth certificate entries.
                </p>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 text-xs space-y-1">
                <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                  2. Applying at a Sub-Registrar Office without Jurisdiction
                </span>
                <p className="text-slate-600 dark:text-slate-400">
                  Applications must be submitted strictly to the Sub-Registrar under whose jurisdiction the wedding occurred or where either spouse resided for the statutory duration.
                </p>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 text-xs space-y-1">
                <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                  3. Incomplete Witness Identification
                </span>
                <p className="text-slate-600 dark:text-slate-400">
                  Witnesses turning up without original physical identity cards will cause appointment cancellation. All witnesses must bring original government photo IDs.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footnote */}
      <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
        This informational guide is grounded in the Special Marriage Act, 1954, the Hindu Marriage Act, 1955, and state registration orders. Verified against official statutory sources on 5 November 2026. Civic Help Setu does not process applications or store citizen records.
      </div>
    </div>
  );
}
