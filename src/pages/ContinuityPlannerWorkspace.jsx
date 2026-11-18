import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  ShieldAlert,
  Layers,
  Activity,
  FileCheck,
  Sparkles,
  History,
  Printer,
  Plus,
  AlertTriangle,
  RefreshCw,
  WifiOff,
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { useNetwork } from '../context/NetworkContext';

import {
  listContinuityPlans,
  saveContinuityPlan,
  transitionPlanState,
  listDependencies,
  saveDependency,
  deleteDependency,
  listScenarios,
  saveScenario,
  listExerciseRuns,
  createExerciseRun,
  recordInjectDecision,
  transitionExerciseState,
  listActionItems,
  saveActionItem,
  transitionActionItemState,
  getPlanRecommendations,
  recordRecommendationDecision,
  PLAN_STATES,
  EXERCISE_STATES,
} from '../services/continuityPlannerService';

import {
  calculateRecoverySequence,
  detectDependencyCycles,
} from '../services/dependencyGraphEngine';

import { queryContinuityAuditLogs } from '../services/continuityAuditService';

import { DependencyMatrixTable } from '../components/continuity/DependencyMatrixTable';
import { TabletopExerciseConductor } from '../components/continuity/TabletopExerciseConductor';
import { PrintableContinuityRunbook } from '../components/continuity/PrintableContinuityRunbook';
import { RecommendationCard } from '../components/continuity/RecommendationCard';
import { ActionItemsTracker } from '../components/continuity/ActionItemsTracker';
import { ContinuityPlanModal } from '../components/continuity/ContinuityPlanModal';
import { DependencyModal } from '../components/continuity/DependencyModal';
import { IncidentScenarioModal } from '../components/continuity/IncidentScenarioModal';

