import React, { useState } from 'react';

/**
 * Land Mutation (Dakhil Kharij / Ferfar / Namantaran) Citizen Guide Component
 * Explains India's statutory land revenue mutation processes covering:
 * - Sale / registered deed transfer
 * - Inheritance / succession (Wirasat / Varasai)
 * - Gift and family partition (Batwara)
 * - Objection windows, revenue courts, and clear caveat that mutation != title guarantee.
 */
export default function LandMutationGuide() {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedRoute, setSelectedRoute] = useState('sale');

  const routes = [
    {
      id: 'sale',
      title: 'Sale / Transfer Deed Route',
      trigger: 'Execution and registration of Sale Deed / Gift Deed at Sub-Registrar Office (SRO)',
      forms: 'Online Dakhil-Kharij Application / J-Slip Transmission / Form 21',
      statutoryWindow: '15 to 35 days public notice window for claims/objections',
      processingTime: 'Undisputed: 30 to 45 days; Contested: Subject to Tehsildar court hearings',
      keyDocuments: [
        'Registered Sale Deed / Title Deed copy (Certified copy from SRO)',
        'Latest Land Revenue / Khata Tax payment receipt',
        'Identity & Address Proof of Purchaser and Vendor (Aadhaar / Voter ID)',
        'Affidavit affirming no ceiling violation and undisputed possession'
      ],
      cautionNote: 'Auto-mutation via SRO does not dispense with checking if local public notice was issued and certified.'
    },
    {
      id: 'inheritance',
      title: 'Inheritance / Succession (Wirasat / Varasai)',
      trigger: 'Demise of registered khatadar / landholder leaving legal heirs',
      forms: 'Succession Form (e.g., UP Revenue Code Sec 33 Wirasat portal / Form 6)',
      statutoryWindow: 'Must be reported within statutory window (typically 30-90 days from demise)',
      processingTime: 'Undisputed Wirasat: 15 to 30 days via Revenue Inspector verification',
      keyDocuments: [
        'Death Certificate of the deceased khatadar (issued by Registrar of Births & Deaths)',
        'Legal Heir Certificate / Surviving Member Certificate or Registered Family Tree (Vanshavali)',
        'Affidavit by applicant declaring all surviving Class-I legal heirs (no heir concealed)',
        'RoR copy (Khatauni / 7/12 extract) showing deceased name'
      ],
      cautionNote: 'Succession based on an unregistered Will often requires Civil Court adjudication if contested by legal heirs.'
    },
    {
      id: 'partition',
      title: 'Partition / Division (Batwara)',
      trigger: 'Mutual agreement or court-directed split of co-owned ancestral or joint property',
      forms: 'Section 116 Application (or state equivalent revenue partition petition)',
      statutoryWindow: 'Notice to all recorded co-tenure holders with 30-day response window',
      processingTime: '6 to 18 months (involves spot inspection, Kurra preparation, and registry split)',
      keyDocuments: [
        'Joint RoR (Khatauni / 7/12) showing all co-sharers and total area',
        'Cadastral Map / Khasra map showing proposed physical boundaries (Kurra)',
        'Mutual Partition Deed (registered) or Civil Court final decree'
      ],
      cautionNote: 'Unregistered family oral partitions cannot alter official RoR without formal revenue sanction.'
    },
    {
      id: 'court',
      title: 'Court Decree / Execution',
      trigger: 'Final judgment and decree passed by Civil Court or Revenue Appellate Authority',
      forms: 'Decree Execution Application under State Land Revenue Code',
      statutoryWindow: 'Limitation Act timelines apply for execution of civil decrees',
      processingTime: '45 to 90 days following receipt of certified decree',
      keyDocuments: [
        'Certified copy of Court Judgment and Final Decree',
        'Certificate of Non-Appeal / Finality from the trial court',
        'Current RoR and cadastral coordinates of subject parcel'
      ],
      cautionNote: 'Revenue authority will verify whether an interim stay has been granted by high appellate courts.'
    }
  ];

  return (
    <div className="land-mutation-guide max-w-4xl mx-auto p-6 bg-white dark:bg-gray-900 rounded-lg shadow-md border border-gray-200 dark:border-gray-800">
      <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            DILRMP &amp; State Revenue Codes
          </span>
          <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
            Fiscal Land Assessment Entry
          </span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Land Mutation (Dakhil Kharij / Ferfar) Guide
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm">
          A step-by-step procedural manual for updating titleholder records in state land registers following sale deeds,
          inheritance/succession (Wirasat), family partition, or court decrees.
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
          Overview &amp; Legal Nature
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('routes')}
          className={`py-2 px-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'routes'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          Sale vs. Inheritance Routes
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('stages')}
          className={`py-2 px-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'stages'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          Notice &amp; Objection Stages
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('authorities')}
          className={`py-2 px-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'authorities'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          State Portals &amp; Revenue Offices
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
          <div className="p-4 bg-amber-50 dark:bg-amber-950/40 rounded-lg border border-amber-200 dark:border-amber-900">
            <h3 className="font-semibold text-amber-900 dark:text-amber-200 mb-1">
              Fundamental Legal Principle: Mutation is NOT Conclusive Proof of Title
            </h3>
            <p className="text-sm text-amber-800 dark:text-amber-300">
              The Supreme Court of India has reiterated in landmark judgments (including <em>Bhimabai Mahadeo Kambekar v. Arthur Import and Export Company</em> and <em>Sawarni v. Inder Kaur</em>)
              that <strong>mutation entries in revenue records do not confer, create, extinguish, or prove title to property</strong>.
              Mutation is solely an administrative entry enabling the State to identify who is responsible for paying land revenue.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-950/40 rounded-lg border border-blue-200 dark:border-blue-900">
              <h4 className="font-semibold text-blue-900 dark:text-blue-200 text-sm mb-1">
                Why Mutation is Crucial for Buyers
              </h4>
              <p className="text-sm text-blue-800 dark:text-blue-300">
                While registered Sale Deeds transfer legal ownership, failure to mutate the entry leaves the seller&apos;s name
                in the official Record-of-Rights (RoR). This exposes the buyer to fraudulent secondary mortgages or illegal sales by the erstwhile seller.
              </p>
            </div>
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg border border-emerald-200 dark:border-emerald-900">
              <h4 className="font-semibold text-emerald-900 dark:text-emerald-200 text-sm mb-1">
                Wirasat (Succession) Imperative
              </h4>
              <p className="text-sm text-emerald-800 dark:text-emerald-300">
                Following the death of a landowner, failing to record succession allows deceased names to remain in revenue records
                (fauti khata), blocking successors from availing crop loans, insurance payouts, or legitimate land sales.
              </p>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800 p-5 rounded-lg border border-gray-200 dark:border-gray-700">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-3">
              What Mutation Establishes vs. Does Not Establish
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <span className="font-medium text-emerald-700 dark:text-emerald-400">What It Establishes:</span>
                <ul className="list-disc pl-5 text-gray-600 dark:text-gray-300 space-y-1">
                  <li>Fiscal liability to discharge land revenue and local cess.</li>
                  <li>Inclusion of the applicant&apos;s name as khatadar on current 7/12, Khatauni, or RTC.</li>
                  <li>Eligibility for government agricultural schemes (e.g. PM-KISAN, crop compensation).</li>
                </ul>
              </div>
              <div className="space-y-2">
                <span className="font-medium text-rose-700 dark:text-rose-400">What It Does Not Establish:</span>
                <ul className="list-disc pl-5 text-gray-600 dark:text-gray-300 space-y-1">
                  <li>Does NOT override civil court ownership decrees or declaration of title.</li>
                  <li>Does NOT validate a defective, forged, or void registered deed.</li>
                  <li>Does NOT extinguish co-sharer inheritance rights if concealed during application.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Routes */}
      {activeTab === 'routes' && (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            {routes.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelectedRoute(r.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  selectedRoute === r.id
                    ? 'bg-blue-600 text-white shadow'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {r.title}
              </button>
            ))}
          </div>

          {routes.filter((r) => r.id === selectedRoute).map((r) => (
            <div key={r.id} className="p-5 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 space-y-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">{r.title}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400 block text-xs">Triggering Event</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{r.trigger}</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400 block text-xs">Prescribed Form / Mechanism</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{r.forms}</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400 block text-xs">Public Notice / Objection Window</span>
                  <span className="font-semibold text-amber-700 dark:text-amber-400">{r.statutoryWindow}</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400 block text-xs">Typical Processing Timeline</span>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">{r.processingTime}</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-gray-500 dark:text-gray-400 block text-xs mb-1">Required Supporting Documents</span>
                  <ul className="list-disc pl-5 text-gray-800 dark:text-gray-200 space-y-1">
                    {r.keyDocuments.map((doc, idx) => (
                      <li key={idx}>{doc}</li>
                    ))}
                  </ul>
                </div>
                <div className="sm:col-span-2 p-3 bg-red-50 dark:bg-red-950/30 rounded border border-red-200 dark:border-red-900 text-xs text-red-800 dark:text-red-300">
                  <strong>Cautionary Advisory:</strong> {r.cautionNote}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Notice & Objection Stages */}
      {activeTab === 'stages' && (
        <div className="space-y-6">
          <div className="p-4 bg-purple-50 dark:bg-purple-950/30 rounded-lg border border-purple-200 dark:border-purple-900">
            <h3 className="font-semibold text-purple-900 dark:text-purple-200 mb-1">
              The Statutory Notice &amp; Revenue Court Journey
            </h3>
            <p className="text-sm text-purple-800 dark:text-purple-300">
              Mutation is a quasi-judicial revenue proceeding designed to safeguard public interest and notify interested parties
              before altering land entries.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
              <span className="text-xs uppercase tracking-wide font-semibold text-blue-600 dark:text-blue-400 block mb-1">
                Stage 1: Public Proclamation (Istihar)
              </span>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                The 15 to 35-Day Objection Window
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                Upon filing of the application, the Revenue Inspector / Tehsildar issues a public notice posted at the Gram Panchayat / Tehsil office and sent to interested parties.
              </p>
              <ul className="text-xs list-disc pl-4 text-gray-500 dark:text-gray-400 space-y-1">
                <li>Citizens or co-sharers may file formal written objections against the mutation.</li>
                <li>Grounds: Impersonation, boundary dispute, pending civil suit stay, or undisclosed heirs.</li>
              </ul>
            </div>

            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
              <span className="text-xs uppercase tracking-wide font-semibold text-amber-600 dark:text-amber-400 block mb-1">
                Stage 2: Undisputed vs. Contested
              </span>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                Conversion to Contested Proceeding
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                If no objection is lodged within the notice window, the Naib-Tehsildar issues a summary sanction order.
              </p>
              <ul className="text-xs list-disc pl-4 text-gray-500 dark:text-gray-400 space-y-1">
                <li>If an objection is submitted, the matter becomes a <strong>contested revenue suit (Vivadit Dakhil Kharij)</strong>.</li>
                <li>Formal dates are scheduled; both parties submit evidence and oral arguments.</li>
              </ul>
            </div>
          </div>

          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-2">
              Appeals &amp; Revisions (Up to Board of Revenue)
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
              An aggrieved party can challenge a Tehsildar&apos;s mutation order under the State Land Revenue Code:
            </p>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="px-2.5 py-1 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded">
                1st Appeal: Sub-Divisional Officer (SDO) / Sub-Collector (within 30 days)
              </span>
              <span className="px-2.5 py-1 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded">
                Revision: Additional District Magistrate (ADM) / District Collector
              </span>
              <span className="px-2.5 py-1 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded">
                Final Board: State Board of Revenue (Revenue Council)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Authorities & Portals */}
      {activeTab === 'authorities' && (
        <div className="space-y-6">
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">State / Territory</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Regional Nomenclature</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Official Portal</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Statutory Fee</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                <tr>
                  <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">Uttar Pradesh</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">Dakhil Kharij / Wirasat</td>
                  <td className="px-4 py-3 font-mono text-xs text-blue-600 dark:text-blue-400">vaad.up.nic.in / upbhulekh.gov.in</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">₹35 - ₹100 per gata</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">Maharashtra</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">Ferfar (Hakk-Sod / Varas)</td>
                  <td className="px-4 py-3 font-mono text-xs text-blue-600 dark:text-blue-400">ecourts.gov.in / mahabhulekh.maharashtra.gov.in</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">Free / nominal ₹50 fee</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">Karnataka</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">Namantaran / RTC Mutation</td>
                  <td className="px-4 py-3 font-mono text-xs text-blue-600 dark:text-blue-400">bhoomi.karnataka.gov.in</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">₹30 to ₹60 per entry</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">West Bengal</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">Mutation &amp; Conversion</td>
                  <td className="px-4 py-3 font-mono text-xs text-blue-600 dark:text-blue-400">banglarbhumi.gov.in</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">Pro-rata per decimal (rural/urban)</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-300">
            <strong>Revenue Hierarchy Note:</strong> Applications originate at the Village/Halqa level with the Talathi/Patwari,
            verification is conducted by the Revenue Inspector (Kanungo), and orders are passed by the Naib-Tehsildar or Tehsildar.
          </div>
        </div>
      )}

      {/* Tab: Application Steps */}
      {activeTab === 'steps' && (
        <div className="space-y-6">
          <div className="relative border-l-2 border-blue-500 dark:border-blue-400 ml-4 pl-6 space-y-6">
            <div className="relative">
              <span className="absolute -left-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-white text-[10px] ring-4 ring-white dark:ring-gray-900">
                1
              </span>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                Execute Registered Deed or Secure Succession Documents
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                For sale transactions, register the deed at the SRO and obtain the certified index/deed copy. For inheritance,
                obtain the official Death Certificate and Surviving Member/Legal Heir Certificate.
              </p>
            </div>

            <div className="relative">
              <span className="absolute -left-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-white text-[10px] ring-4 ring-white dark:ring-gray-900">
                2
              </span>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                Submit Online Mutation Filing on State Revenue Portal
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Access the state portal (e.g. <code>vaad.up.nic.in</code>, <code>bhoomi.karnataka.gov.in</code>).
                Select District, Tehsil, Pargana, and Village. Enter Khasra/Gata number and applicant details.
              </p>
            </div>

            <div className="relative">
              <span className="absolute -left-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-white text-[10px] ring-4 ring-white dark:ring-gray-900">
                3
              </span>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                Issuance of Public Notice &amp; 15-35 Day Objection Period
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                The revenue system generates an official proclamation notice. Ensure notice service is completed.
                Monitor case status for any third-party objection.
              </p>
            </div>

            <div className="relative">
              <span className="absolute -left-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-white text-[10px] ring-4 ring-white dark:ring-gray-900">
                4
              </span>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                Field Verification &amp; Spot Report by Patwari / RI
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                The local Revenue Inspector conducts physical possession verification and verifies no violation of state land ceilings or tribal land transfer bans.
              </p>
            </div>

            <div className="relative">
              <span className="absolute -left-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-white text-[10px] ring-4 ring-white dark:ring-gray-900">
                5
              </span>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                Sanction Order &amp; Record of Rights Update
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                The Tehsildar / Naib-Tehsildar signs the mutation order. The record is updated in the central database,
                allowing the citizen to download an updated digitally signed 7/12, Khatauni, or RTC.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Footer Info & Disclaimers */}
      <div className="mt-8 pt-4 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <span>Verified against State Land Revenue Codes &amp; Supreme Court judicial guidelines.</span>
        <span>Last checked: November 2026</span>
      </div>
    </div>
  );
}
