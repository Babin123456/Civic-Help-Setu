import React, { useState } from 'react';

/**
 * Permanent Driving Licence (DL) Issuance, Test & Renewal Guide Component
 * Provides comprehensive, scannable guidance for Indian citizens transitioning
 * from a Learner's Licence (LL) to a Permanent Driving Licence, handling test slots,
 * ADTT maneuvers, renewal rules under MVA 2019, and duplicate DL processing.
 */
export default function DrivingLicenceGuide() {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedCategory, setSelectedCategory] = useState('lmv');

  const categories = [
    {
      id: 'mcwg',
      title: 'Motorcycle with Gear (MCWG)',
      minAge: '18 Years',
      prerequisites: 'Valid LL for MCWG held for >= 30 days',
      testRequirements: '8-formation track balance without placing foot on the ground, emergency stop, hand signals',
      validity: 'Up to 40 years of age or 20 years from issuance (whichever earlier)'
    },
    {
      id: 'lmv',
      title: 'Light Motor Vehicle (LMV - Cars/Jeeps)',
      minAge: '18 Years',
      prerequisites: 'Valid LL for LMV held for >= 30 days',
      testRequirements: 'Automated track: Parallel parking, Reverse S-bend, Gradient stop and start without rollback (>30cm)',
      validity: 'Up to 40 years of age or 20 years from issuance (whichever earlier)'
    },
    {
      id: 'transport',
      title: 'Transport / Commercial Vehicle (TR)',
      minAge: '20 Years',
      prerequisites: 'Minimum 1 year prior holding of LMV licence, Medical Fitness Certificate (Form 1A)',
      testRequirements: 'Heavy vehicle maneuver track, reversing bay, loading safety knowledge, night driving check',
      validity: '5 years for non-hazardous; 3 years for hazardous goods carriage'
    }
  ];

  return (
    <div className="driving-licence-guide max-w-4xl mx-auto p-6 bg-white dark:bg-gray-900 rounded-lg shadow-md border border-gray-200 dark:border-gray-800">
      <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            MoRTH Sarathi Parivahan
          </span>
          <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
            Motor Vehicles Act, 1988 (Amended 2019)
          </span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Permanent Driving Licence (DL) Issuance &amp; Renewal Guide
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm">
          A step-by-step citizen companion for taking the practical driving test on Automated Driving Test Tracks (ADTT),
          upgrading from Learner&apos;s Licence, renewing expired licences, or obtaining a duplicate Smart Card DL.
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
          Overview &amp; Statutory Timelines
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('classes')}
          className={`py-2 px-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'classes'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          Vehicle Classes &amp; Eligibility
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('adtt')}
          className={`py-2 px-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'adtt'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          ADTT Track Test Checklist
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('renewal')}
          className={`py-2 px-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'renewal'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          Renewal &amp; 1-Year Rule
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
                The 30-Day Mandatory Practice Window
              </h3>
              <p className="text-sm text-blue-800 dark:text-blue-300">
                Under Rule 15 of CMVR 1989, an applicant can book a permanent driving test slot only after
                completing <strong>30 calendar days</strong> from the date of Learner&apos;s Licence (LL) issuance.
              </p>
            </div>
            <div className="p-4 bg-amber-50 dark:bg-amber-950/40 rounded-lg border border-amber-200 dark:border-amber-900">
              <h3 className="font-semibold text-amber-900 dark:text-amber-200 mb-1">
                The 180-Day Expiry Deadline
              </h3>
              <p className="text-sm text-amber-800 dark:text-amber-300">
                A Learner&apos;s Licence is valid for exactly <strong>6 months (180 days)</strong> across India. You must appear
                and clear your driving test within this window. If expired, you must restart with a fresh LL.
              </p>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800 p-5 rounded-lg border border-gray-200 dark:border-gray-700">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-3">
              What a Permanent Driving Licence Proves vs. Does Not Prove
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <span className="font-medium text-emerald-700 dark:text-emerald-400">Official Legal Authority:</span>
                <ul className="list-disc pl-5 text-gray-600 dark:text-gray-300 space-y-1">
                  <li>Authorizes legal operation of specified class of motor vehicles across all Indian States and UTs.</li>
                  <li>Accepted as standard photo identity and age proof for most civic and governmental services.</li>
                  <li>Valid for international driving permit (IDP) issuance within its period of validity.</li>
                </ul>
              </div>
              <div className="space-y-2">
                <span className="font-medium text-rose-700 dark:text-rose-400">Legal Limitations:</span>
                <ul className="list-disc pl-5 text-gray-600 dark:text-gray-300 space-y-1">
                  <li>Does NOT prove vehicle ownership (that requires a Registration Certificate / RC).</li>
                  <li>Does NOT confer permission to drive commercial transport vehicles unless endorsed with TR badge.</li>
                  <li>Does NOT replace primary proof of citizenship or permanent residential domicile.</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="border border-gray-200 dark:border-gray-700 p-4 rounded-lg bg-white dark:bg-gray-900">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
              Official Portal &amp; Department Contacts
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              All applications, test slot bookings, fee payments, and dispatch tracking are consolidated under MoRTH:
            </p>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded font-mono">
                Portal: sarathi.parivahan.gov.in
              </span>
              <span className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded font-mono">
                Helpline: 0120-4925505 (MoRTH Helpdesk)
              </span>
              <span className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded">
                Issuing Authority: Regional Transport Office (RTO) / Licensing Authority (LA)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Vehicle Classes */}
      {activeTab === 'classes' && (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  selectedCategory === cat.id
                    ? 'bg-blue-600 text-white shadow'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {cat.title}
              </button>
            ))}
          </div>

          {categories.filter((c) => c.id === selectedCategory).map((cat) => (
            <div key={cat.id} className="p-5 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 space-y-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">{cat.title}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400 block text-xs">Minimum Age Requirement</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{cat.minAge}</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400 block text-xs">Validity Period</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{cat.validity}</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-gray-500 dark:text-gray-400 block text-xs">Prerequisites</span>
                  <p className="text-gray-800 dark:text-gray-200 mt-0.5">{cat.prerequisites}</p>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-gray-500 dark:text-gray-400 block text-xs">Driving Test Focus &amp; Maneuvers</span>
                  <p className="text-gray-800 dark:text-gray-200 mt-0.5">{cat.testRequirements}</p>
                </div>
              </div>
            </div>
          ))}

          <div className="p-4 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg border border-yellow-200 dark:border-yellow-900 text-sm">
            <h4 className="font-semibold text-yellow-900 dark:text-yellow-200 mb-1">
              Medical Fitness Certificate (Form 1 vs Form 1A)
            </h4>
            <ul className="list-disc pl-5 text-yellow-800 dark:text-yellow-300 space-y-1">
              <li><strong>Non-Transport applicants under 40 years:</strong> Self-declaration of physical fitness via online Form 1.</li>
              <li><strong>Non-Transport applicants above 40 years:</strong> Medical Certificate in Form 1A signed by a registered medical practitioner with visual acuity certification.</li>
              <li><strong>All Transport / Commercial applicants:</strong> Mandatory Form 1A irrespective of age.</li>
            </ul>
          </div>
        </div>
      )}

      {/* Tab: ADTT Track Test Checklist */}
      {activeTab === 'adtt' && (
        <div className="space-y-6">
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-200 dark:border-emerald-900">
            <h3 className="font-semibold text-emerald-900 dark:text-emerald-200 mb-1">
              What is an Automated Driving Test Track (ADTT)?
            </h3>
            <p className="text-sm text-emerald-800 dark:text-emerald-300">
              MoRTH has deployed camera and sensor-based automated tracks across most state RTOs.
              The evaluation is completely digital: touch sensors along the curb trigger instant deductions,
              and video cameras record trajectory, time taken, and boundary compliance without human discretion.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-900">
              <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-2">
                4-Wheeler (LMV) Key Skill Tests
              </h4>
              <ul className="text-sm space-y-2 text-gray-600 dark:text-gray-300">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">1.</span>
                  <span><strong>Parallel Parking:</strong> Reverse park into designated bay without touching curb poles within stipulated time (approx. 90-120 seconds).</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">2.</span>
                  <span><strong>Reverse &apos;S&apos; Bend:</strong> Navigate an S-curved track backwards using side and rear-view mirrors without stopping or deviating.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">3.</span>
                  <span><strong>Gradient (Up-Ramp) Stop:</strong> Halt car on a steep incline; restart without allowing vehicle to roll backwards by more than 30 cm (12 inches).</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">4.</span>
                  <span><strong>8-Figure Maneuver:</strong> Continuous forward steering through an 8-shaped loop without curbing.</span>
                </li>
              </ul>
            </div>

            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-900">
              <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-2">
                2-Wheeler (MCWG) Key Skill Tests
              </h4>
              <ul className="text-sm space-y-2 text-gray-600 dark:text-gray-300">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 font-bold">1.</span>
                  <span><strong>Figure 8 Formation:</strong> Steer through continuous circular curves without letting foot touch ground or straying out of white boundary markers.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 font-bold">2.</span>
                  <span><strong>Straight Plank Balancing:</strong> Ride slowly over a raised or narrow ground strip demonstrating slow-speed balance.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 font-bold">3.</span>
                  <span><strong>Emergency Braking:</strong> Accelerate to test speed and stop cleanly within the designated stopping box upon signal.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 font-bold">4.</span>
                  <span><strong>Mandatory Gear:</strong> ISI-certified helmet fastened; test vehicle must possess active Insurance, PUCC, and RC.</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-2">
              Retest Rules If You Fail
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              If you fail any section of the practical driving test, you can rebook another slot after a statutory
              cooling period of <strong>7 days</strong> on the Sarathi portal by paying the nominal retest fee (approx. ₹300).
              The retest must still be concluded before your Learner&apos;s Licence reaches its 180-day expiry.
            </p>
          </div>
        </div>
      )}

      {/* Tab: Renewal & 1-Year Rule */}
      {activeTab === 'renewal' && (
        <div className="space-y-6">
          <div className="p-4 bg-purple-50 dark:bg-purple-950/30 rounded-lg border border-purple-200 dark:border-purple-900">
            <h3 className="font-semibold text-purple-900 dark:text-purple-200 mb-1">
              Motor Vehicles Amendment Act (2019) Renewal Rules
            </h3>
            <p className="text-sm text-purple-800 dark:text-purple-300">
              Major changes in grace period and driving test exemptions have been instituted to prevent unlicensed driving
              and simplify online renewal without RTO visits.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
              <span className="text-xs uppercase tracking-wide font-semibold text-emerald-600 dark:text-emerald-400 block mb-1">
                Within 1 Year Window (No Retest)
              </span>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                Advance or Timely Renewal
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                You may apply for renewal <strong>up to 1 year before</strong> expiry or within <strong>1 year after</strong> expiry.
              </p>
              <ul className="text-xs list-disc pl-4 text-gray-500 dark:text-gray-400 space-y-1">
                <li>No practical driving test required.</li>
                <li>Submit Aadhaar-authenticated application online via Sarathi.</li>
                <li>Standard renewal fee applies with small late fee if submitted post-expiry.</li>
              </ul>
            </div>

            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
              <span className="text-xs uppercase tracking-wide font-semibold text-rose-600 dark:text-rose-400 block mb-1">
                Beyond 1 Year (Mandatory Retest)
              </span>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                Expired Over 12 Months
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                Under Section 15 of amended MVA, if a licence is expired for <strong>more than 1 year</strong>:
              </p>
              <ul className="text-xs list-disc pl-4 text-gray-500 dark:text-gray-400 space-y-1">
                <li>The applicant MUST retake and pass the practical driving skill test at the RTO track.</li>
                <li>Higher statutory late fees accumulate for each delayed year.</li>
                <li>You may be issued a temporary learner slip before booking the test.</li>
              </ul>
            </div>
          </div>

          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-2">
              Duplicate DL &amp; Address Change
            </h4>
            <div className="text-sm text-gray-600 dark:text-gray-300 space-y-2">
              <p>
                <strong>Lost or Damaged DL:</strong> Apply under &quot;Services on DL&quot; for a Duplicate Driving Licence.
                If lost, an online Police Loss Report / e-FIR acknowledged copy must be uploaded.
              </p>
              <p>
                <strong>Change of Address:</strong> If moving inter-district or inter-state, apply for Change of Address.
                Requires proof of current residence (Aadhaar, electricity bill, or rent agreement). Aadhaar-linked OTP authentication
                enables completely faceless approval in participating states.
              </p>
            </div>
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
                Complete 30 Days with Valid Learner&apos;s Licence
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Verify your LL is active, has completed at least 30 days, and has not crossed 180 days. Keep your LL number and date of birth ready.
              </p>
            </div>

            <div className="relative">
              <span className="absolute -left-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-white text-[10px] ring-4 ring-white dark:ring-gray-900">
                2
              </span>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                Submit Online Application on Sarathi Parivahan
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Select your State -&gt; Apply for Driving Licence -&gt; Enter Learner&apos;s Licence Number and DOB.
                Select class of vehicles, upload medical certificate (if &gt;40 or Transport), and review details.
              </p>
            </div>

            <div className="relative">
              <span className="absolute -left-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-white text-[10px] ring-4 ring-white dark:ring-gray-900">
                3
              </span>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                Pay Fee &amp; Book Driving Test Slot
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Pay the combined DL test and Smart Card issuance fee (typically ₹200 for test + ₹200 for card + smart card fee) via Bharatkosh/State treasury gateway.
                Select an available date and time slot for your RTO or ADTT testing centre.
              </p>
            </div>

            <div className="relative">
              <span className="absolute -left-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-white text-[10px] ring-4 ring-white dark:ring-gray-900">
                4
              </span>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                Appear for Practical Test with Eligible Vehicle
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Bring your vehicle matching the category applied for with valid Insurance, RC, PUCC, and red &apos;L&apos; board.
                Undergo biometric check and execute the prescribed ADTT maneuvers.
              </p>
            </div>

            <div className="relative">
              <span className="absolute -left-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-white text-[10px] ring-4 ring-white dark:ring-gray-900">
                5
              </span>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                Approval, Digital DL in DigiLocker &amp; Smart Card Post
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Once test result is uploaded and approved by the Licensing Authority, the digital DL is immediately pullable in DigiLocker/mParivahan.
                The physical PVC Smart Card is dispatched via Speed Post to the registered address within 7 to 21 working days.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Footer Info & Disclaimers */}
      <div className="mt-8 pt-4 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <span>Verified against MoRTH Central Motor Vehicles Rules (CMVR) &amp; Sarathi guidelines.</span>
        <span>Last checked: November 2026</span>
      </div>
    </div>
  );
}
