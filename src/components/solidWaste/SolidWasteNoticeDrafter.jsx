import { useState, useMemo } from 'react';
import {
  Copy,
  Check,
  Download,
  Building,
  Save,
  ShieldCheck,
  Scale,
} from 'lucide-react';
import {
  NGT_ZONAL_BENCHES,
  generateRule15StatutoryNotice,
  generateNgtSection14Application,
} from '../../services/solidWasteAuditService.js';

export default function SolidWasteNoticeDrafter({
  calculationData,
  onSaveNotice,
}) {
  const [noticeType, setNoticeType] = useState('RULE_15_NOTICE'); // 'RULE_15_NOTICE' or 'NGT_SECTION_14'
  const [bench, setBench] = useState('WESTERN_BENCH_PUNE');

  const [complainantName, setComplainantName] = useState('Rajesh Kulkarni (Joint Secretary, RWA)');
  const [complainantAddress] = useState('A-201, Green Meadows, Kothrud, Pune - 411038');
  const [complainantContact] = useState('9823012345');

  const [locationAddress, setLocationAddress] = useState('Survey No. 48, Behind Green Meadows, Near Ram Nadi Culvert');
  const [wardNumber, setWardNumber] = useState('Ward 28 (Kothrud-Bavdhan)');
  const [city, setCity] = useState('Pune');
  const [state, setState] = useState('Maharashtra');

  const [respondentMunicipal, setRespondentMunicipal] = useState('Pune Municipal Corporation (PMC)');
  const [respondentSpcb, setRespondentSpcb] = useState('Maharashtra Pollution Control Board (MPCB)');

  const [copied, setCopied] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const noticePayload = useMemo(() => {
    return {
      auditType: noticeType,
      bench,
      complainant: {
        name: complainantName,
        address: complainantAddress,
        contact: complainantContact,
      },
      location: {
        address: locationAddress,
        ward: wardNumber,
        city,
        state,
      },
      respondentMunicipal,
      respondentSpcb,
      calculation: calculationData || {
        dumpVolumeCuM: 750,
        estimatedTonnage: 337.5,
        estimatedRemediationCostInr: 185625,
        defaultDays: 45,
        finalEnvironmentalCompensationInr: 1080000,
        activeBurningObserved: true,
      },
    };
  }, [
    noticeType,
    bench,
    complainantName,
    complainantAddress,
    complainantContact,
    locationAddress,
    wardNumber,
    city,
    state,
    respondentMunicipal,
    respondentSpcb,
    calculationData,
  ]);

  const generatedText = useMemo(() => {
    if (noticeType === 'NGT_SECTION_14') {
      return generateNgtSection14Application(noticePayload);
    }
    return generateRule15StatutoryNotice(noticePayload);
  }, [noticeType, noticePayload]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleDownloadSlip = () => {
    const filename = noticeType === 'NGT_SECTION_14'
      ? `NGT_Section14_Application_${city}.txt`
      : `Rule15_Statutory_Notice_${city}.txt`;

    const blob = new Blob([generatedText], { type: 'text/plain;charset=utf-8' });
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
    if (typeof onSaveNotice === 'function') {
      onSaveNotice(noticePayload);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    }
  };

  return (
    <div className="space-y-6" data-testid="solid-waste-notice-drafter">
      {/* Notice Switcher */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={() => setNoticeType('RULE_15_NOTICE')}
          className={`flex-1 p-4 rounded-xl border text-left transition-all ${
            noticeType === 'RULE_15_NOTICE'
              ? 'border-emerald-600 bg-emerald-50/70 dark:bg-emerald-950/50 shadow-sm'
              : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center gap-2 font-semibold text-sm text-gray-900 dark:text-white">
            <Building className="w-4 h-4 text-emerald-600" />
            Rule 15/16 Municipal Commissioner &amp; SPCB Notice
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Formal 15-day pre-litigation representation demanding cleanup, bio-mining, and spot fines.
          </p>
        </button>

        <button
          type="button"
          onClick={() => setNoticeType('NGT_SECTION_14')}
          className={`flex-1 p-4 rounded-xl border text-left transition-all ${
            noticeType === 'NGT_SECTION_14'
              ? 'border-emerald-600 bg-emerald-50/70 dark:bg-emerald-950/50 shadow-sm'
              : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center gap-2 font-semibold text-sm text-gray-900 dark:text-white">
            <Scale className="w-4 h-4 text-emerald-600" />
            NGT Section 14/15 Original Application
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Court-ready judicial petition for filing before the National Green Tribunal Zonal Bench.
          </p>
        </button>
      </div>

      {/* Input Parameters Grid */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Complainant / Citizen Name
            </label>
            <input
              type="text"
              value={complainantName}
              onChange={(e) => setComplainantName(e.target.value)}
              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Dump Site Location / Survey No. / Landmark
            </label>
            <input
              type="text"
              value={locationAddress}
              onChange={(e) => setLocationAddress(e.target.value)}
              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Municipal Ward Name / No.
            </label>
            <input
              type="text"
              value={wardNumber}
              onChange={(e) => setWardNumber(e.target.value)}
              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              City / Urban Local Body
            </label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              State
            </label>
            <input
              type="text"
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
        </div>

        {noticeType === 'NGT_SECTION_14' && (
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                NGT Zonal Bench
              </label>
              <select
                value={bench}
                onChange={(e) => setBench(e.target.value)}
                className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {Object.values(NGT_ZONAL_BENCHES).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.benchName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Respondent Municipal Authority
              </label>
              <input
                type="text"
                value={respondentMunicipal}
                onChange={(e) => setRespondentMunicipal(e.target.value)}
                className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Respondent State Pollution Control Board
              </label>
              <input
                type="text"
                value={respondentSpcb}
                onChange={(e) => setRespondentSpcb(e.target.value)}
                className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>
        )}
      </div>

      {/* Generated Document Text Area */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
          <div>
            <h4 className="text-base font-semibold text-gray-900 dark:text-white">
              {noticeType === 'NGT_SECTION_14'
                ? 'Generated NGT Section 14/15 Original Application'
                : 'Generated Rule 15/16 SWM Statutory Notice'}
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Court-admissible legal representation format ready for dispatch
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied!' : 'Copy Notice'}
            </button>

            <button
              type="button"
              onClick={handleDownloadSlip}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Download Slip
            </button>

            {typeof onSaveNotice === 'function' && (
              <button
                type="button"
                onClick={handleSave}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-indigo-600 text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 transition-colors"
              >
                {savedSuccess ? <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" /> : <Save className="w-3.5 h-3.5" />}
                {savedSuccess ? 'Saved in Vault!' : 'Save in Vault'}
              </button>
            )}
          </div>
        </div>

        <textarea
          readOnly
          rows={14}
          value={generatedText}
          className="w-full text-xs font-mono bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 p-4 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none"
        />
      </div>
    </div>
  );
}
