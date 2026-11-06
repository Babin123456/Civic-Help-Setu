import React, { useState } from 'react';

/**
 * e-Shram Registration & Profile-Update Guide Component
 * Explains India's National Database of Unorganised Workers (NDUW / e-Shram),
 * 12-digit UAN card creation, self vs CSC registration routes, profile update protocols,
 * and sets clear, honest expectations dispelling myths of automatic cash transfers.
 */
export default function EShramGuide() {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedRoute, setSelectedRoute] = useState('self');

  const registrationModes = [
    {
      id: 'self',
      title: 'Self-Registration (Online via Mobile)',
      portal: 'eshram.gov.in',
      fee: 'Completely Free (Zero Fee)',
      requirements: 'Aadhaar card with active linked mobile number for OTP authentication',
      duration: '10 to 15 minutes',
      suitableFor: 'Workers with smartphone and active Aadhaar-linked SIM'
    },
    {
      id: 'csc',
      title: 'Assisted Route (CSC Village Level Entrepreneur)',
      portal: 'Digital Seva Portal (CSC Centers)',
      fee: 'Completely Free (Government pays CSC; worker pays ₹0)',
      requirements: 'Physical Aadhaar card and bank passbook; biometric fingerprint authentication available',
      duration: '15 to 20 minutes at local CSC center',
      suitableFor: 'Workers without smartphone, unlinked Aadhaar mobile numbers, or needing biometric verification'
    },
    {
      id: 'update',
      title: 'Profile Update & Correction',
      portal: 'eshram.gov.in (Already Registered -> Update Profile)',
      fee: 'Free online (nominal ₹20 if done at CSC)',
      requirements: 'UAN number or Aadhaar OTP to modify address, occupation, or bank account',
      duration: '5 to 10 minutes',
      suitableFor: 'Updating changed mobile numbers, migrating addresses, or correcting bank accounts'
    }
  ];

  return (
    <div className="eshram-guide max-w-4xl mx-auto p-6 bg-white dark:bg-gray-900 rounded-lg shadow-md border border-gray-200 dark:border-gray-800">
      <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            Ministry of Labour &amp; Employment (MoLE)
          </span>
          <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
            National Database of Unorganised Workers (NDUW)
          </span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          e-Shram Registration &amp; UAN Card Guide
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm">
          A transparent citizen guide to obtaining a 12-digit e-Shram Universal Account Number (UAN) card, updating occupation
          and bank profiles, and understanding realistic benefit entitlements without falling for misleading rumours.
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
          Overview &amp; Truth About Benefits
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('eligibility')}
          className={`py-2 px-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'eligibility'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          Eligibility &amp; Exclusions
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('modes')}
          className={`py-2 px-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'modes'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          Self vs. CSC Registration
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('profile-update')}
          className={`py-2 px-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'profile-update'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          Profile Updates &amp; Corrections
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
          Online Registration Journey
        </button>
      </div>

      {/* Tab: Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="p-4 bg-amber-50 dark:bg-amber-950/40 rounded-lg border border-amber-200 dark:border-amber-900">
            <h3 className="font-semibold text-amber-900 dark:text-amber-200 mb-1">
              Dispelling the Myths: e-Shram is NOT an Automatic Cash Transfer Scheme
            </h3>
            <p className="text-sm text-amber-800 dark:text-amber-300">
              Social media often circulates false rumours promising monthly deposits of ₹1,000 to ₹3,000 for e-Shram cardholders.
              <strong> The e-Shram portal is a national registration database, not a cash distribution scheme.</strong> Registration
              provides a portable UAN identity and facilitates linkage to specific welfare programs, but does not guarantee automatic monetary payouts.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-950/40 rounded-lg border border-blue-200 dark:border-blue-900">
              <h4 className="font-semibold text-blue-900 dark:text-blue-200 text-sm mb-1">
                Real Tangible Benefits
              </h4>
              <ul className="text-xs text-blue-800 dark:text-blue-300 space-y-1 list-disc pl-4">
                <li>12-digit portable Universal Account Number (UAN) valid for life across all states.</li>
                <li>Single-window integration with Central Social Security schemes (PM-SYM, PMSBY).</li>
                <li>Direct identification for emergency relief assistance during national crises or pandemics.</li>
                <li>Access to National Career Service (NCS) and skill development programs.</li>
              </ul>
            </div>

            <div className="p-4 bg-rose-50 dark:bg-rose-950/40 rounded-lg border border-rose-200 dark:border-rose-900">
              <h4 className="font-semibold text-rose-900 dark:text-rose-200 text-sm mb-1">
                What e-Shram Does NOT Provide
              </h4>
              <ul className="text-xs text-rose-800 dark:text-rose-300 space-y-1 list-disc pl-4">
                <li>Does NOT deposit automatic monthly cash or pension into bank accounts.</li>
                <li>Does NOT guarantee government employment or public sector recruitment.</li>
                <li>Does NOT replace statutory BPL ration cards or Ayushman Bharat health cards.</li>
                <li>Does NOT exempt workers from fulfilling independent scheme eligibility criteria.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Eligibility & Exclusions */}
      {activeTab === 'eligibility' && (
        <div className="space-y-6">
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
              Who is an &quot;Unorganised Worker&quot; Eligible for e-Shram?
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
              Any worker who is a home-based worker, self-employed worker, or a wage worker in the unorganised sector,
              meeting the following three mandatory conditions:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div className="p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded">
                <strong>Age Group:</strong> 16 to 59 Years of age completed.
              </div>
              <div className="p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded">
                <strong>Non-Taxpayer:</strong> Should NOT be an income tax payee.
              </div>
              <div className="p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded">
                <strong>Non-Formal:</strong> Should NOT be a member of EPFO or ESIC.
              </div>
            </div>
          </div>

          <div className="p-4 bg-rose-50 dark:bg-rose-950/30 rounded-lg border border-rose-200 dark:border-rose-900 text-sm">
            <h4 className="font-semibold text-rose-900 dark:text-rose-200 mb-1">
              Strict Statutory Exclusions
            </h4>
            <p className="text-rose-800 dark:text-rose-300">
              Formal sector employees covered by EPF/EPS pensions, government servants, armed forces personnel,
              registered professionals (doctors, chartered accountants, lawyers), and anyone filing income tax returns (ITR)
              are legally barred from registering on e-Shram. Ineligible accounts are subject to de-registration and recovery of benefits.
            </p>
          </div>
        </div>
      )}

      {/* Tab: Modes */}
      {activeTab === 'modes' && (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            {registrationModes.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelectedRoute(m.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  selectedRoute === m.id
                    ? 'bg-blue-600 text-white shadow'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {m.title}
              </button>
            ))}
          </div>

          {registrationModes.filter((m) => m.id === selectedRoute).map((m) => (
            <div key={m.id} className="p-5 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 space-y-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">{m.title}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400 block text-xs">Official Portal / Channel</span>
                  <span className="font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">{m.portal}</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400 block text-xs">Citizen Service Fee</span>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">{m.fee}</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400 block text-xs">Average Duration</span>
                  <span className="text-gray-800 dark:text-gray-200">{m.duration}</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400 block text-xs">Who Should Use This</span>
                  <span className="text-gray-800 dark:text-gray-200">{m.suitableFor}</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-gray-500 dark:text-gray-400 block text-xs">Required Credentials</span>
                  <p className="text-gray-800 dark:text-gray-200 mt-0.5">{m.requirements}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Profile Update */}
      {activeTab === 'profile-update' && (
        <div className="space-y-6">
          <div className="p-4 bg-purple-50 dark:bg-purple-950/30 rounded-lg border border-purple-200 dark:border-purple-900">
            <h3 className="font-semibold text-purple-900 dark:text-purple-200 mb-1">
              How to Correct or Update Your e-Shram Profile
            </h3>
            <p className="text-sm text-purple-800 dark:text-purple-300">
              It is vital to keep your registered mobile number, current residential address, and active bank account updated
              so that direct benefit transfers (DBT) do not fail.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
              <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-1">
                Bank Account Details
              </h4>
              <p className="text-xs text-gray-600 dark:text-gray-300">
                Update account number, IFSC code, and branch name. Ensure your bank account is seeded with Aadhaar and NPCI-mapped for DBT.
              </p>
            </div>

            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
              <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-1">
                Occupation &amp; Skills
              </h4>
              <p className="text-xs text-gray-600 dark:text-gray-300">
                Change your primary occupation or add secondary vocational skills using the standard National Classification of Occupations (NCO) codes.
              </p>
            </div>

            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
              <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-1">
                Current Address (Migrant Workers)
              </h4>
              <p className="text-xs text-gray-600 dark:text-gray-300">
                Migrant workers relocating for work can change their present state/district location while keeping permanent address intact.
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
                Visit Official Portal &amp; Enter Aadhaar-Linked Mobile
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Go to <code>eshram.gov.in</code>. Enter your Aadhaar-linked mobile number, solve captcha, and enter OTP.
              </p>
            </div>

            <div className="relative">
              <span className="absolute -left-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-white text-[10px] ring-4 ring-white dark:ring-gray-900">
                2
              </span>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                Enter Aadhaar Number &amp; Complete e-KYC
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Enter 12-digit Aadhaar number. Authenticate using OTP (or biometric iris/fingerprint at CSC).
                Personal demographics (name, DOB, photo) are fetched automatically from UIDAI.
              </p>
            </div>

            <div className="relative">
              <span className="absolute -left-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-white text-[10px] ring-4 ring-white dark:ring-gray-900">
                3
              </span>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                Fill Residential, Education &amp; Occupation Details
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Provide permanent &amp; current addresses, education qualifications, monthly income slab (&lt;₹10,000, ₹10k-₹15k),
                and select your primary occupation from the NCO list.
              </p>
            </div>

            <div className="relative">
              <span className="absolute -left-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-white text-[10px] ring-4 ring-white dark:ring-gray-900">
                4
              </span>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                Enter Active Bank Account Information
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Enter your bank account number, account holder name, and IFSC code. The portal will automatically display bank and branch name.
              </p>
            </div>

            <div className="relative">
              <span className="absolute -left-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-white text-[10px] ring-4 ring-white dark:ring-gray-900">
                5
              </span>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                Preview Self-Declaration &amp; Download UAN Card
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Review all submitted fields, check consent box, and submit. The 12-digit UAN Card will be instantly generated
                and available for immediate PDF download and print.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Footer Info & Disclaimers */}
      <div className="mt-8 pt-4 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <span>Verified against Ministry of Labour &amp; Employment e-Shram guidelines.</span>
        <span>Last checked: November 2026</span>
      </div>
    </div>
  );
}
