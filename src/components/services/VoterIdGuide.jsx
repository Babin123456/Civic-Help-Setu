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
  Vote,
  UserPlus,
  RefreshCw,
  Search
} from 'lucide-react';

/**
 * VoterIdGuide Component
 *
 * Implements Issue #512: Dedicated scannable citizen guide for Voter ID (EPIC) registration,
 * ECI Form 6/7/8 navigation, 4 annual qualifying dates (1 Jan, 1 Apr, 1 Jul, 1 Oct),
 * Booth Level Officer (BLO) field verification, electoral roll inclusion, and e-EPIC download.
 */
export default function VoterIdGuide({ service, onBack }) {
  const [selectedForm, setSelectedForm] = useState('form6'); // 'form6' | 'form8_shift' | 'form8_correct' | 'form8_replace'
  const [selectedTab, setSelectedTab] = useState('overview'); // 'overview' | 'dates' | 'steps' | 'documents' | 'blo'

  return (
    <div className="voter-id-guide max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 mb-2">
              <ShieldCheck className="w-3.5 h-3.5" /> Election Commission of India (ECI)
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Voter ID (EPIC) Registration &amp; Correction Guide
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Plain-language instructions for first-time voter enrollment (Form 6), shifting residence, corrections, card replacement (Form 8), and e-EPIC download via ECI.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase">
              Official Portal:
            </span>
            <a
              href="https://voters.eci.gov.in"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors"
            >
              ECI Voters Portal <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* ECI Form Selector */}
        <div className="mt-4 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Select Statutory Form:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'form6', label: 'Form 6: New Voter (18+)', icon: UserPlus },
              { id: 'form8_shift', label: 'Form 8: Shifting Residence', icon: MapPin },
              { id: 'form8_correct', label: 'Form 8: Correction of Details', icon: RefreshCw },
              { id: 'form8_replace', label: 'Form 8: Replacement EPIC', icon: Vote }
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setSelectedForm(f.id)}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                  selectedForm === f.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                <f.icon className="w-3 h-3" />
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 pt-6 border-t border-slate-200 dark:border-slate-800 mt-6">
          {[
            { id: 'overview', label: 'What This Document Is', icon: FileText },
            { id: 'dates', label: '4 Annual Qualifying Dates', icon: Calendar },
            { id: 'steps', label: 'Application Journey', icon: Building },
            { id: 'documents', label: 'Documents to Keep Ready', icon: CheckCircle },
            { id: 'blo', label: 'BLO Visit & Roll Inclusion', icon: UserCheck }
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
              What the Voter ID (EPIC) Proves
            </h3>
            <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed">
              <li>• Conclusive proof of identity issued by the Election Commission of India for franchise rights.</li>
              <li>• Grants constitutional right to cast ballot in general Lok Sabha, state assembly, and municipal elections.</li>
              <li>• Recognized universally across India as photo ID and residential proof for banking and telecom.</li>
            </ul>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Card Delivery vs. Electoral Roll Inclusion
            </h3>
            <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed">
              <li>• <strong>Active Voter List Entry is Paramount:</strong> Merely possessing a physical plastic card does NOT allow you to vote if your name is absent from the live electoral roll on polling day.</li>
              <li>• Always check your polling station and serial number on the ECI search portal (<a href="https://electoralsearch.eci.gov.in" target="_blank" rel="noreferrer" className="underline">electoralsearch.eci.gov.in</a>).</li>
            </ul>
          </div>
        </div>
      )}

      {/* Tab 2: 4 Qualifying Dates */}
      {selectedTab === 'dates' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              Four Annual Qualifying Dates for 18-Year-Olds
            </h3>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Under amended Section 14(b) of the Representation of the People Act, 1950, youth turning 18 are no longer restricted to a single cut-off on 1st January. There are now <strong>four qualifying dates</strong> every year:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/30 text-center">
                <span className="font-bold text-blue-900 dark:text-blue-200 block text-sm">1st January</span>
                <span className="text-slate-500 dark:text-slate-400 text-xs mt-1 block">Quarter 1</span>
              </div>
              <div className="p-3 rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/30 text-center">
                <span className="font-bold text-blue-900 dark:text-blue-200 block text-sm">1st April</span>
                <span className="text-slate-500 dark:text-slate-400 text-xs mt-1 block">Quarter 2</span>
              </div>
              <div className="p-3 rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/30 text-center">
                <span className="font-bold text-blue-900 dark:text-blue-200 block text-sm">1st July</span>
                <span className="text-slate-500 dark:text-slate-400 text-xs mt-1 block">Quarter 3</span>
              </div>
              <div className="p-3 rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/30 text-center">
                <span className="font-bold text-blue-900 dark:text-blue-200 block text-sm">1st October</span>
                <span className="text-slate-500 dark:text-slate-400 text-xs mt-1 block">Quarter 4</span>
              </div>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Advance applications can be submitted up to three months before your 18th birthday.
            </p>
          </div>
        </div>
      )}

      {/* Tab 3: Steps */}
      {selectedTab === 'steps' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Application Journey: {selectedForm === 'form6' ? 'Form 6 (New Voter)' : selectedForm === 'form8_shift' ? 'Form 8 (Shifting Residence)' : selectedForm === 'form8_correct' ? 'Form 8 (Correction)' : 'Form 8 (Card Replacement)'}
            </h3>

            <ol className="text-xs text-slate-600 dark:text-slate-300 space-y-3 list-decimal pl-4 leading-relaxed">
              <li>
                <strong>Submit Application on Voters Portal:</strong> Log in to <a href="https://voters.eci.gov.in" target="_blank" rel="noreferrer" className="underline text-blue-600 font-semibold">voters.eci.gov.in</a> or open the official Voter Helpline App.
              </li>
              <li>
                <strong>Select Form:</strong> Choose Form 6 for first-time registration, or Form 8 for address shifting, data corrections, or replacement of damaged cards.
              </li>
              <li>
                <strong>Upload Supporting Documents:</strong> Upload age proof, address proof, and passport-size photo. Receive a unique 12-digit Application Reference Number.
              </li>
              <li>
                <strong>Booth Level Officer (BLO) Verification:</strong> The jurisdictional BLO visits your house or contacts you to physically cross-check documents and verify ordinary residence.
              </li>
              <li>
                <strong>ERO Decision &amp; e-EPIC Download:</strong> The Electoral Registration Officer approves inclusion. You can immediately download the password-protected digital <strong>e-EPIC</strong> PDF.
              </li>
              <li>
                <strong>Postal Delivery of Laminated Card:</strong> ECI prints the color laminated PVC EPIC card and delivers it directly to your doorstep via Speed Post totally free of charge.
              </li>
            </ol>
          </div>
        </div>
      )}

      {/* Tab 4: Documents */}
      {selectedTab === 'documents' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Documents to Keep Ready
            </h3>

            <div className="space-y-3">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Proof of Age (Age ≥ 18 Years)
                  </span>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded">
                    Mandatory for Form 6
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Birth Certificate, Aadhaar Card, PAN Card, Driving Licence, or Class 10/12 School Passing Certificate.
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Proof of Ordinary Residence in the Polling Area
                  </span>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded">
                    Mandatory
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Electricity/water/gas bill in family name, current passbook of post office/nationalized bank, Indian Passport, or Registered Rent Deed.
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Recent Color Passport Photograph
                  </span>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded">
                    Mandatory
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  White background photograph showing full frontal face without dark sunglasses or caps.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: BLO */}
      {selectedTab === 'blo' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-blue-600" />
              Role of the Booth Level Officer (BLO)
            </h3>

            <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/30 rounded-lg border border-slate-200 dark:border-slate-800">
                <span className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
                  Who is the BLO?
                </span>
                A local government officer (usually a government school teacher, Anganwadi worker, or village assistant) appointed by the District Election Officer to oversee the polling station area.
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/30 rounded-lg border border-slate-200 dark:border-slate-800">
                <span className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
                  Field Verification Step:
                </span>
                The BLO receives your online submission on their mobile app, visits your address to verify that you ordinarily reside there, and checks that you are not registered in any other constituency.
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/30 rounded-lg border border-slate-200 dark:border-slate-800">
                <span className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
                  Free Service Guarantee:
                </span>
                Voter registration, corrections, and physical card delivery are <strong>100% free of charge</strong> under statutory ECI rules. Never pay any fee or tout.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footnote */}
      <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
        This informational guide is grounded in Election Commission of India statutory voter manuals and the Representation of the People Act, 1950. Verified on 5 November 2026. Civic Help Setu does not process voter enrollments or access ECI databases.
      </div>
    </div>
  );
}
