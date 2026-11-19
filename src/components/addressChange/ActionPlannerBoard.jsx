import { useState, useMemo } from 'react';
import { Search, Printer, AlertCircle } from 'lucide-react';
import ActionStepCard from './ActionStepCard';
import { calculatePlanReadiness, getConditionalMoveRules } from '../../services/addressChangeService';
import AddressChangeEmptyState from './AddressChangeEmptyState';

export default function ActionPlannerBoard({
  records,
  planState,
  onUpdateProgress,
  onOpenDetails,
  onOpenCorrection,
  onOpenPrintReport,
}) {
  const [searchQuery, setSearchQuery] = useState('');

  const readiness = useMemo(() => {
    return calculatePlanReadiness(records, planState.items);
  }, [records, planState.items]);

  const conditionalRules = useMemo(() => {
    return getConditionalMoveRules(
      planState.moveType,
      planState.originState,
      planState.destinationState
    );
  }, [planState.moveType, planState.originState, planState.destinationState]);

  const filteredRecords = useMemo(() => {
    if (!searchQuery.trim()) return records;
    const q = searchQuery.toLowerCase().trim();
    return records.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.authority.name.toLowerCase().includes(q) ||
        r.statutoryBasis.toLowerCase().includes(q)
    );
  }, [records, searchQuery]);

  const blockedMap = useMemo(() => {
    const map = new Map();
    readiness.blockedRecords.forEach((item) => {
      map.set(item.recordId, item.missingPrerequisites);
    });
    return map;
  }, [readiness.blockedRecords]);

  return (
    <div>
      {/* Progress & Readiness Banner */}
      <div
        className="card"
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-main)',
          borderRadius: '0.75rem',
          padding: '1.25rem',
          marginBottom: '1.5rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            marginBottom: '0.75rem',
          }}
        >
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              Address Update Action Plan ({records.length} Records)
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0' }}>
              Organized in chronological prerequisite order to avoid rejected applications.
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenPrintReport}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', padding: '0.45rem 0.85rem' }}
          >
            <Printer size={16} /> Print / Export Checklist
          </button>
        </div>

        {/* Progress Bar */}
        <div style={{ marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
            <span style={{ color: 'var(--text-primary)' }}>Overall Relocation Readiness</span>
            <span style={{ color: 'var(--accent-main, #2563eb)' }}>{readiness.percentage}%</span>
          </div>
          <div
            style={{
              width: '100%',
              height: '8px',
              backgroundColor: 'var(--border-light, #e5e7eb)',
              borderRadius: '9999px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${readiness.percentage}%`,
                height: '100%',
                backgroundColor: readiness.percentage === 100 ? '#10b981' : 'var(--accent-main, #2563eb)',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </div>

        {/* Status Counts */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '1rem',
            fontSize: '0.8rem',
            color: 'var(--text-secondary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#059669' }} />
            <strong>Completed:</strong> {readiness.completed}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#2563eb' }} />
            <strong>Submitted:</strong> {readiness.submitted}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#d97706' }} />
            <strong>Documents Ready:</strong> {readiness.documentsPrepared}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#9ca3af' }} />
            <strong>Not Started:</strong> {readiness.notStarted}
          </div>
        </div>
      </div>

      {/* Conditional Relocation Guidance Advisory */}
      {conditionalRules.length > 0 && (
        <div style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {conditionalRules.map((rule, idx) => (
            <div
              key={idx}
              role="note"
              style={{
                backgroundColor: rule.severity === 'important' ? 'rgba(245, 158, 11, 0.12)' : 'var(--glass-bg)',
                border: rule.severity === 'important' ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid var(--border-main)',
                borderRadius: '0.5rem',
                padding: '0.85rem 1rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.65rem',
              }}
            >
              <AlertCircle
                size={18}
                color={rule.severity === 'important' ? '#f59e0b' : 'var(--accent-main)'}
                style={{ flexShrink: 0, marginTop: '2px' }}
              />
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {rule.title}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem', lineHeight: 1.4 }}>
                  {rule.detail}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Search Bar */}
      <div style={{ marginBottom: '1rem', position: 'relative' }}>
        <Search
          size={16}
          style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }}
        />
        <input
          type="text"
          placeholder="Filter checklist steps by record name, department, or keyword..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '0.5rem 0.75rem 0.5rem 2.25rem',
            fontSize: '0.875rem',
            borderRadius: '0.375rem',
            border: '1px solid var(--border-main)',
            backgroundColor: 'var(--bg-main)',
            color: 'var(--text-primary)',
          }}
        />
      </div>

      {/* Step Cards List */}
      {filteredRecords.length === 0 ? (
        <AddressChangeEmptyState onResetSearch={() => setSearchQuery('')} />
      ) : (
        <div>
          {filteredRecords.map((record, index) => {
            const isBlocked = blockedMap.has(record.id);
            const missingIds = blockedMap.get(record.id) || [];
            const missingNames = missingIds.map((id) => {
              const found = records.find((r) => r.id === id);
              return found ? found.name : id;
            });

            return (
              <ActionStepCard
                key={record.id}
                record={record}
                index={index}
                itemState={planState.items[record.id] || {}}
                isBlocked={isBlocked}
                missingPrereqNames={missingNames}
                onUpdateProgress={onUpdateProgress}
                onOpenDetails={onOpenDetails}
                onOpenCorrection={onOpenCorrection}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

