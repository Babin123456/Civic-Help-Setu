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
  Users,
  UserPlus,
  UserMinus,
  RefreshCw,
  ShoppingBag
} from 'lucide-react';

/**
 * RationCardGuide Component
 *
 * Implements Issue #511: Dedicated scannable citizen guide for Ration Card issuance,
 * member-addition/deletion, address shifting, card categories (AAY, PHH, NPHH),
 * ONORC national portability, and Fair Price Shop (FPS) linkage.
 */
export default function RationCardGuide({ service, onBack }) {
  const [selectedPath, setSelectedPath] = useState('new'); // 'new' | 'add_member' | 'remove_member' | 'correction'
  const [selectedState, setSelectedState] = useState('All-India NFSA');
  const [selectedTab, setSelectedTab] = useState('overview'); // 'overview' | 'categories' | 'steps' | 'documents' | 'onorc'

  const stateProvisions = {
    'All-India NFSA': {
      authority: 'District Supply Officer (DSO) / Food and Civil Supplies Department',
      portal: 'https://nfsa.gov.in',
      processingTime: '30 days under NFSA statutory standards',
      fees: 'Nominal card printing fee (₹10 to ₹50) or Free smart card'
    },
    'Tamil Nadu (TNPDS)': {
      authority: 'Taluk Supply Officer (TSO) / Civil Supplies Department',
      portal: 'https://www.tnpds.gov.in',
      processingTime: '15 to 30 working days',
      fees: 'Free smart card issuance on TNPDS'
    },
    'Uttar Pradesh (FCS)': {
      authority: 'Supply Inspector / Regional Food Controller',
      portal: 'https://fcs.up.gov.in',
      processingTime: '30 working days',
      fees: '₹20 online processing charges'
    }
  };

  const currentJurisdiction = stateProvisions[selectedState] || stateProvisions['All-India NFSA'];

  return (
    <div className="ration-card-guide max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 mb-2">
              <ShieldCheck className="w-3.5 h-3.5" /> National Food Security Act, 2013
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Ration Card Issuance &amp; Member Services Guide
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Plain-language instructions for applying for new household ration cards, adding or deleting family members, updating Fair Price Shops, and ONORC portability.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase">
              State:
            </label>
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="text-xs font-medium bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="All-India NFSA">All-India (NFSA Standard)</option>
              <option value="Tamil Nadu (TNPDS)">Tamil Nadu (TNPDS)</option>
              <option value="Uttar Pradesh (FCS)">Uttar Pradesh (FCS UP)</option>
            </select>
          </div>
        </div>

        {/* Action Pathway Selector */}
        <div className="mt-4 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Select Desired Service:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'new', label: 'New Household Card', icon: ShoppingBag },
              { id: 'add_member', label: 'Add Family Member', icon: UserPlus },
              { id: 'remove_member', label: 'Delete / Surrender Member', icon: UserMinus },
              { id: 'correction', label: 'Address / FPS Shift', icon: RefreshCw }
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedPath(p.id)}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                  selectedPath === p.id
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                <p.icon className="w-3 h-3" />
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 pt-6 border-t border-slate-200 dark:border-slate-800 mt-6">
          {[
            { id: 'overview', label: 'What This Document Is', icon: FileText },
            { id: 'categories', label: 'Card Categories (AAY/PHH)', icon: ShoppingBag },
            { id: 'steps', label: 'Application Journey', icon: Building },
            { id: 'documents', label: 'Documents & Deletion Slip', icon: CheckCircle },
            { id: 'onorc', label: 'ONORC & e-KYC', icon: MapPin }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = selectedTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedTab(tab.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-sm'
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
              What a Ration Card Proves
            </h3>
            <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed">
              <li>• Entitlement to subsidized foodgrains (rice, wheat, coarse grains) under the Targeted Public Distribution System (TPDS).</li>
              <li>• Official record of household composition and primary head of household (usually eldest female member).</li>
              <li>• Valid as supporting family relationship and residential proof for several state welfare programs.</li>
            </ul>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Legal Caveat: Not Proof of Citizenship
            </h3>
            <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed">
              <li>• The Supreme Court has repeatedly confirmed that a Ration Card is an entitlement document and does <strong>NOT establish Indian citizenship</strong>.</li>
              <li>• A person cannot be registered in more than one ration card anywhere in India. Duplicate listings trigger automated Aadhaar-deactivation.</li>
            </ul>
          </div>
        </div>
      )}

      {/* Tab 2: Categories */}
      {selectedTab === 'categories' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Ration Card Entitlement Tiers under NFSA
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="p-3.5 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-lg space-y-2">
                <span className="font-bold text-amber-900 dark:text-amber-200 block">
                  1. Antyodaya Anna Yojana (AAY)
                </span>
                <p className="text-slate-600 dark:text-slate-400">
                  Reserved for the poorest families. Fixed entitlement of <strong>35 kg of foodgrains per household per month</strong>.
                </p>
              </div>

              <div className="p-3.5 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded-lg space-y-2">
                <span className="font-bold text-blue-900 dark:text-blue-200 block">
                  2. Priority Households (PHH)
                </span>
                <p className="text-slate-600 dark:text-slate-400">
                  Eligible households based on state poverty and vulnerability indices. Entitlement of <strong>5 kg foodgrains per person per month</strong>.
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-lg space-y-2">
                <span className="font-bold text-slate-900 dark:text-slate-100 block">
                  3. Non-Priority (NPHH / White)
                </span>
                <p className="text-slate-600 dark:text-slate-400">
                  Above-poverty line households. Non-subsidized foodgrains or state-subsidized sugar/kerosene only.
                </p>
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
              Application Journey: {selectedPath === 'new' ? 'New Household Card' : selectedPath === 'add_member' ? 'Adding a Member' : selectedPath === 'remove_member' ? 'Deleting a Member' : 'Address Shifting'}
            </h3>

            {selectedPath === 'new' && (
              <ol className="text-xs text-slate-600 dark:text-slate-300 space-y-2.5 list-decimal pl-4 leading-relaxed">
                <li><strong>Obtain Deletion / Surrender Certificate:</strong> Applicant and spouse must secure a deletion certificate proving their names were removed from their parents' ration cards.</li>
                <li><strong>Apply Online on State PDS Portal:</strong> Fill application on the state Food portal ({currentJurisdiction.portal}) designating the eldest female member as the Head of the Household.</li>
                <li><strong>FPS Selection &amp; Revenue Field Verification:</strong> Select the nearest Fair Price Shop. The Supply Inspector visits the residence to verify family independence and kitchen setup.</li>
                <li><strong>Card Approval &amp; e-POS Seeding:</strong> Card is generated online. Family visits the local FPS to link biometrics on the electronic Point of Sale (e-POS) terminal.</li>
              </ol>
            )}

            {selectedPath === 'add_member' && (
              <ol className="text-xs text-slate-600 dark:text-slate-300 space-y-2.5 list-decimal pl-4 leading-relaxed">
                <li><strong>Newborn Baby:</strong> Submit child’s official Birth Certificate and parents' Aadhaar cards on the portal.</li>
                <li><strong>Newly Married Spouse:</strong> Submit Marriage Registration Certificate along with official Surrender/Deletion Certificate from spouse’s maiden ration card.</li>
                <li><strong>Supply Office Approval:</strong> Once approved online, the new member’s Aadhaar is seeded for monthly biometric ration withdrawal.</li>
              </ol>
            )}

            {selectedPath === 'remove_member' && (
              <ol className="text-xs text-slate-600 dark:text-slate-300 space-y-2.5 list-decimal pl-4 leading-relaxed">
                <li><strong>In Case of Demise:</strong> Upload the official Death Certificate to permanently remove the deceased member from the quota tally.</li>
                <li><strong>In Case of Marriage / Relocation:</strong> Apply for member surrender certificate to allow them to be added to their new household card.</li>
              </ol>
            )}

            {selectedPath === 'correction' && (
              <ol className="text-xs text-slate-600 dark:text-slate-300 space-y-2.5 list-decimal pl-4 leading-relaxed">
                <li><strong>Address Change:</strong> Upload registered rent agreement or utility bill for the new locality.</li>
                <li><strong>FPS Change:</strong> Select the new FPS dealer. Quota shifts to the new fair price shop from the 1st of the following month.</li>
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
              Document Checklist &amp; Deletion Slip Rule
            </h3>

            <div className="space-y-3">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Aadhaar Cards of All Family Members
                  </span>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded">
                    Mandatory
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Required for biometric e-POS linkage and deduplication against central PDS registries.
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Surrender / Deletion Certificate from Former Ration Card
                  </span>
                  <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded">
                    Mandatory for New Cards &amp; Married Spouses
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Proves that applicant or spouse has been removed from previous parental card. Applications without this slip are rejected.
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Residence Proof (Electricity Bill, Rent Agreement, LPG Passbook)
                  </span>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded">
                    Mandatory
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Proves residential jurisdiction for FPS dealer allocation.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: ONORC & e-KYC */}
      {selectedTab === 'onorc' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <MapPin className="w-5 h-5 text-emerald-600" />
              One Nation One Ration Card (ONORC) National Portability
            </h3>

            <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-lg text-xs space-y-2 text-slate-700 dark:text-slate-300 leading-relaxed">
              <p>
                <strong>Lifting Rations Anywhere in India:</strong> Under the ONORC initiative, migrant workers and families registered on an NFSA ration card in any state can collect their monthly foodgrain quota from <strong>ANY Fair Price Shop in India</strong> using their Aadhaar biometric authentication on the local e-POS machine.
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>No need to change your home state ration card when migrating for temporary work.</li>
                <li>Split rationing allows family members staying back in the native village to collect their share while the migrant worker lifts their portion in the host city.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Footnote */}
      <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
        This informational guide is grounded in the National Food Security Act, 2013 and official DFPD state citizen charters. Verified on 5 November 2026. Civic Help Setu does not process applications or manage PDS quotas.
      </div>
    </div>
  );
}
