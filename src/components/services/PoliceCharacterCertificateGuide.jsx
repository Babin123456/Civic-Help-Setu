import React, { useState } from 'react';

/**
 * State Police Character Certificate Guide Component
 * Explains domestic police background verification for employment, contract tenders,
 * and tenant/driver vetting through state CCTNS portals (Delhi Police, UPCOP, Maharashtra, KSP).
 * Clearly distinguishes it from Passport Seva PCC for international travel.
 */
export default function PoliceCharacterCertificateGuide() {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedState, setSelectedState] = useState('delhi');

  const statePoliceSystems = [
    {
      id: 'delhi',
      state: 'Delhi Police',
      portal: 'delhipolice.gov.in (PCC Citizen Module)',
      fee: '₹250 per applicant',
      timeline: '7 to 15 working days',
      jurisdiction: 'Jurisdictional Police Station based on present residential address in NCT of Delhi',
      inquiryMode: 'Database CCTNS check + beat constable spot inquiry report',
      validity: 'Typically 6 months to 1 year per receiving employer requirements'
    },
    {
      id: 'up',
      state: 'Uttar Pradesh (UPCOP)',
      portal: 'uppolice.gov.in / UPCOP Mobile App',
      fee: '₹50 standard statutory fee',
      timeline: '10 to 15 working days under UP Janhit Guarantee Act',
      jurisdiction: 'Thana (Police Station) of current or permanent residence in UP',
      inquiryMode: 'Online beat officer verification report and local criminal history clearance',
      validity: 'As requested by receiving entity (no indefinite statutory validity)'
    },
    {
      id: 'mh',
      state: 'Maharashtra Police',
      portal: 'aaplesarkar.mahaonline.gov.in / mahapolice.gov.in',
      fee: '₹100 to ₹150 nominal processing charge',
      timeline: '15 to 21 working days',
      jurisdiction: 'City Police Commissionerate / District SP office',
      inquiryMode: 'Special Branch (SB) and local police station record verification',
      validity: 'Issued for specific designated purpose (employment / tender / license)'
    },
    {
      id: 'ka',
      state: 'Karnataka State Police (KSP)',
      portal: 'ksp.karnataka.gov.in (Police Verification Certificate - PVC)',
      fee: '₹100 (students/general) to ₹250 (private employees)',
      timeline: '14 working days under Sakala Services Act',
      jurisdiction: 'Jurisdictional City / District Police Station',
      inquiryMode: 'Crime and Criminal Tracking Network and local crime register check',
      validity: '1 year from date of digital issue'
    }
  ];

  return (
    <div className="police-character-guide max-w-4xl mx-auto p-6 bg-white dark:bg-gray-900 rounded-lg shadow-md border border-gray-200 dark:border-gray-800">
      <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            State Police Acts &amp; Regulations
          </span>
          <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
            Domestic Employment &amp; Tenancy
          </span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          State Police Character Certificate Guide
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm">
          A citizen guide for domestic employment background checks, commercial driver licensing, contract tenders,
          and tenant verification issued by state police commissionerates through CCTNS portals.
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
          onClick={() => setActiveTab('state-systems')}
          className={`py-2 px-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'state-systems'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          State Police Portals &amp; Fees
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('passport-distinction')}
          className={`py-2 px-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'passport-distinction'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          Distinction from Passport PCC
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('documents')}
          className={`py-2 px-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'documents'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          Required Evidence &amp; Verification
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
          Online Application Journey
        </button>
      </div>

      {/* Tab: Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-950/40 rounded-lg border border-blue-200 dark:border-blue-900">
              <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-1">
                Executive Purpose of Character Certificate
              </h3>
              <p className="text-sm text-blue-800 dark:text-blue-300">
                Issued by the local Superintendent of Police (SP) or Commissioner of Police to certify that, based on police records
                and local verification, the applicant has no adverse criminal antecedents or pending trials.
              </p>
            </div>
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg border border-emerald-200 dark:border-emerald-900">
              <h3 className="font-semibold text-emerald-900 dark:text-emerald-200 mb-1">
                Primary Domestic Use Cases
              </h3>
              <p className="text-sm text-emerald-800 dark:text-emerald-300">
                Mandatory for pre-employment screening in private IT/finance firms, security guard badges, commercial cab drivers,
                educational institution staff, government contract tenders, and domestic tenancy.
              </p>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800 p-5 rounded-lg border border-gray-200 dark:border-gray-700">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-3">
              What a State Police Character Certificate Establishes vs. Does Not Establish
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <span className="font-medium text-emerald-700 dark:text-emerald-400">What It Establishes:</span>
                <ul className="list-disc pl-5 text-gray-600 dark:text-gray-300 space-y-1">
                  <li>Absence of recorded FIRs, charge-sheets, or convictions in the state CCTNS crime repository.</li>
                  <li>Residential physical presence verified by the jurisdictional beat constable.</li>
                  <li>Official good-character clearance required by corporate HR or regulatory licensing boards.</li>
                </ul>
              </div>
              <div className="space-y-2">
                <span className="font-medium text-rose-700 dark:text-rose-400">What It Does NOT Establish:</span>
                <ul className="list-disc pl-5 text-gray-600 dark:text-gray-300 space-y-1">
                  <li>Does NOT substitute for MEA Passport Seva PCC for foreign immigration or overseas visas.</li>
                  <li>Does NOT constitute a permanent national good-conduct card (validity is time-bound).</li>
                  <li>Does NOT shield against future criminal prosecution if offenses occur post-issuance.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: State Systems */}
      {activeTab === 'state-systems' && (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            {statePoliceSystems.map((s) => (
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

          {statePoliceSystems.filter((s) => s.id === selectedState).map((s) => (
            <div key={s.id} className="p-5 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 space-y-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">{s.state} Verification Process</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400 block text-xs">Official Portal / App</span>
                  <span className="font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">{s.portal}</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400 block text-xs">Statutory Application Fee</span>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">{s.fee}</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400 block text-xs">Service Guarantee Timeline</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{s.timeline}</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400 block text-xs">Jurisdiction Basis</span>
                  <span className="text-gray-800 dark:text-gray-200">{s.jurisdiction}</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-gray-500 dark:text-gray-400 block text-xs">Verification Mode</span>
                  <p className="text-gray-800 dark:text-gray-200 mt-0.5">{s.inquiryMode}</p>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-gray-500 dark:text-gray-400 block text-xs">Validity Guidance</span>
                  <p className="text-gray-800 dark:text-gray-200 mt-0.5">{s.validity}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Passport PCC Distinction */}
      {activeTab === 'passport-distinction' && (
        <div className="space-y-6">
          <div className="p-4 bg-purple-50 dark:bg-purple-950/30 rounded-lg border border-purple-200 dark:border-purple-900">
            <h3 className="font-semibold text-purple-900 dark:text-purple-200 mb-1">
              Do Not Confuse State Police Character Verification with MEA Passport PCC
            </h3>
            <p className="text-sm text-purple-800 dark:text-purple-300">
              There is no single universal national format for police clearance in India. Submitting the wrong certificate
              can lead to immediate rejection by visa officers or employers.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
              <span className="text-xs uppercase tracking-wide font-semibold text-blue-600 dark:text-blue-400 block mb-1">
                Domestic Police Character Certificate
              </span>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                State Police (CCTNS)
              </h4>
              <ul className="text-xs text-gray-600 dark:text-gray-300 space-y-1 list-disc pl-4">
                <li>Issued by District Police Commissioner / SP.</li>
                <li>Online via State Police web portal (UPCOP, Delhi Police, Aaple Sarkar).</li>
                <li>Used for Indian private companies, tenancy, drivers, security licenses, contracts.</li>
                <li><strong>Rejected by foreign embassies</strong>.</li>
              </ul>
            </div>

            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
              <span className="text-xs uppercase tracking-wide font-semibold text-emerald-600 dark:text-emerald-400 block mb-1">
                International Police Clearance Certificate
              </span>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                MEA Passport Seva (PSK)
              </h4>
              <ul className="text-xs text-gray-600 dark:text-gray-300 space-y-1 list-disc pl-4">
                <li>Issued by Regional Passport Officer (MEA) under Passports Act.</li>
                <li>Requires valid Passport and in-person PSK biometric appointment.</li>
                <li>Used for overseas visas, PR immigration, foreign citizenship.</li>
                <li>Mandatory for foreign embassies worldwide.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Required Evidence */}
      {activeTab === 'documents' && (
        <div className="space-y-6">
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
              Mandatory Checklist for State Verification
            </h3>
            <ul className="text-sm space-y-2 text-gray-600 dark:text-gray-300">
              <li className="flex items-start gap-2">
                <span className="text-emerald-600 font-bold">✓</span>
                <span><strong>Proof of Identity:</strong> Aadhaar Card / PAN Card / Voter ID / Passport.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-600 font-bold">✓</span>
                <span><strong>Proof of Present Residence:</strong> Electricity bill, registered rent agreement, or bank passbook proving stay in police station limits.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-600 font-bold">✓</span>
                <span><strong>Employer / Purpose Letter:</strong> Formal requisition letter from hiring employer or tender board stating need for verification.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-600 font-bold">✓</span>
                <span><strong>Two Local Reference Contacts:</strong> Name, address, and mobile numbers of two respectable neighbors/residents in your locality.</span>
              </li>
            </ul>
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
                Log into State Police Citizen Portal / App
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Register on your state police portal (e.g. <code>delhipolice.gov.in</code>, UPCOP app). Enter mobile number and OTP.
              </p>
            </div>

            <div className="relative">
              <span className="absolute -left-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-white text-[10px] ring-4 ring-white dark:ring-gray-900">
                2
              </span>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                Fill Character Verification Form &amp; Upload Documents
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Select your jurisdictional District and Thana/Police Station. Enter residential duration, upload photograph,
                identity proof, address proof, and reference details.
              </p>
            </div>

            <div className="relative">
              <span className="absolute -left-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-white text-[10px] ring-4 ring-white dark:ring-gray-900">
                3
              </span>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                Pay Statutory Fee Online
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Pay the nominal fee (₹50 to ₹250 depending on state) via UPI or NetBanking. Save the acknowledgement slip with reference number.
              </p>
            </div>

            <div className="relative">
              <span className="absolute -left-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-white text-[10px] ring-4 ring-white dark:ring-gray-900">
                4
              </span>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                Beat Officer In-Person Inquiry
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                The local beat constable visits your premises or calls references to confirm your reputation, residence, and clean background.
              </p>
            </div>

            <div className="relative">
              <span className="absolute -left-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-white text-[10px] ring-4 ring-white dark:ring-gray-900">
                5
              </span>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                Download Digitally Signed Character Certificate
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Upon approval by the Assistant Commissioner of Police (ACP) / SP, download the PDF certificate with QR code directly from the portal.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Footer Info & Disclaimers */}
      <div className="mt-8 pt-4 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <span>Verified against State Police Regulations &amp; CCTNS Citizen Service Charters.</span>
        <span>Last checked: November 2026</span>
      </div>
    </div>
  );
}
