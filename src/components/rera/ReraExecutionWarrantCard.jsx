import { useState, useMemo } from 'react';
import {
  Gavel,
  Copy,
  Check,
  Download,
  AlertTriangle,
  Building2,
  Clock,
  ShieldCheck,
  Save,
} from 'lucide-react';
import {
  RERA_JURISDICTIONS,
  calculateExecutionPostOrderInterest,
  generateSection40ExecutionPetition,
} from '../../services/reraDisputeService.js';

export default function ReraExecutionWarrantCard({ onSavePetition }) {
  const [jurisdiction, setJurisdiction] = useState('MAHARASHTRA');
  const [complainantName, setComplainantName] = useState('Aditya Narain');
  const [complainantAddress, setComplainantAddress] = useState('Flat 802, Orchid Tower, Powai, Mumbai - 400076');
  const [complainantContact, setComplainantContact] = useState('9820012345');

  const [promoterName, setPromoterName] = useState('Lodha Skyline Developers Pvt. Ltd.');
  const [projectName, setProjectName] = useState('Skyline Vista Phase 2');
  const [reraRegNo, setReraRegNo] = useState('P51800012345');
  const [registeredOffice, setRegisteredOffice] = useState('14th Floor, Skyline Hub, Lower Parel, Mumbai');

  const [orderNumber, setOrderNumber] = useState('MahaRERA/CC/2025/9482');
  const [orderDate, setOrderDate] = useState('2025-11-15');
  const [awardedAmountInr, setAwardedAmountInr] = useState(4850000);
  const [evaluationDate, setEvaluationDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [copied, setCopied] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const selectedJurisdiction = RERA_JURISDICTIONS[jurisdiction] || RERA_JURISDICTIONS.MAHARASHTRA;

  const executionCalculation = useMemo(() => {
    return calculateExecutionPostOrderInterest({
      orderDate,
      orderAwardInr: awardedAmountInr,
      evaluationDate,
      annualInterestRate: 10.75,
      statutoryComplianceGraceDays: 60,
    });
  }, [orderDate, awardedAmountInr, evaluationDate]);

  const executionPayload = useMemo(() => {
    return {
      recordType: 'EXECUTION_PETITION',
      jurisdiction,
      complainant: {
        name: complainantName,
        address: complainantAddress,
        contact: complainantContact,
      },
      promoter: {
        name: promoterName,
        projectName,
        reraRegNo,
        registeredOffice,
      },
      orderNumber,
      orderDate,
      awardedAmountInr: Number(awardedAmountInr) || 0,
      evaluationDate,
      calculation: executionCalculation,
    };
  }, [
    jurisdiction,
    complainantName,
    complainantAddress,
    complainantContact,
    promoterName,
    projectName,
    reraRegNo,
    registeredOffice,
    orderNumber,
    orderDate,
    awardedAmountInr,
    evaluationDate,
    executionCalculation,
  ]);

  const generatedPetition = useMemo(() => {
    return generateSection40ExecutionPetition(executionPayload);
  }, [executionPayload]);

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
    a.download = `RERA_Sec40_Execution_${orderNumber.replace(/[^a-zA-Z0-9]/g, '_')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSave = () => {
    if (typeof onSavePetition === 'function') {
      onSavePetition(executionPayload);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    }
  };

  return (
    <div className="space-y-6" data-testid="rera-execution-card">
      {/* Statutory Header */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 dark:bg-indigo-950/40 dark:border-indigo-800">
        <div className="flex items-start gap-3">
          <Gavel className="w-6 h-6 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-indigo-950 dark:text-indigo-200 text-lg">
              Section 40 Execution Petition & Revenue Recovery Certificate (RRC) Drafter
            </h3>
            <p className="text-sm text-indigo-800 dark:text-indigo-300 mt-1 leading-relaxed">
              When a builder fails to satisfy a RERA refund or compensation decree within the 60-day compliance window,
              Section 40(1) authorizes the issuance of a Revenue Recovery Certificate to the District Collector to recover
              amounts as arrears of land revenue. Section 40(2) empowers attachment of promoter bank accounts and properties.
            </p>
          </div>
        </div>
      </div>

      {/* Input Form Grid */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm">
        <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-gray-500" />
          Decree & Case Particulars
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
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
                  {j.stateName} - Execution Fee: ₹{j.executionFeeInr.toLocaleString('en-IN')}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Original RERA Complaint / Case No.
            </label>
            <input
              type="text"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              placeholder="e.g. MahaRERA/CC/2025/9482"
              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Date Order Pronounced
            </label>
            <input
              type="date"
              value={orderDate}
              onChange={(e) => setOrderDate(e.target.value)}
              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Total Decreetal Award Granted by Authority (₹)
            </label>
            <input
              type="number"
              min="0"
              step="10000"
              value={awardedAmountInr}
              onChange={(e) => setAwardedAmountInr(Number(e.target.value))}
              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Execution Evaluation Date
            </label>
            <input
              type="date"
              value={evaluationDate}
              onChange={(e) => setEvaluationDate(e.target.value)}
              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
        </div>

        {/* Parties Grid */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <h5 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Decree Holder (Allottee)
            </h5>
            <input
              type="text"
              value={complainantName}
              onChange={(e) => setComplainantName(e.target.value)}
              placeholder="Full Name"
              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <input
              type="text"
              value={complainantAddress}
              onChange={(e) => setComplainantAddress(e.target.value)}
              placeholder="Residential Address"
              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <input
              type="text"
              value={complainantContact}
              onChange={(e) => setComplainantContact(e.target.value)}
              placeholder="Phone / Mobile Number"
              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div className="space-y-3">
            <h5 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Judgment Debtor (Promoter)
            </h5>
            <input
              type="text"
              value={promoterName}
              onChange={(e) => setPromoterName(e.target.value)}
              placeholder="Promoter Company Name"
              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Project Name"
                className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <input
                type="text"
                value={reraRegNo}
                onChange={(e) => setReraRegNo(e.target.value)}
                placeholder="RERA Reg. No."
                className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <input
              type="text"
              value={registeredOffice}
              onChange={(e) => setRegisteredOffice(e.target.value)}
              placeholder="Registered Office Address"
              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
        </div>
      </div>

      {/* Live Statutory Calculation Banner */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm">
          <span className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">Original Award</span>
          <div className="text-xl font-bold text-gray-900 dark:text-white mt-1 font-mono">
            ₹{executionCalculation.orderAwardInr.toLocaleString('en-IN')}
          </div>
          <span className="text-xs text-gray-500">Principal + interest awarded</span>
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm">
          <span className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">Compliance Status</span>
          <div className="mt-1 flex items-center gap-2">
            {executionCalculation.isDefaulted ? (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-300">
                <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                Defaulted ({executionCalculation.overdueDays}d overdue)
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
                <Clock className="w-3.5 h-3.5 mr-1" />
                Within 60-day window
              </span>
            )}
          </div>
          <span className="text-xs text-gray-500">Deadline: {executionCalculation.complianceDeadlineDate}</span>
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm">
          <span className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">Post-Decree Interest</span>
          <div className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1 font-mono">
            ₹{executionCalculation.postOrderInterestInr.toLocaleString('en-IN')}
          </div>
          <span className="text-xs text-gray-500">@ {executionCalculation.annualInterestRate}% p.a.</span>
        </div>

        <div className="bg-gradient-to-br from-indigo-900 to-indigo-950 text-white rounded-xl p-4 shadow-sm">
          <span className="text-xs text-indigo-300 uppercase font-semibold">Total Recoverable Debt</span>
          <div className="text-2xl font-black text-white mt-1 font-mono">
            ₹{executionCalculation.totalExecutableDebtInr.toLocaleString('en-IN')}
          </div>
          <span className="text-xs text-indigo-300">Section 40(1) Recoverable Sum</span>
        </div>
      </div>

      {/* Petition Drafter Preview */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
          <div>
            <h4 className="text-base font-semibold text-gray-900 dark:text-white">
              Generated Court-Ready Section 40 Execution Petition
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Verified legal format for submission before {selectedJurisdiction.authorityName}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
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

            {typeof onSavePetition === 'function' && (
              <button
                type="button"
                onClick={handleSave}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-emerald-600 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 transition-colors"
              >
                {savedSuccess ? <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> : <Save className="w-3.5 h-3.5" />}
                {savedSuccess ? 'Saved in Vault!' : 'Save Execution'}
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
