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
  Car,
  Laptop,
  Check,
  RotateCcw
} from 'lucide-react';

/**
 * LearnerLicenceGuide Component
 *
 * Implements Issue #515: Dedicated scannable citizen guide for Learner's Licence (LL)
 * under Motor Vehicles Act, 1988, Sarathi Parivahan portal (sarathi.parivahan.gov.in),
 * faceless online test from home, 6-month statutory validity, and 30-day earliest DL date rule.
 */
export default function LearnerLicenceGuide({ service, onBack }) {
  const [selectedMode, setSelectedMode] = useState('contactless'); // 'contactless' | 'rto'
  const [selectedTab, setSelectedTab] = useState('overview'); // 'overview' | 'age' | 'test' | 'dates' | 'steps'

  return (
    <div className="learner-licence-guide max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 mb-2">
              <ShieldCheck className="w-3.5 h-3.5" /> Motor Vehicles Act, 1988 (Section 8)
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Learner’s Licence (LL) Application &amp; Validity Guide
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Step-by-step guidance for obtaining a Learner's Licence via Sarathi Parivahan, taking the online LL test from home, 6-month validity, and 30-day driving test milestones.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase">
              Official Portal:
            </span>
            <a
              href="https://sarathi.parivahan.gov.in"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors"
            >
              Sarathi Parivahan <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Mode Selector */}
        <div className="mt-4 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Select Testing Mode:
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedMode('contactless')}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                selectedMode === 'contactless'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              <Laptop className="w-3.5 h-3.5" /> Faceless Online Test from Home (Aadhaar Mode)
            </button>
            <button
              onClick={() => setSelectedMode('rto')}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                selectedMode === 'rto'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              <Building className="w-3.5 h-3.5" /> Physical RTO Visit (Non-Aadhaar Mode)
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 pt-6 border-t border-slate-200 dark:border-slate-800 mt-6">
          {[
            { id: 'overview', label: 'What This Document Is', icon: FileText },
            { id: 'age', label: 'Age & Vehicle Categories', icon: Car },
            { id: 'test', label: 'Online Knowledge Test', icon: Laptop },
            { id: 'dates', label: 'Validity & DL Milestones', icon: Clock },
            { id: 'steps', label: 'Application Steps', icon: Calendar }
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
              What a Learner's Licence Allows
            </h3>
            <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed">
              <li>• Legal temporary authorization to learn driving on public roads for specified vehicle categories.</li>
              <li>• Mandatory prerequisite before appearing for a permanent Driving Licence (DL) practical driving test.</li>
              <li>• Standard statutory validity of strictly <strong>6 months</strong> across India.</li>
            </ul>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Strict Mandatory Rules While Driving
            </h3>
            <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed">
              <li>• <strong>Accompanied Driver Rule:</strong> The learner driver MUST be accompanied by an instructor or person holding an active, permanent Driving Licence who is in a position to control the vehicle.</li>
              <li>• <strong>Red 'L' Plate Rule:</strong> A prominent white square plate with a red letter 'L' must be painted or pasted on both the front and rear of the vehicle.</li>
            </ul>
          </div>
        </div>
      )}

      {/* Tab 2: Age Categories */}
      {selectedTab === 'age' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Car className="w-5 h-5 text-blue-600" />
              Statutory Age Thresholds by Vehicle Class (Section 4)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3.5 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded-lg space-y-2">
                <span className="font-bold text-blue-900 dark:text-blue-200 block">
                  1. Age 16 Years (MCWOG)
                </span>
                <p className="text-slate-600 dark:text-slate-400">
                  Motor Cycle Without Gear (engine capacity not exceeding 50cc). Requires explicit written consent from parents / guardians in Form 2.
                </p>
              </div>

              <div className="p-3.5 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-lg space-y-2">
                <span className="font-bold text-emerald-900 dark:text-emerald-200 block">
                  2. Age 18 Years (MCWG &amp; LMV)
                </span>
                <p className="text-slate-600 dark:text-slate-400">
                  Standard Motor Cycle With Gear (bikes/scooters) and Light Motor Vehicles (LMV - private motor cars, jeeps, hatchbacks).
                </p>
              </div>

              <div className="p-3.5 bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/40 rounded-lg space-y-2">
                <span className="font-bold text-purple-900 dark:text-purple-200 block">
                  3. Age 20 Years (Transport)
                </span>
                <p className="text-slate-600 dark:text-slate-400">
                  Commercial transport vehicles, heavy passenger buses, and trucks. Candidate must have held a valid LMV licence for at least 1 year.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Online Test */}
      {selectedTab === 'test' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Laptop className="w-5 h-5 text-blue-600" />
              Online Computerised Knowledge Test Format
            </h3>

            <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700">
                <span className="font-bold text-slate-900 dark:text-slate-100 block mb-1">
                  Structure of the Online Test:
                </span>
                • <strong>Total Questions:</strong> Typically 15 multiple-choice questions on traffic signals, mandatory road signs, and driving etiquette.
                <br />
                • <strong>Qualifying Score:</strong> Must answer at least 9 or 10 questions correctly (varies slightly by state transport rules).
                <br />
                • <strong>Time Limit:</strong> 30 seconds per question.
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700">
                <span className="font-bold text-slate-900 dark:text-slate-100 block mb-1">
                  Faceless Mode Camera Protocol:
                </span>
                If taking the test from home via Aadhaar OTP, your device camera must remain on throughout the test. AI facial authentication verifies that the candidate registered is the person taking the test without external coaching.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Dates & Milestones */}
      {selectedTab === 'dates' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              Critical Statutory Validity &amp; Next Driving Licence Dates
            </h3>

            <div className="p-4 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded-lg text-xs space-y-2 text-slate-700 dark:text-slate-300 leading-relaxed">
              <p>
                <strong>1. Statutory Validity Period: Strictly 6 Months</strong>
                <br />
                An LL is valid for exactly 180 days (6 months) from the date of passing the online test. If the LL lapses without applying for a Driving Licence, the candidate must restart the application and pay test fees again.
              </p>
              <p>
                <strong>2. The Mandatory 30-Day Learning Milestone:</strong>
                <br />
                Under Rule 15 of the Central Motor Vehicles Rules, an applicant can book a permanent Driving Licence driving test slot only <strong>AFTER 30 days</strong> from the date of LL issuance. You cannot appear for the driving test before completing 30 days of training.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Steps */}
      {selectedTab === 'steps' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Application Journey on Sarathi Parivahan
            </h3>

            <ol className="text-xs text-slate-600 dark:text-slate-300 space-y-3 list-decimal pl-4 leading-relaxed">
              <li>
                <strong>Access Sarathi Portal:</strong> Open <a href="https://sarathi.parivahan.gov.in" target="_blank" rel="noreferrer" className="underline text-blue-600 font-semibold">sarathi.parivahan.gov.in</a>, select your State, and choose "Apply for Learner Licence".
              </li>
              <li>
                <strong>Authentication Choice:</strong> Select "Submit via Aadhaar Authentication" to take the test from home without visiting the RTO.
              </li>
              <li>
                <strong>Select Vehicle Classes:</strong> Choose desired classes (e.g., MCWG for motorcycle and LMV for four-wheeler car).
              </li>
              <li>
                <strong>Pay Statutory Fee (Rule 32):</strong> Pay the statutory fee of ₹150 per class + ₹50 test fee online.
              </li>
              <li>
                <strong>Watch Road Safety Tutorial:</strong> Complete the mandatory 10-minute road safety video tutorial on the portal.
              </li>
              <li>
                <strong>Appear for Online Test:</strong> Use the application number and password received by SMS to take the test.
              </li>
              <li>
                <strong>Instant LL Download:</strong> On passing, the digitally signed Learner's Licence PDF with Form 3 endorsement is downloaded immediately.
              </li>
            </ol>
          </div>
        </div>
      )}

      {/* Footnote */}
      <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
        This informational guide is grounded in the Motor Vehicles Act, 1988 and official MoRTH Sarathi portal procedures. Verified on 5 November 2026. Civic Help Setu does not conduct driving tests or issue licences.
      </div>
    </div>
  );
}
