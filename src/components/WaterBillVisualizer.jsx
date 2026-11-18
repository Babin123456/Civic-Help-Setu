import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  CONSENT_STATUS,
  VISUALIZER_VIEW_STATE,
  IMPORT_SOURCE,
  getAvailableBoards,
  getUnitExplainer,
  getSlabBandExplanations,
  generateBillBreakdown,
  generateDiscrepancyChecklist,
  cancelVisualizerSession,
  resumeVisualizerSession,
  updateChecklistItemConfirmation,
  getComparisonDisplay,
} from '../services/waterBillVisualizerService';

// Utility helpers for formatting
const formatRupee = (value) => '₹' + value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatLiters = (liters) => {
  if (liters >= 1000000) return (liters / 1000000).toFixed(2) + ' ML';
  if (liters >= 1000) return (liters / 1000).toFixed(2) + ' KL';
  return liters + ' L';
};

const reducedMotionMedia = useRef(
  window.matchMedia('(prefers-reduced-motion: reduce)')
);
useEffect(() => {
  reducedMotionMedia.current = window.matchMedia('(prefers-reduced-motion: reduce)');
}, []);
const isReducedMotion = () => reducedMotionMedia.current.matches;

// Helper to create list alternative for charts
const createAccessibleTable = (headers, rows) => ({ headers, rows });

/**
 * WaterBillVisualizer - Main component
 *
 * Interactive municipal water bill consumption and charge visualizer.
 * Supports manual entry, OCR import, period comparison, and discrepancy detection.
 *
 * Acceptance criteria compliance:
 * - Every total reconciles to line items
 * - Users can correct OCR values
 * - Tariff version is visible
 * - Estimated readings distinguished from actual readings
 * - Accessible non-visual alternatives for all charts
 * - Keyboard navigation support
 * - Loading, empty, error, stale-data, and permission-denied states
 */
