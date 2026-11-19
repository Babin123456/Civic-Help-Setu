import React from 'react';
import { useState } from 'react';
import {
  CONSENT_STATUS,
  VISUALIZER_VIEW_STATE,
  IMPORT_SOURCE,
} from '../services/waterBillVisualizerService';

/**
 * WaterBillVisualizerPage - Page component
 *
 * Renders the Water Bill Visualizer as a full-page citizen workflow.
 * Integrates with the Civic Help Setu service catalogue, reuses established
 * authentication, privacy, and design conventions.
 *
 * Primary user flow:
 * 1. User enters bill line items manually or imports a supported bill after consent.
 * 2. User confirms meter period and units.
 * 3. App calculates a transparent breakdown.
 * 4. User compares two periods.
 * 5. A discrepancy checklist is generated from user-confirmed values.
 * 6. User can cancel, return, and resume without losing confirmed non-sensitive inputs.
 *
 * The interface distinguishes saved user progress from official government application status.
 */
const WaterBillVisualizerPage = () => {
  const [userId, setUserId] = useState('citizen_divya_demo');
  const [dossier, setDossier] = useState(null);
  const [viewState, setViewState] = useState('idle');
  const [error, setError] = useState(null);

  // Initialize dossier on mount
  useEffect(() => {
    setDossier(
      // In a real integration, userId would come from auth (e.g., Clerk)
      initializeUserVisualizerDossier(userId)
    );
    setViewState(VISUALIZER_VIEW_STATE.IDLE);
  }, [userId]);

  // Sync UI state from dossier
  useEffect(() => {
    if (!dossier) return;
    setViewState(dossier.viewState || VISUALIZER_VIEW_STATE.IDLE);
  }, [dossier]);

  // Period 1 form state
  const [p1Consumption, setP1Consumption] = useState('');
  const [p1ReadingType, setP1ReadingType] = useState('actual');
  const [p1Source, setP1Source] = useState(IMPORT_SOURCE.MANUAL);
  const [p1FixedCharge, setP1FixedCharge] = useState('');
  const [p1Arrears, setP1Arrears] = useState('');
  const [p1Adjustment, setP1Adjustment] = useState('');

  // Period 2 form state
  const [p2Consumption, setP2Consumption] = useState('');
  const [p2ReadingType, setP2ReadingType] = useState('actual');
  const [p2Source, setP2Source] = useState(IMPORT_SOURCE.MANUAL);
  const [p2FixedCharge, setP2FixedCharge] = useState('');
  const [p2Arrears, setP2Arrears] = useState('');
  const [p2Adjustment, setP2Adjustment] = useState('');

  // Consent state
  const [consentGranted, setConsentGranted] = useState(false);

  // Bill breakdown result
  const [breakdown, setBreakdown] = useState(null);
  const [checklist, setChecklist] = useState(null);
  const [accessibleTable, setAccessibleTable] = useState(null);

  // Handle period 1 changes
  const handleP1Change = (e) => {
    const { name, value } = e.target;
    setDossier(
      setPeriod1Bill(userId, {
        consumptionLiters: name === 'consumption' ? parseFloat(value) : undefined,
        readingType: name === 'readingType' ? value : p1ReadingType,
        source: name === 'source' ? value : p1Source,
        fixedCharge: name === 'fixedCharge' ? parseFloat(value) : undefined,
        arrears: name === 'arrears' ? parseFloat(value) : undefined,
        adjustment: name === 'adjustment' ? parseFloat(value) : undefined,
      })
    );
  };

  // Handle period 2 changes
  const handleP2Change = (e) => {
    const { name, value } = e.target;
    setDossier(
      setPeriod2Bill(userId, {
        consumptionLiters: name === 'consumption' ? parseFloat(value) : undefined,
        readingType: name === 'readingType' ? value : p2ReadingType,
        source: name === 'source' ? value : p2Source,
        fixedCharge: name === 'fixedCharge' ? parseFloat(value) : undefined,
        arrears: name === 'arrears' ? parseFloat(value) : undefined,
        adjustment: name === 'adjustment' ? parseFloat(value) : undefined,
      })
    );
  };

  // Handle consent grant
  const handleConsentGrant = () => {
    setDossier(grantVisualizerConsent(userId, userId));
    setConsentGranted(true);
  };

  // Handle OCR import suggestion
  const handleOcrImport = (ocrValue) => {
    setDossier(setPeriod1Bill(userId, {
      consumptionLiters: parseFloat(ocrValue) || 0,
      readingType: 'estimated',
      source: IMPORT_SOURCE.OCR,
    }));
  };

  // Handle cancel
  const handleCancel = () => {
    setDossier(cancelVisualizerSession(userId));
    setViewState(VISUALIZER_VIEW_STATE.IDLE);
    setP1Consumption('');
    setP1ReadingType('actual');
    setP1Source(IMPORT_SOURCE.MANUAL);
    setP1FixedCharge('');
    setP1Arrears('');
    setP1Adjustment('');
    setP2Consumption('');
    setP2ReadingType('actual');
    setP2Source(IMPORT_SOURCE.MANUAL);
    setP2FixedCharge('');
    setP2Arrears('');
    setP2Adjustment('');
    setBreakdown(null);
    setChecklist(null);
    setAccessibleTable(null);
  };

  // Handle resume
  const handleResume = () => {
    const resumed = resumeVisualizerSession(userId);
    setDossier(resumed);
    setViewState(resumed.viewState || VISUALIZER_VIEW_STATE.IDLE);
    // Repopulate form state from resumed dossier
    if (resumed.period1) {
      setP1Consumption(resumed.period1.consumptionLiters != null ? String(resumed.period1.consumptionLiters) : '');
      setP1ReadingType(resumed.period1.readingType || 'actual');
      setP1Source(resumed.period1.source || IMPORT_SOURCE.MANUAL);
      setP1FixedCharge(resumed.period1.fixedCharge != null ? String(resumed.period1.fixedCharge) : '');
      setP1Arrears(resumed.period1.arrears != null ? String(resumed.period1.arrears) : '');
      setP1Adjustment(resumed.period1.adjustment != null ? String(resumed.period1.adjustment) : '');
    }
    if (resumed.period2) {
      setP2Consumption(resumed.period2.consumptionLiters != null ? String(resumed.period2.consumptionLiters) : '');
      setP2ReadingType(resumed.period2.readingType || 'actual');
      setP2Source(resumed.period2.source || IMPORT_SOURCE.MANUAL);
      setP2FixedCharge(resumed.period2.fixedCharge != null ? String(resumed.period2.fixedCharge) : '');
      setP2Arrears(resumed.period2.arrears != null ? String(resumed.period2.arrears) : '');
      setP2Adjustment(resumed.period2.adjustment != null ? String(resumed.period2.adjustment) : '');
    }
  };

  // Generate breakdown when READY state is reached
  useEffect(() => {
    if (viewState === VISUALIZER_VIEW_STATE.READY && dossier) {
      // Ensure both periods have data
      if (dossier.period1.consumptionLiters !== null && dossier.period2.consumptionLiters !== null) {
        const result = generateBillBreakdown(userId);
        if (result.error) {
          setError(result.error);
        } else {
          setBreakdown(result);
          // Generate discrepancy checklist automatically
          const checklistResult = generateDiscrepancyChecklist(userId);
          if (checklistResult.checklist) {
            setChecklist(checklistResult.checklist);
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
    }
  }, [viewState, dossier, userId]);

  // Format helpers
  const formatRupee = (value) => '₹' + value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatLiters = (liters) => {
    if (liters >= 1000000) return (liters / 1000000).toFixed(2) + ' ML';
    if (liters >= 1000) return (liters / 1000).toFixed(2) + ' KL';
    return liters + ' L';
  };

  // Render states
  const renderState = () => {
    // IDLE with no dossier
    if (!dossier && viewState === VISUALIZER_VIEW_STATE.IDLE) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center', minHeight: '400px' }}>
          <h1 style={{ fontSize: '1.8rem', fontWeight: '700', margin: '0 0 1rem 0' }}>
            Water Bill Consumption & Charge Visualizer
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', margin: '0 0 1.5rem 0' }}>
            Enter your water bill consumption data to see a transparent breakdown of charges.
          </p>
          <p style={{ color: 'var(--text-secondary)', margin: '0 0 2rem 0' }}>
            • Supports PMC_PUNE, DJB_DELHI, BWSSB_BENGALURU, and GENERIC_ULB tariff configurations
            • Deterministic calculations using published tariff rules
            • Compare two billing periods to identify discrepancies
            • Accessible table alternatives for all charts and graphs
          </p>
          <div style={{ background: 'rgba(56, 189, 248, 0.05)', border: '1px dashed var(--border-main)', borderRadius: '0.5rem', padding: '1.5rem', maxWidth: '600px', margin: '0 auto' }}>
            <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-secondary)' }}>Getting Started</h3>
            <ol style={{ margin: '0 0 1rem 1.5rem', color: 'var(--text-secondary)', lineHeight: '1.8' }}>
              <li>Select your water board/jurisdiction</li>
              <li>Enter consumption for Period 1 (current or previous bill)</li>
              <li>Enter consumption for Period 2 (compare with previous period)</li>
              <li>Grant consent to calculate charges using published tariff rules</li>
              <li>Review the discrepancy checklist for any billing differences</li>
            </ol>
            <p style={{ margin: '0.5rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              <strong>Note:</strong> OCR-imported values are AI-generated suggestions labelled as such until confirmed. Charge calculations use deterministic published tariff rules.
            </p>
          </div>
        </div>
      );
    }

    // IDLE with dossier but no data entered yet
    if (dossier && viewState === VISUALIZER_VIEW_STATE.IDLE && dossier.step === 1 && dossier.period1.consumptionLiters === null) {
      return (
        <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: '600', marginBottom: '0.5rem' }}>
            Period 1 Entry
          </h2>
          <p style={{ color: 'var(--text-secondary)', margin: '0 0 1rem 0' }}>
            Enter consumption for the first billing period.
          </p>
          <div style={{
            background: 'var(--bg-card, #131b2e)',
            border: '1px solid var(--border-main)',
            borderRadius: '1rem',
            padding: '2rem',
            maxWidth: '600px',
            margin: '0 auto',
          }}>
            <PeriodEntryForm
              onConsumptionChange={setP1Consumption}
              onReadingTypeChange={setP1ReadingType}
              onSourceChange={setP1Source}
              onFixedChargeChange={setP1FixedCharge}
              onArrearsChange={setP1Arrears}
              onAdjustmentChange={setP1Adjustment}
              initialConsumption={p1Consumption || ''}
              initialReadingType={p1ReadingType}
              initialSource={p1Source}
              initialFixedCharge={p1FixedCharge || ''}
              initialArrears={p1Arrears || ''}
              initialAdjustment={p1Adjustment || ''}
            />
          </div>
        </div>
      );
    }

    // Loading state
    if (viewState === VISUALIZER_VIEW_STATE.LOADING) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <svg
            width="40"
            height="40"
            style={{ animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }}
            viewBox="0 0 50 50"
          >
            <circle
              cx="25"
              cy="25"
              r="18"
              stroke="var(--accent-main)"
              strokeWidth="5"
              fill="none"
            />
            <path
              d="M35 25a10 10 0 0 1-10 10H15L12 30l3-7h6v-4H15L8 30l3-7h6v-2a10 10 0 0 1 20 0v2z"
              stroke="var(--accent-main)"
              strokeWidth="5"
              fill="none"
            />
          </svg>
          <p style={{ margin: '1rem 0 0', color: 'var(--text-secondary)' }}>Loading visualizer data…</p>
        </div>
      );
    }

    // Permission denied state
    if (viewState === VISUALIZER_VIEW_STATE.PERMISSION_DENIED) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#d97706' }}>
          <h2 style={{ margin: '0 0 1rem 0' }}>Permission Required</h2>
          <p>
            Consent is required to process your bill data and calculate charges. Please
            grant consent to continue.
          </p>
          <button
            onClick={handleConsentGrant}
            style={{
              background: 'var(--accent-main)',
              color: 'white',
              border: 'none',
              borderRadius: '0.375rem',
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              margin: '0.5rem 0 0',
            }}
          >
            Grant Consent
          </button>
          <p style={{ margin: '0.5rem 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Your data is processed locally in your browser. No uploaded document contents are stored or sent to any server.
          </p>
        </div>
      );
    }

    // Error state
    if (viewState === VISUALIZER_VIEW_STATE.ERROR) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#ef4444' }}>
          <h2 style={{ margin: '0 0 1rem 0' }}>Error</h2>
          <p>{error || 'An unknown error occurred.'}</p>
          <button
            onClick={() => setViewState(VISUALIZER_VIEW_STATE.IDLE)}
            style={{
              background: 'var(--accent-main)',
              color: 'white',
              border: 'none',
              borderRadius: '0.375rem',
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
            }}
          >
            Try Again
          </button>
        </div>
      );
    }

    // Empty state (dossier exists but no consumption data)
    if (dossier && viewState === VISUALIZER_VIEW_STATE.EMPTY) {
      return (
        <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: '600', marginBottom: '0.5rem' }}>
            No Bill Data Entered
          </h2>
          <p style={{ color: 'var(--text-secondary)', margin: '0 0 1rem 0' }}>
            Start by entering consumption for Period 1 using the form below.
          </p>
          <PeriodEntryForm
            onConsumptionChange={setP1Consumption}
            onReadingTypeChange={setP1ReadingType}
            onSourceChange={setP1Source}
            onFixedChargeChange={setP1FixedCharge}
            onArrearsChange={setP1Arrears}
            onAdjustmentChange={setP1Adjustment}
            initialConsumption={p1Consumption || ''}
            initialReadingType={p1ReadingType}
            initialSource={p1Source}
            initialFixedCharge={p1FixedCharge || ''}
            initialArrears={p1Arrears || ''}
            initialAdjustment={p1Adjustment || ''}
            step={1}
            totalSteps={4}
          />
        </div>
      );
    }

    // Ready state with breakdown and comparison
    if (viewState === VISUALIZER_VIEW_STATE.READY && dossier && breakdown) {
      return (
        <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
          <header style={{
            borderBottom: '1px solid var(--border-main)',
            padding: '1rem 0',
            margin: '1rem 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0 }}>
              Water Bill Comparison & Breakdown
            </h1>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Tariff v{breakdown.tariffVersion} {breakdown.boardKey}
              </span>
              <button
                onClick={handleCancel}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border-main)',
                  color: 'var(--text-primary)',
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

          {/* Tariff info */}
          <div style={{
            background: 'rgba(56, 189, 248, 0.05)',
            border: '1px solid rgba(56, 189, 248, 0.2)',
            borderRadius: '0.5rem',
            padding: '0.75rem',
            margin: '0.5rem 0',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <svg width="14" height="14" style={{ color: '#10b981' }} viewBox="0 0 24 24">
                <path d="M12 2c1.1 0 2 .9 2 2v18c0 1.1-.9 2-2 2s-2-.9-2-2V2c0-1.1.9-2 2-2zM2 4h4v5H2V4zm3 6h2v3H5V10zm3 0h2v3h-2V10zm3 0h2v3h-2V10z" />
              </svg>
              <span style={{ fontWeight: '600' }}>Tariff version: {breakdown.tariffVersion} (board: {breakdown.boardKey})</span>
            </div>
          </div>

          {/* Period 1 Summary */}
          <div style={{
            background: 'rgba(56, 189, 248, 0.03)',
            border: '1px solid rgba(56, 189, 248, 0.15)',
            borderRadius: '0.5rem',
            padding: '1rem',
            margin: '0.5rem 0',
          }}>
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: 'var(--accent-main)' }}>Period 1</h3>
            <ul style={{ margin: '0', padding: '0.5rem 0 0 1rem' }}>
              <li>Consumption: {formatLiters(dossier.period1.consumptionLiters)}</li>
              <li>Reading Type: {dossier.period1.readingType}</li>
              <li>Source: {dossier.period1.source === 'MANUAL' ? 'Manual entry' : 'OCR import'}</li>
              <li>Variable Charge: {formatRupee(breakdown.period1Bill.variableCharge)}</li>
              <li>Fixed Charge: {formatRupee(breakdown.period1Bill.fixedCharge)}</li>
              <li>Total Payable: {formatRupee(breakdown.period1Bill.totalPayable)}</li>
            </ul>
            {dossier.period1.readingType === 'estimated' && (
              <p style={{ margin: '0.3rem 0 0', fontSize: '0.75rem', color: '#f59e0b' }}>
                ⚠ This is an estimated reading. AI-generated suggestion until confirmed.
              </p>
            )}
          </div>

          {/* Period 2 Summary */}
          <div style={{
            background: 'rgba(56, 189, 248, 0.03)',
            border: '1px solid rgba(56, 189, 248, 0.15)',
            borderRadius: '0.5rem',
            padding: '1rem',
            margin: '0.5rem 0',
          }}>
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: 'var(--accent-main)' }}>Period 2</h3>
            <ul style={{ margin: '0', padding: '0.5rem 0 0 1rem' }}>
              <li>Consumption: {formatLiters(dossier.period2.consumptionLiters)}</li>
              <li>Reading Type: {dossier.period2.readingType}</li>
              <li>Source: {dossier.period2.source === 'MANUAL' ? 'Manual entry' : 'OCR import'}</li>
              <li>Variable Charge: {formatRupee(breakdown.period2Bill.variableCharge)}</li>
              <li>Fixed Charge: {formatRupee(breakdown.period2Bill.fixedCharge)}</li>
              <li>Total Payable: {formatRupee(breakdown.period2Bill.totalPayable)}</li>
            </ul>
            {dossier.period2.readingType === 'estimated' && (
              <p style={{ margin: '0.3rem 0 0', fontSize: '0.75rem', color: '#f59e0b' }}>
                ⚠ This is an estimated reading. AI-generated suggestion until confirmed.
              </p>
            )}
          </div>

          {/* Comparison Summary */}
          <div style={{
            background: 'rgba(56, 189, 248, 0.05)',
            border: '1px solid rgba(56, 189, 248, 0.2)',
            borderRadius: '0.5rem',
            padding: '1rem',
            margin: '0.5rem 0',
          }}>
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: 'var(--accent-main)' }}>Comparison</h3>
            <ul style={{ margin: '0', padding: '0.5rem 0 0 1rem' }}>
              <li>
                Consumption Change: {dossier.period2.consumptionLiters >= dossier.period1.consumptionLiters ? 'Increase' : 'Decrease'}
              </li>
              <li>
                Total Payable Change: {formatRupee(breakdown.period2Bill.totalPayable - breakdown.period1Bill.totalPayable)}
              </li>
            </ul>
          </div>

          {/* Variable Charge Slab Breakdown */}
          {breakdown.period1Bill.variableSlabBreakdown && (
            <div style={{
              margin: '1rem 0',
              background: 'rgba(56, 189, 248, 0.03)',
              border: '1px solid rgba(56, 189, 248, 0.15)',
              borderRadius: '0.5rem',
              padding: '1rem',
            }}>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: 'var(--accent-main)' }}>
                Variable Charge Slab Breakdown
              </h3>
              <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Consumption charged at different slab rates based on published tariff rules.
              </p>
              <div style={{ display: 'grid', gap: '0.3rem' }}>
                {breakdown.period1Bill.variableSlabBreakdown.map((slab, i) => (
                  <div
                    key={i}
                    style={{
                      background: 'rgba(56, 189, 248, 0.02)',
                      border: '1px solid rgba(56, 189, 248, 0.1)',
                      borderRadius: '0.375rem',
                      padding: '0.5rem',
                      fontSize: '0.85rem',
                    }}
                  >
                    <span style={{ width: '60', display: 'inline-block' }}>
                      Slab {i + 1}: {formatLiters(slab.litersInSlab)}L
                    </span>
                    <span style={{ color: '#10b981', fontWeight: '600' }}>{formatRupee(slab.chargeInRupees)}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Total variable charge: {formatRupee(breakdown.period1Bill.variableCharge)}
              </div>
            </div>
          )}

          {/* Discrepancy Checklist */}
          {checklist && checklist.length > 0 && (
            <div style={{
              margin: '1rem 0',
              background: 'rgba(56, 189, 248, 0.03)',
              border: '1px solid rgba(56, 189, 248, 0.15)',
              borderRadius: '0.5rem',
              padding: '1rem',
            }}>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: 'var(--accent-main)' }}>
                Discrepancy Checklist
              </h3>
              <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Review the items below. Mark as confirmed if you recognize the change, or correct the values if something seems incorrect.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {checklist.map((item) => (
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
                            onClick={() => {
                              // Update confirmation status
                              setDossier(updateChecklistItemConfirmation(userId, item.id, true));
                            }}
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
                            onClick={() => {
                              // Mark as incorrect
                              setDossier(updateChecklistItemConfirmation(userId, item.id, false));
                            }}
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
                            title="Mark as incorrect"
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
            <div style={{ margin: '1rem 0', maxHeight: '400px', overflowY: 'auto' }}>
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
          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
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
            >
              Cancel
            </button>
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
            >
              Start Over
            </button>
          </div>
        </div>
      );
    }

    // Comparison summary only state
    if (viewState === VISUALIZER_VIEW_STATE.COMPARISON && dossier) {
      return (
        <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: '600', marginBottom: '0.5rem' }}>
            Comparison Summary
          </h2>

          {dossier.period1.consumptionLiters !== null && dossier.period2.consumptionLiters !== null && breakdown && (
            <div style={{
              background: 'rgba(56, 189, 248, 0.03)',
              border: '1px solid rgba(56, 189, 248, 0.15)',
              borderRadius: '0.5rem',
              padding: '1rem',
              margin: '0.5rem 0',
            }}>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: 'var(--accent-main)' }}>Period 1</h3>
              <ul style={{ margin: '0', padding: '0.5rem 0 0 1rem' }}>
                <li>Consumption: {formatLiters(dossier.period1.consumptionLiters)}</li>
                <li>Total Payable: {formatRupee(breakdown.period1Bill.totalPayable)}</li>
              </ul>
            </div>
          )}

          {dossier.period2.consumptionLiters !== null && breakdown && (
            <div style={{
              background: 'rgba(56, 189, 248, 0.03)',
              border: '1px solid rgba(56, 189, 248, 0.15)',
              borderRadius: '0.5rem',
              padding: '1rem',
              margin: '0.5rem 0',
            }}>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: 'var(--accent-main)' }}>Period 2</h3>
              <ul style={{ margin: '0', padding: '0.5rem 0 0 1rem' }}>
                <li>Consumption: {formatLiters(dossier.period2.consumptionLiters)}</li>
                <li>Total Payable: {formatRupee(breakdown.period2Bill.totalPayable)}</li>
              </ul>
            </div>
          )}

          {breakdown && (
            <div style={{
              background: 'rgba(56, 189, 248, 0.05)',
              border: '1px solid rgba(56, 189, 248, 0.2)',
              borderRadius: '0.5rem',
              padding: '1rem',
              margin: '0.5rem 0',
            }}>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: 'var(--accent-main)' }}>Difference</h3>
              <ul style={{ margin: '0', padding: '0.5rem 0 0 1rem' }}>
                <li>
                  Consumption Change: {dossier.period2.consumptionLiters >= dossier.period1.consumptionLiters ? 'Increase' : 'Decrease'}
                </li>
                <li>
                  Total Payable Change: {formatRupee(breakdown.period2Bill.totalPayable - breakdown.period1Bill.totalPayable)}
                </li>
              </ul>
            </div>
          )}

          {checklist && checklist.length > 0 && (
            <div style={{ margin: '1rem 0' }}>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: 'var(--accent-main)' }}>
                Discrepancy Checklist
              </h3>
              <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Review the items below.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {checklist.map((item) => (
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
                            onClick={() => {
                              setDossier(updateChecklistItemConfirmation(userId, item.id, true));
                            }}
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
                            onClick={() => {
                              setDossier(updateChecklistItemConfirmation(userId, item.id, false));
                            }}
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
                            title="Mark as incorrect"
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

          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
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
            >
              Cancel
            </button>
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
            >
              Start Over
            </button>
          </div>
        </div>
      );
    }

    // Default fallback
    return null;
  };

  return (
    <div>
      {renderState()}
    </div>
  );
};

