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
  CreditCard,
  Zap,
  RefreshCw,
  Search
} from 'lucide-react';

/**
 * PanCardGuide Component
 *
 * Implements Issue #513: Dedicated scannable citizen guide for PAN Card allotment and corrections,
 * Income Tax e-Filing Instant e-PAN, Protean/UTIITSL portals, Form 49A vs CSF,
 * application milestone tracking (acknowledgement, allotment, dispatch, delivery), and duplicate PAN penalty.
 */
export default function PanCardGuide({ service, onBack }) {
  const [selectedRoute, setSelectedRoute] = useState('instant'); // 'instant' | 'physical' | 'correction'
  const [selectedTab, setSelectedTab] = useState('overview'); // 'overview' | 'portals' | 'steps' | 'documents' | 'tracking'

  return (
    <div className="pan-card-guide max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 mb-2">
              <ShieldCheck className="w-3.5 h-3.5" /> Income Tax Department (Section 139A)
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              PAN Card Allotment &amp; Correction Guide
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Plain-language instructions for Free Instant e-PAN, physical PAN card application via Protean/UTIITSL, data corrections, and delivery status tracking.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase">
              Free Instant e-PAN:
            </span>
            <a
              href="https://eportal.incometax.gov.in"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
            >
              <Zap className="w-3.5 h-3.5" /> IT e-Filing Portal <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Route Selector */}
        <div className="mt-4 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Select Desired Route:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'instant', label: 'Instant e-PAN (Free, 10 Mins)', icon: Zap },
              { id: 'physical', label: 'Physical Card (Form 49A)', icon: CreditCard },
              { id: 'correction', label: 'Change / Correction (CSF)', icon: RefreshCw }
            ].map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedRoute(r.id)}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                  selectedRoute === r.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                <r.icon className="w-3 h-3" />
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 pt-6 border-t border-slate-200 dark:border-slate-800 mt-6">
          {[
            { id: 'overview', label: 'What This Document Is', icon: FileText },
            { id: 'portals', label: 'Authorized Portals & Fees', icon: Building },
            { id: 'steps', label: 'Application Journey', icon: Calendar },
            { id: 'documents', label: 'Documents to Keep Ready', icon: CheckCircle },
            { id: 'tracking', label: 'Status Milestones & Dates', icon: Clock }
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
              What a PAN Card Proves
            </h3>
            <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed">
              <li>• Unique 10-character alphanumeric tax identifier linking all high-value financial and tax records to the Income Tax Department.</li>
              <li>• Mandatory for opening bank accounts, trading securities, filing tax returns, and purchasing real estate or motor vehicles.</li>
              <li>• Widely recognized as photo identity across Indian public and private institutions.</li>
            </ul>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Crucial Legal Warnings
            </h3>
            <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed">
              <li>• <strong>NOT Proof of Address or Citizenship:</strong> A PAN card does not verify residential address or Indian nationality.</li>
              <li>• <strong>Penalty for Duplicate PAN:</strong> Possessing more than one PAN is a statutory offense under Section 272B attracting a <strong>penalty of ₹10,000</strong>. Surrender duplicate PANs immediately.</li>
            </ul>
          </div>
        </div>
      )}

      {/* Tab 2: Portals & Fees */}
      {selectedTab === 'portals' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Building className="w-5 h-5 text-blue-600" />
              Authorized Application Portals &amp; Published Fees
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="p-3.5 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-lg space-y-2">
                <span className="font-bold text-emerald-900 dark:text-emerald-200 block">
                  1. IT e-Filing (Instant e-PAN)
                </span>
                <p className="text-slate-600 dark:text-slate-400">
                  Completely <strong>FREE of cost</strong>. Issued digitally in 10 minutes via Aadhaar OTP.
                </p>
                <a href="https://eportal.incometax.gov.in" target="_blank" rel="noreferrer" className="text-emerald-600 underline font-semibold block">
                  eportal.incometax.gov.in
                </a>
              </div>

              <div className="p-3.5 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded-lg space-y-2">
                <span className="font-bold text-blue-900 dark:text-blue-200 block">
                  2. Protean (formerly NSDL)
                </span>
                <p className="text-slate-600 dark:text-slate-400">
                  Published fee: <strong>₹107</strong> (for physical card within India) or <strong>₹72</strong> for e-PAN only.
                </p>
                <a href="https://www.onlineservices.nsdl.com" target="_blank" rel="noreferrer" className="text-blue-600 underline font-semibold block">
                  onlineservices.nsdl.com
                </a>
              </div>

              <div className="p-3.5 bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/40 rounded-lg space-y-2">
                <span className="font-bold text-purple-900 dark:text-purple-200 block">
                  3. UTIITSL
                </span>
                <p className="text-slate-600 dark:text-slate-400">
                  Published fee: <strong>₹107</strong> for domestic card delivery. Parallel authorized service provider.
                </p>
                <a href="https://www.pan.utiitsl.com" target="_blank" rel="noreferrer" className="text-purple-600 underline font-semibold block">
                  pan.utiitsl.com
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Steps */}
      {selectedTab === 'steps' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Application Journey: {selectedRoute === 'instant' ? 'Instant e-PAN Route' : selectedRoute === 'physical' ? 'Physical Card (Form 49A)' : 'PAN Correction (CSF)'}
            </h3>

            {selectedRoute === 'instant' && (
              <ol className="text-xs text-slate-600 dark:text-slate-300 space-y-2.5 list-decimal pl-4 leading-relaxed">
                <li><strong>Open IT Portal:</strong> Visit <a href="https://eportal.incometax.gov.in" target="_blank" rel="noreferrer" className="underline font-semibold text-blue-600">eportal.incometax.gov.in</a> and select "Instant e-PAN".</li>
                <li><strong>Enter Aadhaar:</strong> Enter your 12-digit Aadhaar number (must be linked to an active mobile number and have never been allotted a prior PAN).</li>
                <li><strong>Validate via OTP:</strong> Enter the OTP received on the Aadhaar-registered mobile phone. Details (Name, DoB, Photo) are fetched automatically.</li>
                <li><strong>Instant Allotment &amp; Download:</strong> A valid digitally signed e-PAN PDF is generated within 10 minutes ready for download.</li>
              </ol>
            )}

            {selectedRoute === 'physical' && (
              <ol className="text-xs text-slate-600 dark:text-slate-300 space-y-2.5 list-decimal pl-4 leading-relaxed">
                <li><strong>File Form 49A:</strong> Open Protean or UTIITSL, select Form 49A (Individual), and fill personal details.</li>
                <li><strong>Choose Submission Mode:</strong> Select paperless Aadhaar e-KYC (no physical docs needed) or scanned documents submission.</li>
                <li><strong>Pay Statutory Fee:</strong> Pay the statutory fee of ₹107 via net banking, UPI, or credit card.</li>
                <li><strong>Receive Acknowledgement Number:</strong> Keep the 15-digit acknowledgement slip safe for tracking.</li>
                <li><strong>Dispatched by Speed Post:</strong> The laminated PVC PAN card is delivered by India Post within 7 to 14 days.</li>
              </ol>
            )}

            {selectedRoute === 'correction' && (
              <ol className="text-xs text-slate-600 dark:text-slate-300 space-y-2.5 list-decimal pl-4 leading-relaxed">
                <li><strong>Select Changes or Correction Form (CSF):</strong> Open the correction module on Protean or UTIITSL.</li>
                <li><strong>Tick Fields Requiring Modification:</strong> Tick checkboxes against Name, Father's Name, Date of Birth, or Signature.</li>
                <li><strong>Upload Documentary Proof:</strong> Upload gazette notification, marriage certificate, or birth certificate supporting the change.</li>
                <li><strong>Fee Payment &amp; Reprint:</strong> Pay fee (₹107) and track updated card dispatch.</li>
              </ol>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Documents */}
      {selectedTab === 'documents' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Accepted Documents (Rule 114)
            </h3>

            <div className="space-y-3">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Aadhaar Card (All-in-One Proof)
                  </span>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded">
                    Universal
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Serves as proof of identity, proof of address, and proof of date of birth simultaneously.
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Alternative Proof of Date of Birth (If Aadhaar has Year Only)
                  </span>
                  <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded">
                    Conditional
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  10th Matriculation certificate, Birth Certificate, Passport, or Driving Licence showing exact DD/MM/YYYY.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Tracking & Dates */}
      {selectedTab === 'tracking' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              Tracking Milestones &amp; Important Dates
            </h3>

            <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
              <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30">
                <strong>1. Application / Payment Date:</strong> 15-digit acknowledgement generated immediately on fee settlement.
              </div>
              <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30">
                <strong>2. Allotment Date:</strong> 10-digit PAN allocated by the Income Tax Department (usually 2 to 3 days).
              </div>
              <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30">
                <strong>3. Dispatch Date:</strong> Card printed and handed over to India Post (Speed Post consignment number SMS alert sent).
              </div>
              <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30">
                <strong>4. Delivery Date:</strong> Final delivery to residential address (estimated 7 to 14 days total).
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footnote */}
      <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
        This informational guide is grounded in Section 139A of the Income Tax Act, 1961 and authorized Protean/UTIITSL rules. Verified on 5 November 2026. Civic Help Setu does not process PAN applications or collect PAN numbers.
      </div>
    </div>
  );
}
