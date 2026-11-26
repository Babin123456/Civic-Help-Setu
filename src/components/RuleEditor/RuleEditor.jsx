/**
 * Civic Service Eligibility Rules Visual Editor
 *
 * A React component for authoring eligibility rules using the declarative DSL.
 * Provides a form-based interface with typed operators, effective date ranges,
 * and real-time validation. Compiles to the deterministic evaluator used by
 * the rule engine.
 *
 * Accessibility: keyboard-navigable, screen-reader friendly, mobile-responsive.
 * Fallback: raw JSON text area for advanced authors.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { OPERATORS, compileRule, parseRuleExpression, RuleDefinition, RuleSetDefinition } from '../data/eligibilityDsl.js';
import { createRuleEngine } from '../services/eligibilityRuleEngine.js';

// ---- Operator display names and descriptions ----
const OPERATOR_DISPLAY = {
  [OPERATORS.EQ]: 'Equals',
  [OPERATORS.NEQ]: 'Not equals',
  [OPERATORS.LT]: 'Less than',
  [OPERATORS.LTE]: 'Less than or equal',
  [OPERATORS.GT]: 'Greater than',
  [OPERATORS.GTE]: 'Greater than or equal',
  [OPERATORS.IN]: 'Is in',
  [OPERATORS.CONTAINS]: 'Contains',
};

// Valid profile fields the DSL can reference
const PROFILE_FIELDS = [
  { value: 'age', label: 'Age' },
  { value: 'annualIncome', label: 'Annual income' },
  { value: 'employment', label: 'Employment' },
  { value: 'category', label: 'Category' },
  { value: 'state', label: 'State' },
  { value: 'hasAadhaar', label: 'Has Aadhaar' },
  { value: 'hasPan', label: 'Has PAN' },
  { value: 'hasLearnerLicense', label: 'Has learner licence' },
  { value: 'hasIncomeCertificate', label: 'Has income certificate' },
  { value: 'ownsAgriculturalLand', label: 'Owns agricultural land' },
  { value: 'isStudent', label: 'Is student' },
];

// Effective date helpers
function parseDateString(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatDateForInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * RuleEditor - A visual editor for authoring eligibility rules.
 * 
 * Props:
 *   initialRule?: RuleDefinition - pre-loaded rule (optional)
 *   onRuleChange?: (rule: RuleDefinition) => void - called when rule changes
 *   schemeId?: string - associated scheme ID for context
 * 
 * State managed internally:
 *   - rule: the current RuleDefinition being edited
 *   - expressionEditing: which part of the expression is being edited
 *   - effectiveDate open state
 *   - validation errors
 */
