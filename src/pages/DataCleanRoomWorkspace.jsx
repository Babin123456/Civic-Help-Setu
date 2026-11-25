import { useState } from 'react';
import { Shield, Lock, Layers, BarChart3 } from 'lucide-react';
import { CleanRoomService } from '../services/cleanRoomService.js';
import CleanRoomBudgetBadge from '../components/cleanRoom/CleanRoomBudgetBadge.jsx';
import CleanRoomDifferencingAlert from '../components/cleanRoom/CleanRoomDifferencingAlert.jsx';
import CleanRoomTemplateSelector from '../components/cleanRoom/CleanRoomTemplateSelector.jsx';
import CleanRoomResultsTable from '../components/cleanRoom/CleanRoomResultsTable.jsx';
import CleanRoomStewardQueue from '../components/cleanRoom/CleanRoomStewardQueue.jsx';
import CleanRoomAuditLogModal from '../components/cleanRoom/CleanRoomAuditLogModal.jsx';

export default function DataCleanRoomWorkspace() {
  const [activeTab, setActiveTab] = useState('analytics'); // 'analytics' | 'steward' | 'audit'
  const [workspaces, setWorkspaces] = useState(() => CleanRoomService.listWorkspaces());
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('ws-urban-inst-01');
  const [templates, setTemplates] = useState(() => CleanRoomService.listTemplates());
  const [activeTemplateId, setActiveTemplateId] = useState('TPL_WARD_SERVICE_SUMMARY');
  const [queryResult, setQueryResult] = useState(null);
  const [queryError, setQueryError] = useState(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [auditLogs, setAuditLogs] = useState(() => CleanRoomService.getAuditLogs());
  const [metrics, setMetrics] = useState(() => CleanRoomService.getEvaluationMetrics());

  // Load state from CleanRoomService
  const loadWorkspaceData = () => {
    const wsList = CleanRoomService.listWorkspaces();
    const tplList = CleanRoomService.listTemplates();
    const logs = CleanRoomService.getAuditLogs();
    const m = CleanRoomService.getEvaluationMetrics();

    setWorkspaces(wsList);
    setTemplates(tplList);
    setAuditLogs(logs);
    setMetrics(m);

    if (wsList.length > 0 && !wsList.some((w) => w.workspaceId === selectedWorkspaceId)) {
      setSelectedWorkspaceId(wsList[0].workspaceId);
    }
  };

  const currentWorkspace = workspaces.find((w) => w.workspaceId === selectedWorkspaceId) || workspaces[0];

  const handleExecuteQuery = ({ templateId, filters }) => {
    setIsExecuting(true);
    setQueryError(null);

    // Simulate minor network / engine delay for realistic interaction
    setTimeout(() => {
      const res = CleanRoomService.executeQuery({
        workspaceId: selectedWorkspaceId,
        templateId,
        filters,
      });

      setIsExecuting(false);

      if (res.success) {
        setQueryResult(res);
        setQueryError(null);
      } else {
        setQueryResult(null);
        setQueryError(res);
      }

      // Refresh workspaces and audit logs
      loadWorkspaceData();
    }, 250);
  };

  const handleApproveWorkspace = (wsId, payload) => {
    CleanRoomService.reviewWorkspace(wsId, { decision: 'approve', ...payload });
    loadWorkspaceData();
  };

  const handleRejectWorkspace = (wsId, payload) => {
    CleanRoomService.reviewWorkspace(wsId, { decision: 'reject', ...payload });
    loadWorkspaceData();
  };

  const handleReplenishBudget = (wsId, payload) => {
    CleanRoomService.replenishBudget(wsId, payload);
    loadWorkspaceData();
  };

  return (
    <div className="container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1rem' }}>
      {/* Header Banner */}
      <div
        className="card"
        style={{
          padding: '1.75rem',
          borderRadius: '0.75rem',
          background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.1) 0%, rgba(16, 185, 129, 0.08) 100%)',
          border: '1px solid var(--border-light)',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <div
            style={{
              padding: '0.5rem',
              borderRadius: '0.5rem',
              background: '#2563eb',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Shield size={24} />
          </div>
          <div>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: '#2563eb',
              }}
            >
              DPDP Act 2023 Compliant &bull; Zero-Export Platform
            </span>
            <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800 }}>Civic Data Clean Room</h1>
          </div>
        </div>
        <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: 1.5, maxWidth: '850px' }}>
          Enables verified civic partners, municipal planning think tanks, and researchers to execute narrowly scoped
          aggregate analytics without exporting row-level citizen data. Enforces automated k-anonymity (k &ge; 10),
          differential privacy budgets, and history-aware differencing attack prevention.
        </p>

        {/* Workspace Switcher */}
        <div
          style={{
            marginTop: '1.25rem',
            paddingTop: '1rem',
            borderTop: '1px solid var(--border-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Active Workspace:
            </span>
            <select
              aria-label="Select Active Workspace"
              value={selectedWorkspaceId}
              onChange={(e) => {
                setSelectedWorkspaceId(e.target.value);
                setQueryResult(null);
                setQueryError(null);
              }}
              style={{
                padding: '0.45rem 0.75rem',
                borderRadius: '0.4rem',
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-light)',
                fontSize: '0.85rem',
                fontWeight: 600,
              }}
            >
              {workspaces.map((ws) => (
                <option key={ws.workspaceId} value={ws.workspaceId}>
                  {ws.partnerOrg} ({ws.partnerName}) - [{ws.status}]
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            <Lock size={14} color="#10b981" />
            <span>Zero Citizen PII Invariant Guaranteed</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div
        role="tablist"
        aria-label="Data Clean Room Tabs"
        style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '1px solid var(--border-light)',
          marginBottom: '1.5rem',
        }}
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'analytics'}
          onClick={() => setActiveTab('analytics')}
          style={{
            padding: '0.75rem 1.25rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'analytics' ? '2px solid #2563eb' : '2px solid transparent',
            color: activeTab === 'analytics' ? '#2563eb' : 'var(--text-secondary)',
            fontWeight: activeTab === 'analytics' ? 700 : 500,
            fontSize: '0.95rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          <BarChart3 size={16} /> Partner Analytics Workbench
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'steward'}
          onClick={() => setActiveTab('steward')}
          style={{
            padding: '0.75rem 1.25rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'steward' ? '2px solid #2563eb' : '2px solid transparent',
            color: activeTab === 'steward' ? '#2563eb' : 'var(--text-secondary)',
            fontWeight: activeTab === 'steward' ? 700 : 500,
            fontSize: '0.95rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          <Layers size={16} /> Data Steward Governance
          {metrics?.pendingWorkspaces > 0 && (
            <span
              style={{
                background: '#f59e0b',
                color: '#fff',
                borderRadius: '999px',
                padding: '0.1rem 0.4rem',
                fontSize: '0.7rem',
                fontWeight: 700,
              }}
            >
              {metrics.pendingWorkspaces}
            </span>
          )}
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'audit'}
          onClick={() => setActiveTab('audit')}
          style={{
            padding: '0.75rem 1.25rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'audit' ? '2px solid #2563eb' : '2px solid transparent',
            color: activeTab === 'audit' ? '#2563eb' : 'var(--text-secondary)',
            fontWeight: activeTab === 'audit' ? 700 : 500,
            fontSize: '0.95rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          <Shield size={16} /> Tamper-Evident Audit Logs
        </button>
      </div>

      {/* Main Tab Content */}
      {activeTab === 'analytics' && (
        <div>
          <CleanRoomBudgetBadge workspace={currentWorkspace} />

          {queryError && (
            <CleanRoomDifferencingAlert error={queryError.error} message={queryError.message} />
          )}

          <CleanRoomTemplateSelector
            templates={templates}
            activeTemplateId={activeTemplateId}
            onSelectTemplate={setActiveTemplateId}
            onExecuteQuery={handleExecuteQuery}
            isExecuting={isExecuting}
            workspace={currentWorkspace}
          />

          <CleanRoomResultsTable queryResult={queryResult} />
        </div>
      )}

      {activeTab === 'steward' && (
        <CleanRoomStewardQueue
          workspaces={workspaces}
          onApprove={handleApproveWorkspace}
          onReject={handleRejectWorkspace}
          onReplenish={handleReplenishBudget}
          metrics={metrics}
        />
      )}

      {activeTab === 'audit' && (
        <CleanRoomAuditLogModal auditLogs={auditLogs} />
      )}
    </div>
  );
}
