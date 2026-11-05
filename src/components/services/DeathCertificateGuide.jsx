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
  ExternalLink
} from 'lucide-react';

/**
 * DeathCertificateGuide Component
 *
 * Implements Issue #502: Dedicated scannable citizen guide for Death Certificate
 * issuance, institutional vs home events, delayed registration (2026 amendment rules),
 * certified copies, and correction of factual errors.
 */
export default function DeathCertificateGuide({ service, onBack }) {
  const [selectedState, setSelectedState] = useState('All-India / Central Standard');
  const [selectedTab, setSelectedTab] = useState('overview'); // 'overview' | 'steps' | 'documents' | 'delays' | 'faq'

  const stateProvisions = {
    'All-India / Central Standard': {
      authority: 'Registrar of Births and Deaths (Gram Panchayat / Municipal Corporation / Cantonment Board)',
      portal: 'https://crsorgi.gov.in',
      reportingPeriod: '21 days from date of death',
      normalFee: 'Free (First copy is issued free to informant)',
      lateFee30Days: '₹2 to ₹100 depending on State rules',
      lateFee1Year: '₹5 to ₹200 + BDO/EO written permission',
      lateFeeOver1Year: 'Order of DM/SDM/Executive Magistrate (1-2 yrs) or JMFC (>2 yrs) under 2026 Central Amendment',
      onlineAvailable: 'Events registered on CRS portal can be verified and downloaded online.'
    },
    'Tamil Nadu': {
      authority: 'Town Panchayat Executive Officer / Municipal Corporation Health Officer / Village Administrative Officer (VAO)',
      portal: 'https://www.crstn.org/birth_death_tn/crs',
      reportingPeriod: '21 days from date of death',
      normalFee: 'Free within 21 days',
      lateFee30Days: '₹100 late fee under TN Rule 9(1)',
      lateFee1Year: '₹200 late fee with Form 14 self-attestation under Rule 9(2)',
      lateFeeOver1Year: '₹500 late fee + DM/SDM order (1-2 yrs) or JMFC order (>2 yrs)',
      onlineAvailable: 'Records registered from 1 January 2018 are downloadable online free of cost.'
    }
  };

  const currentJurisdiction = stateProvisions[selectedState] || stateProvisions['All-India / Central Standard'];

  return (
    <div className="death-certificate-guide max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 mb-2">
              <ShieldCheck className="w-3.5 h-3.5" /> Statutory Civil Registration Guide
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Death Certificate Issuance &amp; Certified Copies
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Official registration steps, informant obligations, delayed registration rules, and certified copy procedures under the Registration of Births and Deaths Act.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase">
              Jurisdiction:
            </label>
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="text-xs font-medium bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="All-India / Central Standard">All-India / Central Standard</option>
              <option value="Tamil Nadu">Tamil Nadu (CRSTN)</option>
            </select>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 pt-6 border-t border-slate-200 dark:border-slate-800 mt-6">
          {[
            { id: 'overview', label: 'What This Document Is', icon: FileText },
            { id: 'steps', label: 'Application Journey', icon: Building },
            { id: 'documents', label: 'Evidence & Documents', icon: CheckCircle },
            { id: 'delays', label: 'Delayed Registration', icon: Clock },
            { id: 'faq', label: 'Common Mistakes & Corrections', icon: AlertTriangle }
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
              What This Document Proves
            </h3>
            <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed">
              <li>• Prima facie conclusive legal proof of the fact, exact date, and place of death.</li>
              <li>• Required for statutory insurance claims, pension transfers, banking settlements, and closure of public accounts.</li>
              <li>• Extracts under Section 12 or Section 17 are admissible in all Indian civil courts without formal proof.</li>
            </ul>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              What It Does NOT Prove
            </h3>
            <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed">
              <li>• <strong>Does NOT prove Legal Heirship:</strong> A death certificate confirms the person is deceased, but does NOT determine who inherits property or assets.</li>
              <li>• <strong>Does NOT replace Medical Certificate of Cause of Death (MCCD):</strong> Cause-of-death details are confidential statistical records and never printed on civil certificates.</li>
            </ul>
          </div>

          <div className="md:col-span-2 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-600" />
              Jurisdiction Rule: Place of Occurrence
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              A death must strictly be registered with the local Registrar responsible for the <strong>place where the death occurred</strong>, NOT the family’s permanent home or native village. If an individual passes away in a hospital in another city, the registration belongs to the municipal body of that hospital’s area.
            </p>
          </div>
        </div>
      )}

      {/* Tab 2: Application Journey */}
      {selectedTab === 'steps' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Application Journey: Institutional vs. Home Deaths
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 space-y-2">
                <span className="font-semibold text-xs text-blue-800 dark:text-blue-300 uppercase">
                  Institutional Deaths (Hospital / Nursing Home)
                </span>
                <ol className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5 list-decimal pl-4 leading-relaxed">
                  <li>Hospital or medical institution prepares the statutory reporting form (Form 2) and sends it directly to the jurisdictional Registrar.</li>
                  <li>Family collects the hospital death memo and crematorium/burial acknowledgement.</li>
                  <li>After registration entry by local Registrar, family downloads or collects the official certificate online or from the local body counter.</li>
                </ol>
              </div>

              <div className="p-4 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 space-y-2">
                <span className="font-semibold text-xs text-amber-800 dark:text-amber-300 uppercase">
                  Domiciliary / Home Deaths
                </span>
                <ol className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5 list-decimal pl-4 leading-relaxed">
                  <li>Head of household or nearest relative reports the event to the local Registrar within 21 days.</li>
                  <li>Submit doctor’s death confirmation memo (if treated) or cremation/burial ground receipt.</li>
                  <li>Local Registrar inspects or verifies informant declaration, registers the record, and issues the certificate.</li>
                </ol>
              </div>
            </div>

            <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-2">
              <h4 className="text-xs font-bold uppercase text-slate-800 dark:text-slate-200">
                Official Registration Portal &amp; Contacts
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Competent Authority: <strong>{currentJurisdiction.authority}</strong>
              </p>
              <a
                href={currentJurisdiction.portal}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 underline"
              >
                Access Official Portal ({currentJurisdiction.portal}) <ExternalLink className="w-3.5 h-3.5" />
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
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Only state-authorized proof categories are recognized. Scanned documents are never uploaded to this informational guide.
            </p>

            <div className="space-y-3">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Hospital Death Report / Attending Doctor’s Memo
                  </span>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded">
                    Mandatory for Institutional Cases
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Issued by medical superintendent showing date, exact time, and confirmation of demise.
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Cremation / Burial Ground Receipt or Undertaker Acknowledgement
                  </span>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded">
                    Mandatory
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Verifies that final rites were administered at a recognized site within the local body jurisdiction.
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Identity Proof of the Informant / Applicant
                  </span>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded">
                    Mandatory
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Aadhaar card, Voter ID card, or Passport of the family member or reporting informant.
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Non-Availability Certificate (Form 10) &amp; Judicial Magistrate Order
                  </span>
                  <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded">
                    Conditional (Delayed Cases &gt; 1 Year)
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Required under Section 13 when the death was not registered during the standard statutory reporting window.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Delayed Registration */}
      {selectedTab === 'delays' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              Delayed Registration Provisions (2026 Central Amendment)
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              The Registration of Births and Deaths (Amendment) Act establishes structured magistrate tiers for registrations past normal deadlines:
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700">
                    <th className="p-3 font-semibold">Reporting Time Elapsed</th>
                    <th className="p-3 font-semibold">Sanctioning Authority</th>
                    <th className="p-3 font-semibold">Statutory Late Fee</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-600 dark:text-slate-300">
                  <tr>
                    <td className="p-3 font-medium">Within 21 Days</td>
                    <td className="p-3">Registrar of Births &amp; Deaths</td>
                    <td className="p-3 text-emerald-600 font-semibold">Free</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-medium">21 to 30 Days</td>
                    <td className="p-3">Registrar / Local Authority</td>
                    <td className="p-3">{currentJurisdiction.lateFee30Days}</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-medium">30 Days to 1 Year</td>
                    <td className="p-3">Block Development Officer / Executive Officer</td>
                    <td className="p-3">{currentJurisdiction.lateFee1Year}</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-medium">1 Year to 2 Years</td>
                    <td className="p-3">District Magistrate / Sub-Divisional Magistrate / Authorised Executive Magistrate</td>
                    <td className="p-3">{currentJurisdiction.lateFeeOver1Year}</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-medium">More than 2 Years</td>
                    <td className="p-3">Judicial Magistrate of the First Class (JMFC)</td>
                    <td className="p-3">{currentJurisdiction.lateFeeOver1Year}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: FAQ & Prevention Tips */}
      {selectedTab === 'faq' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Common Citizen Mistakes &amp; Prevention Tips
            </h3>

            <div className="space-y-3">
              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 text-xs space-y-1">
                <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                  1. Confusing Registration Office with Residential Address
                </span>
                <p className="text-slate-600 dark:text-slate-400">
                  Citizens often approach the registration office of their ancestral town. You must always register with the authority governing the place where the death occurred.
                </p>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 text-xs space-y-1">
                <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                  2. Misspelled Names &amp; Discrepancies with Aadhaar / Bank Records
                </span>
                <p className="text-slate-600 dark:text-slate-400">
                  Ensure the spelling of the deceased person’s name, parent names, and spouse name exactly matches existing identity documents to prevent bank settlement delays.
                </p>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 text-xs space-y-1">
                <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                  3. Creating Duplicate Registrations for Unretrieved Certificates
                </span>
                <p className="text-slate-600 dark:text-slate-400">
                  If you cannot find an earlier record, apply for a record search or Non-Availability Certificate (NAC) under Section 17. Never attempt to register a death a second time.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Official Footnote & Caveats */}
      <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
        This informational guide is grounded in the Registration of Births and Deaths Act, 1969 and applicable state rules. Verified against statutory records on 5 November 2026. Civic Help Setu does not process applications or store citizen records.
      </div>
    </div>
  );
}
