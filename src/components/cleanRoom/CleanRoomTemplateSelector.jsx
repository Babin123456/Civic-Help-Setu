import { useState } from 'react';
import { Play, Filter, ShieldCheck } from 'lucide-react';

export default function CleanRoomTemplateSelector({
  templates = [],
  activeTemplateId,
  onSelectTemplate,
  onExecuteQuery,
  isExecuting = false,
  workspace = null,
}) {
  const [selectedFilters, setSelectedFilters] = useState({});

  const activeTemplate = templates.find((t) => t.id === activeTemplateId) || templates[0];

  const handleFilterChange = (key, value) => {
    setSelectedFilters((prev) => ({
      ...prev,
      [key]: value === 'ALL' ? undefined : value,
    }));
  };

  const handleRun = () => {
    if (!activeTemplate) return;
    onExecuteQuery({
      templateId: activeTemplate.id,
      filters: selectedFilters,
    });
  };

  // Mock filter options for templates
  const filterOptions = {
    ward_id: ['ALL', 'Ward-101', 'Ward-102', 'Ward-103', 'Ward-104', 'Ward-105', 'Ward-106'],
    fiscal_quarter: ['ALL', 'Q1-2026', 'Q2-2026', 'Q3-2026', 'Q4-2026'],
    resolution_status: ['ALL', 'resolved', 'in_progress', 'escalated'],
    scheme_id: ['ALL', 'pm_awas_urban', 'national_disability_pension', 'widow_pension_yojana', 'ration_food_security'],
    district: ['ALL', 'Bengaluru Urban', 'Bengaluru Rural', 'Mysuru', 'Dharwad'],
    applicant_category: ['ALL', 'general', 'sc_st', 'obc', 'ews'],
    defect_severity: ['ALL', 'minor', 'moderate', 'severe', 'critical'],
    repair_status: ['ALL', 'reported', 'work_in_progress', 'completed'],
  };

  const isDatasetPermitted = workspace?.approvedDatasets?.includes(activeTemplate?.datasetId);

  return (
    <div
      className="card"
      style={{
        padding: '1.25rem',
        borderRadius: '0.75rem',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-light)',
        marginBottom: '1.5rem',
      }}
    >
      <div style={{ marginBottom: '1rem' }}>
        <label
          htmlFor="template-select"
          style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}
        >
          Select Approved Query Template
        </label>
        <select
          id="template-select"
          value={activeTemplate?.id || ''}
          onChange={(e) => {
            onSelectTemplate(e.target.value);
            setSelectedFilters({});
          }}
          style={{
            width: '100%',
            padding: '0.65rem 0.8rem',
            borderRadius: '0.5rem',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-light)',
            fontSize: '0.95rem',
            fontWeight: 500,
          }}
        >
          {templates.map((tpl) => (
            <option key={tpl.id} value={tpl.id}>
              {tpl.title} &bull; (Dataset: {tpl.datasetId})
            </option>
          ))}
        </select>
        {activeTemplate && (
          <p style={{ margin: '0.4rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {activeTemplate.description}
          </p>
        )}
      </div>

      {/* Parameter Filters */}
      {activeTemplate && activeTemplate.supportedFilters?.length > 0 && (
        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-light)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem' }}>
            <Filter size={15} color="var(--text-secondary)" />
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Bounded Query Filters (AST-Validated)
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '1rem',
            }}
          >
            {activeTemplate.supportedFilters.map((filter) => {
              const options = filterOptions[filter.key] || ['ALL'];
              return (
                <div key={filter.key}>
                  <label
                    htmlFor={`filter-${filter.key}`}
                    style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}
                  >
                    {filter.label}
                  </label>
                  <select
                    id={`filter-${filter.key}`}
                    value={selectedFilters[filter.key] || 'ALL'}
                    onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      borderRadius: '0.4rem',
                      background: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-light)',
                      fontSize: '0.85rem',
                    }}
                  >
                    {options.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Action Row */}
      <div
        style={{
          marginTop: '1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          <ShieldCheck size={16} color="#10b981" />
          <span>
            Cost: <strong>1 Query Token</strong> &bull; Privacy Cost:{' '}
            <strong>ε = {activeTemplate?.epsilonCost || 0.1}</strong> &bull; k-Threshold: <strong>k ≥ 10</strong>
          </span>
        </div>

        <button
          type="button"
          onClick={handleRun}
          disabled={isExecuting || !isDatasetPermitted || workspace?.queryBudgetRemaining <= 0}
          className="btn btn-primary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.6rem 1.25rem',
            fontSize: '0.9rem',
            fontWeight: 600,
            cursor: isExecuting || !isDatasetPermitted ? 'not-allowed' : 'pointer',
            opacity: isExecuting || !isDatasetPermitted ? 0.6 : 1,
          }}
        >
          <Play size={16} />
          {isExecuting ? 'Computing Aggregate...' : 'Execute In Clean Room'}
        </button>
      </div>

      {!isDatasetPermitted && (
        <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: '#ef4444' }}>
          Your partner workspace is not approved for dataset &quot;{activeTemplate?.datasetId}&quot;. Request authorization from Municipal Data Steward.
        </div>
      )}
    </div>
  );
}