export default function ContinuityPlannerWorkspace() {
  const { user } = useAuth();
  const { isOnline } = useNetwork();

  const isAdmin = user?.role === 'admin';
  const isOperator = user?.role === 'operator' || isAdmin;

  // Active Workspace Tab
  const [activeTab, setActiveTab] = useState('plans'); // 'plans' | 'dependencies' | 'drills' | 'aar' | 'recommendations' | 'audit'
  const [viewMode, setViewMode] = useState('workspace'); // 'workspace' | 'print'

  // Data collections state initialized synchronously for SSR / initial render
  const [plans, setPlans] = useState(() => {
    try {
      return listContinuityPlans();
    } catch {
      return [];
    }
  });

  const { id: routePlanId } = useParams() || {};

  const [selectedPlanId, setSelectedPlanId] = useState(() => {
    if (routePlanId && plans.some((p) => p.id === routePlanId)) {
      return routePlanId;
    }
    const active = plans.find((p) => p.status === PLAN_STATES.ACTIVE) || plans[0];
    return active?.id || null;
  });

  const [dependencies, setDependencies] = useState(() => {
    try {
      return listDependencies(selectedPlanId);
    } catch {
      return [];
    }
  });

  const [scenarios, setScenarios] = useState(() => {
    try {
      return listScenarios();
    } catch {
      return [];
    }
  });

  const [exerciseRuns, setExerciseRuns] = useState(() => {
    try {
      return listExerciseRuns({ planId: selectedPlanId });
    } catch {
      return [];
    }
  });

  const [selectedRunId, setSelectedRunId] = useState(() => {
    return exerciseRuns[0]?.id || null;
  });

  const [actionItems, setActionItems] = useState(() => {
    try {
      return listActionItems();
    } catch {
      return [];
    }
  });

  const [recommendations, setRecommendations] = useState(() => {
    try {
      return selectedPlanId ? getPlanRecommendations(selectedPlanId) : [];
    } catch {
      return [];
    }
  });

  const [auditLogs, setAuditLogs] = useState(() => {
    try {
      return queryContinuityAuditLogs({ limit: 40 });
    } catch {
      return [];
    }
  });

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [errorState, setErrorState] = useState(null);

  // Modals state
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showDepModal, setShowDepModal] = useState(false);
  const [showScenarioModal, setShowScenarioModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);

  // Load all records from storage
  const loadData = () => {
    setIsLoading(true);
    setErrorState(null);
    try {
      const allPlans = listContinuityPlans();
      setPlans(allPlans);

      const activePlan = allPlans.find((p) => p.status === PLAN_STATES.ACTIVE) || allPlans[0];
      const planId = selectedPlanId || activePlan?.id || null;
      setSelectedPlanId(planId);

      const allDeps = listDependencies(planId);
      setDependencies(allDeps);

      const allScenarios = listScenarios();
      setScenarios(allScenarios);

      const allExercises = listExerciseRuns({ planId });
      setExerciseRuns(allExercises);
      if (!selectedRunId && allExercises.length > 0) {
        setSelectedRunId(allExercises[0].id);
      }

      const allActions = listActionItems();
      setActionItems(allActions);

      if (planId) {
        const recs = getPlanRecommendations(planId);
        setRecommendations(recs);
      }

      const logs = queryContinuityAuditLogs({ limit: 40 });
      setAuditLogs(logs);
    } catch (err) {
      setErrorState(err.message || 'Failed to load continuity planning data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectPlan = (planId) => {
    setSelectedPlanId(planId);
    try {
      setDependencies(listDependencies(planId));
      setExerciseRuns(listExerciseRuns({ planId }));
      setRecommendations(planId ? getPlanRecommendations(planId) : []);
    } catch (err) {
      setErrorState(err.message || 'Failed to switch continuity plan');
    }
  };

  const currentPlan = useMemo(() => {
    return plans.find((p) => p.id === selectedPlanId) || plans[0] || null;
  }, [plans, selectedPlanId]);

  const currentExercise = useMemo(() => {
    return exerciseRuns.find((r) => r.id === selectedRunId) || exerciseRuns[0] || null;
  }, [exerciseRuns, selectedRunId]);

  const currentScenario = useMemo(() => {
    if (!currentExercise) return scenarios[0] || null;
    return scenarios.find((s) => s.id === currentExercise.scenarioId) || scenarios[0] || null;
  }, [scenarios, currentExercise]);

  const servicesList = useMemo(() => {
    return dependencies.map((d) => ({
      id: d.serviceId,
      name: d.serviceName,
      criticality: d.criticality,
      estimatedRestorationHours: d.estimatedRestorationHours,
    }));
  }, [dependencies]);

  const recoverySequence = useMemo(() => {
    return calculateRecoverySequence(servicesList, dependencies);
  }, [servicesList, dependencies]);

  const cycleStatus = useMemo(() => {
    return detectDependencyCycles(servicesList, dependencies);
  }, [servicesList, dependencies]);

  // Handlers for Plan CRUD & State
  const handleSavePlan = (planData) => {
    try {
      saveContinuityPlan(planData);
      setEditingPlan(null);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleTransitionPlan = (planId, nextState) => {
    try {
      transitionPlanState(planId, nextState, {
        reason: `Status transitioned to ${nextState} from dashboard`,
      });
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  // Handlers for Dependencies
  const handleSaveDependency = (depData) => {
    try {
      saveDependency(depData);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteDependency = (depId) => {
    if (!window.confirm('Are you sure you want to remove this service dependency mapping?')) return;
    try {
      deleteDependency(depId);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSaveScenario = (scenarioData) => {
    try {
      saveScenario(scenarioData);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  // Handlers for Tabletop Drills
  const handleStartNewDrill = (scenarioId) => {
    if (!currentPlan) return;
    try {
      const newRun = createExerciseRun({
        title: `Drill - ${scenarios.find((s) => s.id === scenarioId)?.title || 'Exercise'}`,
        planId: currentPlan.id,
        scenarioId,
        targetRTOHours: currentPlan.recoveryObjectives?.rtoHours || 4,
      });
      setSelectedRunId(newRun.id);
      setActiveTab('drills');
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleRecordInjectDecision = (runId, decisionData) => {
    try {
      recordInjectDecision(runId, decisionData);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleTransitionExercise = (runId, nextState, options = {}) => {
    try {
      transitionExerciseState(runId, nextState, options);
      if (nextState === EXERCISE_STATES.CLOSED && Array.isArray(options.afterActionSummary?.recommendations)) {
        options.afterActionSummary.recommendations.forEach((recText) => {
          if (recText && recText.trim().length >= 3) {
            saveActionItem({
              exerciseRunId: runId,
              title: recText.trim(),
              ownerDepartment: 'Emergency Operations & Response',
              priority: 'HIGH',
              status: 'OPEN',
            });
          }
        });
      }
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  // Handlers for Action Items
  const handleTransitionActionItem = (itemId, nextState, options = {}) => {
    try {
      transitionActionItemState(itemId, nextState, options);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  // Handlers for Explainable Recommendations
  const handleRecommendationDecision = (recId, decision, options = {}) => {
    try {
      recordRecommendationDecision(recId, decision, options);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  // RENDER PRINTABLE RUNBOOK VIEW
  if (viewMode === 'print') {
    return (
      <PrintableContinuityRunbook
        plan={currentPlan}
        dependencies={dependencies}
        onBack={() => setViewMode('workspace')}
      />
    );
  }

  return (
    <div className="section" style={{ padding: '1.5rem 1rem' }}>
      <div className="container" style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* OFFLINE RESILIENCE BANNER */}
        {!isOnline && (
          <div
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '0.5rem',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '1rem',
              fontSize: '0.85rem',
              fontWeight: '600',
            }}
          >
            <WifiOff size={16} aria-hidden="true" />
            <span>
              Offline Operating Mode Active. Continuity runbooks and tabletop exercise decision logs remain fully operable and persisted locally.
            </span>
          </div>
        )}

        {/* WORKSPACE HEADER */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem',
            marginBottom: '1.5rem',
            borderBottom: '1px solid var(--border-main)',
            paddingBottom: '1.25rem',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <ShieldAlert size={24} style={{ color: 'var(--accent-main)' }} aria-hidden="true" />
              <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: '900', color: 'var(--text-primary)' }}>
                Civic Incident Drill & Continuity Planner
              </h1>
            </div>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Prepare municipal departments for service disruptions, cyber outages, and extreme weather emergencies.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            {/* PLAN SELECTION DROPDOWN */}
            {plans.length > 0 && (
              <select
                aria-label="Select active continuity plan"
                value={selectedPlanId || ''}
                onChange={(e) => handleSelectPlan(e.target.value)}
                style={{
                  padding: '0.45rem 0.85rem',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--border-main)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  fontWeight: '600',
                }}
              >
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} ({p.status})
                  </option>
                ))}
              </select>
            )}

            {/* PRINT RUNBOOK BUTTON */}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setViewMode('print')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
              title="Printable Offline Continuity Runbook"
            >
              <Printer size={15} aria-hidden="true" />
              <span>Offline Runbook</span>
            </button>

            {/* CREATE PLAN (Admin/Operator) */}
            {isAdmin && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setEditingPlan(null);
                  setShowPlanModal(true);
                }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
              >
                <Plus size={15} aria-hidden="true" />
                <span>New Continuity Plan</span>
              </button>
            )}
          </div>
        </div>

        {/* WORKSPACE NAVIGATION TABS */}
        <div
          role="tablist"
          aria-label="Continuity planner sections"
          style={{
            display: 'flex',
            gap: '0.5rem',
            overflowX: 'auto',
            marginBottom: '1.25rem',
            borderBottom: '1px solid var(--border-light)',
            paddingBottom: '0.5rem',
          }}
        >
          {[
            { id: 'plans', label: 'Continuity Plans & BIA', icon: Layers },
            { id: 'dependencies', label: 'Dependency Graph & SPOFs', icon: Activity },
            { id: 'drills', label: 'Tabletop Drills', icon: ShieldAlert },
            { id: 'aar', label: 'AAR & Action Items', icon: FileCheck },
            { id: 'recommendations', label: `Recommendations (${recommendations.length})`, icon: Sparkles },
            { id: 'audit', label: 'Audit & Compliance', icon: History },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '0.55rem 0.95rem',
                  borderRadius: '0.5rem',
                  border: 'none',
                  background: isActive ? 'var(--accent-main)' : 'transparent',
                  color: isActive ? '#ffffff' : 'var(--text-secondary)',
                  fontWeight: isActive ? '700' : '600',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'background 0.15s ease',
                }}
              >
                <Icon size={16} aria-hidden="true" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* LOADING SKELETON */}
        {isLoading && (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.75rem' }} />
            <p>Loading continuity specifications and dependency maps...</p>
          </div>
        )}

        {/* ERROR STATE */}
        {errorState && (
          <div
            style={{
              padding: '1.5rem',
              borderRadius: '0.5rem',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#ef4444',
              marginBottom: '1rem',
            }}
          >
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem', fontWeight: '800' }}>Continuity Planner Error</h3>
            <p style={{ margin: '0 0 0.85rem', fontSize: '0.85rem' }}>{errorState}</p>
            <button type="button" className="btn btn-secondary" onClick={loadData}>
              Retry Operation
            </button>
          </div>
        )}

        {/* TAB 1: CONTINUITY PLANS & BIA */}
        {!isLoading && activeTab === 'plans' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {plans.map((plan) => {
              const isSelected = plan.id === selectedPlanId;
              return (
                <div
                  key={plan.id}
                  style={{
                    padding: '1.25rem',
                    borderRadius: '0.65rem',
                    background: 'var(--bg-card)',
                    border: `1px solid ${isSelected ? 'var(--accent-main)' : 'var(--border-main)'}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <span
                          style={{
                            padding: '0.15rem 0.55rem',
                            borderRadius: '99px',
                            fontSize: '0.75rem',
                            fontWeight: '700',
                            background: plan.status === PLAN_STATES.ACTIVE ? 'rgba(16, 185, 129, 0.15)' : 'var(--glass-bg)',
                            color: plan.status === PLAN_STATES.ACTIVE ? '#10b981' : 'var(--text-secondary)',
                            border: '1px solid var(--border-light)',
                          }}
                        >
                          {plan.status}
                        </span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>v{plan.version}</span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>• {plan.jurisdictionId}</span>
                      </div>
                      <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.2rem', color: 'var(--text-primary)', fontWeight: '800' }}>
                        {plan.title}
                      </h2>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        Department: <strong>{plan.department}</strong> | Created by {plan.createdBy}
                      </p>
                    </div>

                    {/* STATUS TRANSITION BUTTONS */}
                    {isAdmin && (
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        {plan.status === PLAN_STATES.DRAFT && (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => handleTransitionPlan(plan.id, PLAN_STATES.IN_REVIEW)}
                            style={{ fontSize: '0.78rem', padding: '0.35rem 0.65rem' }}
                          >
                            Submit for Review
                          </button>
                        )}
                        {plan.status === PLAN_STATES.IN_REVIEW && (
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() => handleTransitionPlan(plan.id, PLAN_STATES.APPROVED)}
                            style={{ fontSize: '0.78rem', padding: '0.35rem 0.65rem' }}
                          >
                            Approve Plan
                          </button>
                        )}
                        {plan.status === PLAN_STATES.APPROVED && (
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() => handleTransitionPlan(plan.id, PLAN_STATES.ACTIVE)}
                            style={{ fontSize: '0.78rem', padding: '0.35rem 0.65rem' }}
                          >
                            Activate Plan
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* RECOVERY OBJECTIVES TILES */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: '0.75rem',
                      padding: '0.75rem',
                      borderRadius: '0.5rem',
                      background: 'var(--glass-bg)',
                    }}
                  >
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', display: 'block' }}>Target RTO (Disruption Tolerance)</span>
                      <strong style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                        {plan.recoveryObjectives?.rtoHours || 4} Hours
                      </strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', display: 'block' }}>Target RPO (Max Data Gap)</span>
                      <strong style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                        {plan.recoveryObjectives?.rpoHours || 1} Hours
                      </strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', display: 'block' }}>Alternate Failover Facility</span>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {plan.recoveryObjectives?.alternateFacilities?.[0] || 'Designated Ward Bhavan'}
                      </span>
                    </div>
                  </div>

                  {/* EMERGENCY CALL TREE */}
                  <div>
                    <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.88rem', fontWeight: '700' }}>
                      Emergency Escalation Call Tree ({plan.contactTree?.length || 0} Officers)
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.5rem' }}>
                      {(plan.contactTree || []).map((c, i) => (
                        <div
                          key={i}
                          style={{
                            padding: '0.6rem',
                            borderRadius: '0.4rem',
                            border: '1px solid var(--border-light)',
                            background: 'var(--bg-main)',
                            fontSize: '0.82rem',
                          }}
                        >
                          <div style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{c.role}</div>
                          <div style={{ color: 'var(--text-secondary)' }}>{c.officerName}</div>
                          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.2rem', color: 'var(--text-tertiary)' }}>
                            <span>📞 {c.phone}</span>
                            <span>✉️ {c.email}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 2: SERVICE DEPENDENCIES & SPOFs */}
        {!isLoading && activeTab === 'dependencies' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* CIRCULAR DEPENDENCY ALERT */}
            {cycleStatus.hasCycle && (
              <div
                style={{
                  padding: '1rem',
                  borderRadius: '0.5rem',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid #ef4444',
                  color: '#ef4444',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '800', fontSize: '0.95rem' }}>
                  <AlertTriangle size={18} aria-hidden="true" />
                  <span>Circular Dependency Detected in Municipal Service Architecture!</span>
                </div>
                <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem' }}>
                  Path: <strong>{cycleStatus.cycleDescription}</strong>. Circular links cause mutual deadlock during outages and prevent sequential service recovery.
                </p>
              </div>
            )}

            {/* TOPOLOGICAL RECOVERY ORDER SEQUENCE */}
            <div
              style={{
                padding: '1rem',
                borderRadius: '0.5rem',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-main)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '800' }}>
                  Topological Service Recovery Sequence (Phased Restoration)
                </h3>
                {isAdmin && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowDepModal(true)}
                    style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                  >
                    <Plus size={14} />
                    <span>Map Dependency</span>
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                {recoverySequence.map((step) => (
                  <div
                    key={step.serviceId}
                    style={{
                      flex: '0 0 auto',
                      padding: '0.5rem 0.85rem',
                      borderRadius: '0.4rem',
                      border: '1px solid var(--border-light)',
                      background: 'var(--glass-bg)',
                      fontSize: '0.8rem',
                    }}
                  >
                    <span style={{ fontSize: '0.7rem', color: 'var(--accent-main)', fontWeight: '700', display: 'block' }}>
                      PHASE {step.phase}
                    </span>
                    <strong style={{ color: 'var(--text-primary)' }}>{step.serviceName}</strong>
                  </div>
                ))}
              </div>
            </div>

            {/* DEPENDENCY MATRIX ACCESSIBLE TABLE */}
            <DependencyMatrixTable
              dependencies={dependencies}
              services={servicesList}
              onDelete={handleDeleteDependency}
              isAdmin={isAdmin}
            />
          </div>
        )}

        {/* TAB 3: TABLETOP DRILLS */}
        {!isLoading && activeTab === 'drills' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* DRILL LAUNCHER BAR */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.75rem',
                padding: '0.85rem',
                background: 'var(--bg-card)',
                borderRadius: '0.5rem',
                border: '1px solid var(--border-main)',
              }}
            >
              <div>
                <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                  Launch Municipal Tabletop Exercise
                </strong>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Select an incident scenario template to initiate a structured tabletop drill.
                </p>
              </div>

              {isOperator && (
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {scenarios.map((scen) => (
                    <button
                      key={scen.id}
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => handleStartNewDrill(scen.id)}
                      style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                    >
                      <span>Drill: {scen.title.split(' ')[0]}</span>
                    </button>
                  ))}

                  {isAdmin && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setShowScenarioModal(true)}
                      style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                    >
                      <Plus size={13} />
                      <span>Custom Scenario</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* EXERCISE DRILL CONDUCTOR */}
            {currentExercise ? (
              <TabletopExerciseConductor
                exerciseRun={currentExercise}
                scenario={currentScenario}
                onRecordDecision={handleRecordInjectDecision}
                onTransitionState={handleTransitionExercise}
                isAdmin={isAdmin}
              />
            ) : (
              <div
                style={{
                  padding: '3rem 1rem',
                  textAlign: 'center',
                  background: 'var(--bg-card)',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--border-main)',
                  color: 'var(--text-secondary)',
                }}
              >
                <Activity size={32} style={{ margin: '0 auto 0.5rem', color: 'var(--text-tertiary)' }} />
                <h3>No Active Drills Scheduled</h3>
                <p style={{ fontSize: '0.85rem' }}>
                  Select a scenario above to schedule and facilitate an incident tabletop exercise.
                </p>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: AAR & ACTION ITEMS */}
        {!isLoading && activeTab === 'aar' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.75rem',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800' }}>
                  After-Action Corrective Action Items
                </h3>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Track post-exercise vulnerability remediations, SLA procurements, and manual SOP revisions to closure.
                </p>
              </div>
            </div>

            <ActionItemsTracker
              actionItems={actionItems}
              onTransitionState={handleTransitionActionItem}
              isAdmin={isAdmin}
            />
          </div>
        )}

        {/* TAB 5: RECOMMENDATIONS */}
        {!isLoading && activeTab === 'recommendations' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800' }}>
                Bounded Graph Intelligence Recommendations
              </h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Explainable, ruleset-versioned resilience findings with transparent source parameter attribution and mandatory human-in-the-loop signoff.
              </p>
            </div>

            {recommendations.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', background: 'var(--bg-card)', borderRadius: '0.5rem' }}>
                No active resilience recommendations found for this plan.
              </div>
            ) : (
              recommendations.map((rec) => (
                <RecommendationCard
                  key={rec.id}
                  recommendation={rec}
                  onRecordDecision={handleRecommendationDecision}
                  isPrivileged={isOperator}
                />
              ))
            )}
          </div>
        )}

        {/* TAB 6: AUDIT TRAIL */}
        {!isLoading && activeTab === 'audit' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800' }}>
                Continuity Planning Append-Only Audit Trail
              </h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Immutable event receipts recording plan approvals, drill closures, and automated recommendation overrides.
              </p>
            </div>

            <div
              tabIndex="0"
              role="region"
              aria-label="Continuity audit log receipts"
              style={{
                width: '100%',
                overflowX: 'auto',
                borderRadius: '0.5rem',
                border: '1px solid var(--border-main)',
                background: 'var(--bg-card)',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'var(--glass-bg)', borderBottom: '1px solid var(--border-main)' }}>
                    <th scope="col" style={{ padding: '0.65rem 0.85rem' }}>Seq #</th>
                    <th scope="col" style={{ padding: '0.65rem 0.85rem' }}>Timestamp</th>
                    <th scope="col" style={{ padding: '0.65rem 0.85rem' }}>Action</th>
                    <th scope="col" style={{ padding: '0.65rem 0.85rem' }}>Entity</th>
                    <th scope="col" style={{ padding: '0.65rem 0.85rem' }}>Actor</th>
                    <th scope="col" style={{ padding: '0.65rem 0.85rem' }}>Reason / Operational Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        No audit events recorded yet.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                        <td style={{ padding: '0.65rem 0.85rem', fontWeight: '700' }}>#{log.sequenceNumber}</td>
                        <td style={{ padding: '0.65rem 0.85rem', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                          {new Date(log.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', fontWeight: '600', color: 'var(--accent-main)' }}>
                          {log.action}
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', color: 'var(--text-secondary)' }}>
                          {log.entityType} ({log.entityId.slice(0, 10)})
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', color: 'var(--text-secondary)' }}>
                          {log.actor?.role} ({log.actor?.id})
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', color: 'var(--text-primary)' }}>
                          {log.reason || 'Standard operational update'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MODALS */}
        {showPlanModal && (
          <ContinuityPlanModal
            isOpen={showPlanModal}
            onClose={() => {
              setShowPlanModal(false);
              setEditingPlan(null);
            }}
            onSave={handleSavePlan}
            initialPlan={editingPlan}
          />
        )}

        {showDepModal && (
          <DependencyModal
            isOpen={showDepModal}
            onClose={() => setShowDepModal(false)}
            onSave={handleSaveDependency}
            planId={selectedPlanId || 'plan_pune_ward_12'}
            availableServices={servicesList}
          />
        )}

        {showScenarioModal && (
          <IncidentScenarioModal
            isOpen={showScenarioModal}
            onClose={() => setShowScenarioModal(false)}
            onSave={handleSaveScenario}
          />
        )}
      </div>
    </div>
  );
}
