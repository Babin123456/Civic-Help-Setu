import { AlertCircle, Save, Send, Check } from 'lucide-react';
import { CAPACITY_PLAN_STATUSES } from '../../data/counterDemandContract.js';

export const CounterDemandStaffingForm = ({
  plan,
  hourlyAllocations,
  onAllocationChange,
  onSaveDraft,
  onSubmitForReview,
  onApprovePlan,
  userRole = 'manager',
  isSubmitting = false,
}) => {
  if (!hourlyAllocations || hourlyAllocations.length === 0) {
    return null;
  }

  const isEditable = !plan || plan.status === CAPACITY_PLAN_STATUSES.DRAFT || plan.status === CAPACITY_PLAN_STATUSES.REJECTED;
  const canApprove = (userRole === 'admin' || userRole === 'manager') && plan?.status === CAPACITY_PLAN_STATUSES.SUBMITTED;

  // Compute total recommended vs allocated
  const totalRecommended = hourlyAllocations.reduce((sum, h) => sum + (h.recommendedCounters || 0), 0);
  const totalAllocated = hourlyAllocations.reduce((sum, h) => sum + (h.allocatedCounters || 0), 0);
  const totalVariancePct = totalRecommended > 0
    ? (Math.abs(totalAllocated - totalRecommended) / totalRecommended) * 100
    : 0;

  return (
    <div
      className="card"
      style={{
        background: 'var(--bg-card)',
        borderRadius: '12px',
        border: '1px solid var(--border)',
        padding: '1.25rem',
        margin: '1rem 0',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
        <div>
          <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>
            Operational Queue Staffing Allocation (Shift Planning)
          </h4>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Status:{' '}
            <strong style={{ textTransform: 'uppercase', color: 'var(--accent-main, #2563eb)' }}>
              {plan?.status || 'NEW DRAFT'}
            </strong>{' '}
            • Physical Counter Ceiling: {hourlyAllocations[0]?.maxPhysicalCounters || 12}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.85rem' }}>
          <div>
            Model Total: <strong>{totalRecommended} counter-hours</strong>
          </div>
          <div>
            Allocated: <strong style={{ color: totalAllocated < totalRecommended ? 'var(--danger-text, #dc2626)' : 'var(--text-primary)' }}>
              {totalAllocated} counter-hours
            </strong>
          </div>
          {totalVariancePct >= 20 && (
            <span
              style={{
                fontSize: '0.75rem',
                padding: '0.2rem 0.5rem',
                borderRadius: '4px',
                background: 'var(--warning-bg, #fef3c7)',
                color: 'var(--warning-text, #b45309)',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
            >
              <AlertCircle size={12} />
              {totalVariancePct.toFixed(0)}% Variance
            </span>
          )}
        </div>
      </div>

      {/* Hourly inputs grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '0.75rem',
          marginBottom: '1.25rem',
        }}
      >
        {hourlyAllocations.map((slot) => {
          const delta = slot.allocatedCounters - slot.recommendedCounters;
          const deltaColor = delta > 0 ? 'var(--success-text, #16a34a)' : delta < 0 ? 'var(--danger-text, #dc2626)' : 'var(--text-secondary)';

          return (
            <div
              key={slot.hour}
              style={{
                padding: '0.75rem',
                borderRadius: '8px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                {slot.hour}:00
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                Model: <strong>{slot.recommendedCounters}</strong>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                {isEditable ? (
                  <input
                    type="number"
                    min="1"
                    max={slot.maxPhysicalCounters || 16}
                    value={slot.allocatedCounters}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (!isNaN(val)) {
                        onAllocationChange(slot.hour, val);
                      }
                    }}
                    style={{
                      width: '54px',
                      padding: '0.3rem',
                      textAlign: 'center',
                      borderRadius: '6px',
                      border: '1px solid var(--border)',
                      fontWeight: 'bold',
                      fontSize: '0.9rem',
                    }}
                    aria-label={`Allocated counters for ${slot.hour}:00`}
                  />
                ) : (
                  <span style={{ fontWeight: 'bold', fontSize: '1rem' }}>
                    {slot.allocatedCounters}
                  </span>
                )}
              </div>

              <div style={{ fontSize: '0.7rem', marginTop: '0.4rem', color: deltaColor, fontWeight: 600 }}>
                {delta === 0 ? 'Matches Baseline' : delta > 0 ? `+${delta} surplus` : `${delta} deficit`}
              </div>
            </div>
          );
        })}
      </div>

      {/* Plan action buttons */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', flexWrap: 'wrap' }}>
        {isEditable && (
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onSaveDraft}
              disabled={isSubmitting}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Save size={16} />
              Save Draft
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={onSubmitForReview}
              disabled={isSubmitting}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Send size={16} />
              Submit for Review
            </button>
          </>
        )}

        {canApprove && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={onApprovePlan}
            disabled={isSubmitting}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: 'var(--success-main, #16a34a)' }}
          >
            <Check size={16} />
            Authorize &amp; Land Capacity Plan
          </button>
        )}
      </div>
    </div>
  );
};

export default CounterDemandStaffingForm;

