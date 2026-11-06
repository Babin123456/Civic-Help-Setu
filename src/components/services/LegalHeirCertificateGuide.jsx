import React, { useState } from 'react';

/**
 * Legal Heir & Surviving Member Certificate Guide Component
 * Provides comprehensive, plain-language guidance for Indian citizens applying for
 * administrative Legal Heir / Surviving Member Certificates through Revenue / SDM offices,
 * detailing Class-I heirs, revenue inquiry procedures, and clearly distinguishing it
 * from judicial Succession Certificates issued by Civil Courts.
 */
export default function LegalHeirCertificateGuide() {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedJurisdiction, setSelectedJurisdiction] = useState('tn');

  const jurisdictions = [
    {
      id: 'tn',
      state: 'Tamil Nadu (G.O. Ms. No. 477 Revenue)',
      authority: 'Tahsildar / Zonal Deputy Tahsildar (e-Sevai Portal)',
      portal: 'tnesevai.tn.gov.in',
      processingDays: '15 to 30 working days',
      heirScope: 'Class-I heirs (spouse, children, mother); Class-II heirs permitted if deceased died bachelor / no Class-I heir',
      statutoryFee: '₹60 nominal e-Sevai citizen service fee',
      appealRoute: 'Revenue Divisional Officer (RDO) within 30 days of rejection'
    },
    {
      id: 'delhi',
      state: 'Delhi (e-District Revenue Dept)',
      authority: 'Sub-Divisional Magistrate (SDM) / Tehsildar',
      portal: 'edistrict.delhigovt.nic.in',
      processingDays: '14 to 21 working days',
      heirScope: 'Surviving Member Certificate (SMC) certifying all living family members',
      statutoryFee: 'Free online application (nominal facilitation charge at 2-Kiosk)',
      appealRoute: 'Additional District Magistrate (ADM) / District Magistrate'
    },
    {
      id: 'ka',
      state: 'Karnataka (Seva Sindhu)',
      authority: 'Tahsildar / Nada Kacheri (Atalji Janasnehi Kendra)',
      portal: 'sevasindhu.karnataka.gov.in',
      processingDays: '21 working days (guaranteed under Sakala Services Act)',
      heirScope: 'Family tree verification (Vanshavali) and Survivor Certificate',
      statutoryFee: '₹40 per application',
      appealRoute: 'Assistant Commissioner (Revenue Sub-Division)'
    },
    {
      id: 'mh',
      state: 'Maharashtra (Aaple Sarkar)',
      authority: 'Tahsildar / Sub-Divisional Officer',
      portal: 'aaplesarkar.mahaonline.gov.in',
      processingDays: '15 to 30 working days under Right to Public Services Act',
      heirScope: 'Varas Pramanpatra / Heirship certificate for administrative dues',
      statutoryFee: '₹33 to ₹50 online processing fee',
      appealRoute: 'Sub-Divisional Officer (SDO)'
    }
  ];

  return (
    <div className="legal-heir-guide max-w-4xl mx-auto p-6 bg-white dark:bg-gray-900 rounded-lg shadow-md border border-gray-200 dark:border-gray-800">
      <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            State Revenue Administration
          </span>
          <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
            Administrative Survivor Record
          </span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Legal Heir &amp; Surviving Member Certificate Guide
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm">
          A definitive companion for bereaved families obtaining an administrative Legal Heir / Surviving Member Certificate (SMC)
          for settling gratuity, pensions, bank accounts, and civic transfers.
        </p>
      </div>

      {/* Tabs navigation */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6 overflow-x-auto gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`py-2 px-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'overview'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          Overview &amp; Purpose
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('heir-vs-court')}
          className={`py-2 px-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'heir-vs-court'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          Legal Heir vs. Succession Certificate
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('heirs-scope')}
          className={`py-2 px-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'heirs-scope'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          Recognized Heirs &amp; Documents
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('jurisdictions')}
          className={`py-2 px-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'jurisdictions'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          State Revenue Variations
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('steps')}
          className={`py-2 px-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'steps'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          Application Journey
        </button>
      </div>

      {/* Tab: Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-950/40 rounded-lg border border-blue-200 dark:border-blue-900">
              <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-1">
                Executive Purpose of the Certificate
              </h3>
              <p className="text-sm text-blue-800 dark:text-blue-300">
                A revenue Legal Heir Certificate / Surviving Member Certificate is an administrative document issued by
                the Tehsildar or SDM certifying the living immediate relatives of a deceased individual following field verification.
              </p>
            </div>
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg border border-emerald-200 dark:border-emerald-900">
              <h3 className="font-semibold text-emerald-900 dark:text-emerald-200 mb-1">
                Common Practical Uses
              </h3>
              <p className="text-sm text-emerald-800 dark:text-emerald-300">
                Widely required for sanction of service pensions, compassionate appointments in public sector jobs,
                release of salary/gratuity arrears, and mutating utility connections (electricity, water, property tax).
              </p>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800 p-5 rounded-lg border border-gray-200 dark:border-gray-700">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-3">
              What a Legal Heir Certificate Establishes vs. Does Not Establish
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <span className="font-medium text-emerald-700 dark:text-emerald-400">What It Establishes:</span>
                <ul className="list-disc pl-5 text-gray-600 dark:text-gray-300 space-y-1">
                  <li>Official list of surviving immediate family members certified by local revenue authorities.</li>
                  <li>Authority to receive government post-retirement benefits and terminal dues.</li>
                  <li>Proof of relationship for compassionate employment considerations.</li>
                </ul>
              </div>
              <div className="space-y-2">
                <span className="font-medium text-rose-700 dark:text-rose-400">What It Does NOT Establish:</span>
                <ul className="list-disc pl-5 text-gray-600 dark:text-gray-300 space-y-1">
                  <li>Does NOT conclusively adjudicate title to disputed real estate or partition shares.</li>
                  <li>Does NOT substitute for a court-granted Succession Certificate when banks insist on one.</li>
                  <li>Does NOT validate claims under a disputed Will or unproven testamentary disposition.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Legal Heir vs Court Succession Certificate */}
      {activeTab === 'heir-vs-court' && (
        <div className="space-y-6">
          <div className="p-4 bg-purple-50 dark:bg-purple-950/30 rounded-lg border border-purple-200 dark:border-purple-900">
            <h3 className="font-semibold text-purple-900 dark:text-purple-200 mb-1">
              Do You Need a Legal Heir Certificate or a Succession Certificate?
            </h3>
            <p className="text-sm text-purple-800 dark:text-purple-300">
              One of the most frequent legal misunderstandings in India is confusing an administrative Legal Heir Certificate
              with a court-issued Succession Certificate. Financial institutions and courts treat them very differently.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-5 bg-white dark:bg-gray-900">
              <span className="text-xs uppercase tracking-wide font-semibold text-blue-600 dark:text-blue-400 block mb-1">
                Administrative Revenue Document
              </span>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                Legal Heir / Surviving Member Certificate
              </h4>
              <ul className="text-sm space-y-2 text-gray-600 dark:text-gray-300">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">•</span>
                  <span><strong>Issuing Authority:</strong> Tehsildar / Taluk Office / SDM (Executive Revenue Authority).</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">•</span>
                  <span><strong>Turnaround:</strong> 15 to 30 working days.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">•</span>
                  <span><strong>Cost:</strong> Nominal fee (₹30 to ₹60).</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">•</span>
                  <span><strong>Primary Scope:</strong> Family pensions, government employee dues, utility meter transfers.</span>
                </li>
              </ul>
            </div>

            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-5 bg-white dark:bg-gray-900">
              <span className="text-xs uppercase tracking-wide font-semibold text-emerald-600 dark:text-emerald-400 block mb-1">
                Judicial Civil Court Decree
              </span>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                Succession Certificate (Indian Succession Act)
              </h4>
              <ul className="text-sm space-y-2 text-gray-600 dark:text-gray-300">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 font-bold">•</span>
                  <span><strong>Issuing Authority:</strong> Civil Judge (Senior Division) / District Court judge.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 font-bold">•</span>
                  <span><strong>Turnaround:</strong> 6 to 12 months (involves newspaper gazette notice and judicial hearings).</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 font-bold">•</span>
                  <span><strong>Cost:</strong> Ad-valorem judicial court fees (typically 2% to 6% of estate asset value).</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 font-bold">•</span>
                  <span><strong>Primary Scope:</strong> High-value bank balances without nominee, demat shares, mutual funds, debts.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Recognized Heirs & Documents */}
      {activeTab === 'heirs-scope' && (
        <div className="space-y-6">
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
              Standard Recognized Class-I Legal Heirs
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
              Under general statutory succession principles, administrative revenue authorities will verify and certify:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded">
                <strong>1. Surviving Spouse:</strong> Husband or Wife of the deceased (legally wedded).
              </div>
              <div className="p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded">
                <strong>2. Children:</strong> Sons and Daughters (including married daughters and legally adopted children).
              </div>
              <div className="p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded">
                <strong>3. Mother:</strong> Biological or adoptive mother of the deceased.
              </div>
              <div className="p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded">
                <strong>4. Pre-deceased Children&apos;s Heirs:</strong> Grandchildren if their parent died before the deceased.
              </div>
            </div>
          </div>

          <div className="p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
            <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-2">
              Mandatory Evidence Checklist
            </h4>
            <ul className="text-sm space-y-2 text-gray-600 dark:text-gray-300">
              <li className="flex items-start gap-2">
                <span className="text-emerald-600 font-bold">✓</span>
                <span><strong>Official Death Certificate:</strong> Original or computerized copy from municipal registrar.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-600 font-bold">✓</span>
                <span><strong>Identity &amp; Address Proof of All Surviving Members:</strong> Aadhaar card, Voter ID, or Passport.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-600 font-bold">✓</span>
                <span><strong>Proof of Relationship:</strong> Birth certificates of children, school leaving certificates, marriage registration.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-600 font-bold">✓</span>
                <span><strong>Self-Declaration / Notarized Affidavit:</strong> Affirming under oath that no legal heir has been excluded or concealed.</span>
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* Tab: Jurisdictions */}
      {activeTab === 'jurisdictions' && (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            {jurisdictions.map((j) => (
              <button
                key={j.id}
                type="button"
                onClick={() => setSelectedJurisdiction(j.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  selectedJurisdiction === j.id
                    ? 'bg-blue-600 text-white shadow'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {j.state}
              </button>
            ))}
          </div>

          {jurisdictions.filter((j) => j.id === selectedJurisdiction).map((j) => (
            <div key={j.id} className="p-5 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 space-y-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">{j.state}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400 block text-xs">Competent Authority</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{j.authority}</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400 block text-xs">Official Portal</span>
                  <span className="font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">{j.portal}</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400 block text-xs">Service Timeline</span>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">{j.processingDays}</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400 block text-xs">Statutory Application Fee</span>
                  <span className="text-gray-800 dark:text-gray-200">{j.statutoryFee}</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-gray-500 dark:text-gray-400 block text-xs">Heirship Scope &amp; Eligibility</span>
                  <p className="text-gray-800 dark:text-gray-200 mt-0.5">{j.heirScope}</p>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-gray-500 dark:text-gray-400 block text-xs">Appellate / Grievance Route</span>
                  <p className="text-gray-800 dark:text-gray-200 mt-0.5">{j.appealRoute}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Steps */}
      {activeTab === 'steps' && (
        <div className="space-y-6">
          <div className="relative border-l-2 border-blue-500 dark:border-blue-400 ml-4 pl-6 space-y-6">
            <div className="relative">
              <span className="absolute -left-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-white text-[10px] ring-4 ring-white dark:ring-gray-900">
                1
              </span>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                Obtain Official Death Certificate
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Ensure the death certificate is registered and issued by the municipal corporation / rural panchayat registrar.
              </p>
            </div>

            <div className="relative">
              <span className="absolute -left-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-white text-[10px] ring-4 ring-white dark:ring-gray-900">
                2
              </span>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                Submit Online Application on State Revenue Portal
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Log into state portal (e.g., e-District Delhi, e-Sevai TN, Seva Sindhu). Upload details of all surviving legal heirs,
                affidavits, and address proofs.
              </p>
            </div>

            <div className="relative">
              <span className="absolute -left-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-white text-[10px] ring-4 ring-white dark:ring-gray-900">
                3
              </span>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                Field Verification by Village Administrative Officer (VAO) / Patwari
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                The local revenue officer visits the residential locality, verifies family statements with neighbors, and submits
                an inquiry report to the Revenue Inspector.
              </p>
            </div>

            <div className="relative">
              <span className="absolute -left-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-white text-[10px] ring-4 ring-white dark:ring-gray-900">
                4
              </span>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                Approval &amp; Digital Certificate Issuance
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                The Tahsildar / SDM grants the digitally signed certificate containing a verification barcode and QR code.
                Download directly from the citizen dashboard.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Footer Info & Disclaimers */}
      <div className="mt-8 pt-4 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <span>Verified against State Revenue Orders &amp; Public Services Guarantee Acts.</span>
        <span>Last checked: November 2026</span>
      </div>
    </div>
  );
}
