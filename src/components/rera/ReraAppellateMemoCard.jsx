import { useState, useMemo } from 'react';
import {
  Scale,
  Copy,
  Check,
  Download,
  ShieldAlert,
  FileCheck,
  Save,
  ShieldCheck,
} from 'lucide-react';
import {
  RERA_JURISDICTIONS,
  RERA_REAT_ORDER_TYPE,
  evaluateReatPreDepositRequirement,
  generateReatAppealDismissalObjection,
  generateReatMemorandumOfAppeal,
} from '../../services/reraDisputeService.js';

export default function ReraAppellateMemoCard({ onSaveAppeal }) {
  const [jurisdiction, setJurisdiction] = useState('MAHARASHTRA');
  const [viewMode, setViewMode] = useState('BUILDER_APPEAL_OBJECTION'); // 'BUILDER_APPEAL_OBJECTION' or 'ALLOTTEE_APPEAL_MEMO'

  const [complainantName, setComplainantName] = useState('Sunita Deshmukh');
  const [complainantAddress, setComplainantAddress] = useState('B-403, Lakeview Enclave, Thane West, Maharashtra');
  const [promoterName, setPromoterName] = useState('Prime Realcon Infrastructure Pvt. Ltd.');

  const [originalOrderNumber, setOriginalOrderNumber] = useState('MahaRERA/Order/2025/7123');
  const [appealNumber, setAppealNumber] = useState('AT/2026/0491');
  const [orderDate, setOrderDate] = useState('2025-12-01');
  const [certifiedCopyDate, setCertifiedCopyDate] = useState('2025-12-10');

  const [totalAwardedInr, setTotalAwardedInr] = useState(5400000);
  const [penaltyAmountInr, setPenaltyAmountInr] = useState(500000);
  const [orderType, setOrderType] = useState(RERA_REAT_ORDER_TYPE.REFUND_COMPENSATION);

  const [copied, setCopied] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const selectedJurisdiction = RERA_JURISDICTIONS[jurisdiction] || RERA_JURISDICTIONS.MAHARASHTRA;

  const preDepositEval = useMemo(() => {
    return evaluateReatPreDepositRequirement({
      appealFilerRole: 'PROMOTER',
      orderType,
      penaltyAmountInr,
      totalRefundAwardInr: totalAwardedInr,
    });
  }, [orderType, penaltyAmountInr, totalAwardedInr]);

  const objectionPetitionText = useMemo(() => {
    return generateReatAppealDismissalObjection({
      jurisdiction,
      complainant: { name: complainantName, address: complainantAddress },
      promoter: { name: promoterName },
      originalOrderNumber,
      appealNumber,
      orderDate,
      totalAwardedInr,
    });
  }, [jurisdiction, complainantName, complainantAddress, promoterName, originalOrderNumber, appealNumber, orderDate, totalAwardedInr]);

  const allotteeAppealMemoText = useMemo(() => {
    return generateReatMemorandumOfAppeal({
      jurisdiction,
      complainant: { name: complainantName, address: complainantAddress },
      promoter: { name: promoterName },
      originalOrderNumber,
      orderDate,
      certifiedCopyDate,
      limitationExpiryDate: '60 days from receipt of certified order copy',
    });
  }, [jurisdiction, complainantName, complainantAddress, promoterName, originalOrderNumber, orderDate, certifiedCopyDate]);

  const activeText = viewMode === 'BUILDER_APPEAL_OBJECTION' ? objectionPetitionText : allotteeAppealMemoText;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(activeText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleDownloadSlip = () => {
    const filename = viewMode === 'BUILDER_APPEAL_OBJECTION'
      ? `REAT_Sec43_Objection_${appealNumber.replace(/[^a-zA-Z0-9]/g, '_')}.txt`
      : `REAT_Sec44_AppealMemo_${originalOrderNumber.replace(/[^a-zA-Z0-9]/g, '_')}.txt`;

    const blob = new Blob([activeText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSave = () => {
    if (typeof onSaveAppeal === 'function') {
      onSaveAppeal({
        recordType: 'REAT_APPEAL',
        viewMode,
        jurisdiction,
        complainant: { name: complainantName, address: complainantAddress },
        promoter: { name: promoterName },
        originalOrderNumber,
        appealNumber,
        orderDate,
        totalAwardedInr,
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    }
  };

  return (
    <div className="space-y-6" data-testid="rera-appellate-card">
      {/* Statutory Header */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 dark:bg-amber-950/40 dark:border-amber-800">
        <div className="flex items-start gap-3">
          <Scale className="w-6 h-6 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-amber-950 dark:text-amber-200 text-lg">
              RERA Appellate Tribunal (REAT) Section 43(5) & 44 Workspace
            </h3>
            <p className="text-sm text-amber-900 dark:text-amber-300 mt-1 leading-relaxed">
              Under Section 43(5) of RERA 2016 and Supreme Court precedent (<em>Newtech Promoters, 2021</em>),
              a builder cannot appeal against an order awarding refund or interest without depositing 100% of the
              awarded amount upfront. If the builder files an appeal without proof of pre-deposit, homebuyers can
              file an Objection Petition for summary dismissal in limine.
            </p>
          </div>
        </div>
      </div>

      {/* Mode Switcher */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={() => setViewMode('BUILDER_APPEAL_OBJECTION')}
          className={`flex-1 p-4 rounded-xl border text-left transition-all ${
            viewMode === 'BUILDER_APPEAL_OBJECTION'
              ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/50 shadow-sm'
              : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center gap-2 font-semibold text-sm text-gray-900 dark:text-white">
            <ShieldAlert className="w-4 h-4 text-indigo-600" />
            Builder Filed Appeal Against Me
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Section 43(5) 100% Pre-Deposit Threshold Objection Petition for summary dismissal.
          </p>
        </button>

        <button
          type="button"
          onClick={() => setViewMode('ALLOTTEE_APPEAL_MEMO')}
          className={`flex-1 p-4 rounded-xl border text-left transition-all ${
            viewMode === 'ALLOTTEE_APPEAL_MEMO'
              ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/50 shadow-sm'
              : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center gap-2 font-semibold text-sm text-gray-900 dark:text-white">
            <FileCheck className="w-4 h-4 text-indigo-600" />
            I Want to Appeal Authority Order
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Section 44 Memorandum of Appeal within 60 days (Allottees are 100% exempt from pre-deposit).
          </p>
        </button>
      </div>

      {/* Inputs Form */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tribunal Jurisdiction
            </label>
            <select
              value={jurisdiction}
              onChange={(e) => setJurisdiction(e.target.value)}
              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {Object.values(RERA_JURISDICTIONS).map((j) => (
                <option key={j.id} value={j.id}>
                  {j.stateName} REAT (Appeal Fee: ₹{j.reatAppealFeeInr.toLocaleString('en-IN')})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Original RERA Complaint / Order No.
            </label>
            <input
              type="text"
              value={originalOrderNumber}
              onChange={(e) => setOriginalOrderNumber(e.target.value)}
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

        {viewMode === 'BUILDER_APPEAL_OBJECTION' ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                REAT Appeal No. Assigned by Registry
              </label>
              <input
                type="text"
                value={appealNumber}
                onChange={(e) => setAppealNumber(e.target.value)}
                placeholder="e.g. AT/2026/0491"
                className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Subject Matter of Order
              </label>
              <select
                value={orderType}
                onChange={(e) => setOrderType(e.target.value)}
                className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value={RERA_REAT_ORDER_TYPE.REFUND_COMPENSATION}>
                  Refund & Interest Awarded to Allottee (100% Mandatory Pre-Deposit)
                </option>
                <option value={RERA_REAT_ORDER_TYPE.PENALTY}>
                  Penal Sanction under Sec 59/60 (30% Mandatory Pre-Deposit)
                </option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                {orderType === RERA_REAT_ORDER_TYPE.PENALTY ? 'Penalty Imposed (₹)' : 'Total Awarded Sum (₹)'}
              </label>
              <input
                type="number"
                min="0"
                step="50000"
                value={orderType === RERA_REAT_ORDER_TYPE.PENALTY ? penaltyAmountInr : totalAwardedInr}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (orderType === RERA_REAT_ORDER_TYPE.PENALTY) {
                    setPenaltyAmountInr(val);
                  } else {
                    setTotalAwardedInr(val);
                  }
                }}
                className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono"
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Date Certified Copy Received from RERA Registry
              </label>
              <input
                type="date"
                value={certifiedCopyDate}
                onChange={(e) => setCertifiedCopyDate(e.target.value)}
                className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Statutory Limitation Window
              </label>
              <input
                type="text"
                readOnly
                value="60 Days under Section 44(2) of RERA, 2016"
                className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
              />
            </div>
          </div>
        )}

        {/* Parties Grid */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Allottee Full Name & Address
            </label>
            <input
              type="text"
              value={complainantName}
              onChange={(e) => setComplainantName(e.target.value)}
              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 mb-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <input
              type="text"
              value={complainantAddress}
              onChange={(e) => setComplainantAddress(e.target.value)}
              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Promoter Company / Entity
            </label>
            <input
              type="text"
              value={promoterName}
              onChange={(e) => setPromoterName(e.target.value)}
              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
        </div>
      </div>

      {/* Pre-Deposit Requirement Breakdown (Builder Appeal Mode) */}
      {viewMode === 'BUILDER_APPEAL_OBJECTION' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm">
            <span className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">Pre-Deposit Requirement</span>
            <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1 font-mono">
              {preDepositEval.mandatoryPreDepositPercentage}%
            </div>
            <span className="text-xs text-gray-500">Statutory threshold under Section 43(5)</span>
          </div>

          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm">
            <span className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">Mandatory Deposit Sum</span>
            <div className="text-2xl font-black text-gray-900 dark:text-white mt-1 font-mono">
              ₹{preDepositEval.mandatoryDepositInr.toLocaleString('en-IN')}
            </div>
            <span className="text-xs text-gray-500">Must be deposited prior to hearing</span>
          </div>

          <div className="bg-indigo-900 text-white rounded-xl p-4 shadow-sm">
            <span className="text-xs text-indigo-200 uppercase font-semibold">Supreme Court Precedent</span>
            <div className="text-sm font-bold text-white mt-1">
              Newtech Promoters (2021)
            </div>
            <p className="text-xs text-indigo-200 mt-1">
              Deposit is condition sine qua non; REAT has zero discretion to waive 100% deposit.
            </p>
          </div>
        </div>
      )}

      {/* Petition Drafter Preview */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
          <div>
            <h4 className="text-base font-semibold text-gray-900 dark:text-white">
              {viewMode === 'BUILDER_APPEAL_OBJECTION'
                ? 'Section 43(5) Statutory Dismissal in Limine Objection'
                : 'Section 44 Memorandum of Appeal to REAT'}
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Verified legal petition ready for filing before {selectedJurisdiction.stateName} REAT
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied!' : 'Copy Document'}
            </button>

            <button
              type="button"
              onClick={handleDownloadSlip}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Download Slip
            </button>

            {typeof onSaveAppeal === 'function' && (
              <button
                type="button"
                onClick={handleSave}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-emerald-600 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 transition-colors"
              >
                {savedSuccess ? <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> : <Save className="w-3.5 h-3.5" />}
                {savedSuccess ? 'Saved in Vault!' : 'Save Document'}
              </button>
            )}
          </div>
        </div>

        <textarea
          readOnly
          rows={14}
          value={activeText}
          className="w-full text-xs font-mono bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 p-4 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none"
        />
      </div>
    </div>
  );
}
