import { useState, useMemo } from 'react';
import {
  Building2,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
} from 'lucide-react';
import {
  BWG_PREMISE_TYPES,
  evaluateBwgCompliance,
} from '../../services/solidWasteAuditService.js';

export default function BulkWasteGeneratorCard() {
  const [premiseType, setPremiseType] = useState('GATED_RESIDENTIAL_SOCIETY');
  const [dailyWasteKg, setDailyWasteKg] = useState(240);
  const [builtUpAreaSqM, setBuiltUpAreaSqM] = useState(7500);
  const [onSiteWetWasteProcessing, setOnSiteWetWasteProcessing] = useState(false);
  const [bioMethanationOrComposting, setBioMethanationOrComposting] = useState(false);
  const [dryWasteChannelized, setDryWasteChannelized] = useState(true);
  const [hazardousWasteSegregated, setHazardousWasteSegregated] = useState(false);

  const complianceResult = useMemo(() => {
    return evaluateBwgCompliance({
      premiseType,
      dailyWasteKg,
      builtUpAreaSqM,
      onSiteWetWasteProcessing,
      bioMethanationOrComposting,
      dryWasteChannelized,
      hazardousWasteSegregated,
    });
  }, [
    premiseType,
    dailyWasteKg,
    builtUpAreaSqM,
    onSiteWetWasteProcessing,
    bioMethanationOrComposting,
    dryWasteChannelized,
    hazardousWasteSegregated,
  ]);

  return (
    <div className="space-y-6" data-testid="bwg-compliance-card">
      {/* Statutory Header */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 dark:bg-emerald-950/40 dark:border-emerald-800">
        <div className="flex items-start gap-3">
          <Building2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-emerald-950 dark:text-emerald-200 text-lg">
              Bulk Waste Generator (BWG) Statutory Compliance Auditor
            </h3>
            <p className="text-sm text-emerald-800 dark:text-emerald-300 mt-1 leading-relaxed">
              Under Rule 3(1)(7) and Rule 4(6)-(8) of the <em>Solid Waste Management Rules, 2016</em>, any premise generating
              over <strong>100 kg/day</strong> of waste or occupying over <strong>5,000 sq. meters</strong> is legally defined as a
              Bulk Waste Generator. Bulk generators are prohibited from handing over unsegregated wet waste to the municipality
              and must treat organic waste on-site through composting or bio-methanation.
            </p>
          </div>
        </div>
      </div>

      {/* Form Grid */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm">
        <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
          Premise Metric Evaluation
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Premise Category
            </label>
            <select
              value={premiseType}
              onChange={(e) => setPremiseType(e.target.value)}
              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {Object.values(BWG_PREMISE_TYPES).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Daily Waste Generated (kg/day)
            </label>
            <input
              type="number"
              min="0"
              step="10"
              value={dailyWasteKg}
              onChange={(e) => setDailyWasteKg(Number(e.target.value))}
              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono"
            />
            <span className="text-[11px] text-gray-500">BWG threshold: &ge; 100 kg/day</span>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Total Plinth / Campus Area (sq.m)
            </label>
            <input
              type="number"
              min="0"
              step="500"
              value={builtUpAreaSqM}
              onChange={(e) => setBuiltUpAreaSqM(Number(e.target.value))}
              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono"
            />
            <span className="text-[11px] text-gray-500">BWG threshold: &ge; 5,000 sq.m</span>
          </div>
        </div>

        {/* On-Site Waste Treatment Checkboxes */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <h5 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
            On-Site Statutory Processing Verifications
          </h5>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex items-start gap-2.5 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 cursor-pointer">
              <input
                type="checkbox"
                checked={onSiteWetWasteProcessing}
                onChange={(e) => setOnSiteWetWasteProcessing(e.target.checked)}
                className="mt-1 rounded text-emerald-600 focus:ring-emerald-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  Mandatory In-Situ Wet Waste Processing (Rule 4(6))
                </span>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Organic waste is processed on-site without transporting unsegregated loads to municipal landfills.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-2.5 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 cursor-pointer">
              <input
                type="checkbox"
                checked={bioMethanationOrComposting}
                onChange={(e) => setBioMethanationOrComposting(e.target.checked)}
                className="mt-1 rounded text-emerald-600 focus:ring-emerald-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  Operational Composter / Bio-Methanation Unit (Rule 4(7))
                </span>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Functional organic waste converter (OWC), vermi-compost pits, or biogas plant within premises.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-2.5 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 cursor-pointer">
              <input
                type="checkbox"
                checked={dryWasteChannelized}
                onChange={(e) => setDryWasteChannelized(e.target.checked)}
                className="mt-1 rounded text-emerald-600 focus:ring-emerald-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  Authorized Recycler Tie-Up for Dry Waste (Rule 4(8))
                </span>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Dry recyclables channelized to SPCB authorized recyclers or empanelled waste-picker collectives.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-2.5 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 cursor-pointer">
              <input
                type="checkbox"
                checked={hazardousWasteSegregated}
                onChange={(e) => setHazardousWasteSegregated(e.target.checked)}
                className="mt-1 rounded text-emerald-600 focus:ring-emerald-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  Dedicated Domestic Hazardous Waste Bins (Rule 4(1)(c))
                </span>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Separate safe storage for batteries, fluorescent lamps, sanitary waste, and chemicals.
                </p>
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* Compliance Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm">
          <span className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">BWG Classification</span>
          <div className="mt-1 flex items-center gap-2">
            {complianceResult.isBulkGenerator ? (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-300">
                Bulk Generator (BWG)
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                Non-Bulk Premise
              </span>
            )}
          </div>
          <span className="text-[11px] text-gray-500 mt-1 block">
            {complianceResult.isBwgByWaste && complianceResult.isBwgByArea
              ? 'Exceeds both waste & area thresholds'
              : complianceResult.isBwgByWaste
                ? 'Exceeds 100 kg/day threshold'
                : complianceResult.isBwgByArea
                  ? 'Exceeds 5,000 sq.m threshold'
                  : 'Below statutory BWG limits'}
          </span>
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm">
          <span className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">Compliance Rating</span>
          <div className="text-2xl font-bold mt-1 font-mono text-gray-900 dark:text-white">
            {complianceResult.complianceScore} / 100
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              className={`h-full ${
                complianceResult.complianceScore >= 80
                  ? 'bg-emerald-500'
                  : complianceResult.complianceScore >= 50
                    ? 'bg-amber-500'
                    : 'bg-red-500'
              }`}
              style={{ width: `${complianceResult.complianceScore}%` }}
            />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm">
          <span className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">Violation Status</span>
          <div className="mt-1">
            {complianceResult.isCompliant ? (
              <span className="inline-flex items-center text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4 mr-1" />
                Fully Compliant
              </span>
            ) : (
              <span className="inline-flex items-center text-xs font-semibold text-red-600 dark:text-red-400">
                <AlertTriangle className="w-4 h-4 mr-1" />
                {complianceResult.status === 'CRITICAL_VIOLATION' ? 'Critical Violations' : 'Deficient Setup'}
              </span>
            )}
          </div>
          <span className="text-[11px] text-gray-500 block mt-1">
            {complianceResult.violations.length} statutory infractions detected
          </span>
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm">
          <span className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">Spot Fine Exposure</span>
          <div className="text-xl font-bold text-rose-600 dark:text-rose-400 mt-1 font-mono">
            ₹{complianceResult.totalSpotFineExposureInrPerDay.toLocaleString('en-IN')}/day
          </div>
          <span className="text-[11px] text-gray-500 block mt-1">Under Municipal SWM Bye-laws</span>
        </div>
      </div>

      {/* Violation Details List */}
      {complianceResult.violations.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 dark:bg-rose-950/30 dark:border-rose-800 rounded-xl p-5">
          <h4 className="text-sm font-semibold text-rose-950 dark:text-rose-200 flex items-center gap-2 mb-2">
            <ShieldAlert className="w-4 h-4 text-rose-600" />
            Statutory Infractions Under SWM Rules, 2016
          </h4>
          <ul className="space-y-2 mt-3">
            {complianceResult.violations.map((v, i) => (
              <li key={i} className="text-xs text-rose-900 dark:text-rose-300 flex items-start gap-2">
                <span className="font-mono font-bold shrink-0">{v.rule}:</span>
                <span>{v.description}</span>
                <span className="ml-auto font-mono text-rose-700 dark:text-rose-400 shrink-0">
                  (Fine: ₹{v.penaltyInrPerDay.toLocaleString('en-IN')}/day)
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
