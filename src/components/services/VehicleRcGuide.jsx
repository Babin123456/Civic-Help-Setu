import React, { useState } from 'react';

/**
 * Vehicle Registration Certificate (RC) Issuance & Transfer Guide Component
 * Provides comprehensive, scannable guidance for Indian vehicle owners navigating
 * new registration, ownership transfer (Forms 29 & 30), inter-state NOC (Form 28),
 * hypothecation cancellation (Form 35), duplicate RC (Form 26), and address updates.
 */
export default function VehicleRcGuide() {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedPathway, setSelectedPathway] = useState('transfer');

  const pathways = [
    {
      id: 'new',
      title: 'New Vehicle Registration',
      forms: 'Form 20, Form 21 (Sale Cert), Form 22 (Roadworthiness)',
      timeline: '7 to 15 working days',
      inspectionRequired: 'Dealer PDI / Inspection or RTO physical inspection',
      summary: 'Typically initiated at point-of-sale through authorized automobile dealers via Vahan portal with HSRP plate issuance.'
    },
    {
      id: 'transfer',
      title: 'Ownership Transfer (Sale/Purchase)',
      forms: 'Form 29 (Notice of Transfer), Form 30 (Application for Transfer)',
      timeline: '14 to 30 working days',
      inspectionRequired: 'Chassis pencil print tracing & vehicle physical verification',
      summary: 'Required when buying or selling a used vehicle. Protects seller from third-party liabilities and establishes buyer title.'
    },
    {
      id: 'hypothecation',
      title: 'Hypothecation (HP) Removal',
      forms: 'Form 35 (Notice of Termination of Agreement) & Bank NOC',
      timeline: '7 to 14 working days',
      inspectionRequired: 'Not required (Faceless Aadhaar service in many states)',
      summary: 'Removes bank/financier lien from vehicle records once the vehicle loan is paid in full.'
    },
    {
      id: 'noc',
      title: 'Inter-State NOC (Migration)',
      forms: 'Form 28 (Application for No Objection Certificate) in triplicate',
      timeline: '15 to 30 working days',
      inspectionRequired: 'Crime records bureau clearance (NCRB/State Police check)',
      summary: 'Mandatory before re-registering a vehicle in another State/UT when relocating permanently.'
    },
    {
      id: 'duplicate',
      title: 'Duplicate RC',
      forms: 'Form 26 (Application for Duplicate Certificate of Registration)',
      timeline: '10 to 20 working days',
      inspectionRequired: 'Verification against police loss report / e-FIR',
      summary: 'For replacing lost, damaged, destroyed, or mutilated physical Smart Card RC.'
    }
  ];

  return (
    <div className="vehicle-rc-guide max-w-4xl mx-auto p-6 bg-white dark:bg-gray-900 rounded-lg shadow-md border border-gray-200 dark:border-gray-800">
      <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            MoRTH Vahan Citizen Services
          </span>
          <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
            Motor Vehicles Act, 1988 (Sec 39 - 65)
          </span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Vehicle Registration Certificate (RC) &amp; Transfer Guide
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm">
          A definitive handbook for Indian motorists navigating ownership transfer, hypothecation termination,
          inter-state NOC, road tax reconciliation, and High Security Registration Plates (HSRP).
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
          Overview &amp; Legal Mandates
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('pathways')}
          className={`py-2 px-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'pathways'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          Forms &amp; Statutory Pathways
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('transfer-checklist')}
          className={`py-2 px-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'transfer-checklist'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          Buyer vs. Seller Checklist
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('interstate')}
          className={`py-2 px-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'interstate'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          Inter-State NOC &amp; Road Tax
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
          Online Vahan Application Flow
        </button>
      </div>

      {/* Tab: Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-950/40 rounded-lg border border-blue-200 dark:border-blue-900">
              <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-1">
                Statutory Ownership &amp; Third-Party Liability
              </h3>
              <p className="text-sm text-blue-800 dark:text-blue-300">
                Under Section 50 of the Motor Vehicles Act, the registered owner in RTO records remains strictly
                liable for all accidents, toll penalties, and traffic offences until legal title is formally transferred.
              </p>
            </div>
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg border border-emerald-200 dark:border-emerald-900">
              <h3 className="font-semibold text-emerald-900 dark:text-emerald-200 mb-1">
                Unified Vahan 4.0 Architecture
              </h3>
              <p className="text-sm text-emerald-800 dark:text-emerald-300">
                Vehicle registrations across 33+ States and UTs are synchronized under Vahan 4.0, enabling digital
                cross-verification of chassis numbers, engine numbers, insurance, and pollution certificates.
              </p>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800 p-5 rounded-lg border border-gray-200 dark:border-gray-700">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-3">
              What a Registration Certificate (RC) Proves vs. Does Not Prove
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <span className="font-medium text-emerald-700 dark:text-emerald-400">Legal Proof Provided:</span>
                <ul className="list-disc pl-5 text-gray-600 dark:text-gray-300 space-y-1">
                  <li>Proves legal registration and authority to ply the vehicle on public roads in India.</li>
                  <li>Establishes prima facie ownership, vehicle class, seated capacity, unladen weight, and fuel type.</li>
                  <li>Documents financial encumbrances (hypothecation, lease, or hire-purchase agreement).</li>
                </ul>
              </div>
              <div className="space-y-2">
                <span className="font-medium text-rose-700 dark:text-rose-400">Does Not Prove:</span>
                <ul className="list-disc pl-5 text-gray-600 dark:text-gray-300 space-y-1">
                  <li>Does NOT authorize driving the vehicle (requires a valid Driving Licence).</li>
                  <li>Does NOT guarantee exemption from local municipal entry taxes or state permit rules.</li>
                  <li>Does NOT serve as primary proof of personal citizenship or permanent identity.</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="border border-gray-200 dark:border-gray-700 p-4 rounded-lg bg-white dark:bg-gray-900">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
              Official Portal &amp; Department Reference
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              All vehicle-related transactions, tax payments, ownership transfers, and status checks are handled via:
            </p>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded font-mono">
                Portal: vahan.parivahan.gov.in
              </span>
              <span className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded font-mono">
                mParivahan Mobile App (Virtual RC)
              </span>
              <span className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded">
                Administered by: Regional Transport Office (RTO) / Registering Authority
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Pathways & Forms */}
      {activeTab === 'pathways' && (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            {pathways.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedPathway(p.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  selectedPathway === p.id
                    ? 'bg-blue-600 text-white shadow'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {p.title}
              </button>
            ))}
          </div>

          {pathways.filter((p) => p.id === selectedPathway).map((p) => (
            <div key={p.id} className="p-5 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 space-y-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">{p.title}</h3>
              <p className="text-sm text-gray-700 dark:text-gray-300">{p.summary}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400 block text-xs">Prescribed Statutory Forms</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{p.forms}</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400 block text-xs">Standard Processing Timeline</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{p.timeline}</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-gray-500 dark:text-gray-400 block text-xs">Vehicle Inspection &amp; Tracing Requirement</span>
                  <p className="text-gray-800 dark:text-gray-200 mt-0.5">{p.inspectionRequired}</p>
                </div>
              </div>
            </div>
          ))}

          <div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-900 text-sm">
            <h4 className="font-semibold text-amber-900 dark:text-amber-200 mb-1">
              Chassis Number Pencil Tracing (Form 29 / 30 / 28)
            </h4>
            <p className="text-amber-800 dark:text-amber-300">
              When submitting transfer or NOC forms physically or at RTO verification counters, a physical pencil
              impression (tracing) of the etched chassis number on the vehicle&apos;s frame must be affixed onto the margin of the forms.
            </p>
          </div>
        </div>
      )}

      {/* Tab: Buyer vs Seller Checklist */}
      {activeTab === 'transfer-checklist' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-900">
              <span className="text-xs uppercase tracking-wide font-semibold text-blue-600 dark:text-blue-400 block mb-1">
                Seller Responsibilities
              </span>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                What the Seller Must Provide
              </h4>
              <ul className="text-sm space-y-2 text-gray-600 dark:text-gray-300">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">✓</span>
                  <span><strong>Form 29 (Notice of Transfer):</strong> Duly signed in duplicate.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">✓</span>
                  <span><strong>Form 30 (Part I):</strong> Completed and signed reporting the transfer.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">✓</span>
                  <span><strong>Original Registration Certificate (RC):</strong> Physical Smart Card or paper book.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">✓</span>
                  <span><strong>Bank NOC &amp; Form 35:</strong> If vehicle was previously financed under loan.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">✓</span>
                  <span><strong>Delivery Receipt:</strong> Signed sale receipt noting date, exact time, and odometer reading.</span>
                </li>
              </ul>
            </div>

            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-900">
              <span className="text-xs uppercase tracking-wide font-semibold text-emerald-600 dark:text-emerald-400 block mb-1">
                Buyer Responsibilities
              </span>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                What the Buyer Must Execute
              </h4>
              <ul className="text-sm space-y-2 text-gray-600 dark:text-gray-300">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span><strong>Form 30 (Part II):</strong> Counter-signed agreement of purchase within 14 days of transfer.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span><strong>Address Proof:</strong> Aadhaar / Passport / Electricity bill matching buyer&apos;s residence.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span><strong>Active Motor Insurance:</strong> Transfer existing policy or purchase fresh comprehensive cover.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span><strong>Valid PUCC:</strong> Valid Pollution Under Control Certificate recorded on Vahan.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span><strong>Fee Payment:</strong> Transfer endorsement fee + Smart Card issuance fee on Vahan.</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="p-4 bg-rose-50 dark:bg-rose-950/30 rounded-lg border border-rose-200 dark:border-rose-900 text-sm">
            <h4 className="font-semibold text-rose-900 dark:text-rose-200 mb-1">
              Warning for Sellers: The &quot;Agreement on Stamp Paper&quot; Fallacy
            </h4>
            <p className="text-rose-800 dark:text-rose-300">
              A private notary sale agreement does NOT terminate statutory liability under the Motor Vehicles Act.
              The Supreme Court of India has reiterated in numerous rulings (e.g., <em>Naveen Kumar v. Vijay Kumar</em>)
              that the registered owner remains liable for Motor Accident Claims Tribunal (MACT) awards until the RTO
              updates the RC record.
            </p>
          </div>
        </div>
      )}

      {/* Tab: Inter-State NOC & Road Tax */}
      {activeTab === 'interstate' && (
        <div className="space-y-6">
          <div className="p-4 bg-purple-50 dark:bg-purple-950/30 rounded-lg border border-purple-200 dark:border-purple-900">
            <h3 className="font-semibold text-purple-900 dark:text-purple-200 mb-1">
              Relocating Across State Borders: The Form 28 NOC Flow
            </h3>
            <p className="text-sm text-purple-800 dark:text-purple-300">
              Under Section 47 of MVA, a vehicle registered in one State may be kept in another State for up to 12 months.
              Beyond 12 months, the vehicle must be assigned a new registration mark in the new State.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                Step 1: Obtain Form 28 (NOC) from Source RTO
              </h4>
              <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1 list-disc pl-4">
                <li>Apply on Vahan Citizen Services for No Objection Certificate.</li>
                <li>Submit 3 copies of Form 28 with chassis pencil tracings.</li>
                <li>RTO verifies clear crime records via National Crime Records Bureau (NCRB) &amp; traffic police challans.</li>
                <li>NOC specifies destination RTO code; valid for 6 months.</li>
              </ul>
            </div>

            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                Step 2: Pay Road Tax at Destination RTO
              </h4>
              <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1 list-disc pl-4">
                <li>Submit vehicle with Form 28, original RC, and new local address proof.</li>
                <li>Pay pro-rata lifetime road tax (calculated based on vehicle age and original invoice value).</li>
                <li>New registration number (e.g., KA instead of DL/MH) is assigned and new Smart Card RC issued.</li>
              </ul>
            </div>
          </div>

          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-2">
              Claiming Road Tax Refund from Source State
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              After paying road tax in the new state, you are eligible to claim a pro-rata refund of the lifetime tax
              paid in the original state. You must submit Form DT (Tax refund application), copy of new RC, proof of new tax paid,
              and original tax receipt to the original RTO.
            </p>
          </div>
        </div>
      )}

      {/* Tab: Online Steps */}
      {activeTab === 'steps' && (
        <div className="space-y-6">
          <div className="relative border-l-2 border-blue-500 dark:border-blue-400 ml-4 pl-6 space-y-6">
            <div className="relative">
              <span className="absolute -left-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-white text-[10px] ring-4 ring-white dark:ring-gray-900">
                1
              </span>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                Log into Vahan Citizen Services
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Go to <code>vahan.parivahan.gov.in</code>. Enter your vehicle registration number and state/RTO to access online services.
              </p>
            </div>

            <div className="relative">
              <span className="absolute -left-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-white text-[10px] ring-4 ring-white dark:ring-gray-900">
                2
              </span>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                Select Service &amp; Verify Identity via Aadhaar OTP
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Choose &quot;Transfer of Ownership&quot; / &quot;Hypothecation Termination&quot; / &quot;Change of Address&quot;.
                In Aadhaar-enabled states, e-KYC can be completed instantly without visiting the RTO.
              </p>
            </div>

            <div className="relative">
              <span className="absolute -left-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-white text-[10px] ring-4 ring-white dark:ring-gray-900">
                3
              </span>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                Upload Scanned Documents &amp; Pay Statutory Fees
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Upload scanned copies of Form 29/30, Insurance, PUCC, buyer identity/address proof. Pay statutory fees
                via payment gateway (Bharatkosh or State Treasury).
              </p>
            </div>

            <div className="relative">
              <span className="absolute -left-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-white text-[10px] ring-4 ring-white dark:ring-gray-900">
                4
              </span>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                Physical Document Submission / Inspection (If Required)
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                For non-faceless services or interstate transfers, book an RTO appointment and submit original documents
                along with chassis pencil print and physical vehicle verification.
              </p>
            </div>

            <div className="relative">
              <span className="absolute -left-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-white text-[10px] ring-4 ring-white dark:ring-gray-900">
                5
              </span>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                Approval &amp; Digital RC in mParivahan / DigiLocker
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Once the Registering Authority approves the file, the updated virtual RC is immediately accessible
                in DigiLocker and mParivahan. Physical Smart Card RC is dispatched via Speed Post.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Footer Info & Disclaimers */}
      <div className="mt-8 pt-4 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <span>Verified against MoRTH Central Motor Vehicles Rules (CMVR) &amp; Vahan guidelines.</span>
        <span>Last checked: November 2026</span>
      </div>
    </div>
  );
}
