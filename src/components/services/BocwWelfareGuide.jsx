import React, { useState } from 'react';

/**
 * Building and Other Construction Workers (BOCW) Labour Welfare Card Guide Component
 * Explains India's statutory construction worker registration under the BOCW Act, 1996,
 * detailing the 90-day work condition, state board benefits (scholarships, maternity, pension),
 * subscription renewals, and distinguishing it from national e-Shram cards.
 */
export default function BocwWelfareGuide() {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedState, setSelectedState] = useState('up');

  const stateBoards = [
    {
      id: 'up',
      state: 'Uttar Pradesh (UPBOCW)',
      board: 'UP Building & Other Construction Workers Welfare Board',
      portal: 'upbocw.in',
      fee: '₹20 registration + ₹20/year subscription',
      timeline: '15 to 30 working days',
      keyBenefits: 'Sant Ravidas Shiksha Protsahan (Scholarships), Kanya Vivah Sahayata (₹55k), Shishu Hitlabh, Pension',
      workCertificate: 'Self-certification or certification by registered contractor / Gram Pradhan'
    },
    {
      id: 'delhi',
      state: 'Delhi (DBOCWW Board)',
      board: 'Delhi Building and Other Construction Workers Welfare Board',
      portal: 'edistrict.delhigovt.nic.in',
      fee: '₹25 registration fee',
      timeline: '21 to 30 working days',
      keyBenefits: 'Maternity assistance (₹30,000), Children education support (up to ₹10k/yr), Accidental death cover, Old age pension',
      workCertificate: 'Employer/contractor 90-day certificate or registered trade union endorsement'
    },
    {
      id: 'ka',
      state: 'Karnataka (KBOCWWB)',
      board: 'Karnataka Building and Other Construction Workers Welfare Board',
      portal: 'karbocwwb.karnataka.gov.in',
      fee: '₹25 registration fee + ₹50 annual subscription',
      timeline: '30 working days under Sakala',
      keyBenefits: 'Toolkits, Bus pass facility, Kalyanashree (marriage assistance ₹50k), Ayushman Bharat top-up, Pension',
      workCertificate: 'Form IV 90-day certificate certified by registered builder/engineer or Labor Inspector'
    },
    {
      id: 'mh',
      state: 'Maharashtra (MBOCWWB)',
      board: 'Maharashtra Building and Other Construction Workers Welfare Board',
      portal: 'mahabocw.in',
      fee: '₹25 registration + ₹12/year subscription',
      timeline: '30 working days',
      keyBenefits: 'Essential commodity kits, safety equipment kits, education scholarships for daughters, midday meal schemes',
      workCertificate: 'Certificate of 90 days employment issued by employer/municipal officer/Gram Sevak'
    }
  ];

  return (
    <div className="bocw-welfare-guide max-w-4xl mx-auto p-6 bg-white dark:bg-gray-900 rounded-lg shadow-md border border-gray-200 dark:border-gray-800">
      <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            BOCW Act, 1996 &amp; Welfare Cess Act
          </span>
          <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
            State Labour Welfare Board
          </span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          BOCW Labour Welfare Registration Card Guide
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm">
          A definitive handbook for building and construction workers to obtain an official State BOCW Welfare Identity Card (Labour Card),
          fulfill the 90-day work condition, access statutory benefits (scholarships, maternity, pensions), and maintain active subscriptions.
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
          onClick={() => setActiveTab('eligibility')}
          className={`py-2 px-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'eligibility'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          90-Day Condition &amp; Occupations
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('state-boards')}
          className={`py-2 px-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'state-boards'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          State Welfare Boards &amp; Benefits
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('bocw-vs-eshram')}
          className={`py-2 px-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'bocw-vs-eshram'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          BOCW Card vs. e-Shram Card
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
          Application &amp; Renewal Steps
        </button>
      </div>

      {/* Tab: Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-950/40 rounded-lg border border-blue-200 dark:border-blue-900">
              <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-1">
                Statutory Welfare Under BOCW Act, 1996
              </h3>
              <p className="text-sm text-blue-800 dark:text-blue-300">
                The Building and Other Construction Workers Act guarantees social security to construction laborers.
                Funded through a statutory 1% cess levied on all building projects, the state boards provide tangible financial
                and health benefits directly to registered beneficiaries.
              </p>
            </div>
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg border border-emerald-200 dark:border-emerald-900">
              <h3 className="font-semibold text-emerald-900 dark:text-emerald-200 mb-1">
                Tangible Financial Assistance
              </h3>
              <p className="text-sm text-emerald-800 dark:text-emerald-300">
                Unlike generic databases, a registered BOCW beneficiary can claim direct subsidies for children&apos;s higher education,
                maternity assistance (up to ₹30,000), daughter&apos;s marriage grants (₹50,000+), toolkits, and monthly pensions upon turning 60.
              </p>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800 p-5 rounded-lg border border-gray-200 dark:border-gray-700">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-3">
              What a BOCW Welfare Card Establishes vs. Does Not Establish
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <span className="font-medium text-emerald-700 dark:text-emerald-400">What It Establishes:</span>
                <ul className="list-disc pl-5 text-gray-600 dark:text-gray-300 space-y-1">
                  <li>Recognized identity as a registered construction worker in state labour department records.</li>
                  <li>Direct access to file claims under state board welfare schemes.</li>
                  <li>Entitlement to old-age monthly construction pension upon reaching 60 years.</li>
                </ul>
              </div>
              <div className="space-y-2">
                <span className="font-medium text-rose-700 dark:text-rose-400">What It Does NOT Establish:</span>
                <ul className="list-disc pl-5 text-gray-600 dark:text-gray-300 space-y-1">
                  <li>Does NOT guarantee permanent public employment or contractual permanence.</li>
                  <li>Does NOT grant benefits if annual worker subscriptions are allowed to lapse.</li>
                  <li>Does NOT cover workers outside the construction sector (e.g. domestic helpers, street vendors).</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Eligibility & 90-Day Condition */}
      {activeTab === 'eligibility' && (
        <div className="space-y-6">
          <div className="p-4 bg-amber-50 dark:bg-amber-950/40 rounded-lg border border-amber-200 dark:border-amber-900">
            <h3 className="font-semibold text-amber-900 dark:text-amber-200 mb-1">
              The Mandatory 90-Day Work Condition (Section 12)
            </h3>
            <p className="text-sm text-amber-800 dark:text-amber-300">
              Under Section 12 of the BOCW Act, an applicant <strong>must have completed at least 90 days of construction work</strong> in
              the preceding 12 months. This work history must be certified by an employer, registered contractor, architect, trade union,
              or rural village authority (Gram Pradhan / Secretary).
            </p>
          </div>

          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-2">
              Recognized Construction Trades &amp; Occupations
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-gray-700 dark:text-gray-300">
              <span className="p-2 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">• Mason (Rajmistri)</span>
              <span className="p-2 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">• Carpenter (Badhai)</span>
              <span className="p-2 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">• Painter / Polish worker</span>
              <span className="p-2 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">• Plumber / Pipe fitter</span>
              <span className="p-2 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">• Electrician on site</span>
              <span className="p-2 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">• Bar bender (Sariya fitter)</span>
              <span className="p-2 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">• Tile &amp; Marble cutter</span>
              <span className="p-2 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">• Concrete mixer operator</span>
              <span className="p-2 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">• Unskilled site helper / Beldar</span>
            </div>
          </div>
        </div>
      )}

      {/* Tab: State Boards */}
      {activeTab === 'state-boards' && (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            {stateBoards.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setSelectedState(b.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  selectedState === b.id
                    ? 'bg-blue-600 text-white shadow'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {b.state}
              </button>
            ))}
          </div>

          {stateBoards.filter((b) => b.id === selectedState).map((b) => (
            <div key={b.id} className="p-5 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 space-y-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">{b.board}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400 block text-xs">Official Portal</span>
                  <span className="font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">{b.portal}</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400 block text-xs">Statutory Fees &amp; Subscription</span>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">{b.fee}</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400 block text-xs">Service Guarantee Timeline</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{b.timeline}</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400 block text-xs">90-Day Work Verification</span>
                  <span className="text-gray-800 dark:text-gray-200">{b.workCertificate}</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-gray-500 dark:text-gray-400 block text-xs">Major Welfare Schemes Available</span>
                  <p className="text-gray-800 dark:text-gray-200 mt-0.5">{b.keyBenefits}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab: BOCW vs e-Shram */}
      {activeTab === 'bocw-vs-eshram' && (
        <div className="space-y-6">
          <div className="p-4 bg-purple-50 dark:bg-purple-950/30 rounded-lg border border-purple-200 dark:border-purple-900">
            <h3 className="font-semibold text-purple-900 dark:text-purple-200 mb-1">
              Do You Need a BOCW Labour Card or an e-Shram Card?
            </h3>
            <p className="text-sm text-purple-800 dark:text-purple-300">
              Many construction workers register on e-Shram assuming they automatically receive BOCW benefits.
              They are completely separate systems. Construction workers are strongly advised to hold <strong>both</strong>.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-5 bg-white dark:bg-gray-900">
              <span className="text-xs uppercase tracking-wide font-semibold text-blue-600 dark:text-blue-400 block mb-1">
                State Statutory Welfare Card
              </span>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                BOCW Labour Welfare Card
              </h4>
              <ul className="text-xs text-gray-600 dark:text-gray-300 space-y-1 list-disc pl-4">
                <li>Issued by State Labour Welfare Board under 1996 Act.</li>
                <li>Restricted strictly to construction trades with 90 days work proof.</li>
                <li>Direct statutory cash schemes (maternity ₹30k, marriage ₹55k, education).</li>
                <li>Requires nominal registration fee and annual renewal subscription.</li>
              </ul>
            </div>

            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-5 bg-white dark:bg-gray-900">
              <span className="text-xs uppercase tracking-wide font-semibold text-emerald-600 dark:text-emerald-400 block mb-1">
                Central Universal ID
              </span>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                e-Shram National UAN Card
              </h4>
              <ul className="text-xs text-gray-600 dark:text-gray-300 space-y-1 list-disc pl-4">
                <li>Issued by Central Ministry of Labour &amp; Employment.</li>
                <li>Open to all unorganised workers (agricultural, domestic, street vendors).</li>
                <li>Acts as a national identification registry for emergency relief.</li>
                <li>100% free with lifetime validity; no renewal fee.</li>
              </ul>
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
                Obtain 90-Day Work Certificate
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Get a signed certificate from your construction employer, builder, labor contractor, or Gram Pradhan
                confirming at least 90 days of work in the preceding 12 months.
              </p>
            </div>

            <div className="relative">
              <span className="absolute -left-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-white text-[10px] ring-4 ring-white dark:ring-gray-900">
                2
              </span>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                Submit Online Application on State BOCW Portal
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Access your state portal (e.g., <code>upbocw.in</code>, <code>mahabocw.in</code>, e-District Delhi).
                Enter Aadhaar details, upload bank passbook, family member details, and the 90-day certificate.
              </p>
            </div>

            <div className="relative">
              <span className="absolute -left-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-white text-[10px] ring-4 ring-white dark:ring-gray-900">
                3
              </span>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                Pay Nominal Registration Fee
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Pay the small statutory registration charge (typically ₹20 to ₹50) online or at a CSC kiosk.
              </p>
            </div>

            <div className="relative">
              <span className="absolute -left-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-white text-[10px] ring-4 ring-white dark:ring-gray-900">
                4
              </span>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                Scrutiny by Labour Enforcement Officer
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                The local Labour Enforcement Officer (LEO) reviews documentation and approves the beneficiary record.
              </p>
            </div>

            <div className="relative">
              <span className="absolute -left-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-white text-[10px] ring-4 ring-white dark:ring-gray-900">
                5
              </span>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                Download Labour Identity Card &amp; Maintain Annual Renewal
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Download the official photo Labour Welfare Card with registration number. Remember to pay the annual renewal
                subscription (₹12 to ₹50) before the expiry date to keep benefits active.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Footer Info & Disclaimers */}
      <div className="mt-8 pt-4 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <span>Verified against BOCW (RECS) Act, 1996 &amp; State Welfare Board regulations.</span>
        <span>Last checked: November 2026</span>
      </div>
    </div>
  );
}
