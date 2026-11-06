import React, { useState } from 'react';

/**
 * Succession Certificate Court Process Explainer Component
 * Provides scannable, step-by-step judicial guidance under Part X (Sections 370-390)
 * of the Indian Succession Act, 1925 for recovering deceased debts and securities,
 * distinguishing it clearly from revenue certificates and clarifying court fee, citation,
 * and indemnity bond requirements.
 */
export default function SuccessionCertificateExplainer() {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedStage, setSelectedStage] = useState('petition');

  const judicialStages = [
    {
      id: 'petition',
      title: 'Stage 1: Petition Filing (Sec 372)',
      timeline: 'Day 1 to 15',
      forum: 'Court of District Judge / Civil Judge (Senior Division)',
      requirements: 'Verified petition detailing time of death, ordinary residence, family tree, absence of Will, and Schedule of Securities',
      actions: 'Drafting with legal counsel, verifying asset account numbers and exact balances, paying initial filing fee'
    },
    {
      id: 'citation',
      title: 'Stage 2: Public Citation & Notice',
      timeline: '30 to 45 Days',
      forum: 'Two widely circulated daily newspapers (English & Regional vernacular)',
      requirements: 'Statutory public notice informing general public and potential creditors/co-heirs to file objections',
      actions: 'Payment of publication charges, filing physical copies of newspapers in court record'
    },
    {
      id: 'hearing',
      title: 'Stage 3: Evidence & Summary Inquiry',
      timeline: '2 to 4 Months',
      forum: 'Open Court Hearing',
      requirements: 'Petitioner statement on oath, cross-examination (if contested), marked exhibits (death cert, bank passbooks)',
      actions: 'Adducing testimony of petitioner and independent witness; examining objections if any'
    },
    {
      id: 'courtfee',
      title: 'Stage 4: Court Fees & Stamp Duty',
      timeline: '15 to 30 Days post-order',
      forum: 'State Treasury / Court Registry',
      requirements: 'Judicial non-judicial stamp duty calculated ad-valorem under State Court Fees Act (approx 2% to 6%)',
      actions: 'Depositing stamp paper or e-court fee receipt matching total assessed movable valuation'
    },
    {
      id: 'issuance',
      title: 'Stage 5: Indemnity Bond & Certificate Grant',
      timeline: '2 to 4 Weeks final',
      forum: 'Sheristadar / Registrar Office of District Court',
      requirements: 'Execution of security indemnity bond with solvent sureties (if directed by court)',
      actions: 'Issuance of Certificate of Succession in Form prescribed under Section 377'
    }
  ];

  return (
    <div className="succession-certificate-explainer max-w-4xl mx-auto p-6 bg-white dark:bg-gray-900 rounded-lg shadow-md border border-gray-200 dark:border-gray-800">
      <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            Indian Succession Act, 1925 (Part X)
          </span>
          <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
            Civil Court Judicial Process
          </span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Succession Certificate Court Process Explainer
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm">
          A plain-language guide for legal heirs navigating the Civil Court petition process to collect debts, securities,
          shares, and bank deposits of a deceased family member under Sections 370-390 of the Indian Succession Act.
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
          Overview &amp; Statutory Scope
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
          Judicial Stages &amp; Timelines
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('movable-only')}
          className={`py-2 px-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'movable-only'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          Debts &amp; Securities vs. Real Estate
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('courtfees')}
          className={`py-2 px-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'courtfees'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          Court Fees &amp; Indemnity Bond
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
          Filing Checklist for Counsel
        </button>
      </div>

      {/* Tab: Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="p-4 bg-amber-50 dark:bg-amber-950/40 rounded-lg border border-amber-200 dark:border-amber-900">
            <h3 className="font-semibold text-amber-900 dark:text-amber-200 mb-1">
              Informational Guidance, Not Legal Advice
            </h3>
            <p className="text-sm text-amber-800 dark:text-amber-300">
              A Succession Certificate is granted exclusively by a competent Civil Court (District Judge / Senior Civil Judge).
              This explainer outlines procedural stages for informational transparency; citizens must engage licensed legal counsel
              for petition drafting and court appearances.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-950/40 rounded-lg border border-blue-200 dark:border-blue-900">
              <h4 className="font-semibold text-blue-900 dark:text-blue-200 text-sm mb-1">
                Conclusive Indemnity to Debtors (Section 381)
              </h4>
              <p className="text-sm text-blue-800 dark:text-blue-300">
                Banks, companies, and insurers demand a Succession Certificate because Section 381 grants complete statutory
                immunity: paying the certificate holder fully absolves the financial institution of third-party claims.
              </p>
            </div>
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg border border-emerald-200 dark:border-emerald-900">
              <h4 className="font-semibold text-emerald-900 dark:text-emerald-200 text-sm mb-1">
                Distinction from Revenue Legal Heir Slips
              </h4>
              <p className="text-sm text-emerald-800 dark:text-emerald-300">
                While a Tehsildar certificate is useful for pensions, it carries no judicial authority under central banking laws.
                For un-nominated bank balances exceeding statutory limits, civil courts alone can issue succession certificates.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Stages */}
      {activeTab === 'stages' && (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            {judicialStages.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedStage(s.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  selectedStage === s.id
                    ? 'bg-blue-600 text-white shadow'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {s.title}
              </button>
            ))}
          </div>

          {judicialStages.filter((s) => s.id === selectedStage).map((s) => (
            <div key={s.id} className="p-5 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 space-y-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">{s.title}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400 block text-xs">Estimated Stage Duration</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{s.timeline}</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400 block text-xs">Judicial Forum / Venue</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{s.forum}</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-gray-500 dark:text-gray-400 block text-xs">Legal Requirements</span>
                  <p className="text-gray-800 dark:text-gray-200 mt-0.5">{s.requirements}</p>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-gray-500 dark:text-gray-400 block text-xs">Practical Actions Needed</span>
                  <p className="text-gray-800 dark:text-gray-200 mt-0.5">{s.actions}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Movable vs Real Estate */}
      {activeTab === 'movable-only' && (
        <div className="space-y-6">
          <div className="p-4 bg-rose-50 dark:bg-rose-950/30 rounded-lg border border-rose-200 dark:border-rose-900">
            <h3 className="font-semibold text-rose-900 dark:text-rose-200 mb-1">
              Critical Statutory Limitation: Debts and Securities ONLY
            </h3>
            <p className="text-sm text-rose-800 dark:text-rose-300">
              Under Section 370 of the Indian Succession Act, a Succession Certificate is restricted strictly to movable
              debts and securities. It CANNOT be granted in respect of immovable property (land, plots, houses, flats).
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-5 bg-white dark:bg-gray-900">
              <span className="text-xs uppercase tracking-wide font-semibold text-emerald-600 dark:text-emerald-400 block mb-1">
                Covered by Succession Certificate
              </span>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                Eligible Movable Assets
              </h4>
              <ul className="text-sm space-y-1.5 text-gray-600 dark:text-gray-300 list-disc pl-5">
                <li>Bank savings accounts, current accounts, and fixed deposits.</li>
                <li>Demat account equity shares, bonds, debentures, and mutual fund units.</li>
                <li>Government securities, National Savings Certificates (NSC), PPF balances.</li>
                <li>Salary arrears, unpaid dividends, and insurance policy claim proceed balances.</li>
              </ul>
            </div>

            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-5 bg-white dark:bg-gray-900">
              <span className="text-xs uppercase tracking-wide font-semibold text-rose-600 dark:text-rose-400 block mb-1">
                Excluded from Succession Certificate
              </span>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                Immovable Property &amp; Title
              </h4>
              <ul className="text-sm space-y-1.5 text-gray-600 dark:text-gray-300 list-disc pl-5">
                <li>Residential flats, apartments, bungalows, and independent buildings.</li>
                <li>Agricultural land parcels, commercial plots, and industrial sheds.</li>
                <li>Note: For immovable property, heirs must apply for revenue mutation, partition, or Probate/Letters of Administration.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Court Fees */}
      {activeTab === 'courtfees' && (
        <div className="space-y-6">
          <div className="p-4 bg-blue-50 dark:bg-blue-950/40 rounded-lg border border-blue-200 dark:border-blue-900">
            <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-1">
              Ad-Valorem Court Fee Calculation
            </h3>
            <p className="text-sm text-blue-800 dark:text-blue-300">
              Unlike revenue certificates, a Succession Certificate attracts substantial ad-valorem judicial court fees
              governed by state Court Fees Acts.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
              <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-2">
                Typical Stamp Duty Slabs (Varies by State)
              </h4>
              <ul className="text-xs text-gray-600 dark:text-gray-300 space-y-1 list-disc pl-4">
                <li>Typically 2% to 4% for lower amounts (e.g. up to ₹5 Lakhs).</li>
                <li>4% to 6% for higher amounts (above ₹10 Lakhs).</li>
                <li>Some states provide capped ceilings for female applicants or specific maximum stamp caps.</li>
                <li>Fee is payable only when the judge passes the order allowing the petition, prior to certificate engrossing.</li>
              </ul>
            </div>

            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
              <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-2">
                Indemnity Bond with Solvent Sureties
              </h4>
              <p className="text-xs text-gray-600 dark:text-gray-300 mb-2">
                Under Section 375 of the Indian Succession Act, the District Judge usually mandates the applicant to execute
                an Indemnity Bond with one or two solvent third-party sureties.
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                This guarantees indemnification in case another undisclosed heir or prior creditor later files a rightful claim against the estate.
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
                Compile Complete Schedule of Debts &amp; Securities
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Collect exact account numbers, branch IFSCs, folio numbers, and latest account statements for all bank accounts,
                FD receipts, mutual fund statements, and shares.
              </p>
            </div>

            <div className="relative">
              <span className="absolute -left-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-white text-[10px] ring-4 ring-white dark:ring-gray-900">
                2
              </span>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                File Section 372 Petition via Legal Counsel
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Counsel files verified petition in the Court of the District Judge / Senior Civil Judge in whose territorial jurisdiction
                the deceased resided or where securities are maintained.
              </p>
            </div>

            <div className="relative">
              <span className="absolute -left-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-white text-[10px] ring-4 ring-white dark:ring-gray-900">
                3
              </span>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                Publish Newspaper Citations &amp; Await Objection Window
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Publish public citations in English and local vernacular newspapers. Await the 30-to-45 day statutory objection window.
              </p>
            </div>

            <div className="relative">
              <span className="absolute -left-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-white text-[10px] ring-4 ring-white dark:ring-gray-900">
                4
              </span>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                Adduce Evidence in Court &amp; Deposit Court Fee Stamps
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Petitioner deposes in court, submitting original death certificate and documents. Upon judge&apos;s favorable order,
                deposit the assessed ad-valorem judicial stamp paper.
              </p>
            </div>

            <div className="relative">
              <span className="absolute -left-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-white text-[10px] ring-4 ring-white dark:ring-gray-900">
                5
              </span>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                Execute Surety Bond &amp; Collect Certificate
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Execute indemnity bond with sureties as directed by court. Collect the sealed Certificate of Succession and submit
                certified copies to banks/companies for immediate asset release.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Footer Info & Disclaimers */}
      <div className="mt-8 pt-4 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <span>Verified against Indian Succession Act, 1925 &amp; State Court Fee Acts.</span>
        <span>Last checked: November 2026</span>
      </div>
    </div>
  );
}
