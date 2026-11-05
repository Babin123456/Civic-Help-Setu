import React, { useState } from 'react';

/**
 * Land Record Record-of-Rights (RoR) & Certified Extract Guide Component
 * Explains India's fragmented land revenue records across states:
 * 7/12 & 8A (MH/GJ), Khatauni & Khasra (UP/MP/BR), Patta/Chitta & FMB (TN),
 * Jamabandi (PB/HR), and RTC/Pahani (KA), clearly differentiating
 * free informational online views from legally valid certified extracts.
 */
export default function LandRecordGuide() {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedStateSystem, setSelectedStateSystem] = useState('mh');

  const stateSystems = [
    {
      id: 'mh',
      region: 'Maharashtra & Gujarat',
      documentName: '7/12 Extract (Saat-Baara) & 8A',
      portal: 'Mahabhulekh (mahabhulekh.maharashtra.gov.in) / AnyRoR (anyror.gujarat.gov.in)',
      components: 'Village Form VII (ownership, liabilities, other rights) + Form XII (crop inspection / pik pahani)',
      cadastralUnit: 'Gat Number / Survey Number / Hissa Number',
      legalSignificance: 'Mandatory for agricultural subsidies, PM-Kisan, bank mortgages, and sale deed execution.'
    },
    {
      id: 'up',
      region: 'Uttar Pradesh, MP & Bihar',
      documentName: 'Khasra, Khatauni & Bhunaksha',
      portal: 'UP Bhulekh (upbhulekh.gov.in) / MP Bhulekh (mpbhulekh.gov.in)',
      components: 'Khatauni (RoR tenure-holder register, Bhumidhar rights) + Khasra (field survey & boundary register)',
      cadastralUnit: 'Gata Number / Fasli Year / Khata Number',
      legalSignificance: 'Reflects transferable vs non-transferable rights and recorded court injunctions/stays.'
    },
    {
      id: 'tn',
      region: 'Tamil Nadu',
      documentName: 'Patta, Chitta & FMB Sketch',
      portal: 'e-Services Revenue (eservices.tn.gov.in / AnyQuery)',
      components: 'Patta (owner title) + Chitta (wet/dry land tax classification) + Field Measurement Book (sketch)',
      cadastralUnit: 'Survey Number & Sub-Division Number',
      legalSignificance: 'FMB sketch required for property boundary verification and sub-division registration.'
    },
    {
      id: 'ka',
      region: 'Karnataka',
      documentName: 'RTC (Record of Rights, Tenancy & Crops / Pahani)',
      portal: 'Bhoomi Portal (bhoomi.karnataka.gov.in)',
      components: 'Pahani Form 16 detailing owner, survey number, soil class, tenancy rights, and seasonal crops',
      cadastralUnit: 'Survey Number / Surnoc / Hissa Number',
      legalSignificance: 'Bhoomi QR-coded RTC is the statutory standard for land transactions and mutation tracking.'
    },
    {
      id: 'pb',
      region: 'Punjab & Haryana',
      documentName: 'Jamabandi & Nakal',
      portal: 'PLRS Jamabandi (jamabandi.punjab.gov.in) / Jamabandi Haryana (jamabandi.nic.in)',
      components: 'Revised quadrennial record of rights listing Khewat, Khatoni, Khasra numbers, and share percentages',
      cadastralUnit: 'Khewat No. (owner group) / Khatoni No. (cultivator group) / Khasra No. (parcel)',
      legalSignificance: 'Specifies hypothecation, mortgage (rahin), and legal court restraints.'
    }
  ];

  return (
    <div className="land-record-guide max-w-4xl mx-auto p-6 bg-white dark:bg-gray-900 rounded-lg shadow-md border border-gray-200 dark:border-gray-800">
      <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            DILRMP (Digital India Land Records)
          </span>
          <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
            State Land Revenue Codes
          </span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Land Record Record-of-Rights (RoR) &amp; Certified Extract Guide
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm">
          A plain-language guide for Indian citizens navigating state land records (7/12, Khatauni, Patta/Chitta, RTC, Jamabandi),
          distinguishing free online copies from legally valid certified extracts, and tracking mutation (Dakhil Kharij).
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
          Overview &amp; Legal Framework
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('systems')}
          className={`py-2 px-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'systems'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          State-Specific Systems &amp; Portals
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('certified-vs-view')}
          className={`py-2 px-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'certified-vs-view'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          Informational View vs. Certified Extract
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('mutation')}
          className={`py-2 px-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'mutation'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          Mutation (Namantaran / Ferfar)
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
          How to Download Certified Copies
        </button>
      </div>

      {/* Tab: Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-950/40 rounded-lg border border-blue-200 dark:border-blue-900">
              <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-1">
                The Record-of-Rights (RoR) Concept
              </h3>
              <p className="text-sm text-blue-800 dark:text-blue-300">
                A Record of Rights (RoR) is the primary revenue document identifying the rightful legal occupants,
                nature of tenure, land parcel boundaries, and financial encumbrances recorded by the state revenue department.
              </p>
            </div>
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg border border-emerald-200 dark:border-emerald-900">
              <h3 className="font-semibold text-emerald-900 dark:text-emerald-200 mb-1">
                Presumptive Title in India
              </h3>
              <p className="text-sm text-emerald-800 dark:text-emerald-300">
                Under Indian law, land revenue registration establishes a <strong>presumptive title</strong>, not guaranteed
                conclusive ownership. It is rebuttable in civil courts if title fraud or disputed succession is established.
              </p>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800 p-5 rounded-lg border border-gray-200 dark:border-gray-700">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-3">
              What an RoR Record Proves vs. Does Not Prove
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <span className="font-medium text-emerald-700 dark:text-emerald-400">Legal Evidence Provided:</span>
                <ul className="list-disc pl-5 text-gray-600 dark:text-gray-300 space-y-1">
                  <li>Identifies the registered khatadar / landholder responsible for paying land revenue.</li>
                  <li>Delineates surveyed land area, soil categorization, and irrigation sources.</li>
                  <li>Discloses registered encumbrances, bank hypothecations, and ongoing revenue litigation.</li>
                </ul>
              </div>
              <div className="space-y-2">
                <span className="font-medium text-rose-700 dark:text-rose-400">What It Does Not Guarantee:</span>
                <ul className="list-disc pl-5 text-gray-600 dark:text-gray-300 space-y-1">
                  <li>Does NOT substitute for a registered Sale Deed, Gift Deed, or Probate of Will.</li>
                  <li>Does NOT extinguish unadjudicated claims of unregistered co-sharers or minor heirs.</li>
                  <li>Free web previews without digital signature are NOT admissible as legal evidence in court.</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="border border-gray-200 dark:border-gray-700 p-4 rounded-lg bg-white dark:bg-gray-900">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
              Statutory Revenue Hierarchy
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Land administration operates through a structured sub-district administrative hierarchy:
            </p>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded font-medium">
                Village Level: Talathi / Patwari / Village Administrative Officer (VAO)
              </span>
              <span className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded font-medium">
                Circle Level: Revenue Inspector (RI) / Circle Officer (CO)
              </span>
              <span className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded font-medium">
                Taluk/Tehsil Level: Tehsildar / Mamlatdar / Sub-Divisional Magistrate (SDM)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tab: State Systems */}
      {activeTab === 'systems' && (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            {stateSystems.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedStateSystem(s.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  selectedStateSystem === s.id
                    ? 'bg-blue-600 text-white shadow'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {s.region}
              </button>
            ))}
          </div>

          {stateSystems.filter((s) => s.id === selectedStateSystem).map((s) => (
            <div key={s.id} className="p-5 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">{s.documentName}</h3>
                <span className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-2.5 py-1 rounded">
                  {s.region}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400 block text-xs">Official State Portal</span>
                  <span className="font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">{s.portal}</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400 block text-xs">Cadastral Search Identifiers</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{s.cadastralUnit}</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-gray-500 dark:text-gray-400 block text-xs">Document Composition &amp; Records</span>
                  <p className="text-gray-800 dark:text-gray-200 mt-0.5">{s.components}</p>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-gray-500 dark:text-gray-400 block text-xs">Practical Legal Utility</span>
                  <p className="text-gray-800 dark:text-gray-200 mt-0.5">{s.legalSignificance}</p>
                </div>
              </div>
            </div>
          ))}

          <div className="p-4 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg border border-yellow-200 dark:border-yellow-900 text-sm">
            <h4 className="font-semibold text-yellow-900 dark:text-yellow-200 mb-1">
              Never Treat Regional Terms as Synonymous
            </h4>
            <p className="text-yellow-800 dark:text-yellow-300">
              A Maharashtra 7/12 extract contains dual agricultural registers (ownership and seasonal crop inspection),
              whereas a UP Khatauni solely records tenure rights, and a Tamil Nadu Patta is often accompanied by an FMB boundary sketch.
              Always use the local jurisdiction&apos;s exact nomenclature when requesting documents from revenue offices.
            </p>
          </div>
        </div>
      )}

      {/* Tab: Certified vs View */}
      {activeTab === 'certified-vs-view' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-5 bg-white dark:bg-gray-900">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs uppercase tracking-wide font-semibold text-amber-600 dark:text-amber-400">
                  Free Informational View
                </span>
                <span className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 px-2 py-0.5 rounded">
                  Non-Certified
                </span>
              </div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                Unsigned Web Copy / Public Search
              </h4>
              <ul className="text-sm space-y-2 text-gray-600 dark:text-gray-300">
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 font-bold">•</span>
                  <span><strong>Cost:</strong> Free of charge on state Bhulekh / Bhoomi portals.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 font-bold">•</span>
                  <span><strong>Purpose:</strong> Quick personal due diligence, verifying seller claims, checking survey numbers.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 font-bold">•</span>
                  <span><strong>Watermark:</strong> Watermarked with &quot;Informational Only / Not for Legal Use&quot;.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 font-bold">•</span>
                  <span><strong>Court Admissibility:</strong> NOT admissible as evidence under the Indian Evidence Act.</span>
                </li>
              </ul>
            </div>

            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-5 bg-white dark:bg-gray-900">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs uppercase tracking-wide font-semibold text-emerald-600 dark:text-emerald-400">
                  Certified Extract
                </span>
                <span className="text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 px-2 py-0.5 rounded">
                  Legal Admissibility
                </span>
              </div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                Digitally Signed Copy / Certified Nakal
              </h4>
              <ul className="text-sm space-y-2 text-gray-600 dark:text-gray-300">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 font-bold">•</span>
                  <span><strong>Cost:</strong> Nominal statutory fee (₹15 to ₹50 per extract depending on state).</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 font-bold">•</span>
                  <span><strong>Authentication:</strong> Cryptographic digital signature of Tehsildar / Talathi with verifiable QR code.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 font-bold">•</span>
                  <span><strong>Court Admissibility:</strong> Fully admissible under Section 65B of Evidence Act and Information Technology Act, 2000.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 font-bold">•</span>
                  <span><strong>Mandatory For:</strong> Property registration, bank mortgage / agricultural loan sanction, and revenue litigation.</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-900 text-sm">
            <h4 className="font-semibold text-blue-900 dark:text-blue-200 mb-1">
              How to Verify Authenticity via QR Code
            </h4>
            <p className="text-blue-800 dark:text-blue-300">
              All modern digitally signed land records include a tamper-proof QR code and a unique Document Verification Number (DVN).
              Any buyer or lending bank can scan the QR code with a smartphone camera to fetch the authentic PDF directly from the state data repository.
            </p>
          </div>
        </div>
      )}

      {/* Tab: Mutation */}
      {activeTab === 'mutation' && (
        <div className="space-y-6">
          <div className="p-4 bg-purple-50 dark:bg-purple-950/30 rounded-lg border border-purple-200 dark:border-purple-900">
            <h3 className="font-semibold text-purple-900 dark:text-purple-200 mb-1">
              What is Mutation (Namantaran / Dakhil Kharij / Ferfar)?
            </h3>
            <p className="text-sm text-purple-800 dark:text-purple-300">
              Mutation is the process of altering title entries in the Record-of-Rights following a change in ownership
              arising from a registered Sale Deed, inheritance/succession upon death of an owner, gift deed, partition, or court decree.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-900">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                Sale Deed vs. Mutation: The Common Pitfall
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                Executing and registering a Sale Deed at the Sub-Registrar Office (SRO) completes the legal transaction
                between buyer and seller, but it does NOT automatically update the local revenue register.
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Unless a formal mutation application is submitted and sanctioned by the Tehsildar, the seller&apos;s name remains
                on the 7/12 or Khatauni, posing risks of fraudulent secondary mortgaging or tax demands.
              </p>
            </div>

            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-900">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                The 30-Day Objection Notice Period
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                When a mutation entry is recorded (pencil entry / provisional ferfar), the Circle Officer issues a public
                notice inviting objections from co-sharers and interested parties within 15 to 30 days.
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                If no objection is lodged within the statutory window, the Tehsildar certifies the entry, making the new buyer
                the registered khatadar on the final RoR extract.
              </p>
            </div>
          </div>
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
                Identify District, Taluk/Tehsil, and Village
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Gather your cadastral coordinates: District name, Taluka / Tehsil, Village (Gaon), and Survey / Gata / Khasra number.
              </p>
            </div>

            <div className="relative">
              <span className="absolute -left-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-white text-[10px] ring-4 ring-white dark:ring-gray-900">
                2
              </span>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                Log into State Certified Land Records Portal
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Access your state&apos;s dedicated digital signature portal (e.g., <code>digitalsatbara.mahabhulekh.maharashtra.gov.in</code> or <code>bhoomi.karnataka.gov.in</code>).
                Sign in using your mobile number or citizen credentials.
              </p>
            </div>

            <div className="relative">
              <span className="absolute -left-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-white text-[10px] ring-4 ring-white dark:ring-gray-900">
                3
              </span>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                Search Parcel &amp; Confirm Khatadar Name
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Select your Village, enter the Survey/Gat number or Owner&apos;s name, and verify the displayed khatadar details.
              </p>
            </div>

            <div className="relative">
              <span className="absolute -left-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-white text-[10px] ring-4 ring-white dark:ring-gray-900">
                4
              </span>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                Pay Nominal Statutory Extraction Fee
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Recharge wallet or pay via UPI/NetBanking (typically ₹15 to ₹50). The fee covers digital signing and state archival maintenance.
              </p>
            </div>

            <div className="relative">
              <span className="absolute -left-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-white text-[10px] ring-4 ring-white dark:ring-gray-900">
                5
              </span>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                Download Digitally Signed PDF with QR Code
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Download the PDF certificate containing the DSC signature block and QR code. This document requires no physical seal
                from the Talathi or Tehsildar and is fully court-admissible.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Footer Info & Disclaimers */}
      <div className="mt-8 pt-4 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <span>Verified against Ministry of Rural Development DILRMP &amp; State Revenue Department portals.</span>
        <span>Last checked: November 2026</span>
      </div>
    </div>
  );
}
