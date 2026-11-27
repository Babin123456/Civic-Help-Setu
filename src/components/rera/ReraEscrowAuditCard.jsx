import { useState, useMemo } from 'react';
import {
  DollarSign,
  Copy,
  Check,
  Download,
  AlertTriangle,
  Building2,
  Save,
  ShieldCheck,
} from 'lucide-react';
import {
  RERA_JURISDICTIONS,
  auditProjectEscrowCompliance,
  generateSection35EscrowInvestigationPetition,
} from '../../services/reraDisputeService.js';

export default function ReraEscrowAuditCard({ onSaveAudit }) {
  const [jurisdiction, setJurisdiction] = useState('MAHARASHTRA');

  const [applicantName, setApplicantName] = useState('Apex Allottees Welfare Association');
  const [promoterName, setPromoterName] = useState('Nirvana Lifespaces Ltd.');
  const [projectName, setProjectName] = useState('Nirvana Serenity Towers');
  const [reraRegNo, setReraRegNo] = useState('P52000045678');

  const [totalEstimatedProjectCostInr, setTotalEstimatedProjectCostInr] = useState(120000000); // 12 Crores
  const [totalAllotteeCollectionsInr, setTotalAllotteeCollectionsInr] = useState(90000000);   // 9 Crores
  const [certifiedCompletionPercentage, setCertifiedCompletionPercentage] = useState(40);     // 40% certified
  const [totalFundsWithdrawnInr, setTotalFundsWithdrawnInr] = useState(72000000);             // 7.2 Crores withdrawn
  const [currentEscrowBalanceInr, setCurrentEscrowBalanceInr] = useState(5000000);             // 50 Lakhs balance

  const [copied, setCopied] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const selectedJurisdiction = RERA_JURISDICTIONS[jurisdiction] || RERA_JURISDICTIONS.MAHARASHTRA;

  const auditReport = useMemo(() => {
    return auditProjectEscrowCompliance({
      totalEstimatedProjectCostInr,
      totalAllotteeCollectionsInr,
      certifiedCompletionPercentage,
      totalFundsWithdrawnInr,
      currentEscrowBalanceInr,
    });
  }, [
    totalEstimatedProjectCostInr,
    totalAllotteeCollectionsInr,
    certifiedCompletionPercentage,
    totalFundsWithdrawnInr,
    currentEscrowBalanceInr,
  ]);

  const auditPayload = useMemo(() => {
    return {
      recordType: 'ESCROW_AUDIT',
      jurisdiction,
      complainant: { name: applicantName },
      promoter: { name: promoterName, projectName, reraRegNo },
      totalEstimatedProjectCostInr,
      totalAllotteeCollectionsInr,
      certifiedCompletionPercentage,
      totalFundsWithdrawnInr,
      currentEscrowBalanceInr,
      auditReport,
    };
  }, [
    jurisdiction,
    applicantName,
    promoterName,
    projectName,
    reraRegNo,
    totalEstimatedProjectCostInr,
    totalAllotteeCollectionsInr,
    certifiedCompletionPercentage,
    totalFundsWithdrawnInr,
    currentEscrowBalanceInr,
    auditReport,
  ]);

  const generatedPetition = useMemo(() => {
    return generateSection35EscrowInvestigationPetition(auditPayload);
  }, [auditPayload]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedPetition);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleDownloadSlip = () => {
    const blob = new Blob([generatedPetition], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `RERA_Sec35_EscrowAudit_${projectName.replace(/[^a-zA-Z0-9]/g, '_')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSave = () => {
    if (typeof onSaveAudit === 'function') {
      onSaveAudit(auditPayload);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    }
  };

  return (
    <div className="space-y-6" data-testid="rera-escrow-card">
      {/* Statutory Header */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 dark:bg-emerald-950/40 dark:border-emerald-800">
        <div className="flex items-start gap-3">
          <DollarSign className="w-6 h-6 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-emerald-950 dark:text-emerald-200 text-lg">
              Section 4(2)(l)(D) 70% Dedicated Escrow Account Audit & Diversion Detector
            </h3>
            <p className="text-sm text-emerald-800 dark:text-emerald-300 mt-1 leading-relaxed">
              Under Section 4(2)(l)(D) of RERA, 70% of all funds collected from allottees must be held in a separate scheduled
              bank account. Withdrawals are strictly limited to the percentage of project completion certified by an Engineer,
              Architect, and practicing Chartered Accountant. Unlawful diversions trigger investigations under Section 35 and
              penalties up to 5% of project cost under Sections 60 &amp; 61.
            </p>
          </div>
        </div>
      </div>

      {/* Inputs Form */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm">
        <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-gray-500" />
          Project Cost & Banking Particulars
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              State RERA Jurisdiction
            </label>
            <select
              value={jurisdiction}
              onChange={(e) => setJurisdiction(e.target.value)}
              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {Object.values(RERA_JURISDICTIONS).map((j) => (
                <option key={j.id} value={j.id}>
                  {j.stateName} ({j.authorityName})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Applicant Name (Allottee / Association of Allottees)
            </label>
            <input
              type="text"
              value={applicantName}
              onChange={(e) => setApplicantName(e.target.value)}
              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Promoter Developer Entity
            </label>
            <input
              type="text"
              value={promoterName}
              onChange={(e) => setPromoterName(e.target.value)}
              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Project Name
            </label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              RERA Registration Number
            </label>
            <input
              type="text"
              value={reraRegNo}
              onChange={(e) => setReraRegNo(e.target.value)}
              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Total Estimated Project Cost (₹)
            </label>
            <input
              type="number"
              min="0"
              step="1000000"
              value={totalEstimatedProjectCostInr}
              onChange={(e) => setTotalEstimatedProjectCostInr(Number(e.target.value))}
              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Total Collections from Allottees (₹)
            </label>
            <input
              type="number"
              min="0"
              step="1000000"
              value={totalAllotteeCollectionsInr}
              onChange={(e) => setTotalAllotteeCollectionsInr(Number(e.target.value))}
              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Certified Physical Completion (%)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={certifiedCompletionPercentage}
              onChange={(e) => setCertifiedCompletionPercentage(Number(e.target.value))}
              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Total Funds Withdrawn by Promoter (₹)
            </label>
            <input
              type="number"
              min="0"
              step="500000"
              value={totalFundsWithdrawnInr}
              onChange={(e) => setTotalFundsWithdrawnInr(Number(e.target.value))}
              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Current Balance in Dedicated Escrow Account (₹)
            </label>
            <input
              type="number"
              min="0"
              step="500000"
              value={currentEscrowBalanceInr}
              onChange={(e) => setCurrentEscrowBalanceInr(Number(e.target.value))}
              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono"
            />
          </div>
        </div>
      </div>

      {/* Forensic Audit Results */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm">
          <span className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">Mandatory 70% Escrow</span>
          <div className="text-xl font-bold text-gray-900 dark:text-white mt-1 font-mono">
            ₹{auditReport.mandatoryEscrowRetentionInr.toLocaleString('en-IN')}
          </div>
          <span className="text-xs text-gray-500">70% of collections</span>
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm">
          <span className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">Max Allowable Withdrawal</span>
          <div className="text-xl font-bold text-indigo-600 dark:text-indigo-400 mt-1 font-mono">
            ₹{auditReport.maximumPermissibleWithdrawalInr.toLocaleString('en-IN')}
          </div>
          <span className="text-xs text-gray-500">Based on {auditReport.certifiedCompletionPercentage}% completion</span>
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm">
          <span className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">Unauthorized Diversion</span>
          <div className={`text-xl font-bold mt-1 font-mono ${
            auditReport.unauthorizedEscrowDiversionInr > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'
          }`}>
            ₹{auditReport.unauthorizedEscrowDiversionInr.toLocaleString('en-IN')}
          </div>
          <div className="mt-1">
            {auditReport.isCompliant ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
                Compliant
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-300">
                <AlertTriangle className="w-3 h-3 mr-1" />
                {auditReport.riskCategory === 'SEVERE_DIVERSION' ? 'Severe Diversion' : 'Moderate Deficit'}
              </span>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm">
          <span className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">Sec 60/61 Penalty Exposure</span>
          <div className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1 font-mono">
            ₹{(auditReport.section60PenaltyMaxInr + auditReport.section61PenaltyMaxInr).toLocaleString('en-IN')}
          </div>
          <span className="text-xs text-gray-500">Up to 10% of total project cost</span>
        </div>
      </div>

      {/* Petition Drafter Preview */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
          <div>
            <h4 className="text-base font-semibold text-gray-900 dark:text-white">
              Section 35 &amp; 36 Forensic Investigation &amp; Account Freezing Petition
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Verified legal petition for submission before {selectedJurisdiction.authorityName}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied!' : 'Copy Petition'}
            </button>

            <button
              type="button"
              onClick={handleDownloadSlip}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Download Slip
            </button>

            {typeof onSaveAudit === 'function' && (
              <button
                type="button"
                onClick={handleSave}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-emerald-600 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 transition-colors"
              >
                {savedSuccess ? <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> : <Save className="w-3.5 h-3.5" />}
                {savedSuccess ? 'Saved in Vault!' : 'Save Audit'}
              </button>
            )}
          </div>
        </div>

        <textarea
          readOnly
          rows={14}
          value={generatedPetition}
          className="w-full text-xs font-mono bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 p-4 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none"
        />
      </div>
    </div>
  );
}
