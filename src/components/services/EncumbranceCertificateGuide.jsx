import React, { useState } from 'react';

/**
 * Encumbrance Certificate (EC) Application & Period Selection Guide Component
 * Provides comprehensive, scannable guidance for Indian property buyers, borrowers,
 * and owners on applying for an EC via state registration portals (TNREGINET, Kaveri 2.0,
 * Dharani/IGRS, Meebhoomi/IGRS), understanding Form 15 vs. Form 16 (Nil EC), selecting
 * adequate search periods, and recognizing critical title limitations.
 */
export default function EncumbranceCertificateGuide() {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedState, setSelectedState] = useState('tn');

  const statePortals = [
    {
      id: 'tn',
      state: 'Tamil Nadu',
      portal: 'TNREGINET (tnreginet.gov.in)',
      digitizedSince: '1975 onwards (varies slightly by SRO)',
      searchIdentifiers: 'Zone, District, Sub-Registrar Office, Village, Survey No., Sub-Division No.',
      feeStructure: 'Free online viewing; nominal ₹1 to ₹10 search fee + ₹100 certified extract fee',
      forms: 'Form 15 (Encumbrance found) / Form 16 (Nil Encumbrance Certificate)'
    },
    {
      id: 'ka',
      state: 'Karnataka',
      portal: 'Kaveri 2.0 (kaverionline.karnataka.gov.in)',
      digitizedSince: '2004 onwards (older records available offline)',
      searchIdentifiers: 'District, SRO, Property Type (Site/Flat/Agricultural), Survey / Plot / Khata No.',
      feeStructure: 'First year ₹10; subsequent years nominal; ₹50 to ₹150 certified digitally signed copy',
      forms: 'Form 15 (Encumbered) / Form 16 (Nil Encumbrance Certificate)'
    },
    {
      id: 'tg_ap',
      state: 'Telangana & Andhra Pradesh',
      portal: 'IGRS Telangana (registration.telangana.gov.in) / IGRS AP',
      digitizedSince: '1983 onwards across all computerised sub-registrar offices',
      searchIdentifiers: 'Document Number & Year or District, Mandal, Village, Plot / Survey No.',
      feeStructure: 'Approx. ₹25 to ₹50 per standard 30-year search window',
      forms: 'Standard Statement of Encumbrance on Property'
    },
    {
      id: 'mh',
      state: 'Maharashtra',
      portal: 'e-Search IGR Maharashtra (igrmaharashtra.gov.in)',
      digitizedSince: '2002 onwards (e-Search Free & Paid modules)',
      searchIdentifiers: 'District, Taluka, Village, Survey No. / CTS No. / Flat No.',
      feeStructure: 'Free basic index search; paid e-Search for certified Index-II copies',
      forms: 'Search Report / Index II Inspection Extract'
    }
  ];

  return (
    <div className="encumbrance-certificate-guide max-w-4xl mx-auto p-6 bg-white dark:bg-gray-900 rounded-lg shadow-md border border-gray-200 dark:border-gray-800">
      <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            Registration Act, 1908 (Sec 57)
          </span>
          <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
            Sub-Registrar Office (Book 1 Search)
          </span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Encumbrance Certificate (EC) Application Guide
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm">
          A citizen handbook for obtaining an Encumbrance Certificate (Form 15 vs. Form 16 Nil EC), choosing the right search window
          (13–35 years), verifying property transactions, and understanding critical title limitations.
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
          Overview &amp; Form 15 vs 16
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('period')}
          className={`py-2 px-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'period'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          Search Period Selection
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('limitations')}
          className={`py-2 px-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'limitations'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          Title Limitations &amp; Caveats
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('portals')}
          className={`py-2 px-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'portals'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          State Registration Portals
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
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg border border-emerald-200 dark:border-emerald-900">
              <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider block mb-1">
                Form 15: Transactions Found
              </span>
              <h3 className="font-semibold text-emerald-900 dark:text-emerald-200 mb-1">
                Standard Encumbrance Certificate
              </h3>
              <p className="text-sm text-emerald-800 dark:text-emerald-300">
                Issued when registered transactions (sale deeds, gift deeds, simple mortgages, court attachments, or partition deeds)
                affecting the property are found in Book 1 during the requested search duration.
              </p>
            </div>

            <div className="p-4 bg-blue-50 dark:bg-blue-950/40 rounded-lg border border-blue-200 dark:border-blue-900">
              <span className="text-xs font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wider block mb-1">
                Form 16: Zero Transactions Found
              </span>
              <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-1">
                Nil Encumbrance Certificate (NEC)
              </h3>
              <p className="text-sm text-blue-800 dark:text-blue-300">
                Issued when the Sub-Registrar&apos;s records reveal no registered encumbrance or transaction on the property
                during the queried search window. Essential for home loan approvals and clear title verification.
              </p>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800 p-5 rounded-lg border border-gray-200 dark:border-gray-700">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-3">
              What an Encumbrance Certificate (EC) Proves vs. Does Not Prove
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <span className="font-medium text-emerald-700 dark:text-emerald-400">What It Proves:</span>
                <ul className="list-disc pl-5 text-gray-600 dark:text-gray-300 space-y-1">
                  <li>Chronological list of all non-testamentary registered transactions in Book 1 at the SRO.</li>
                  <li>Names of registered executants (sellers/mortgagors) and claimants (buyers/lenders).</li>
                  <li>Registered mortgage hypothecations and officially communicated court attachment orders.</li>
                </ul>
              </div>
              <div className="space-y-2">
                <span className="font-medium text-rose-700 dark:text-rose-400">What It Does NOT Prove:</span>
                <ul className="list-disc pl-5 text-gray-600 dark:text-gray-300 space-y-1">
                  <li>Does NOT guarantee unblemished legal title (is not a title policy or conclusive ownership guarantee).</li>
                  <li>Does NOT reveal unregistered equitable mortgages or unregistered agreements of sale.</li>
                  <li>Does NOT include Testamentary Wills (registered in Book 3) or unadjudicated legal heir claims.</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="border border-gray-200 dark:border-gray-700 p-4 rounded-lg bg-white dark:bg-gray-900">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
              Statutory Authority Reference
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Applications are administered by the State Registration and Stamps Department (Inspector General of Registration - IGR)
              under Section 57 of the Registration Act, 1908.
            </p>
          </div>
        </div>
      )}

      {/* Tab: Period Selection */}
      {activeTab === 'period' && (
        <div className="space-y-6">
          <div className="p-4 bg-purple-50 dark:bg-purple-950/30 rounded-lg border border-purple-200 dark:border-purple-900">
            <h3 className="font-semibold text-purple-900 dark:text-purple-200 mb-1">
              Selecting the Proper Search Window (From Date to To Date)
            </h3>
            <p className="text-sm text-purple-800 dark:text-purple-300">
              Choosing an inadequate search period is one of the most frequent citizen mistakes, often leading to loan rejection
              or overlooked ancestral encumbrances.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
              <span className="text-xs uppercase tracking-wide font-semibold text-blue-600 dark:text-blue-400 block mb-1">
                Standard Bank Loan
              </span>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                13 to 15 Years
              </h4>
              <p className="text-xs text-gray-600 dark:text-gray-300">
                Mandated by scheduled commercial banks and housing finance corporations (HFCs) for standard home loan underwriting
                and title clearance.
              </p>
            </div>

            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
              <span className="text-xs uppercase tracking-wide font-semibold text-emerald-600 dark:text-emerald-400 block mb-1">
                Property Acquisition
              </span>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                30 to 35 Years
              </h4>
              <p className="text-xs text-gray-600 dark:text-gray-300">
                Recommended by property advocates for outright purchase, ensuring title can be traced continuously through statutory
                limitation periods (Article 65 of Limitation Act).
              </p>
            </div>

            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
              <span className="text-xs uppercase tracking-wide font-semibold text-amber-600 dark:text-amber-400 block mb-1">
                Ancestral / Partition
              </span>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                Full Digitized Limit
              </h4>
              <p className="text-xs text-gray-600 dark:text-gray-300">
                Back to the earliest digitized year in the SRO database (e.g. 1975 in TN, 1983 in TG/AP) to detect ancestral partition agreements.
              </p>
            </div>
          </div>

          <div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-900 text-sm">
            <h4 className="font-semibold text-amber-900 dark:text-amber-200 mb-1">
              Digitized vs. Manual Search Periods
            </h4>
            <p className="text-amber-800 dark:text-amber-300">
              Online search is strictly limited to records digitized by the respective state. If you require a search period
              dating prior to computerized entries (e.g., prior to 1983 in Andhra/Telangana or prior to 2004 in certain Karnataka taluks),
              you must file a physical Form 22 application at the jurisdictional Sub-Registrar Office for a manual register search.
            </p>
          </div>
        </div>
      )}

      {/* Tab: Limitations */}
      {activeTab === 'limitations' && (
        <div className="space-y-6">
          <div className="p-4 bg-rose-50 dark:bg-rose-950/30 rounded-lg border border-rose-200 dark:border-rose-900">
            <h3 className="font-semibold text-rose-900 dark:text-rose-200 mb-1">
              Critical Warning: What an EC Will Never Reveal
            </h3>
            <p className="text-sm text-rose-800 dark:text-rose-300">
              Citizens often mistake a &quot;Nil Encumbrance Certificate&quot; for complete immunity against title defects.
              An EC only reflects entries in Book 1 of the Sub-Registrar Office; it cannot disclose off-record liabilities.
            </p>
          </div>

          <div className="space-y-3">
            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
              <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-1">
                1. Unregistered Equitable Mortgages (Deposit of Title Deeds)
              </h4>
              <p className="text-xs text-gray-600 dark:text-gray-300">
                In states where registration of memorandum of deposit of title deeds was not strictly enforced historically,
                informal bank loans or private financier liens will not appear in SRO Book 1.
              </p>
            </div>

            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
              <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-1">
                2. Testamentary Documents (Wills &amp; Codicils)
              </h4>
              <p className="text-xs text-gray-600 dark:text-gray-300">
                Wills are registered in Book 3 and remain confidential during the testator&apos;s lifetime. They are never indexed
                in Book 1 property searches and will never be shown on an EC.
              </p>
            </div>

            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
              <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-1">
                3. Unnotified Court Injunctions &amp; Civil Suits (Lis Pendens)
              </h4>
              <p className="text-xs text-gray-600 dark:text-gray-300">
                Pending civil suits or stay orders before Civil Courts will only appear if a formal notice under Section 52 of
                Transfer of Property Act was registered at the SRO.
              </p>
            </div>

            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
              <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-1">
                4. Statutory Tax Liens &amp; Municipal Dues
              </h4>
              <p className="text-xs text-gray-600 dark:text-gray-300">
                Arrears of property tax, electricity dues, water rates, or betterment charges are local municipal liabilities
                and never get recorded in the Registration Department&apos;s books.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Portals */}
      {activeTab === 'portals' && (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            {statePortals.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedState(s.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  selectedState === s.id
                    ? 'bg-blue-600 text-white shadow'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {s.state}
              </button>
            ))}
          </div>

          {statePortals.filter((s) => s.id === selectedState).map((s) => (
            <div key={s.id} className="p-5 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 space-y-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">{s.state} Registration Services</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400 block text-xs">Official Registration Portal</span>
                  <span className="font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">{s.portal}</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400 block text-xs">Digitized Coverage</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{s.digitizedSince}</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-gray-500 dark:text-gray-400 block text-xs">Mandatory Search Identifiers</span>
                  <p className="text-gray-800 dark:text-gray-200 mt-0.5">{s.searchIdentifiers}</p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400 block text-xs">Fee Structure</span>
                  <span className="text-gray-800 dark:text-gray-200">{s.feeStructure}</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400 block text-xs">Forms Issued</span>
                  <span className="text-gray-800 dark:text-gray-200">{s.forms}</span>
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
                Gather Property Identifiers
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Retrieve accurate property identifiers: Sub-Registrar Office (SRO) name, Village / Revenue Ward,
                Survey Number, Sub-Division Number, Plot Number, or Flat Number from the parent deed.
              </p>
            </div>

            <div className="relative">
              <span className="absolute -left-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-white text-[10px] ring-4 ring-white dark:ring-gray-900">
                2
              </span>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                Access State IGR Portal &amp; Select Search Duration
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Log into portal (e.g., <code>tnreginet.gov.in</code>, <code>kaverionline.karnataka.gov.in</code>).
                Select Search / View EC. Enter &quot;Search From Date&quot; and &quot;Search To Date&quot; (recommended 15 to 30 years).
              </p>
            </div>

            <div className="relative">
              <span className="absolute -left-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-white text-[10px] ring-4 ring-white dark:ring-gray-900">
                3
              </span>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                Review Search Results (Free Informational View)
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Inspect the chronological list of registered deeds. Verify document numbers, execution dates, and claimant details.
              </p>
            </div>

            <div className="relative">
              <span className="absolute -left-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-white text-[10px] ring-4 ring-white dark:ring-gray-900">
                4
              </span>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                Apply for Digitally Signed Certified Copy &amp; Pay Statutory Fee
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                For legal, court, or bank mortgage purposes, apply for a Certified Copy. Pay the statutory fee online via payment gateway.
              </p>
            </div>

            <div className="relative">
              <span className="absolute -left-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-white text-[10px] ring-4 ring-white dark:ring-gray-900">
                5
              </span>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                Download Certified EC (Form 15 / Form 16) with QR Code
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Download the official PDF with cryptographic DSC signature and QR code. Valid in courts and accepted by all banks.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Footer Info & Disclaimers */}
      <div className="mt-8 pt-4 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <span>Verified against Registration Act, 1908 &amp; State IGR guidelines.</span>
        <span>Last checked: November 2026</span>
      </div>
    </div>
  );
}
