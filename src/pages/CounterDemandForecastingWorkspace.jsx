import { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useNetwork } from '../context/NetworkContext';
import {
  getOfficeCapacities,
  getOfficeById,
  forecastHourlyDemand,
  runBacktestEvaluation,
  detectForecastDrift,
  createDraftCapacityPlan,
  updateCapacityPlanAllocations,
  transitionCapacityPlanStatus,
  getCapacityPlans,
  initializeCounterDemandStorage,
} from '../services/counterDemandForecastingService';
import { CAPACITY_PLAN_STATUSES, FORECAST_MODEL_VERSION } from '../data/counterDemandContract';

import CounterDemandFilters from '../components/counterDemand/CounterDemandFilters';
import CounterDemandInteractiveChart from '../components/counterDemand/CounterDemandInteractiveChart';
import CounterDemandAccessibleTable from '../components/counterDemand/CounterDemandAccessibleTable';
import CounterDemandStaffingForm from '../components/counterDemand/CounterDemandStaffingForm';
import CounterDemandOverrideModal from '../components/counterDemand/CounterDemandOverrideModal';
import CounterDemandPublicNotice from '../components/counterDemand/CounterDemandPublicNotice';
import {
  CounterDemandSkeleton,
  CounterDemandOfflineNotice,
  CounterDemandErrorState,
} from '../components/counterDemand/CounterDemandStates';

import {
  Activity,
  Calendar,
  AlertTriangle,
} from 'lucide-react';