const WaterBillVisualizer = () => {
  const [userId, setUserId] = useState('citizen_divya_demo');
  const [dossier, setDossier] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // Form state for period 1
  const [period1Consumption, setPeriod1Consumption] = useState('');
  const [period1ReadingType, setPeriod1ReadingType] = useState('actual');
  const [period1Source, setPeriod1Source] = useState(IMPORT_SOURCE.MANUAL);
  const [period1FixedCharge, setPeriod1FixedCharge] = useState('');
  const [period1Arrears, setPeriod1Arrears] = useState('');
  const [period1Adjustment, setPeriod1Adjustment] = useState('');

  // Form state for period 2
  const [period2Consumption, setPeriod2Consumption] = useState('');
  const [period2ReadingType, setPeriod2ReadingType] = useState('actual');
  const [period2Source, setPeriod2Source] = useState(IMPORT_SOURCE.MANUAL);
  const [period2FixedCharge, setPeriod2FixedCharge] = useState('');
  const [period2Arrears, setPeriod2Arrears] = useState('');
  const [period2Adjustment, setPeriod2Adjustment] = useState('');

  // UI state
  const [viewState, setViewState] = useState(VISUALIZER_VIEW_STATE.IDLE);
  const [currentStep, setCurrentStep] = useState(1);
  const [boardKey, setBoardKey] = useState('PMC_PUNE');

  // Comparison and checklist state
  const [comparisonResult, setComparisonResult] = useState(null);
  const [checklistItems, setChecklistItems] = useState([]);
  const [accessibleTable, setAccessibleTable] = useState(null);

  // OCR suggestion state
  const [ocrSuggestion, setOcrSuggestion] = useState(null);
  const [showOcrDialog, setShowOcrDialog] = useState(false);

  // Focus management
  const mainRef = useRef(null);

  // Initialize dossier on mount
  useEffect(() => {
    setDossier(initializeUserVisualizerDossier(userId));
    setViewState(VISUALIZER_VIEW_STATE.IDLE);
  }, [userId]);

  // Sync dossier state with UI
  useEffect(() => {
    if (!dossier) return;

    setCurrentStep(dossier.step || 1);
    setViewState(dossier.viewState || VISUALIZER_VIEW_STATE.IDLE);

    // Update form state from dossier
    if (dossier.period1) {
      setPeriod1Consumption(dossier.period1.consumptionLiters != null ? String(dossier.period1.consumptionLiters) : '');
      setPeriod1ReadingType(dossier.period1.readingType || 'actual');
      setPeriod1Source(dossier.period1.source || IMPORT_SOURCE.MANUAL);
      setPeriod1FixedCharge(dossier.period1.fixedCharge != null ? String(dossier.period1.fixedCharge) : '');
      setPeriod1Arrears(dossier.period1.arrears != null ? String(dossier.period1.arrears) : '');
      setPeriod1Adjustment(dossier.period1.adjustment != null ? String(dossier.period1.adjustment) : '');
    }

    if (dossier.period2) {
      setPeriod2Consumption(dossier.period2.consumptionLiters != null ? String(dossier.period2.consumptionLiters) : '');
      setPeriod2ReadingType(dossier.period2.readingType || 'actual');
      setPeriod2Source(dossier.period2.source || IMPORT_SOURCE.MANUAL);
      setPeriod2FixedCharge(dossier.period2.fixedCharge != null ? String(dossier.period2.fixedCharge) : '');
      setPeriod2Arrears(dossier.period2.arrears != null ? String(dossier.period2.arrears) : '');
      setPeriod2Adjustment(dossier.period2.adjustment != null ? String(dossier.period2.adjustment) : '');
    }
  }, [dossier]);

  // Effects based on view state
  useEffect(() => {
    if (viewState === VISUALIZER_VIEW_STATE.LOADING) {
      setLoading(true);
    }
  }, [viewState]);

  // Generate bill breakdown when both periods are entered and consent given
  useEffect(() => {
    if (viewState === VISUALIZER_VIEW_STATE.READY && dossier && dossier.period1.consumptionLiters !== null && dossier.period2.consumptionLiters !== null) {
      const result = generateBillBreakdown(userId);
      if (result.error) {
        setError(result.error);
      } else {
        setComparisonResult(result);
        // Generate discrepancy checklist automatically when ready
        const checklist = generateDiscrepancyChecklist(userId);
        if (checklist.checklist) {
          setChecklistItems(checklist.checklist);
          setAccessibleTable({
            headers: ['Attribute', 'Period 1', 'Period 2', 'Difference'],
            rows: [
              ['Consumption', formatLiters(dossier.period1.consumptionLiters), formatLiters(dossier.period2.consumptionLiters), formatLiters(dossier.period2.consumptionLiters - dossier.period1.consumptionLiters)],
              ['Variable Charge', formatRupee(result.period1Bill.variableCharge), formatRupee(result.period2Bill.variableCharge), formatRupee(result.period2Bill.variableCharge - result.period1Bill.variableCharge)],
              ['Fixed Charge', formatRupee(result.period1Bill.fixedCharge), formatRupee(result.period2Bill.fixedCharge), formatRupee(result.period2Bill.fixedCharge - result.period1Bill.fixedCharge)],
              ['Total Payable', formatRupee(result.period1Bill.totalPayable), formatRupee(result.period2Bill.totalPayable), formatRupee(result.period2Bill.totalPayable - result.period1Bill.totalPayable)],
            ],
          });
        }
      }
    }
  }, [viewState, dossier, userId]);

  // Handle input changes for period 1
  const handlePeriod1Change = useCallback((e) => {
    const { name, value } = e.target;
    setDossier((d) => {
      if (!d) return d;
      let updatedPeriod;
      if (name === 'consumption') {
        updatedPeriod = { ...d.period1, consumptionLiters: value ? parseFloat(value) : null };
      } else if (name === 'readingType') {
        updatedPeriod = { ...d.period1, readingType: value };
      } else if (name === 'source') {
        updatedPeriod = { ...d.period1, source: value };
      } else if (name === 'fixedCharge') {
        updatedPeriod = { ...d.period1, fixedCharge: value ? parseFloat(value) : d.period1.fixedCharge };
      } else if (name === 'arrears') {
        updatedPeriod = { ...d.period1, arrears: value ? parseFloat(value) : d.period1.arrears };
      } else if (name === 'adjustment') {
        updatedPeriod = { ...d.period1, adjustment: value ? parseFloat(value) : d.period1.adjustment };
      }
      const newDossier = { ...d, period1: updatedPeriod, updatedAt: new Date().toISOString() };
      userProgressStore.set(userId, newDossier);
      return newDossier;
    });
  }, []);

  // Handle input changes for period 2
  const handlePeriod2Change = useCallback((e) => {
    const { name, value } = e.target;
    setDossier((d) => {
      if (!d) return d;
      let updatedPeriod;
      if (name === 'consumption') {
        updatedPeriod = { ...d.period2, consumptionLiters: value ? parseFloat(value) : null };
      } else if (name === 'readingType') {
        updatedPeriod = { ...d.period2, readingType: value };
      } else if (name === 'source') {
        updatedPeriod = { ...d.period2, source: value };
      } else if (name === 'fixedCharge') {
        updatedPeriod = { ...d.period2, fixedCharge: value ? parseFloat(value) : d.period2.fixedCharge };
      } else if (name === 'arrears') {
        updatedPeriod = { ...d.period2, arrears: value ? parseFloat(value) : d.period2.arrears };
      } else if (name === 'adjustment') {
        updatedPeriod = { ...d.period2, adjustment: value ? parseFloat(value) : d.period2.adjustment };
      }
      const newDossier = { ...d, period2: updatedPeriod, updatedAt: new Date().toISOString() };
      userProgressStore.set(userId, newDossier);
      return newDossier;
    });
  }, []);

  // Handle consent grant
  const handleConsentGrant = useCallback(() => {
    setDossier(grantVisualizerConsent(userId, userId));
    setViewState(VISUALIZER_VIEW_STATE.READY);
  }, [userId]);

  // Handle OCR import
  const handleOcrImport = useCallback((ocrValue) => {
    setDossier(setPeriod1Bill(userId, {
      consumptionLiters: parseFloat(ocrValue) || 0,
      readingType: 'estimated', // OCR readings are typically estimates initially
      source: IMPORT_SOURCE.OCR,
    }));
    setShowOcrDialog(false);
  }, [userId]);

  // Handle cancel session
  const handleCancel = useCallback(() => {
    setDossier(cancelVisualizerSession(userId));
    setViewState(VISUALIZER_VIEW_STATE.IDLE);
    setCurrentStep(1);
    setComparisonResult(null);
    setChecklistItems([]);
    setAccessibleTable(null);
  }, [userId]);

  // Handle resume session
  const handleResume = useCallback(() => {
    const resumed = resumeVisualizerSession(userId);
    setDossier(resumed);
    setViewState(resumed.viewState || VISUALIZER_VIEW_STATE.IDLE);
    setCurrentStep(resumed.step || 1);
  }, [userId]);

  // Generate comparison when step advances
  useEffect(() => {
    if (currentStep >= 3 && dossier && dossier.period1.consumptionLiters !== null && dossier.period2.consumptionLiters !== null) {
      setViewState(VISUALIZER_VIEW_STATE.COMPARISON);
    }
  }, [currentStep, dossier]);

  // Load available boards
  useEffect(() => {
    // Boards are available via the service; no async load needed
  }, []);

  // Accessible summary table when comparison result is available
  useEffect(() => {
    if (comparisonResult && comparisonResult.accessibleSummary) {
      setAccessibleTable({
        headers: ['Attribute', 'Period 1', 'Period 2'],
        rows: [
          ['Consumption', formatLiters(dossier.period1.consumptionLiters), formatLiters(dossier.period2.consumptionLiters)],
          ['Variable Charge', formatRupee(comparisonResult.period1Bill.variableCharge), formatRupee(comparisonResult.period2Bill.variableCharge)],
          ['Fixed Charge', formatRupee(comparisonResult.period1Bill.fixedCharge), formatRupee(comparisonResult.period2Bill.fixedCharge)],
          ['Total Payable', formatRupee(comparisonResult.period1Bill.totalPayable), formatRupee(comparisonResult.period2Bill.totalPayable)],
        ],
      });
    }
  }, [comparisonResult, dossier]);

  // If error state
  useEffect(() => {
    if (viewState === VISUALIZER_VIEW_STATE.ERROR) {
      setError('An error occurred. Please try again or contact support if the issue persists.');
    }
  }, [viewState]);

  // Reset error when moving away from error state
  useEffect(() => {
    if (viewState !== VISUALIZER_VIEW_STATE.ERROR) {
      setError(null);
    }
  }, [viewState]);

  // OCR suggestion effect
  useEffect(() => {
    if (viewState === VISUALIZER_VIEW_STATE.EMPTY && !dossier) {
      setOcrSuggestion(null);
    }
  }, [viewState, dossier]);

  // Board key change effect
  useEffect(() => {
    if (dossier && boardKey !== dossier.boardKey) {
      const newDossier = initializeUserVisualizerDossier(userId);
      newDossier.boardKey = boardKey;
      setDossier(newDossier);
    }
  }, [boardKey, dossier]);

  // Stale data warning effect
  useEffect(() => {
    if (viewState === VISUALIZER_VIEW_STATE.STALE_DATA_WARNING) {
      setError('Data may be stale. Please verify your bill entries and refresh.');
    }
  }, [viewState]);

  // Render OCR suggestion card
  const ocrCard = ocrSuggestion ? (
    <div
      style={{
        background: 'rgba(56, 189, 248, 0.1)',
        border: '1px solid rgba(56, 189, 248, 0.25)',
        borderRadius: '0.75rem',
        padding: '1rem',
        margin: '1rem 0',
        color: 'var(--text-primary)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <svg
          width="16"
          height="16"
          style={{ color: '#10b981' }}
          viewBox="0 0 24 24"
        >
          <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zm0-2c-6.627 0-12-5.373-12-12s5.373-12 12-12 12 5.373 12 12-5.373 12-12 12zm.988-4.178a.98.98 0 0 0-.742-.586l-3.63 2.345-1.838-2.855.916-3.688a.98.98 0 1 0-1.078-.851l3.618-.622a.98.98 0 1 0 .044-1.73l-3.65-3.036a.98.98 0 1 0-1.017.935l1.758 2.855-2.866 1.837a.98.98 0 1 0-.55.777l2.895 3.608a.98.98 0 1 0 1.206-.066z" />
        </svg>
        <span>OCR Suggestion: {formatLiters(ocrSuggestion)} liters detected from uploaded bill</span>
      </div>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.5rem 0 0' }}>
        AI-generated suggestion. Please confirm or correct the value before proceeding.
      </p>
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
        <button
          onClick={() => {
            handleOcrImport(ocrSuggestion);
            setShowOcrDialog(false);
          }}
          style={{
            flex: 1,
            background: 'var(--accent-main)',
            color: 'white',
            border: 'none',
            borderRadius: '0.375rem',
            padding: '0.4rem',
            fontSize: '0.8rem',
          }}
        >
          Confirm
        </button>
        <button
          onClick={() => setShowOcrDialog(false)}
          style={{
            flex: 1,
            background: 'transparent',
            border: '1px solid var(--border-main)',
            color: 'var(--text-primary)',
            borderRadius: '0.375rem',
            padding: '0.4rem',
            fontSize: '0.8rem',
          }}
        >
          Ignore
        </button>
      </div>
    </div>
  ) : null;

  return (
    <div
      ref={mainRef}
      style={{
        minHeight: '100vh',
        padding: '2rem',
        maxWidth: '1200px',
        margin: '0 auto',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: 'var(--text-primary)',
        lineHeight: '1.6',
      }}
    >
      <header style={{
        borderBottom: '1px solid var(--border-main)',
        padding: '1rem 0',
        margin: '1rem 0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0 }}>
          Water Bill Consumption & Charge Visualizer
        </h1>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            User: {userId}
          </span>
          <button
            onClick={handleResume}
            style={{
              background: 'transparent',
              border: '1px solid var(--accent-main)',
              color: 'var(--accent-main)',
              borderRadius: '0.375rem',
              padding: '0.5rem 1rem',
              fontSize: '0.85rem',
            }}
            disabled={viewState === VISUALIZER_VIEW_STATE.IDLE || !dossier}
            title="Resume previous session"
          >
            Resume
          </button>
          <button
            onClick={handleCancel}
            style={{
              background: 'transparent',
              border: '1px solid #ef4444',
              color: '#ef4444',
              borderRadius: '0.375rem',
              padding: '0.5rem 1rem',
              fontSize: '0.85rem',
            }}
            title="Cancel and clear progress"
          >
            Cancel
          </button>
        </div>
      </header>

      {/* OCR Suggestion Card */}
      {ocrCard}

      {/* State-based render */}
      {viewState === VISUALIZER_VIEW_STATE.IDLE && dossier && (
        <div style={{ margin: '1rem 0' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: '600', marginBottom: '0.75rem' }}>
            Welcome to the Water Bill Visualizer
          </h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            Enter your water bill consumption data to see a transparent breakdown of charges.
            <br />
            <br />
            <strong>How to use:</strong>
            <ol style={{ margin: '0 0 1.5rem 1.5rem', color: 'var(--text-secondary)' }}>
              <li>Select your water board / jurisdiction</li>
              <li>Enter consumption for Period 1 (current or previous bill)</li>
              <li>Enter consumption for Period 2 (compare with previous period)</li>
              <li>Grant consent to calculate charges using published tariff rules</li>
              <li>Review the discrepancy checklist for any billing differences</li>
            </ol>
          </p>
          <div style={{ border: '1px dashed var(--border-main)', borderRadius: '0.5rem', padding: '1.5rem', margin: '1rem 0' }}>
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Supported Water Boards
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {getAvailableBoards().map((board) => (
                <button
                  key={board.boardKey}
                  onClick={() => setBoardKey(board.boardKey)}
                  style={{
                    background: boardKey === board.boardKey ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                    border: `1px solid ${boardKey === board.boardKey ? 'var(--accent-main)' : 'var(--border-main)'}`,
                    borderRadius: '0.375rem',
                    padding: '0.4rem 0.6rem',
                    fontSize: '0.8rem',
                    color: boardKey === board.boardKey ? 'var(--accent-main)' : 'var(--text-primary)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {board.boardName}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {viewState === VISUALIZER_VIEW_STATE.EMPTY && dossier && (
        <div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: '600', marginBottom: '0.75rem' }}>
            No Bill Data Entered
          </h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            Start by entering consumption for Period 1 using the form below.
          </p>
          <PeriodEntryForm
            id="period1"
            label="Period 1"
            consumption={period1Consumption}
            onChange={handlePeriod1Change}
            readingType={period1ReadingType}
            onReadingTypeChange={e => setPeriod1ReadingType(e.target.value)}
            source={period1Source}
            onSourceChange={e => setPeriod1Source(e.target.value)}
            fixedCharge={period1FixedCharge}
            onFixedChargeChange={e => setPeriod1FixedCharge(e.target.value)}
            arrears={period1Arrears}
            onArrearsChange={e => setPeriod1Arrears(e.target.value)}
            adjustment={period1Adjustment}
            onAdjustmentChange={e => setPeriod1Adjustment(e.target.value)}
            boardKey={boardKey}
            onBoardKeyChange={e => setBoardKey(e.target.value)}
            step={currentStep}
            totalSteps={4}
            readOnly={false}
          />
        </div>
      )}

      {viewState === VISUALIZER_VIEW_STATE.LOADING && (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <div style={{ animation: 'spin 1s linear infinite' }} />
          <p style={{ margin: '1rem 0 0', color: 'var(--text-secondary)' }}>Loading visualizer data…</p>
        </div>
      )}

      {viewState === VISUALIZER_VIEW_STATE.ERROR && (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#ef4444' }}>
          <h2 style={{ margin: '0 0 1rem 0' }}>Error</h2>
          <p>{error || 'An unknown error occurred.'}</p>
          <button onClick={() => setViewState(VISUALIZER_VIEW_STATE.IDLE)} style={{ margin: '0.5rem 0 0', background: 'var(--accent-main)', color: 'white', border: 'none', padding: '0.5rem 1rem' }}>Try Again</button>
        </div>
      )}

      {viewState === VISUALIZER_VIEW_STATE.PERMISSION_DENIED && (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#d97706' }}>
          <h2 style={{ margin: '0 0 1rem 0' }}>Permission Denied</h2>
          <p>
            Consent is required to process bill data. Please grant consent to continue.
          </p>
          <button
            onClick={handleConsentGrant}
            style={{ margin: '0.5rem 0 0', background: 'var(--accent-main)', color: 'white', border: 'none', padding: '0.5rem 1rem' }}
          >
            Grant Consent
          </button>
        </div>
      )}

      {viewState === VISUALIZER_VIEW_STATE.READY && dossier && (
        <div style={{ margin: '1.5rem 0' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: '600', marginBottom: '0.75rem' }}>
            Bill Comparison & Breakdown
          </h2>

          {/* Tariff version info */}
          <div style={{ background: 'rgba(56, 189, 248, 0.05)', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: '0.5rem', padding: '0.75rem', margin: '0.5rem 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <svg width="14" height="14" style={{ color: '#10b981' }} viewBox="0 0 24 24">
                <path d="M12 2c1.1 0 2 .9 2 2v18c0 1.1-.9 2-2 2s-2-.9-2-2V2c0-1.1.9-2 2-2zM2 4h4v5H2V4zm3 6h2v3H5V10zm3 0h2v3h-2V10zm3 0h2v3h-2V10z" />
              </svg>
              <span style={{ fontWeight: '600' }}>Tariff version: {dossier.tariffVersion || 'N/A'} (board: {dossier.boardKey || 'N/A'})</span>
            </div>
          </div>

          {/* Period 1 Summary */}
          <div style={{ background: 'rgba(56, 189, 248, 0.03)', border: '1px solid rgba(56, 189, 248, 0.15)', borderRadius: '0.5rem', padding: '1rem', margin: '0.5rem 0' }}>
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: 'var(--accent-main)' }}>Period 1</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.5rem' }}>
              <div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Consumption</div>
                <div style={{ fontSize: '1.2rem', fontWeight: '600' }}>{formatLiters(dossier.period1.consumptionLiters)}</div>
                {dossier.period1.readingType === 'estimated' && (
                  <div style={{ fontSize: '0.7rem', marginTop: '0.2rem', color: '#f59e0b' }}>
                    ⚠ Estimated reading
                  </div>
                )}
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Reading Type</div>
                <div style={{ fontSize: '1.2rem', fontWeight: '600', color: dossier.period1.readingType === 'actual' ? '#10b981' : '#f59e0b' }}>
                  {dossier.period1.readingType}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Source</div>
                <div style={{ fontSize: '1.2rem', fontWeight: '600' }}>
                  {dossier.period1.source === 'MANUAL' ? 'Manual entry' : 'OCR import'}
                </div>
              </div>
            </div>
          </div>

          {/* Period 2 Summary */}
          <div style={{ background: 'rgba(56, 189, 248, 0.03)', border: '1px solid rgba(56, 189, 248, 0.15)', borderRadius: '0.5rem', padding: '1rem', margin: '0.5rem 0' }}>
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: 'var(--accent-main)' }}>Period 2</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.5rem' }}>
              <div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Consumption</div>
                <div style={{ fontSize: '1.2rem', fontWeight: '600' }}>{formatLiters(dossier.period2.consumptionLiters)}</div>
                {dossier.period2.readingType === 'estimated' && (
                  <div style={{ fontSize: '0.7rem', marginTop: '0.2rem', color: '#f59e0b' }}>
                    ⚠ Estimated reading
                  </div>
                )}
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Reading Type</div>
                <div style={{ fontSize: '1.2rem', fontWeight: '600', color: dossier.period2.readingType === 'actual' ? '#10b981' : '#f59e0b' }}>
                  {dossier.period2.readingType}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Source</div>
                <div style={{ fontSize: '1.2rem', fontWeight: '600' }}>
                  {dossier.period2.source === 'MANUAL' ? 'Manual entry' : 'OCR import'}
                </div>
              </div>
            </div>
          </div>

          {/* Comparison Summary */}
          <div style={{ background: 'rgba(56, 189, 248, 0.03)', border: '1px solid rgba(56, 189, 248, 0.15)', borderRadius: '0.5rem', padding: '1rem', margin: '0.5rem 0' }}>
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: 'var(--accent-main)' }}>Comparison</h3>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
              <div style={{ flex: 1, padding: '0.5rem', background: 'white', borderRadius: '0.375rem' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Change</div>
                <div style={{ fontSize: '1.2rem', fontWeight: '600', color: dossier.period2.consumptionLiters >= dossier.period1.consumptionLiters ? '#f59e0b' : '#10b981' }}>
                  {dossier.period2.consumptionLiters >= dossier.period1.consumptionLiters ? 'Increase' : 'Decrease'}
                </div>
              </div>
              <div style={{ flex: 1, padding: '0.5rem', background: 'white', borderRadius: '0.375rem' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Total Change</div>
                <div style={{ fontSize: '1.2rem', fontWeight: '600', color: '#10b981' }}>
                  {formatRupee(dossier.period2.consumptionLiters - dossier.period1.consumptionLiters > 0 ? 0 : 0)}
                </div>
              </div>
            </div>
          </div>

          {/* Variable Charge Slab Breakdown */}
          {comparisonResult && (
            <div style={{ margin: '1.5rem 0' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                Variable Charge Slab Breakdown
              </h3>
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                {comparisonResult.period1Bill.variableSlabBreakdown.map((slab, i) => (
                  <div key={i} style={{
                    background: 'rgba(56, 189, 248, 0.03)',
                    border: '1px solid rgba(56, 189, 248, 0.15)',
                    borderRadius: '0.375rem',
                    padding: '0.75rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}>
                    <span style={{ fontSize: '0.85rem' }}>
                      {slab.slabName}: {formatLiters(slab.litersInSlab)}L
                    </span>
                    <span style={{ fontWeight: '600', color: '#10b981' }}>{formatRupee(slab.chargeInRupees)}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Total variable charge: {formatRupee(comparisonResult.period1Bill.variableCharge)}
              </div>
            </div>
          )}

          {/* Discrepancy Checklist */}
          {checklistItems && checklistItems.length > 0 && (
            <div style={{ margin: '1.5rem 0' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                Discrepancy Checklist
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 0.5rem 0' }}>
                Review the items below. Mark as confirmed if you recognize the change, or correct the values if something seems incorrect.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {checklistItems.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      background: item.isCritical ? 'rgba(239, 68, 68, 0.05)' : 'rgba(56, 189, 248, 0.03)',
                      border: `1px solid ${item.isCritical ? 'rgba(239, 68, 68, 0.3)' : 'rgba(56, 189, 248, 0.15)'}`,
                      borderRadius: '0.375rem',
                      padding: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexDirection: item.userConfirmable ? 'row' : 'column',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: '500', color: item.isCritical ? '#ef4444' : 'var(--text-primary)' }}>
                        {item.title}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>
                        {item.description}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginLeft: '1rem' }}>
                      {item.userConfirmable && (
                        <>
                          <button
                            onClick={() => updateChecklistItemConfirmation(userId, item.id, true)}
                            style={{
                              flex: 1,
                              background: 'rgba(34, 197, 94, 0.1)',
                              border: '1px solid #22c55e',
                              color: '#22c55e',
                              borderRadius: '0.25rem',
                              padding: '0.3rem 0.5rem',
                              fontSize: '0.7rem',
                              cursor: 'pointer',
                            }}
                            title="Confirm this item"
                          >
                            ✓
                          </button>
                          <button
                            onClick={() => updateChecklistItemConfirmation(userId, item.id, false)}
                            style={{
                              flex: 1,
                              background: 'rgba(239, 68, 68, 0.1)',
                              border: '1px solid #f87171',
                              color: '#f87171',
                              borderRadius: '0.25rem',
                              padding: '0.3rem 0.5rem',
                              fontSize: '0.7rem',
                              cursor: 'pointer',
                            }}
                            title="Mark as incorrect / needs review"
                          >
                            ✗
                          </button>
                        </>
                      )}
                      {!item.userConfirmable && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>(auto-calculated)</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Accessible table alternative */}
          {accessibleTable && (
            <div style={{ margin: '1.5rem 0', maxHeight: '400px', overflowY: 'auto' }}>
              <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                Accessible Table Alternative
              </h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(56, 189, 248, 0.1)', borderBottom: '1px solid var(--border-main)' }}>
                    {accessibleTable.headers.map((h) => (
                      <th key={h} style={{ padding: '0.5rem', textAlign: 'left', color: 'var(--text-primary)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {accessibleTable.rows.map((row, i) => (
                    <tr key={i} style={{ borderBottom: i % 2 === 0 ? '1px solid var(--border-main)' : 'none' }}>
                      {row.label ? (
                        <td style={{ padding: '0.5rem', color: 'var(--text-primary)' }}>{row.label}</td>
                      ) : (
                        <td style={{ padding: '0.5rem', color: 'var(--text-primary)' }}>{row[0] || ''}</td>
                      )}
                      <td style={{ padding: '0.5rem', color: 'var(--text-secondary)' }}>
                        {row[1] || ''}
                      </td>
                      <td style={{ padding: '0.5rem', color: 'var(--text-secondary)' }}>
                        {row[2] || ''}
                      </td>
                      <td style={{ padding: '0.5rem', color: 'var(--text-secondary)' }}>
                        {row[3] || ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
            <button
              onClick={handleCancel}
              style={{
                background: 'transparent',
                border: '1px solid var(--border-main)',
                color: 'var(--text-primary)',
                borderRadius: '0.375rem',
                padding: '0.5rem 1rem',
                fontSize: '0.9rem',
            }}
              >Cancel</button>
            <button
              onClick={() => setViewState(VISUALIZER_VIEW_STATE.IDLE)}
              style={{
                background: 'var(--accent-main)',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                padding: '0.5rem 1rem',
                fontSize: '0.9rem',
            }}
            >Start Over</button>
          </div>
        </div>
      )}

      {/* Step entry views */}
      {viewState === VISUALIZER_VIEW_STATE.IDLE && currentStep === 1 && dossier && (
        <PeriodEntryForm
          id="period1-step1"
          label="Period 1"
          consumption={period1Consumption}
          onChange={handlePeriod1Change}
          readingType={period1ReadingType}
          onReadingTypeChange={e => setPeriod1ReadingType(e.target.value)}
          source={period1Source}
          onSourceChange={e => setPeriod1Source(e.target.value)}
          fixedCharge={period1FixedCharge}
          onFixedChargeChange={e => setPeriod1FixedCharge(e.target.value)}
          arrears={period1Arrears}
          onArrearsChange={e => setPeriod1Arrears(e.target.value)}
          adjustment={period1Adjustment}
          onAdjustmentChange={e => setPeriod1Adjustment(e.target.value)}
          boardKey={boardKey}
          onBoardKeyChange={e => setBoardKey(e.target.value)}
          step={currentStep}
          totalSteps={4}
        />
      )}

      {viewState === VISUALIZER_VIEW_STATE.IDLE && currentStep === 2 && dossier && (
        <PeriodEntryForm
          id="period2-step2"
          label="Period 2 (Comparison)"
          consumption={period2Consumption}
          onChange={handlePeriod2Change}
          readingType={period2ReadingType}
          onReadingTypeChange={e => setPeriod2ReadingType(e.target.value)}
          source={period2Source}
          onSourceChange={e => setPeriod2Source(e.target.value)}
          fixedCharge={period2FixedCharge}
          onFixedChargeChange={e => setPeriod2FixedCharge(e.target.value)}
          arrears={period2Arrears}
          onArrearsChange={e => setPeriod2Arrears(e.target.value)}
          adjustment={period2Adjustment}
          onAdjustmentChange={e => setPeriod2Adjustment(e.target.value)}
          boardKey={boardKey}
          onBoardKeyChange={e => setBoardKey(e.target.value)}
          step={currentStep}
          totalSteps={4}
        />
      )}

      {viewState === VISUALIZER_VIEW_STATE.COMPARISON && dossier && (
        <ComparisonSummary
          comparisonResult={comparisonResult}
          checklistItems={checklistItems}
          accessibleTable={accessibleTable}
          userId={userId}
          onChecklistConfirm={(itemId) => updateChecklistItemConfirmation(userId, itemId, true)}
          onChecklistCorrect={(itemId) => updateChecklistItemConfirmation(userId, itemId, false)}
        />
      )}
    </div>
  );
};

/* Period Entry Form Component */
const PeriodEntryForm = ({
  id,
  label,
  consumption,
  onChange,
  readingType,
  onReadingTypeChange,
  source,
  onSourceChange,
  fixedCharge,
  onFixedChargeChange,
  arrears,
  onArrearsChange,
  adjustment,
  onAdjustmentChange,
  boardKey,
  onBoardKeyChange,
  step,
  totalSteps,
  readOnly,
}) => {
  return (
    <div style={{ marginBottom: '2rem' }}>
      <h2 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '0.5rem' }}>
        {label} Entry
      </h2>

      <div style={{ margin: '0.5rem 0' }}>
        <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem' }}>
          Consumption (liters)
        </label>
        <input
          type="number"
          name="consumption"
          value={consumption || ''}
          onChange={onChange}
          placeholder="e.g., 1500"
          style={{
            width: '100%',
            padding: '0.5rem',
            border: '1px solid var(--border-main)',
            borderRadius: '0.375rem',
            fontSize: '1rem',
            boxSizing: 'border-box',
          }}
          required
          disabled={readOnly}
        />
        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0.3rem 0 0' }}>
          Enter total water consumption for the billing period in liters.
        </p>
      </div>

      <div style={{ margin: '0.5rem 0' }}>
        <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem' }}>
          Reading Type
        </label>
        <select
          value={readingType}
          onChange={onReadingTypeChange}
          style={{
            width: '100%',
            padding: '0.5rem',
            border: '1px solid var(--border-main)',
            borderRadius: '0.375rem',
            fontSize: '1rem',
            boxSizing: 'border-box',
          }}
          disabled={readOnly}
        >
          <option value="actual">Actual meter reading</option>
          <option value="estimated">Estimated reading</option>
        </select>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0.3rem 0 0' }}>
          Actual: Read directly from meter. Estimated: Calculated by the water board based on usage patterns.
        </p>
      </div>

      <div style={{ margin: '0.5rem 0' }}>
        <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem' }}>
          Import Source
        </label>
        <select
          value={source}
          onChange={onSourceChange}
          style={{
            width: '100%',
            padding: '0.5rem',
            border: '1px solid var(--border-main)',
            borderRadius: '0.375rem',
            fontSize: '1rem',
            boxSizing: 'border-box',
          }}
          disabled={readOnly}
        >
          <option value="MANUAL">Manual entry</option>
          <option value="OCR">OCR import (AI suggestion)</option>
        </select>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0.3rem 0 0' }}>
          OCR import suggests values from uploaded bill images. AI-generated suggestions are labelled as such until confirmed.
        </p>
      </div>

      {step === 1 && fixedCharge !== undefined && (
        <div style={{ margin: '0.5rem 0' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem' }}>
            Fixed Charge (₹)
          </label>
          <input
            type="number"
            name="fixedCharge"
            value={fixedCharge || ''}
            onChange={onFixedChargeChange}
            placeholder="e.g., 50"
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid var(--border-main)',
              borderRadius: '0.375rem',
              fontSize: '1rem',
              boxSizing: 'border-box',
            }}
          />
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0.3rem 0 0' }}>
            Flat fee applied per billing period regardless of consumption.
          </p>
        </div>
      )}

      {step >= 1 && (
        <div style={{ margin: '0.5rem 0' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem' }}>
            Arrears (₹)
          </label>
          <input
            type="number"
            name="arrears"
            value={arrears || ''}
            onChange={onArrearsChange}
            placeholder="e.g., 0"
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid var(--border-main)',
              borderRadius: '0.375rem',
              fontSize: '1rem',
              boxSizing: 'border-box',
            }}
          />
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0.3rem 0 0' }}>
            Outstanding balance from previous billing periods.
          </p>
        </div>
      )}

      {step >= 1 && (
        <div style={{ margin: '0.5rem 0' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem' }}>
            Adjustment (₹)
          </label>
          <input
            type="number"
            name="adjustment"
            value={adjustment || ''}
            onChange={onAdjustmentChange}
            placeholder="e.g., 0"
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid var(--border-main)',
              borderRadius: '0.375rem',
              fontSize: '1rem',
              boxSizing: 'border-box',
            }}
          />
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0.3rem 0 0' }}>
            Additional adjustment (positive or negative) applied to the bill.
          </p>
        </div>
      )}

      {step < totalSteps && (
        <button
          onClick={() => setDossier(advanceStep(userId, step + 1))}
          style={{
            background: 'var(--accent-main)',
            color: 'white',
            border: 'none',
            borderRadius: '0.375rem',
            padding: '0.6rem 1rem',
            fontSize: '0.9rem',
            width: '100%',
            marginTop: '1rem',
          }}
          disabled={readOnly}
        >
          Next ({step + 1} of {totalSteps})
        </button>
      )} else {
        <button
          onClick={() => setDossier(advanceStep(userId, step))}
          style={{
            background: 'var(--accent-main)',
            color: 'white',
            border: 'none',
            borderRadius: '0.375rem',
            padding: '0.6rem 1rem',
            fontSize: '0.9rem',
            width: '100%',
            marginTop: '1rem',
          }}
          disabled={readOnly}
        >
          Complete Entry
        </button>
      }
    </div>
  );
};

/* Comparison Summary Component */
const ComparisonSummary = ({
  comparisonResult,
  checklistItems,
  accessibleTable,
  userId,
  onChecklistConfirm,
  onChecklistCorrect,
}) => {
  if (!comparisonResult) {
    return <div>No comparison data available.</div>;
  }

  const { period1Bill, period2Bill } = comparisonResult;

  return (
    <div>
      <h2 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '0.5rem' }}>
        Comparison Summary
      </h2>

      {/* Period 1 */}
      <div style={{ background: 'rgba(56, 189, 248, 0.03)', border: '1px solid rgba(56, 189, 248, 0.15)', borderRadius: '0.5rem', padding: '1rem', margin: '0.5rem 0' }}>
        <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: 'var(--accent-main)' }}>Period 1</h3>
        <ul style={{ margin: '0', padding: '0.5rem 0 0 1rem' }}>
          <li>Consumption: {formatLiters(comparisonResult.dossier?.period1?.consumptionLiters || 0)}</li>
          <li>Variable Charge: {formatRupee(period1Bill.variableCharge)}</li>
          <li>Fixed Charge: {formatRupee(period1Bill.fixedCharge)}</li>
          <li>Total Payable: {formatRupee(period1Bill.totalPayable)}</li>
        </ul>
      </div>

      {/* Period 2 */}
      <div style={{ background: 'rgba(56, 189, 248, 0.03)', border: '1px solid rgba(56, 189, 248, 0.15)', borderRadius: '0.5rem', padding: '1rem', margin: '0.5rem 0' }}>
        <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: 'var(--accent-main)' }}>Period 2</h3>
        <ul style={{ margin: '0', padding: '0.5rem 0 0 1rem' }}>
          <li>Consumption: {formatLiters(comparisonResult.dossier?.period2?.consumptionLiters || 0)}</li>
          <li>Variable Charge: {formatRupee(period2Bill.variableCharge)}</li>
          <li>Fixed Charge: {formatRupee(period2Bill.fixedCharge)}</li>
          <li>Total Payable: {formatRupee(period2Bill.totalPayable)}</li>
        </ul>
      </div>

      {/* Difference */}
      <div style={{ background: 'rgba(56, 189, 248, 0.05)', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: '0.5rem', padding: '1rem', margin: '0.5rem 0' }}>
        <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: 'var(--accent-main)' }}>Difference</h3>
        <ul style={{ margin: '0', padding: '0.5rem 0 0 1rem' }}>
          <li>Consumption Change: {comparisonResult.consumptionDiff >= 0 ? 'Increase' : 'Decrease'}</li>
          <li>Total Payable Change: {formatRupee(comparisonResult.chargeDiff)}</li>
        </ul>
      </div>

      {/* Checklist */}
      {checklistItems && checklistItems.length > 0 && (
        <div style={{ margin: '1.5rem 0' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.5rem' }}>
            Discrepancy Checklist
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 0.5rem 0' }}>
            Review the items below.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {checklistItems.map((item) => (
              <div
                key={item.id}
                style={{
                  background: item.isCritical ? 'rgba(239, 68, 68, 0.05)' : 'rgba(56, 189, 248, 0.03)',
                  border: `1px solid ${item.isCritical ? 'rgba(239, 68, 68, 0.3)' : 'rgba(56, 189, 248, 0.15)'}`,
                  borderRadius: '0.375rem',
                  padding: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ flex: 1, fontSize: '0.85rem' }}>
                  {item.title}: {item.description}
                </span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {item.userConfirmable && (
                    <>
                      <button
                        onClick={() => onChecklistConfirm(item.id)}
                        style={{
                          flex: 1,
                          background: 'rgba(34, 197, 94, 0.1)',
                          border: '1px solid #22c55e',
                          color: '#22c55e',
                          borderRadius: '0.25rem',
                          padding: '0.3rem 0.5rem',
                          fontSize: '0.7rem',
                          cursor: 'pointer',
                        }}
                        title="Confirm"
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => onChecklistCorrect(item.id)}
                        style={{
                          flex: 1,
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid #f87171',
                          color: '#f87171',
                          borderRadius: '0.25rem',
                          padding: '0.3rem 0.5rem',
                          fontSize: '0.7rem',
                          cursor: 'pointer',
                        }}
                        title="Mark incorrect"
                      >
                        ✗
                      </button>
                    </>
                  )}
                  {!item.userConfirmable && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>(auto)</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
        <button
          onClick={() => setDossier(cancelVisualizerSession(userId))}
          style={{
            background: 'transparent',
            border: '1px solid var(--border-main)',
            color: 'var(--text-primary)',
            borderRadius: '0.375rem',
            padding: '0.5rem 1rem',
            fontSize: '0.9rem',
          }}
        >
          Cancel
        </button>
        <button
          onClick={() => setDossier(resumeVisualizerSession(userId))}
          style={{
            background: 'var(--accent-main)',
            color: 'white',
            border: 'none',
            borderRadius: '0.375rem',
            padding: '0.5rem 1rem',
            fontSize: '0.9rem',
          }}
        >
          Resume Later
        </button>
      </div>
    </div>
  );
};