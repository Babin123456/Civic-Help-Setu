import { useState, useMemo } from 'react';
import {
  HardHat,
  AlertTriangle,
  CheckCircle2,
  Truck,
} from 'lucide-react';
import { evaluateCdWasteCompliance } from '../../services/solidWasteAuditService.js';

export default function CdWasteTrackerCard() {
  const [dailyGenerationTons, setDailyGenerationTons] = useState(25);
  const [totalProjectTons, setTotalProjectTons] = useState(420);
  const [hasUlApprovedPlan, setHasUlApprovedPlan] = useState(false);
  const [segregatedDeposition, setSegregatedDeposition] = useState(true);

  const [concreteTons, setConcreteTons] = useState(180);
  const [soilSandTons, setSoilSandTons] = useState(120);
  const [brickMasonryTons, setBrickMasonryTons] = useState(80);
  const [metalWoodTons, setMetalWoodTons] = useState(40);

  const cdCompliance = useMemo(() => {
    return evaluateCdWasteCompliance({
      dailyGenerationTons,
      totalProjectTons,
      hasUlApprovedPlan,
      segregatedDeposition,
    });
  }, [dailyGenerationTons, totalProjectTons, hasUlApprovedPlan, segregatedDeposition]);

  const totalSegregatedTons = concreteTons + soilSandTons + brickMasonryTons + metalWoodTons;

  return (
    <div className="space-y-6" data-testid="cd-waste-tracker-card">
      {/* Header */}
      <div className="bg-sky-50 border border-sky-200 rounded-xl p-5 dark:bg-sky-950/40 dark:border-sky-800">
        <div className="flex items-start gap-3">
          <HardHat className="w-6 h-6 text-sky-700 dark:text-sky-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-sky-950 dark:text-sky-200 text-lg">
              Construction &amp; Demolition (C&amp;D) Waste Compliance Tracker
            </h3>
            <p className="text-sm text-sky-900 dark:text-sky-300 mt-1 leading-relaxed">
              Under the <em>Construction and Demolition Waste Management Rules, 2016</em>, generators producing more than
              <strong> 20 tonnes/day</strong> or <strong>300 tonnes per project</strong> are categorized as Bulk C&amp;D Generators.
              They are statutorily required to submit a comprehensive Waste Management Plan to the Municipal Corporation
              and segregate waste into 4 distinct streams to prevent illegal roadside dumping.
            </p>
          </div>
        </div>
      </div>

      {/* Input Parameters */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm">
        <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
          C&amp;D Project Scale &amp; Approvals
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Estimated Daily Debris Generation (Tonnes/day)
            </label>
            <input
              type="number"
              min="0"
              step="5"
              value={dailyGenerationTons}
              onChange={(e) => setDailyGenerationTons(Number(e.target.value))}
              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono"
            />
            <span className="text-[11px] text-gray-500">Bulk threshold: &ge; 20 tonnes/day</span>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Total Estimated Project Debris (Tonnes)
            </label>
            <input
              type="number"
              min="0"
              step="50"
              value={totalProjectTons}
              onChange={(e) => setTotalProjectTons(Number(e.target.value))}
              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono"
            />
            <span className="text-[11px] text-gray-500">Bulk threshold: &ge; 300 tonnes/project</span>
          </div>
        </div>

        {/* Verification Checkboxes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
          <label className="flex items-start gap-2.5 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 cursor-pointer">
            <input
              type="checkbox"
              checked={hasUlApprovedPlan}
              onChange={(e) => setHasUlApprovedPlan(e.target.checked)}
              className="mt-1 rounded text-sky-600 focus:ring-sky-500"
            />
            <div>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                ULB Approved C&amp;D Waste Management Plan (Rule 4(3))
              </span>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Prior approval obtained from Municipal Commissioner before commencement of construction/demolition.
              </p>
            </div>
          </label>

          <label className="flex items-start gap-2.5 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 cursor-pointer">
            <input
              type="checkbox"
              checked={segregatedDeposition}
              onChange={(e) => setSegregatedDeposition(e.target.checked)}
              className="mt-1 rounded text-sky-600 focus:ring-sky-500"
            />
            <div>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                4-Stream Physical On-Site Segregation (Rule 4(1))
              </span>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Concrete, soil, brick masonry, and recyclable metals kept in separate barricaded bays.
              </p>
            </div>
          </label>
        </div>

        {/* 4-Stream Decomposition Breakdown */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <h5 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
            4-Stream Debris Segregation Breakdown (Total: {totalSegregatedTons} MT)
          </h5>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-300">Concrete &amp; Mortar</label>
              <input
                type="number"
                min="0"
                value={concreteTons}
                onChange={(e) => setConcreteTons(Number(e.target.value))}
                className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 mt-1 bg-white dark:bg-gray-800 font-mono"
              />
            </div>

            <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-300">Soil, Sand &amp; Gravel</label>
              <input
                type="number"
                min="0"
                value={soilSandTons}
                onChange={(e) => setSoilSandTons(Number(e.target.value))}
                className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 mt-1 bg-white dark:bg-gray-800 font-mono"
              />
            </div>

            <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-300">Brick &amp; Masonry</label>
              <input
                type="number"
                min="0"
                value={brickMasonryTons}
                onChange={(e) => setBrickMasonryTons(Number(e.target.value))}
                className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 mt-1 bg-white dark:bg-gray-800 font-mono"
              />
            </div>

            <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-300">Steel, Timber &amp; Metals</label>
              <input
                type="number"
                min="0"
                value={metalWoodTons}
                onChange={(e) => setMetalWoodTons(Number(e.target.value))}
                className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 mt-1 bg-white dark:bg-gray-800 font-mono"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Compliance Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm">
          <span className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">C&amp;D Generator Status</span>
          <div className="mt-1">
            {cdCompliance.isBulkCdGenerator ? (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-300">
                Bulk C&amp;D Generator
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                Small C&amp;D Premise
              </span>
            )}
          </div>
          <span className="text-[11px] text-gray-500 block mt-1">Rule 4(3) statutory criteria</span>
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm">
          <span className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">Statutory Plan Status</span>
          <div className="mt-1">
            {hasUlApprovedPlan ? (
              <span className="inline-flex items-center text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4 mr-1" />
                ULB Plan Approved
              </span>
            ) : (
              <span className="inline-flex items-center text-xs font-semibold text-rose-600 dark:text-rose-400">
                <AlertTriangle className="w-4 h-4 mr-1" />
                Missing ULB Approval
              </span>
            )}
          </div>
          <span className="text-[11px] text-gray-500 block mt-1">Required prior to demolition</span>
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm">
          <span className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">Deposition Route</span>
          <div className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-gray-900 dark:text-white">
            <Truck className="w-4 h-4 text-sky-600" />
            Designated ULB Recycling Yard
          </div>
          <span className="text-[11px] text-gray-500 block mt-1">Direct roadside dumping prohibited</span>
        </div>
      </div>
    </div>
  );
}
