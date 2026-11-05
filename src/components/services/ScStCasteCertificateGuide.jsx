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
  Award
} from 'lucide-react';

/**
 * ScStCasteCertificateGuide Component
 *
 * Implements Issue #504: Scannable citizen guide for SC/ST Caste Certificate application,
 * competent revenue authorities, ancestor/lineage evidence, 1950 residence cut-off rules,
 * field enquiry stages, lifetime validity, and official portal routes.
 */
export default function ScStCasteCertificateGuide({ service, onBack }) {
  const [selectedState, setSelectedState] = useState('Central Guidelines');
  const [selectedTab, setSelectedTab] = useState('overview'); // 'overview' | 'steps' | 'documents' | 'jurisdiction' | 'faq'

  const stateProvisions = {
    'Central Guidelines': {
      authority: 'District Magistrate / Sub-Divisional Magistrate (SDM) / Tehsildar',
      portal: 'https://services.india.gov.in',
      validity: 'Lifetime validity (Unless revoked on grounds of fraud or misrepresentation)',
      statutoryProcessingTime: '30 to 60 days including mandatory field verification',
      fees: 'Nominal court fee stamp (Usually ₹10 to ₹50 or Free at e-District centers)'
    },
    'Maharashtra': {
      authority: 'Sub-Divisional Officer (SDO) / District Caste Scrutiny Committee',
      portal: 'https://aaplesarkar.mahaonline.gov.in',
      validity: 'Lifetime validity; requires separate Caste Validity Certificate for higher education/jobs',
      statutoryProcessingTime: '45 days under Right to Public Services Act',
      fees: '₹20 to ₹33 portal processing charges'
    },
    'Tamil Nadu': {
      authority: 'RDO (Revenue Divisional Officer) for ST; Tehsildar for SC',
      portal: 'https://www.tnesevai.tn.gov.in',
      validity: 'Permanent community certificate (Lifetime validity)',
      statutoryProcessingTime: '30 days for SC; 60 days with District Level Vigilance Committee for ST',
      fees: '₹60 nominal e-Sevai user charge'
    }
  };

  const currentJurisdiction = stateProvisions[selectedState] || stateProvisions['Central Guidelines'];

  return (
    <div className="sc-st-certificate-guide max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 mb-2">
              <ShieldCheck className="w-3.5 h-3.5" /> Constitutional Reservation Document
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              SC / ST Caste Certificate Application Guide
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Statutory guidance on applying for Scheduled Caste (SC) and Scheduled Tribe (ST) certificates under Articles 341 &amp; 342 of the Constitution of India.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase">
              State / Rules:
            </label>
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="text-xs font-medium bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="Central Guidelines">Central Standard Guidelines</option>
              <option value="Maharashtra">Maharashtra (Aaple Sarkar)</option>
              <option value="Tamil Nadu">Tamil Nadu (e-Sevai)</option>
            </select>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 pt-6 border-t border-slate-200 dark:border-slate-800 mt-6">
          {[
            { id: 'overview', label: 'What This Document Is', icon: FileText },
            { id: 'steps', label: 'Application Journey', icon: Building },
            { id: 'documents', label: 'Required Lineage Evidence', icon: CheckCircle },
            { id: 'jurisdiction', label: 'Cut-off & Migration Rules', icon: MapPin },
            { id: 'faq', label: 'Common Pitfalls & Validity', icon: AlertTriangle }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = selectedTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedTab(tab.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-purple-600 text-white shadow-sm'
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
              What This Certificate Proves
            </h3>
            <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed">
              <li>• Official certification that the individual belongs to a community recognized as Scheduled Caste or Scheduled Tribe in the Presidential Orders.</li>
              <li>• Entitles the holder to constitutional reservation in education, government recruitment, and legislative seats.</li>
              <li>• Valid for a lifetime across the citizen’s life unless explicitly cancelled by an appellate authority.</li>
            </ul>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              What It Does NOT Do
            </h3>
            <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed">
              <li>• <strong>No Automatic Job/College Admission:</strong> It confirms status, but candidate must still qualify according to the relevant exam cutoff.</li>
              <li>• <strong>No Creamy Layer Restriction:</strong> Unlike OBC Non-Creamy Layer certificates, SC and ST certificates have NO family income ceiling.</li>
              <li>• <strong>Caste Cannot Be Inferred:</strong> No digital tool or profile can assume or certify caste; it requires revenue department inquiry.</li>
            </ul>
          </div>

          <div className="md:col-span-2 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Award className="w-4 h-4 text-purple-600" />
              Caste Certificate vs. Caste Validity Certificate
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              In several states (such as Maharashtra, Gujarat, and Andhra Pradesh), receiving the initial Caste Certificate is Step 1. When securing professional college admissions (medical/engineering) or government employment, candidates must submit their file to a statutory <strong>Caste Scrutiny Committee</strong> to obtain a <em>Caste Validity Certificate</em>.
            </p>
          </div>
        </div>
      )}

      {/* Tab 2: Application Journey */}
      {selectedTab === 'steps' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Application Journey &amp; Verification Stages
            </h3>

            <ol className="text-xs text-slate-600 dark:text-slate-300 space-y-3 list-decimal pl-4 leading-relaxed">
              <li>
                <strong>Filing Application:</strong> Submit online via the designated State Revenue / e-District portal ({currentJurisdiction.portal}) or in-person at the local Citizen Service Center (CSC / e-Sevai / MeeSeva).
              </li>
              <li>
                <strong>Lineage &amp; Document Scrutiny:</strong> The application is forwarded to the local Revenue Inspector (RI) and Village Administrative Officer / Patwari.
              </li>
              <li>
                <strong>Field Enquiry &amp; Neighborhood Verification:</strong> The revenue officer visits the applicant’s native locality, checks school records, examines ancestral land documents, and records statements from village elders or ward councillors.
              </li>
              <li>
                <strong>Sub-Divisional Magistrate / Tehsildar Approval:</strong> Upon receiving a positive inquiry report, the designated competent authority digitally approves the certificate.
              </li>
              <li>
                <strong>Digitally Signed Issuance:</strong> Certificate is generated with a unique QR code and digital signature, downloadable from the portal or collected from the CSC.
              </li>
            </ol>

            <div className="border-t border-slate-200 dark:border-slate-800 pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                  Designated Competent Authority:
                </span>
                <span className="text-slate-600 dark:text-slate-400">{currentJurisdiction.authority}</span>
              </div>
              <a
                href={currentJurisdiction.portal}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-purple-600 hover:text-purple-700 underline font-semibold"
              >
                Access Portal ({currentJurisdiction.portal}) <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Documents */}
      {selectedTab === 'documents' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Required Lineage Evidence &amp; Supporting Documents
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Under Supreme Court guidelines (Madhuri Patil case), the primary evidence of caste is bloodline lineage.
            </p>

            <div className="space-y-3">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Paternal Relative’s Caste Certificate (Father, Paternal Uncle, Grandfather)
                  </span>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded">
                    Primary Proof
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Caste is acquired by birth through the father's bloodline in Indian personal law. Maternal documents are only considered in special circumstances (single mother / abandoned child).
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    School Leaving Certificate / General Register Extract
                  </span>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded">
                    Essential
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Primary school admission registers or 10th school leaving certificates of applicant and father mentioning community/sub-caste.
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Ancestral Residence Record (Prior to 1950 Cut-Off)
                  </span>
                  <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded">
                    Statutory Cut-Off Proof
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Old land ownership records (Khatiyan, Jamabandi, Sale deed), village census extract, or ancestral voter lists proving residence in the home state prior to 1950.
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Self-Declaration Affidavit (Form Format)
                  </span>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded">
                    Mandatory
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Sworn affidavit affirming caste name, sub-caste, native place, and declaring no false representation under penalty of law.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Cut-Off & Migration */}
      {selectedTab === 'jurisdiction' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <MapPin className="w-5 h-5 text-purple-600" />
              1950 Cut-Off Date &amp; Inter-State Migration Rules
            </h3>

            <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/30 rounded-lg border border-slate-200 dark:border-slate-800">
                <span className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
                  The Constitutional Cut-Off Year (1950):
                </span>
                Under the Constitution (Scheduled Castes) Order 1950, reservation is granted in relation to a specific State or Union Territory. The applicant must prove that their ancestors resided in that specific State on or before the date of the Presidential Order (10 August 1950 for SC; 1950 for ST).
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/30 rounded-lg border border-slate-200 dark:border-slate-800">
                <span className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
                  What Happens If Your Family Migrated After 1950?
                </span>
                If your family migrated from State A (e.g. Bihar) to State B (e.g. Delhi or Maharashtra) after 1950:
                <br />
                • You are entitled to an SC/ST certificate based on your parent's home state (State A).
                <br />
                • The certificate will explicitly mention that you are a migrant from State A.
                <br />
                • You will be entitled to central government benefits, but generally NOT to state-level benefits in the host State B.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: FAQ & Validity */}
      {selectedTab === 'faq' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Common Pitfalls &amp; Validity Clarifications
            </h3>

            <div className="space-y-3">
              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 text-xs space-y-1">
                <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                  Does an SC or ST Certificate Expire?
                </span>
                <p className="text-slate-600 dark:text-slate-400">
                  No. An SC/ST certificate has permanent, lifetime validity. Unlike OBC or EWS certificates, there is no annual income assessment or renewal required.
                </p>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 text-xs space-y-1">
                <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                  Spelling Inconsistencies between Sub-Caste and Gazette
                </span>
                <p className="text-slate-600 dark:text-slate-400">
                  The sub-caste name must match the exact spelling recognized in the Presidential Order. Variations or local colloquial names will lead to application rejection by the Revenue Department.
                </p>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 text-xs space-y-1">
                <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                  Can Caste Status be Transferred upon Marriage?
                </span>
                <p className="text-slate-600 dark:text-slate-400">
                  No. The Supreme Court has repeatedly held that a person born into a non-reserved category cannot claim SC/ST status merely by marrying an SC or ST spouse.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Official Footnote */}
      <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
        This informational guide is grounded in Ministry of Social Justice &amp; Empowerment guidelines and constitutional orders. Verified on 5 November 2026. Civic Help Setu does not issue certificates or determine caste eligibility.
      </div>
    </div>
  );
}