export const CounterDemandForecastingWorkspace = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const network = useNetwork?.() || { isOnline: true };

  // Roles: admin, manager, operator, citizen (default guest)
  const userRole = user?.role || (user ? 'manager' : 'citizen');

  const offices = useMemo(() => getOfficeCapacities(), []);
  const [selectedOfficeId, setSelectedOfficeId] = useState(offices[0]?.officeId || 'off_delhi_south_01');

  // Default planning target to tomorrow's date
  const [targetDate, setTargetDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });

  const [viewMode, setViewMode] = useState('chart'); // 'chart' | 'table'
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Forecast and Capacity Plan State (eagerly initialized for SSR & immediate render)
  const [forecastData, setForecastData] = useState(() => {
    try {
      initializeCounterDemandStorage();
      return forecastHourlyDemand(selectedOfficeId, targetDate);
    } catch {
      return null;
    }
  });

  const [activePlan, setActivePlan] = useState(() => {
    try {
      initializeCounterDemandStorage();
      const existingPlans = getCapacityPlans(selectedOfficeId);
      return existingPlans.find((p) => p.planDate === targetDate) || null;
    } catch {
      return null;
    }
  });

  const [hourlyAllocations, setHourlyAllocations] = useState(() => {
    try {
      initializeCounterDemandStorage();
      const office = getOfficeById(selectedOfficeId);
      const existingPlans = getCapacityPlans(selectedOfficeId);
      const match = existingPlans.find((p) => p.planDate === targetDate);
      if (match) return match.hourlyStaffing;

      const fc = forecastHourlyDemand(selectedOfficeId, targetDate);
      return fc.hourlyForecast.map((h) => ({
        hour: h.hour,
        hourIndex: h.hourIndex,
        predictedDemand: h.predictedDemand,
        recommendedCounters: h.recommendedCounters,
        allocatedCounters: h.recommendedCounters,
        bufferCounters: h.bufferCounters,
        maxPhysicalCounters: office?.totalPhysicalCounters || 12,
      }));
    } catch {
      return [];
    }
  });

  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [pendingVariancePct, setPendingVariancePct] = useState(0);

  // Diagnostics State
  const [backtestMetrics, setBacktestMetrics] = useState(() => {
    try {
      return runBacktestEvaluation(selectedOfficeId, 14);
    } catch {
      return null;
    }
  });
  const [driftInfo, setDriftInfo] = useState(() => {
    try {
      return detectForecastDrift(selectedOfficeId, 7);
    } catch {
      return null;
    }
  });

  // Function to re-evaluate and load forecast when filters change
  const updateOfficeAndDate = (newOfficeId, newTargetDate) => {
    setIsLoading(true);
    setError(null);

    try {
      initializeCounterDemandStorage();
      const office = getOfficeById(newOfficeId);
      if (!office) {
        throw new Error(`Office not found: ${newOfficeId}`);
      }

      // Compute forecast
      const fc = forecastHourlyDemand(newOfficeId, newTargetDate);
      setForecastData(fc);

      // Check if a saved plan exists for this office and date
      const existingPlans = getCapacityPlans(newOfficeId);
      const match = existingPlans.find((p) => p.planDate === newTargetDate);

      if (match) {
        setActivePlan(match);
        setHourlyAllocations(match.hourlyStaffing);
      } else {
        // Initialize working staffing with model recommendations
        const initialStaffing = fc.hourlyForecast.map((h) => ({
          hour: h.hour,
          hourIndex: h.hourIndex,
          predictedDemand: h.predictedDemand,
          recommendedCounters: h.recommendedCounters,
          allocatedCounters: h.recommendedCounters,
          bufferCounters: h.bufferCounters,
          maxPhysicalCounters: office.totalPhysicalCounters,
        }));
        setActivePlan(null);
        setHourlyAllocations(initialStaffing);
      }

      // Compute diagnostics
      const bt = runBacktestEvaluation(newOfficeId, 14);
      setBacktestMetrics(bt);
      const df = detectForecastDrift(newOfficeId, 7);
      setDriftInfo(df);
    } catch (err) {
      setError(err.message || 'Failed to compute queue demand forecast.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOfficeChange = (id) => {
    setSelectedOfficeId(id);
    updateOfficeAndDate(id, targetDate);
  };

  const handleDateChange = (date) => {
    setTargetDate(date);
    updateOfficeAndDate(selectedOfficeId, date);
  };

  // Handle local counter allocation adjustments
  const handleAllocationChange = (hour, newCount) => {
    setHourlyAllocations((prev) =>
      prev.map((slot) => (slot.hour === hour ? { ...slot, allocatedCounters: newCount } : slot))
    );
  };

  // Save Draft Plan
  const handleSaveDraft = () => {
    try {
      let plan = activePlan;
      if (!plan) {
        plan = createDraftCapacityPlan({
          officeId: selectedOfficeId,
          planDate: targetDate,
          userId: user?.id || 'manager_session',
          userRole,
        });
      }

      // Check if variance is >= 20%
      let maxVariance = 0;
      hourlyAllocations.forEach((slot) => {
        const diff = Math.abs(slot.allocatedCounters - slot.recommendedCounters);
        const pct = slot.recommendedCounters > 0 ? (diff / slot.recommendedCounters) * 100 : 0;
        if (pct > maxVariance) maxVariance = pct;
      });

      if (maxVariance >= 20 && (!plan.overrideReason || plan.overrideReason.length < 8)) {
        setPendingVariancePct(maxVariance);
        setOverrideModalOpen(true);
        return;
      }

      const updated = updateCapacityPlanAllocations({
        planId: plan.planId,
        hourlyAllocations,
        overrideReason: plan.overrideReason || '',
        userId: user?.id || 'manager_session',
      });

      setActivePlan(updated);
      toast.success('Capacity plan draft saved successfully.');
    } catch (err) {
      toast.error(err.message || 'Failed to save draft plan.');
    }
  };

  // Submit Plan for Review
  const handleSubmitForReview = () => {
    try {
      let plan = activePlan;
      if (!plan) {
        plan = createDraftCapacityPlan({
          officeId: selectedOfficeId,
          planDate: targetDate,
          userId: user?.id || 'manager_session',
          userRole,
        });
      }

      // Check variance before submission
      let maxVariance = 0;
      hourlyAllocations.forEach((slot) => {
        const diff = Math.abs(slot.allocatedCounters - slot.recommendedCounters);
        const pct = slot.recommendedCounters > 0 ? (diff / slot.recommendedCounters) * 100 : 0;
        if (pct > maxVariance) maxVariance = pct;
      });

      if (maxVariance >= 20 && (!plan.overrideReason || plan.overrideReason.length < 8)) {
        setPendingVariancePct(maxVariance);
        setOverrideModalOpen(true);
        return;
      }

      updateCapacityPlanAllocations({
        planId: plan.planId,
        hourlyAllocations,
        overrideReason: plan.overrideReason || '',
        userId: user?.id || 'manager_session',
      });

      const submitted = transitionCapacityPlanStatus({
        planId: plan.planId,
        targetStatus: CAPACITY_PLAN_STATUSES.SUBMITTED,
        userId: user?.id || 'manager_session',
        userRole,
      });

      setActivePlan(submitted);
      toast.success('Capacity plan submitted for administrative approval.');
    } catch (err) {
      toast.error(err.message || 'Failed to submit plan.');
    }
  };

  // Approve Plan (manager/admin only)
  const handleApprovePlan = () => {
    if (!activePlan) return;
    try {
      const approved = transitionCapacityPlanStatus({
        planId: activePlan.planId,
        targetStatus: CAPACITY_PLAN_STATUSES.APPROVED,
        userId: user?.id || 'manager_session',
        userRole,
      });
      setActivePlan(approved);
      toast.success('Capacity plan officially authorized and landed.');
    } catch (err) {
      toast.error(err.message || 'Failed to authorize plan.');
    }
  };

  // Handle Override Modal Confirmation
  const handleConfirmOverride = (reason) => {
    setOverrideModalOpen(false);
    try {
      let plan = activePlan;
      if (!plan) {
        plan = createDraftCapacityPlan({
          officeId: selectedOfficeId,
          planDate: targetDate,
          userId: user?.id || 'manager_session',
          userRole,
        });
      }

      const updated = updateCapacityPlanAllocations({
        planId: plan.planId,
        hourlyAllocations,
        overrideReason: reason,
        userId: user?.id || 'manager_session',
      });

      setActivePlan(updated);
      toast.success('Variance override recorded in audit trail.');
    } catch (err) {
      toast.error(err.message || 'Failed to record override.');
    }
  };

  const selectedOffice = useMemo(
    () => getOfficeById(selectedOfficeId),
    [selectedOfficeId]
  );

  return (
    <div className="section animate-fade-in" style={{ paddingBottom: '5rem' }}>
      <div className="container" style={{ maxWidth: '1100px' }}>
        {/* Header Breadcrumbs & Title */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
            <span>Operations &amp; Administration</span>
            <span>/</span>
            <span>Capacity &amp; Queue Planning</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.85rem', fontWeight: 800 }}>
                Civic Counter Demand &amp; Queue Staffing
              </h1>
              <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                Statistical footfall forecasting, Erlang-C queue capacity optimization, and auditable shift planning.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span
                style={{
                  fontSize: '0.75rem',
                  padding: '0.3rem 0.6rem',
                  borderRadius: '999px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-secondary)',
                }}
              >
                Model: <strong>{FORECAST_MODEL_VERSION}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Network & Offline Status Banner */}
        {!network.isOnline && <CounterDemandOfflineNotice />}

        {/* Public / Citizen Notice */}
        <CounterDemandPublicNotice
          aggregateTrafficRating={
            forecastData?.hourlyForecast?.some((h) => h.predictedDemand >= 35) ? 'High' : 'Moderate'
          }
        />

        {/* Cold-start / Sufficiency Warning Banner */}
        {forecastData?.sufficiencyWarning && (
          <div
            className="notice-banner"
            style={{
              padding: '0.75rem 1rem',
              marginBottom: '1rem',
              borderRadius: '8px',
              background: 'var(--warning-bg, #fef3c7)',
              border: '1px solid var(--warning-border, #f59e0b)',
              color: 'var(--warning-text, #92400e)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              fontSize: '0.875rem',
            }}
            role="status"
          >
            <AlertTriangle size={18} />
            <div>
              <strong>Cold-Start Office Warning:</strong> {selectedOffice?.officeName} has fewer than 14 days of historical footfall.
              Forecast is operating in bounded prior fallback mode with expanded prediction interval ribbons.
            </div>
          </div>
        )}

        {/* Office & Date Filter Bar */}
        <CounterDemandFilters
          offices={offices}
          selectedOfficeId={selectedOfficeId}
          onOfficeChange={handleOfficeChange}
          targetDate={targetDate}
          onDateChange={handleDateChange}
          viewMode={viewMode}
          onViewModeToggle={(m) => setViewMode(m)}
          showDiagnostics={showDiagnostics}
          onToggleDiagnostics={() => setShowDiagnostics((prev) => !prev)}
        />

        {/* Loading State */}
        {isLoading && <CounterDemandSkeleton />}

        {/* Error State */}
        {error && !isLoading && (
          <CounterDemandErrorState
            error={error}
            onRetry={() => updateOfficeAndDate(selectedOfficeId, targetDate)}
          />
        )}

        {/* Office Closed Banner */}
        {!isLoading && !error && forecastData?.isOfficeClosed && (
          <div
            className="card"
            style={{
              padding: '2rem 1.5rem',
              textAlign: 'center',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              margin: '1.5rem 0',
            }}
          >
            <div style={{ display: 'inline-flex', padding: '0.75rem', borderRadius: '50%', background: 'var(--accent-subtle, #dbeafe)', marginBottom: '0.75rem' }}>
              <Calendar size={28} color="var(--accent-main, #2563eb)" />
            </div>
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem' }}>Office Closed On Selected Date</h3>
            <p style={{ color: 'var(--text-secondary)', maxWidth: '500px', margin: '0 auto' }}>
              {forecastData.closureReason || 'This civic facilitation centre is scheduled closed on this date.'}
            </p>
          </div>
        )}

        {/* Main Content Area when open */}
        {!isLoading && !error && !forecastData?.isOfficeClosed && (
          <>
            {/* Dual Visualization: SVG Chart vs Semantic Accessible Table */}
            {viewMode === 'chart' ? (
              <CounterDemandInteractiveChart
                hourlyForecast={forecastData?.hourlyForecast || []}
                officeName={selectedOffice?.officeName}
                targetDate={targetDate}
              />
            ) : (
              <CounterDemandAccessibleTable
                hourlyForecast={forecastData?.hourlyForecast || []}
                officeName={selectedOffice?.officeName}
                targetDate={targetDate}
              />
            )}

            {/* Diagnostics Panel (Backtesting & Drift Analysis) */}
            {showDiagnostics && (
              <div
                className="card"
                style={{
                  padding: '1.25rem',
                  borderRadius: '12px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  marginBottom: '1.5rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <Activity size={18} color="var(--accent-main, #2563eb)" />
                  <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>
                    Walk-Forward Backtesting &amp; Accuracy Diagnostics
                  </h4>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: '1rem',
                  }}
                >
                  <div style={{ padding: '0.75rem', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Mean Absolute Error (MAE)</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '0.2rem' }}>
                      {backtestMetrics?.mae !== null ? `${backtestMetrics?.mae} citizens` : 'N/A'}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--success-text, #16a34a)', marginTop: '0.2rem' }}>
                      Naive Baseline: {backtestMetrics?.naiveBaselineMae}
                    </div>
                  </div>

                  <div style={{ padding: '0.75rem', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Mean Absolute % Error (MAPE)</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '0.2rem' }}>
                      {backtestMetrics?.mape !== null ? `${backtestMetrics?.mape}%` : 'N/A'}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                      Target: &lt; 25% (Optimal)
                    </div>
                  </div>

                  <div style={{ padding: '0.75rem', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Root Mean Square Error (RMSE)</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '0.2rem' }}>
                      {backtestMetrics?.rmse !== null ? `${backtestMetrics?.rmse}` : 'N/A'}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                      Evaluated on {backtestMetrics?.evaluatedObservations || 0} slots
                    </div>
                  </div>

                  <div style={{ padding: '0.75rem', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Forecast Drift Status</div>
                    <div
                      style={{
                        fontSize: '1rem',
                        fontWeight: 700,
                        marginTop: '0.35rem',
                        color: driftInfo?.driftDetected ? 'var(--danger-text, #dc2626)' : 'var(--success-text, #16a34a)',
                      }}
                    >
                      {driftInfo?.driftDetected ? 'DRIFT ALERT' : 'STABLE BASELINE'}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                      {driftInfo?.recommendation}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Capacity Plan Staffing Form (Human-in-the-Loop) */}
            <CounterDemandStaffingForm
              plan={activePlan}
              hourlyAllocations={hourlyAllocations}
              onAllocationChange={handleAllocationChange}
              onSaveDraft={handleSaveDraft}
              onSubmitForReview={handleSubmitForReview}
              onApprovePlan={handleApprovePlan}
              userRole={userRole}
            />
          </>
        )}

        {/* Human Override Justification Modal */}
        <CounterDemandOverrideModal
          isOpen={overrideModalOpen}
          onClose={() => setOverrideModalOpen(false)}
          onConfirm={handleConfirmOverride}
          variancePct={pendingVariancePct}
          officeName={selectedOffice?.officeName}
          planDate={targetDate}
        />
      </div>
    </div>
  );
};

export default CounterDemandForecastingWorkspace;