export default WaterBillVisualizerPage;

/* Keyframes for spin animation (added inline) */
const style = document.createElement('style');
style.innerHTML = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);

/* Period Entry Form Component */
const PeriodEntryForm = ({
  id,
  onConsumptionChange,
  onReadingTypeChange,
  onSourceChange,
  onFixedChargeChange,
  onArrearsChange,
  onAdjustmentChange,
  initialConsumption,
  initialReadingType,
  initialSource,
  initialFixedCharge,
  initialArrears,
  initialAdjustment,
  step,
  totalSteps,
}) => {
  return (
    <div style={{ marginBottom: '2rem' }}>
      <h2 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '0.5rem' }}>
        Period Entry
      </h2>

      <div style={{ margin: '0.5rem 0' }}>
        <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem' }}>
          Consumption (liters)
        </label>
        <input
          type="number"
          value={initialConsumption || ''}
          onChange={(e) => onConsumptionChange(e.target.value)}
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
          value={initialReadingType}
          onChange={(e) => onReadingTypeChange(e.target.value)}
          style={{
            width: '100%',
            padding: '0.5rem',
            border: '1px solid var(--border-main)',
            borderRadius: '0.375rem',
            fontSize: '1rem',
            boxSizing: 'border-box',
          }}
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
          value={initialSource}
          onChange={(e) => onSourceChange(e.target.value)}
          style={{
            width: '100%',
            padding: '0.5rem',
            border: '1px solid var(--border-main)',
            borderRadius: '0.375rem',
            fontSize: '1rem',
            boxSizing: 'border-box',
          }}
        >
          <option value="MANUAL">Manual entry</option>
          <option value="OCR">OCR import (AI suggestion)</option>
        </select>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0.3rem 0 0' }}>
          OCR import suggests values from uploaded bill images. AI-generated suggestions are labelled as such until confirmed.
        </p>
      </div>

      {step === 1 && (
        <div style={{ margin: '0.5rem 0' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem' }}>
            Fixed Charge (₹)
          </label>
          <input
            type="number"
            value={initialFixedCharge || ''}
            onChange={(e) => onFixedChargeChange(e.target.value)}
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
            value={initialArrears || ''}
            onChange={(e) => onArrearsChange(e.target.value)}
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
            value={initialAdjustment || ''}
            onChange={(e) => onAdjustmentChange(e.target.value)}
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
        >
          Complete Entry
        </button>
      }
    </div>
  );
};