export function RuleEditor({
  initialRule,
  onRuleChange,
  schemeId,
}: {
  initialRule?: RuleDefinition;
  onRuleChange?: (rule: RuleDefinition) => void;
  schemeId?: string;
}) {
  const [rule, setRule] = useState<RuleDefinition>({
    id: `${schemeId || 'rule'}-${Date.now()}`,
    label: initialRule?.label || 'New eligibility rule',
    expression: initialRule?.expression || { left: '', operator: OPERATORS.EQ, right: '' },
    effectiveDate: initialRule?.effectiveDate,
    active: initialRule?.active !== undefined ? initialRule.active : true,
    hintField: initialRule?.hintField,
    detailTemplate: initialRule?.detailTemplate,
  });

  const [expressionError, setExpressionError] = useState<string | null>(null);
  const [isDirty] = useState(false); // simple dirty check

  // Ref for the expression form
  const expressionRef = useRef<HTMLFormElement>(null);

  // Parse and validate the expression whenever it changes
  useEffect(() => {
    const [parsed, errors] = parseRuleExpression(rule.expression);
    if (errors.length > 0) {
      setExpressionError(errors.map((e) => e.reason).join('; '));
    } else {
      setExpressionError(null);
      // Optionally: compile the rule for preview
      try {
        compileRule(rule);
      } catch (e) {
        setExpressionError(`Compilation error: ${e.message}`);
      }
    }
  }, [rule.expression]);

  // Save / commit the rule when the form is submitted
  const handleSave = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const [parsed, errors] = parseRuleExpression(rule.expression);
      if (errors.length > 0) {
        setExpressionError(errors.map((e) => e.reason).join('; '));
        return;
      }
      setExpressionError(null);
      const validatedRule: RuleDefinition = {
        ...rule,
        expression: parsed,
      };
      if (onRuleChange) {
        onRuleChange(validatedRule);
      }
    },
    [rule.expression, onRuleChange]
  );

  // Cancel / close without saving
  const handleCancel = useCallback(() => {
    if (onRuleChange) {
      onRuleChange(undefined);
    }
  }, [onRuleChange]);

  // Toggle effective date picker
  const [showEffectiveDate, setShowEffectiveDate] = useState(false);
  const [effectiveStart, setEffectiveStart] = useState(
    rule.effectiveDate?.start || new Date().toISOString().split('T')[0]
  );
  const [effectiveEnd, setEffectiveEnd] = useState(
    rule.effectiveDate?.end ? rule.effectiveDate.end : ''
  );

  const handleEffectiveDateApply = useCallback(() => {
    const start = formatDateForInput(parseDateString(effectiveStart));
    const end = effectiveEnd ? formatDateForInput(parseDateString(effectiveEnd)) : undefined;

    setRule((prev) => ({
      ...prev,
      effectiveDate: end ? { start, end } : { start },
      active: true,
    }));
    setShowEffectiveDate(false);
  }, [effectiveStart, effectiveEnd]);

  const handleEffectiveDateCancel = useCallback(() => {
    setShowEffectiveDate(false);
  }, []);

  // Handle hint field change
  const [hintField, setHintField] = useState<RuleDefinition['hintField']>(
    rule.hintField || undefined
  );

  // Handle detail template change
  const [detailTemplate, setDetailTemplate] = useState<RuleDefinition['detailTemplate'] | undefined>(
    rule.detailTemplate
  );

  return (
    <div className="rule-editor" role="dialog" aria-modal="true" aria-labelledby="rule-editor-title">
      <div className="rule-editor__header">
        <h2 id="rule-editor-title">Eligibility Rule Editor</h2>
        <button
          type="button"
          className="rule-editor__close-btn"
          onClick={handleCancel}
          aria-label="Close rule editor"
        >
          ✕
        </button>
      </div>

      <form onSubmit={handleSave} ref={expressionRef} noValidate>
        {/* Rule metadata */}
        <div className="rule-editor__meta">
          <label htmlFor="rule-label">Label</label>
          <input
            id="rule-label"
            type="text"
            value={rule.label}
            onChange={(e) =>
              setRule((prev) => ({ ...prev, label: e.target.value.trim() || 'New eligibility rule' }))
            }
            required
            placeholder="e.g. Income within limit"
            disabled={isDirty ? false : true}
          />

          <label htmlFor="rule-id">Rule ID (auto-generated)</label>
          <input
            id="rule-id"
            type="text"
            value={rule.id}
            onChange={(e) => setRule((prev) => ({ ...prev, id: e.target.value.trim() }))}
            readOnly
          />

          {/* Effective date section */}
          {rule.effectiveDate && (
            <div className="rule-editor__effective-date">
              <label>Effective date range</label>
              <button
                type="button"
                className="rule-editor__effective-date-btn"
                onClick={() => setShowEffectiveDate(true)}
                aria-haspopup="dialog"
                aria-expanded="false"
              >
                {rule.effectiveDate.start ? `Active since ${new Date(rule.effectiveDate.start).toLocaleDateString()}` : 'No start date'}
              </button>
              {showEffectiveDate && (
                <div className="rule-editor__effective-date-picker">
                  <p>From</p>
                  <input
                    type="date"
                    value={effectiveStart}
                    onChange={(e) => setEffectiveStart(e.target.value)}
                    required
                  />
                  <p>To (optional)</p>
                  <input
                    type="date"
                    value={effectiveEnd || ''}
                    onChange={(e) => setEffectiveEnd(e.target.value)}
                  />
                  <div className="rule-editor__effective-date-actions">
                    <button type="button" onClick={handleEffectiveDateApply} className="btn-primary">
                      Apply
                    </button>
                    <button type="button" onClick={handleEffectiveDateCancel} className="btn-secondary">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <label>
            <input
              type="checkbox"
              checked={rule.active}
              onChange={(e) => setRule((prev) => ({ ...prev, active: e.target.checked }))}
            />
            Active
          </label>
        </div>

        {/* Expression editor */}
        <div className="rule-editor__expression">
          <label htmlFor="expression">Rule expression</label>
          {expressionError && (
            <div className="rule-editor__error" role="alert">
              {expressionError}
            </div>
          )}

          <div className="expression-editor">
            {/* Left operand - profile field or literal */}
            <div className="expression-row">
              <label>Left side</label>
              <select
                onChange={(e) => {
                  const field = e.target.value;
                  // Replace the left side of the expression with the selected field
                  setRule((prev) => {
                    const newLeft = field === '' ? '' : field;
                    // Preserve operator and right side if they're valid, otherwise reset
                    const newExpr = newLeft === ''
                      ? { left: '', operator: OPERATORS.EQ, right: '' }
                      : { left: newLeft, operator: prev.operator, right: String(prev.right) };
                    return { ...prev, expression: newExpr };
                  });
                }}
              >
                <option value="">-- Select profile field --</option>
                {PROFILE_FIELDS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
                <option value="custom">Custom value...</option>
              </select>
            </div>

            {/* Operator selector */}
            <div className="expression-row">
              <label>Operator</label>
              <select
                onChange={(e) => {
                  const op = e.target.value;
                  setRule((prev) => {
                    // Validate the operator is known
                    if (!OPERATORS[op as keyof typeof OPERATORS]) return prev;
                    // Keep left and right, just change operator
                    return {
                      ...prev,
                      expression: {
                        left: prev.expression.left,
                        operator: op as keyof typeof OPERATORS,
                        right: prev.expression.right,
                      },
                    };
                  });
                }}
              >
                <option value="">-- Select operator --</option>
                {Object.entries(OPERATOR_DISPLAY).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Right side - literal or profile field */}
            <div className="expression-row">
              <label>Right side</label>
              <select
                onChange={(e) => {
                  const value = e.target.value;
                  setRule((prev) => {
                    const newRight = value === 'custom' ? prev.right : value;
                    return {
                      ...prev,
                      expression: {
                        left: prev.expression.left,
                        operator: prev.expression.operator,
                        right: newRight,
                      },
                    };
                  });
                }}
              >
                <option value="">-- Select value --</option>
                {PROFILE_FIELDS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
                <option value="custom">Custom value...</option>
              </select>
            </div>

            {/* Add a note / detail template */}
            <div className="expression-row">
              <label>Detail template (optional)</label>
              <textarea
                value={detailTemplate || ''}
                onChange={(e) =>
                  setRule((prev) => ({ ...prev, detailTemplate: e.target.value.trim() || undefined }))
                }
                rows={2}
                placeholder="e.g. Family income {value} is within the limit"
                disabled={isDirty ? false : true}
              /></textarea>
              <small className="form-note">
                Use {value} as a placeholder for the evaluated value
              </small>
            </div>
          </div>
        </div>

        {/* Save / Cancel actions */}
        <div className="rule-editor__actions">
          <button type="submit" className="btn-primary">
            Save rule
          </button>
          <button type="button" onClick={handleCancel} className="btn-secondary">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

/**
 * RuleSetEditor - Editor for a complete rule set (multiple rules per scheme/service)
 * 
 * Props:
 *   initialRuleSet?: RuleSetDefinition - pre-loaded rule set
 *   onRuleSetChange?: (ruleSet: RuleSetDefinition) => void - called when rule set changes
 */
export function RuleSetEditor({
  initialRuleSet,
  onRuleSetChange,
}: {
  initialRuleSet?: RuleSetDefinition;
  onRuleSetChange?: (ruleSet: RuleSetDefinition) => void;
}) => {
  const [ruleSet, setRuleSet] = useState<RuleSetDefinition>({
    schemeId: initialRuleSet?.schemeId || '',
    title: initialRuleSet?.title || 'Eligibility rules',
    schemaVersion: initialRuleSet?.schemaVersion || 1,
    rules: initialRuleSet?.rules || [],
    description: initialRuleSet?.description || '',
    tags: initialRuleSet?.tags || [],
    owner: initialRuleSet?.owner,
  });

  const [newRuleId, setNewRuleId] = useState('');
  const [newRuleLabel, setNewRuleLabel] = useState('');
  const [newRuleExpression, setNewRuleExpression] = useState({
    left: '',
    operator: OPERATORS.EQ,
    right: '',
  });
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [ruleEditorOpen, setRuleEditorOpen] = useState(false);

  // Add a new rule to the rule set
  const handleAddRule = useCallback(() => {
    if (!newRuleId.trim()) {
      // Generate a simple ID
      setNewRuleId(`rule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    }
  }, []);

  // Delete a rule from the rule set
  const handleDeleteRule = useCallback((ruleId: string) => {
    setRuleSet((prev) => ({
      ...prev,
      rules: prev.rules.filter((r) => r.id !== ruleId),
      schemaVersion: prev.schemaVersion + 1, // Version bump on change
    }));
  }, []);

  // Open the rule editor for a specific rule (or new rule)
  const openRuleEditor = useCallback(
    (rule?: RuleDefinition) => {
      setRuleEditorOpen(true);
      if (rule) {
        setEditingRuleId(rule.id);
        setRuleSet((prev) => ({
          ...prev,
          rules: prev.rules.map((r) =>
            r.id === rule.id ? { ...r, label: rule.label, expression: rule.expression, active: rule.active, hintField: rule.hintField, detailTemplate: rule.detailTemplate } : r
          ),
        }));
      } else {
        setEditingRuleId(null);
        setRuleSet((prev) => ({
          ...prev,
          rules: [...prev.rules, {
            id: newRuleId || `rule-${Date.now()}`,
            label: newRuleLabel || 'New rule',
            expression: { left: '', operator: OPERATORS.EQ, right: '' },
            active: true,
          }],
          schemaVersion: prev.schemaVersion + 1,
        }));
      }
    },
    [newRuleId, newRuleLabel]
  );

  // Close the rule editor without saving changes
  const closeRuleEditor = useCallback(() => {
    setRuleEditorOpen(false);
    setEditingRuleId(null);
  }, []);

  return (
    <div className="rule-set-editor">
      <header className="rule-set-editor__header">
        <h2>Rule Set Editor</h2>
        <button
          type="button"
          className="rule-set-editor__add-btn"
          onClick={openRuleEditor}
          aria-label="Add new eligibility rule"
        >
          + Add rule
        </button>
      </header>

      {ruleSet.rules.length === 0 && (
        <p className="rule-set-editor__empty">
          No rules defined. Click <button onClick={openRuleEditor}>Add rule</button> to get started.
        </p>
      )}

      <section className="rule-set-editor__rules">
        {ruleSet.rules.map((rule) => (
          <div
            key={rule.id}
            className="rule-set-editor__rule"
            role="button"
            tabIndex={0}
            onClick={() => openRuleEditor(rule)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openRuleEditor(rule);
              }
            }}
          >
            <div className="rule-set-editor__rule-header">
              <span className="rule-set-editor__rule-id">{rule.id}</span>
              <span className="rule-set-editor__rule-label">{rule.label}</span>
              {rule.effectiveDate && (
                <span className="rule-set-editor__effective-date">
                  {rule.effectiveDate.start ? `since ${new Date(rule.effectiveDate.start).toLocaleDateString()}` : 'no date range'}
                </span>
              )}
            </div>
            <div className="rule-set-editor__rule-expression">
              {JSON.stringify(rule.expression)}
            </div>
            {rule.active && rule.effectiveDate ? (
              <small>Active with effective dates</small>
            ) : rule.active && !rule.effectiveDate ? (
              <small>Active (no date range)</small>
            ) : !rule.active ? (
              <small>Inactive</small>
            ) : null}
          </div>
        ))}
      </section>

      <footer className="rule-set-editor__footer">
        <div className="rule-set-editor__version">
          Schema version: {ruleSet.schemaVersion}
        </div>
        <button
          type="button"
          onClick={closeRuleEditor}
          className="rule-set-editor__close-btn"
          disabled={ruleSet.rules.length === 0}
        >
          Close
        </button>
      </footer>
    </div>
  );
};

/**
 * QuickRuleAuthor - A simplified, inline authoring component for common rule patterns.
 * 
 * Use case: Quickly author a single income check rule without opening the full editor.
 */
export function QuickRuleAuthor({
  profileField,
  operator,
  initialValue,
  onRuleSubmit,
}: {
  profileField: string;
  operator: keyof typeof OPERATORS;
  initialValue?: string | number | boolean;
  onRuleSubmit: (rule: RuleDefinition) => void;
}) => {
  const [value, setValue] = useState(initialValue ?? '');
  const [isEditing, setIsEditing] = useState(true);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const rule: RuleDefinition = {
        id: `quick-${profileField}-${Date.now()}`,
        label: `${profileField} ${OPERATORS[operator]} ${String(value)}`,
        expression: {
          left: profileField,
          operator,
          right: value,
        },
        active: true,
        hintField: profileField as any,
        detailTemplate: `${profileField} ${OPERATORS[operator]} {value}`,
      };
      onRuleSubmit(rule);
      setIsEditing(false);
    },
    [profileField, operator, value]
  );

  return isEditing ? (
    <form onSubmit={handleSubmit} className="quick-rule-author">
      <label>
        {profileField} {OPERATORS[operator]} {value !== '' ? String(value) : 'Enter value'}
      </label>
      <input
        type="text"
        value={String(value)}
        onChange={(e) => setValue(e.target.value)}
        placeholder="e.g. 800000"
        required
      />
      <button type="submit">Create rule</button>
    </form>
  ) : null;
};

/**
 * Export all components and utilities for consumption.
 * Users can import:
 *   - RuleEditor: full-featured visual editor
 *   - RuleSetEditor: rule set management
 *   - QuickRuleAuthor: quick inline rule creation
 *   - compileRule, parseRuleExpression: lower-level utilities
 *   - OPERATORS, PROFILE_FIELDS: constants
 */
export type {
  RuleDefinition,
  RuleSetDefinition,
  RuleResult,
  RuleSetEvaluation,
  DslValidationError,
  OPERATORS,
  PROFILE_FIELDS,
};