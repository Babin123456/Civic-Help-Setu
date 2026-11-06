import React, { useState } from 'react';

/**
 * Police Clearance Certificate (PCC) Application Guide Component
 * Explains India's two distinct clearance avenues:
 * 1. Passport Seva Kendra (PSK / MEA) PCC for international immigration, employment, and study.
 * 2. State / Local Police CCTNS Clearance for domestic employment, commercial licensing, and tenancy.
 */
export default function PoliceClearanceCertificateGuide() {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedRoute, setSelectedRoute] = useState('psk');

  const pccRoutes = [
    {
      id: 'psk',
      title: 'MEA Passport Seva PCC (International)',
      authority: 'Regional Passport Office (RPO) / Ministry of External Affairs (MEA)',
      portal: 'passportindia.gov.in (Passport Seva Portal)',
      statutoryFee: '₹500 flat fee per application',
      processingTime: '7 to 21 working days (dependent on local Police Verification Report)',
      prerequisite: 'Valid Indian Passport with current address matching application',
      acceptedFor: 'Foreign Emigration, Employment Visas, Permanent Residency (PR), Student Visas, Citizenship Abroad',
      appointmentRequired: 'Yes, mandatory in-person physical appointment at PSK / POPSK for biometric capture'
    },
    {
      id: 'cctns',
      title: 'State Police CCTNS Clearance (Domestic)',
      authority: 'District Police Commissionerate / Superintendent of Police (SP)',
      portal: 'State Police Citizen Portals (e.g. delhipolice.gov.in, uppolice.gov.in, mahapolice.gov.in)',
      statutoryFee: '₹50 to ₹250 (varies by state)',
      processingTime: '7 to 15 working days',
      prerequisite: 'Proof of residence in district jurisdiction for at least 1-3 years',
      acceptedFor: 'Private / Corporate Employment, School Bus Drivers, Security Guard licensing, Commercial Tenancy',
      appointmentRequired: 'No, usually 100% online submission; local beat constable visits residence for verification'
    }
  ];

  return (
    <div className="police-clearance-guide max-w-4xl mx-auto p-6 bg-white dark:bg-gray-900 rounded-lg shadow-md border border-gray-200 dark:border-gray-800">
      <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            Passports Act, 1967 &amp; State Police Acts
          </span>
          <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
            CCTNS Crime Database Verification
          </span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Police Clearance Certificate (PCC) Application Guide
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm">
          A comprehensive guide to obtaining a Police Clearance Certificate (PCC) in India, distinguishing between
          the MEA Passport Seva route for international travel/immigration and State Police CCTNS route for domestic verification.
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
          Overview &amp; The Two Avenues
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
          International (PSK) vs Domestic (State)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('psk-journey')}
          className={`py-2 px-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'psk-journey'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          PSK Passport PCC Journey
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('mistakes')}
          className={`py-2 px-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'mistakes'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          Common Mistakes &amp; Validity
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
          Step-by-Step Filing
        </button>
      </div>

      {/* Tab: Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="p-4 bg-amber-50 dark:bg-amber-950/40 rounded-lg border border-amber-200 dark:border-amber-900">
            <h3 className="font-semibold text-amber-900 dark:text-amber-200 mb-1">
              Crucial Warning: Never Submit a State Police Slip to an Embassy
            </h3>
            <p className="text-sm text-amber-800 dark:text-amber-300">
              Foreign embassies, consulates, and international immigration authorities (such as US CIS, UK Visas &amp; Immigration,
              IRCC Canada, Australian Home Affairs) <strong>strictly require an MEA Passport Seva PCC</strong>.
              A certificate obtained from a state police website will be rejected outright by foreign visa officers.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-950/40 rounded-lg border border-blue-200 dark:border-blue-900">
              <h4 className="font-semibold text-blue-900 dark:text-blue-200 text-sm mb-1">
                Route A: Passport Seva Kendra (PSK) PCC
              </h4>
              <p className="text-sm text-blue-800 dark:text-blue-300">
                Issued under the Passports Act, 1967 by the Ministry of External Affairs. Requires an active Indian Passport,
                in-person biometric appointment at PSK, and local police verification.
              </p>
            </div>
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg border border-emerald-200 dark:border-emerald-900">
              <h4 className="font-semibold text-emerald-900 dark:text-emerald-200 text-sm mb-1">
                Route B: State Police Character Verification
              </h4>
              <p className="text-sm text-emerald-800 dark:text-emerald-300">
                Issued by the state/city police commissionerate via CCTNS. Used strictly for domestic private jobs, security guard
                clearance, tenant verification, and local commercial licensing.
              </p>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800 p-5 rounded-lg border border-gray-200 dark:border-gray-700">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-3">
              What a PCC Proves vs. Does Not Prove
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <span className="font-medium text-emerald-700 dark:text-emerald-400">What It Proves:</span>
                <ul className="list-disc pl-5 text-gray-600 dark:text-gray-300 space-y-1">
                  <li>Certifies that the applicant has no adverse criminal record or pending warrants in police databases.</li>
                  <li>Confirms identity and physical residential address verification by local police personnel.</li>
                  <li>Satisfies statutory visa requirements for countries requesting good conduct certificates.</li>
                </ul>
              </div>
              <div className="space-y-2">
                <span className="font-medium text-rose-700 dark:text-rose-400">What It Does NOT Prove:</span>
                <ul className="list-disc pl-5 text-gray-600 dark:text-gray-300 space-y-1">
                  <li>Does NOT guarantee visa approval or foreign entry permission (immigration decision lies with foreign embassy).</li>
                  <li>Does NOT serve as an identity card or passport substitute.</li>
                  <li>Does NOT have indefinite validity; foreign authorities typically enforce a 6-month expiry window.</li>
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
            {pccRoutes.map((r) => (
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

          {pccRoutes.filter((r) => r.id === selectedRoute).map((r) => (
            <div key={r.id} className="p-5 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 space-y-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">{r.title}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400 block text-xs">Issuing Authority</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{r.authority}</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400 block text-xs">Official Portal</span>
                  <span className="font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">{r.portal}</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400 block text-xs">Statutory Application Fee</span>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">{r.statutoryFee}</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400 block text-xs">Service Timeline</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{r.processingTime}</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-gray-500 dark:text-gray-400 block text-xs">Key Prerequisites</span>
                  <p className="text-gray-800 dark:text-gray-200 mt-0.5">{r.prerequisite}</p>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-gray-500 dark:text-gray-400 block text-xs">Recognized Scope &amp; Purpose</span>
                  <p className="text-gray-800 dark:text-gray-200 mt-0.5">{r.acceptedFor}</p>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-gray-500 dark:text-gray-400 block text-xs">In-Person Appointment</span>
                  <p className="text-gray-800 dark:text-gray-200 mt-0.5">{r.appointmentRequired}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab: PSK Journey */}
      {activeTab === 'psk-journey' && (
        <div className="space-y-6">
          <div className="p-4 bg-purple-50 dark:bg-purple-950/30 rounded-lg border border-purple-200 dark:border-purple-900">
            <h3 className="font-semibold text-purple-900 dark:text-purple-200 mb-1">
              Passport Seva Kendra (PSK) PCC Workflow
            </h3>
            <p className="text-sm text-purple-800 dark:text-purple-300">
              Step-by-step navigation of the MEA passport clearance route required by overseas embassies.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
              <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-2">
                Phase 1: PSK Appointment &amp; Verification
              </h4>
              <ul className="text-xs text-gray-600 dark:text-gray-300 space-y-1 list-disc pl-4">
                <li>Register on <code>passportindia.gov.in</code>.</li>
                <li>Apply for Police Clearance Certificate (PCC) and pay ₹500 fee.</li>
                <li>Select appointment slot at jurisdictional PSK / POPSK.</li>
                <li>Carry Original Passport, self-attested photocopies, and present address proof.</li>
                <li>Biometric finger-scanning and digital photograph captured at counter.</li>
              </ul>
            </div>

            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
              <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-2">
                Phase 2: Police Station Verification (PVR)
              </h4>
              <ul className="text-xs text-gray-600 dark:text-gray-300 space-y-1 list-disc pl-4">
                <li>RPO initiates electronic Police Verification Request to local police station.</li>
                <li>Beat constable visits residential address or invites applicant to station with 2 local witness references.</li>
                <li>Police check local criminal registers and CCTNS central crime repository.</li>
                <li>Clear report submitted online by Superintendent of Police to RPO.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Mistakes */}
      {activeTab === 'mistakes' && (
        <div className="space-y-6">
          <div className="space-y-3">
            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
              <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-1">
                1. Address Mismatch Between Passport &amp; Present Residence
              </h4>
              <p className="text-xs text-gray-600 dark:text-gray-300">
                If your current physical address differs from the address printed on your passport, you must declare
                the current address in the PCC application and submit valid current address proof (Aadhaar, utility bill, rent agreement).
                Police verification always takes place at the <strong>current residential address</strong>.
              </p>
            </div>

            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
              <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-1">
                2. Expired PCC Submissions
              </h4>
              <p className="text-xs text-gray-600 dark:text-gray-300">
                While Indian PCC documents do not carry an explicit expiration date printed by MEA, foreign immigration
                agencies enforce a strict validity period (usually <strong>6 months</strong> from date of issuance).
                Do not apply excessively far in advance of your visa filing date.
              </p>
            </div>

            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
              <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-1">
                3. Concealing Prior Criminal Proceedings or FIRs
              </h4>
              <p className="text-xs text-gray-600 dark:text-gray-300">
                All police inquiries query the centralized Crime and Criminal Tracking Network &amp; Systems (CCTNS).
                Failing to disclose pending criminal proceedings or disposed cases leads to immediate impounding of passport
                under Section 10(3) of Passports Act for suppression of material facts.
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
                Verify Passport Validity &amp; Destination Country Requirements
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Ensure your passport is valid for at least 6 months. Identify the exact foreign country and visa category
                requesting the PCC.
              </p>
            </div>

            <div className="relative">
              <span className="absolute -left-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-white text-[10px] ring-4 ring-white dark:ring-gray-900">
                2
              </span>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                Submit Online Form &amp; Pay ₹500 on Passport Seva Portal
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Log into <code>passportindia.gov.in</code>. Fill out the Police Clearance Certificate form, enter current residence,
                and pay the ₹500 fee to generate an Appointment Confirmation Receipt.
              </p>
            </div>

            <div className="relative">
              <span className="absolute -left-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-white text-[10px] ring-4 ring-white dark:ring-gray-900">
                3
              </span>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                Attend PSK Appointment for Biometrics &amp; Scrutiny
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Visit the PSK / POPSK on your scheduled appointment date with original passport and address proofs.
                Biometrics and digital photo will be captured.
              </p>
            </div>

            <div className="relative">
              <span className="absolute -left-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-white text-[10px] ring-4 ring-white dark:ring-gray-900">
                4
              </span>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                Complete Local Police Verification
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Meet the investigating police officer from your local police station, show identity documents, and provide
                two neighborhood character references.
              </p>
            </div>

            <div className="relative">
              <span className="absolute -left-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-white text-[10px] ring-4 ring-white dark:ring-gray-900">
                5
              </span>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                Collect Physical PCC / Receive via Speed Post
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Once the police report is cleared, the RPO prints the physical Police Clearance Certificate on security paper
                and dispatches it via Speed Post or allows in-person collection depending on regional office policy.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Footer Info & Disclaimers */}
      <div className="mt-8 pt-4 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <span>Verified against Ministry of External Affairs Passport Seva manual &amp; CCTNS guidelines.</span>
        <span>Last checked: November 2026</span>
      </div>
    </div>
  );
}
