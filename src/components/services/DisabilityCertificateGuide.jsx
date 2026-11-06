import React, { useState } from 'react';
import {
  FileText,
  Calendar,
  Clock,
  AlertTriangle,
  Building,
  UserCheck,
  CheckCircle,
  HelpCircle,
  ShieldCheck,
  MapPin,
  ExternalLink,
  Activity,
  HeartPulse
} from 'lucide-react';

/**
 * DisabilityCertificateGuide Component
 *
 * Implements Issue #509: Scannable citizen guide for Disability Certificate & UDID card
 * under the RPwD Act, 2016 (21 recognized disabilities), Swavlamban portal registration,
 * designated District Medical Board assessment, benchmark criteria (40%), and validity rules.
 */
export default function DisabilityCertificateGuide({ service, onBack }) {
  const [selectedTab, setSelectedTab] = useState('overview'); // 'overview' | 'conditions' | 'board' | 'steps' | 'documents'

  return (
    <div className="disability-udid-guide max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 mb-2">
              <ShieldCheck className="w-3.5 h-3.5" /> Rights of Persons with Disabilities Act, 2016
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Disability Certificate &amp; UDID Application Guide
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Plain-language instructions for obtaining a Unique Disability ID (UDID) and Disability Certificate from designated government Medical Boards via the Swavlamban portal.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase">
              Portal:
            </span>
            <a
              href="https://www.swavlambancard.gov.in"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors"
            >
              Swavlamban Portal <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 pt-6 border-t border-slate-200 dark:border-slate-800 mt-6">
          {[
            { id: 'overview', label: 'What This Document Is', icon: FileText },
            { id: 'conditions', label: '21 Recognized Disabilities', icon: Activity },
            { id: 'board', label: 'Medical Board Assessment', icon: HeartPulse },
            { id: 'steps', label: 'Application Journey', icon: Building },
            { id: 'documents', label: 'Required Medical Records', icon: CheckCircle }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = selectedTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedTab(tab.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab 1: Overview */}
      {selectedTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              What the Disability Certificate / UDID Proves
            </h3>
            <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed">
              <li>• Official statutory proof of benchmark disability under the RPwD Act, 2016.</li>
              <li>• Single national card (UDID) universally recognized across all Indian States and Union Territories.</li>
              <li>• Entitles the holder to 4% reservation in government employment, 5% in higher education, disability pensions, railway travel concessions, and Section 80U income tax deductions.</li>
            </ul>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Permanent vs. Temporary Validity
            </h3>
            <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed">
              <li>• <strong>Permanent Certificate:</strong> Issued when the Medical Board certifies that the physical or neurological impairment is irreversible with no possibility of substantial variation.</li>
              <li>• <strong>Temporary Certificate:</strong> Issued for children (under age 18) or progressive/temporary conditions, specifying a mandatory reassessment date (usually 5 years).</li>
            </ul>
          </div>

          <div className="md:col-span-2 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Benchmark Disability Threshold (40%)
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Under Section 2(r) of the RPwD Act, statutory welfare benefits and reservations apply only to individuals certified with a <strong>"benchmark disability" of 40% or more</strong>. The percentage is calculated strictly by the designated government Medical Board using clinical measurement scales; digital tools cannot calculate or promise percentages.
            </p>
          </div>
        </div>
      )}

      {/* Tab 2: 21 Recognized Disabilities */}
      {selectedTab === 'conditions' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600" />
              21 Recognized Disabilities under RPwD Act, 2016
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              The Act expanded coverage from 7 to 21 statutory disability categories:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
              {[
                'Locomotor Disability',
                'Visual Impairment (Blindness)',
                'Hearing Impairment (Deaf & Hard of Hearing)',
                'Speech and Language Disability',
                'Intellectual Disability',
                'Mental Illness',
                'Autism Spectrum Disorder',
                'Cerebral Palsy',
                'Muscular Dystrophy',
                'Chronic Neurological Conditions',
                'Specific Learning Disabilities',
                'Multiple Sclerosis',
                'Low Vision',
                'Leprosy Cured Persons',
                'Dwarfism',
                'Acid Attack Victims',
                'Parkinson’s Disease',
                'Hemophilia',
                'Thalassemia',
                'Sickle Cell Disease',
                'Multiple Disabilities (including Deaf-Blindness)'
              ].map((item, idx) => (
                <div key={idx} className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30 text-slate-800 dark:text-slate-200 font-medium">
                  {idx + 1}. {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Medical Board Assessment */}
      {selectedTab === 'board' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <HeartPulse className="w-5 h-5 text-blue-600" />
              What Happens at the District Medical Board Appointment?
            </h3>

            <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/30 rounded-lg border border-slate-200 dark:border-slate-800">
                <span className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
                  1. Designated Medical Authority
                </span>
                Assessments can only be conducted by a government-notified Medical Board at the District Hospital or Chief Medical Officer (CMO) office of your district. Private hospital certificates are not recognized without board ratification.
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/30 rounded-lg border border-slate-200 dark:border-slate-800">
                <span className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
                  2. Specialist Examination
                </span>
                Depending on the condition, specialists examine the applicant: Orthopedic Surgeon for locomotor; Ophthalmologist for vision; ENT Specialist / Audiologist for hearing; Psychiatrist / Clinical Psychologist for intellectual disability / mental illness.
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/30 rounded-lg border border-slate-200 dark:border-slate-800">
                <span className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
                  3. Digital Entry on Swavlamban Portal
                </span>
                The Medical Board enters the clinical assessment metrics directly into the central UDID database. No manual paperwork is required once verified.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Steps */}
      {selectedTab === 'steps' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Application Journey: From Registration to UDID Card
            </h3>

            <ol className="text-xs text-slate-600 dark:text-slate-300 space-y-3 list-decimal pl-4 leading-relaxed">
              <li>
                <strong>Online Registration on Swavlamban Portal:</strong> Visit <a href="https://www.swavlambancard.gov.in" target="_blank" rel="noreferrer" className="underline text-blue-600 font-semibold">swavlambancard.gov.in</a> and select "Apply for Disability Certificate &amp; UDID Card".
              </li>
              <li>
                <strong>Hospital &amp; Appointment Allotment:</strong> The portal allocates the designated District Hospital based on the applicant's residential address and issues an acknowledgement number.
              </li>
              <li>
                <strong>Attend Medical Assessment:</strong> Visit the District Hospital on the scheduled assessment day with original treatment history, discharge summaries, and identity proofs.
              </li>
              <li>
                <strong>Online Processing &amp; e-Card Generation:</strong> The CMO approves the assessment report. The citizen can immediately download the digital Disability Certificate and e-UDID card.
              </li>
              <li>
                <strong>Physical Card Dispatch:</strong> The Department of Empowerment of Persons with Disabilities prints and dispatches the laminated national UDID card via Speed Post free of cost.
              </li>
            </ol>
          </div>
        </div>
      )}

      {/* Tab 5: Documents */}
      {selectedTab === 'documents' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Documents to Carry to the Medical Board
            </h3>

            <div className="space-y-3">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Hospital Treatment Records &amp; Clinical History
                  </span>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded">
                    Mandatory
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Discharge summaries, surgical memos, audiological reports (BERA/Audiogram), IQ test reports by clinical psychologists, or radiological reports.
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Identity &amp; Address Proof of Applicant (or Guardian)
                  </span>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded">
                    Mandatory
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Aadhaar Card, Voter ID, or Birth Certificate showing permanent residence in the hospital's district.
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Recent Color Photographs
                  </span>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded">
                    Mandatory
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Passport-size photo clearly showing the affected body part or physical impairment if visible.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footnote */}
      <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
        This informational guide is grounded in the Rights of Persons with Disabilities Act, 2016 and official DEPwD Swavlamban rules. Verified on 5 November 2026. Civic Help Setu does not perform clinical assessments or store citizen disability records.
      </div>
    </div>
  );
}
