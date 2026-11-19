import { useState, useMemo } from 'react';
import {
  Scale,
  Flame,
  Layers,
} from 'lucide-react';
import {
  WASTE_DENSITY_METRICS,
  CITY_LOCATION_FACTORS,
  SCALE_FACTORS,
  calculateWasteTonnageAndNgtCompensation,
} from '../../services/solidWasteAuditService.js';

export default function VolumetricNgtCalculator({ onCalculationChange }) {
  const [dumpLengthM, setDumpLengthM] = useState(25);
  const [dumpWidthM, setDumpWidthM] = useState(12);
  const [dumpAvgDepthM, setDumpAvgDepthM] = useState(2.5);
  const [wasteCategory, setWasteCategory] = useState('UNCOMPACTED_MIXED_MSW');
  const [defaultDays, setDefaultDays] = useState(45);
  const [cityClass, setCityClass] = useState('CLASS_1_1M_TO_10M');
  const [scaleOfOperation, setScaleOfOperation] = useState('LARGE_BULK_OR_ULB');
  const [activeBurningObserved, setActiveBurningObserved] = useState(true);

  const calculationResult = useMemo(() => {
    const res = calculateWasteTonnageAndNgtCompensation({
      dumpLengthM,
      dumpWidthM,
      dumpAvgDepthM,
      wasteCategory,
      defaultDays,
      cityClass,
      scaleOfOperation,
      activeBurningObserved,
    });
    if (typeof onCalculationChange === 'function') {
      onCalculationChange(res);
    }
    return res;
  }, [
    dumpLengthM,
    dumpWidthM,
    dumpAvgDepthM,
    wasteCategory,
    defaultDays,
    cityClass,
    scaleOfOperation,
    activeBurningObserved,
    onCalculationChange,
  ]);

  return (
    <div className="space-y-6" data-testid="volumetric-ngt-calculator">
      {/* Header */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 dark:bg-amber-950/40 dark:border-amber-800">
        <div className="flex items-start gap-3">
          <Scale className="w-6 h-6 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-amber-950 dark:text-amber-200 text-lg">
              Volumetric Dumping Hazard &amp; NGT Environmental Compensation Estimator
            </h3>
            <p className="text-sm text-amber-800 dark:text-amber-300 mt-1 leading-relaxed">
              Computes cumulative solid waste tonnage from ground dimensions using CPCB standard bulk density metrics,
              and evaluates the statutory <strong>Environmental Compensation (EC)</strong> fine formula laid down by the
              National Green Tribunal (NGT) in <em>O.A. No. 606/2018</em> ($EC = PI \times N \times R \times S \times LF$).
            </p>
          </div>
        </div>
      </div>

      {/* Form Grid */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm">
        <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Layers className="w-5 h-5 text-gray-500" />
          Dumping Site Volumetric Dimensions
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Dump Site Length (meters)
            </label>
            <input
              type="number"
              min="1"
              step="1"
              value={dumpLengthM}
              onChange={(e) => setDumpLengthM(Number(e.target.value))}
              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Dump Site Width (meters)
            </label>
            <input
              type="number"
              min="1"
              step="1"
              value={dumpWidthM}
              onChange={(e) => setDumpWidthM(Number(e.target.value))}
              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Average Waste Pile Height / Depth (meters)
            </label>
            <input
              type="number"
              min="0.2"
              step="0.1"
              value={dumpAvgDepthM}
              onChange={(e) => setDumpAvgDepthM(Number(e.target.value))}
              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono"
            />
          </div>
        </div>

        {/* Waste Density and Duration */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Dominant Waste Composition &amp; CPCB Density Standard
            </label>
            <select
              value={wasteCategory}
              onChange={(e) => setWasteCategory(e.target.value)}
              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {Object.values(WASTE_DENSITY_METRICS).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} ({m.densityTonnesPerCuM} tonnes/m³)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Duration of Unattended Illegal Dumping (Days)
            </label>
            <input
              type="number"
              min="1"
              step="1"
              value={defaultDays}
              onChange={(e) => setDefaultDays(Number(e.target.value))}
              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono"
            />
          </div>
        </div>

        {/* NGT Parameters */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              City Population Location Factor (LF)
            </label>
            <select
              value={cityClass}
              onChange={(e) => setCityClass(e.target.value)}
              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {Object.values(CITY_LOCATION_FACTORS).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label} [Factor: {c.factor}x]
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Polluter Operation Scale Factor (S)
            </label>
            <select
              value={scaleOfOperation}
              onChange={(e) => setScaleOfOperation(e.target.value)}
              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {Object.values(SCALE_FACTORS).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label} [Factor: {s.factor}x]
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Aggravating Factors */}
        <div className="bg-red-50 border border-red-200 dark:bg-red-950/30 dark:border-red-800 rounded-lg p-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={activeBurningObserved}
              onChange={(e) => setActiveBurningObserved(e.target.checked)}
              className="rounded text-red-600 focus:ring-red-500"
            />
            <span className="text-sm font-semibold text-red-900 dark:text-red-300 flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-red-600" />
              Active Open Waste Burning / Smoke Plumes Observed (1.5x Aggravation Multiplier)
            </span>
          </label>
          <p className="text-xs text-red-700 dark:text-red-400 mt-1 pl-6">
            Under Rule 15(v) of SWM Rules 2016, open burning of solid waste is strictly prohibited. The NGT mandates
            a 50% punitive markup on environmental compensation when open burning occurs.
          </p>
        </div>
      </div>

      {/* Calculations Summary Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm">
          <span className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">Accumulated Volume</span>
          <div className="text-2xl font-bold mt-1 font-mono text-gray-900 dark:text-white">
            {calculationResult.dumpVolumeCuM.toLocaleString('en-IN')} m³
          </div>
          <span className="text-[11px] text-gray-500">Length &times; Width &times; Depth</span>
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm">
          <span className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">Estimated Tonnage</span>
          <div className="text-2xl font-bold mt-1 font-mono text-indigo-600 dark:text-indigo-400">
            {calculationResult.estimatedTonnage.toLocaleString('en-IN')} MT
          </div>
          <span className="text-[11px] text-gray-500">Metric Tonnes of waste mass</span>
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm">
          <span className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">Bio-Mining Cost</span>
          <div className="text-xl font-bold mt-1 font-mono text-amber-600 dark:text-amber-400">
            ₹{calculationResult.estimatedRemediationCostInr.toLocaleString('en-IN')}
          </div>
          <span className="text-[11px] text-gray-500">@ ₹550/tonne remediation standard</span>
        </div>

        <div className="bg-gradient-to-br from-amber-900 to-amber-950 text-white rounded-xl p-4 shadow-sm">
          <span className="text-xs text-amber-300 uppercase font-semibold">NGT Compensation Liability</span>
          <div className="text-2xl font-black mt-1 font-mono text-white">
            ₹{calculationResult.finalEnvironmentalCompensationInr.toLocaleString('en-IN')}
          </div>
          <span className="text-[11px] text-amber-200 block mt-1">
            (₹{calculationResult.perDayFineInr.toLocaleString('en-IN')} / day for {calculationResult.defaultDays} days)
          </span>
        </div>
      </div>
    </div>
  );
}
