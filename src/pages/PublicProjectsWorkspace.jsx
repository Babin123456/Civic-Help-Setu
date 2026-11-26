import { useState, useMemo } from 'react';
import {
  Layers,
  Table as TableIcon,
  Search,
  Clock,
  Plus,
  WifiOff,
} from 'lucide-react';
import StandardPageHeader from '../components/common/StandardPageHeader';
import ProjectMapViewer from '../components/publicProjects/ProjectMapViewer';
import ProjectAccessibleTable from '../components/publicProjects/ProjectAccessibleTable';
import MilestoneEvidenceTimeline from '../components/publicProjects/MilestoneEvidenceTimeline';
import EvidenceReviewModal from '../components/publicProjects/EvidenceReviewModal';
import ProgressSubmissionModal from '../components/publicProjects/ProgressSubmissionModal';
import AccessibleModal from '../components/common/AccessibleModal';
import {
  listPublicProjects,
  getPublicProjectDetail,
  createPublicProject,
  submitMilestoneProgress,
  recordVerificationReview,
  getPublicProjectsSummaryMetrics,
  ensurePublicProjectsSeedData,
  PROJECT_CATEGORIES,
  PROJECT_CATEGORY_LABELS,
  PROJECT_STATUSES,
} from '../services/publicProjectService';
import { can } from '../services/accessControl';
import { useToast } from '../context/ToastContext';
import { useNetwork } from '../context/NetworkContext';

const formatInr = (amount) => {
  if (typeof amount !== 'number') return '₹0';
  if (amount >= 10000000) {
    return `₹${(amount / 10000000).toFixed(2)} Cr`;
  }
  if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(2)} Lakh`;
  }
  return `₹${amount.toLocaleString('en-IN')}`;
};

const PublicProjectsWorkspace = () => {
  const { toast } = useToast();
  const { isOnline } = useNetwork();

  const canCreate = can('publicProjects.create');
  const canVerify = can('publicProjects.verify');

  const [viewMode, setViewMode] = useState('map'); // 'map' | 'table'
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [jurisdictionFilter, setJurisdictionFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Synchronously seed data on initialization
  const [selectedProjectId, setSelectedProjectId] = useState('proj-road-101');
  const [refreshKey, setRefreshKey] = useState(() => {
    ensurePublicProjectsSeedData();
    return 0;
  });

  // Modals state
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const [activeMilestone, setActiveMilestone] = useState(null);
  const [activeSubmission, setActiveSubmission] = useState(null);

  // New Project Form State
  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [newProjectCategory, setNewProjectCategory] = useState(PROJECT_CATEGORIES.ROADS);
  const [newProjectWard, setNewProjectWard] = useState('Ward 150');
  const [newProjectBudget, setNewProjectBudget] = useState('15000000');
  const [createError, setCreateError] = useState('');

  const projects = useMemo(() => {
    void refreshKey;
    return listPublicProjects({
      category: categoryFilter || null,
      status: statusFilter || null,
      jurisdiction: jurisdictionFilter || null,
      search: searchQuery || '',
    });
  }, [categoryFilter, statusFilter, jurisdictionFilter, searchQuery, refreshKey]);

  const summary = useMemo(() => {
    void refreshKey;
    return getPublicProjectsSummaryMetrics();
  }, [refreshKey]);

  const selectedProject = useMemo(() => {
    void refreshKey;
    if (!selectedProjectId) return null;
    return getPublicProjectDetail(selectedProjectId, undefined, canVerify);
  }, [selectedProjectId, canVerify, refreshKey]);

  // Handlers
  const handleSelectProject = (projectId) => {
    setSelectedProjectId(projectId);
    const detailElement = document.getElementById('project-detail-section');
    if (detailElement) {
      detailElement.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleOpenSubmit = (milestone) => {
    setActiveMilestone(milestone);
    setIsSubmitModalOpen(true);
  };

  const handleOpenVerify = (milestone, submission) => {
    setActiveMilestone(milestone);
    setActiveSubmission(submission);
    setIsVerifyModalOpen(true);
  };

  const handleSubmitProgress = (payload) => {
    submitMilestoneProgress(payload);
    toast?.success
      ? toast.success('Milestone progress evidence submitted and sealed.')
      : alert('Milestone progress evidence submitted and sealed.');
    setRefreshKey((k) => k + 1);
  };

  const handleSaveReview = (payload) => {
    recordVerificationReview(payload);
    toast?.success
      ? toast.success('Verification audit decision committed successfully.')
      : alert('Verification audit decision committed successfully.');
    setRefreshKey((k) => k + 1);
  };

  const handleCreateProjectSubmit = (e) => {
    e.preventDefault();
    if (!newProjectTitle || newProjectTitle.trim().length < 10) {
      setCreateError('Title must be at least 10 characters.');
      return;
    }
    if (!newProjectDesc || newProjectDesc.trim().length < 20) {
      setCreateError('Description must be at least 20 characters.');
      return;
    }

    try {
      const created = createPublicProject({
        title: newProjectTitle.trim(),
        description: newProjectDesc.trim(),
        category: newProjectCategory,
        jurisdiction: { wardNumber: newProjectWard, zone: 'South Zone' },
        budgetReference: {
          sanctionedAmountInr: Number(newProjectBudget) || 10000000,
          financialYear: '2026-2027',
          isPublic: true,
        },
      });

      setSelectedProjectId(created.id);
      setIsCreateModalOpen(false);
      setNewProjectTitle('');
      setNewProjectDesc('');
      setCreateError('');
      setRefreshKey((k) => k + 1);
      toast?.success
        ? toast.success('New public infrastructure project created.')
        : alert('New public infrastructure project created.');
    } catch (err) {
      setCreateError(err.message || 'Failed to create project.');
    }
  };

  return (
    <div className="section" style={{ padding: '2rem 1rem' }}>
      <div className="container" style={{ maxWidth: '1280px', margin: '0 auto' }}>
        {/* Offline Banner Indicator */}
        {!isOnline && (
          <div
            role="status"
            aria-live="polite"
            style={{
              background: 'rgba(245, 158, 11, 0.15)',
              border: '1px solid #f59e0b',
              color: '#f59e0b',
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              fontSize: '0.85rem',
            }}
          >
            <WifiOff size={18} />
            <span>
              <strong>Offline Mode:</strong> Working from local cache. Evidence submissions will be buffered and sealed locally.
            </span>
          </div>
        )}

        {/* Page Header */}
        <StandardPageHeader
          eyebrow="Civic Infrastructure Transparency"
          title="Geospatial Public Project Verification & Evidence Timeline"
          subtitle="Map-linked register of municipal roads, drains, schools, and civic buildings. Track planned milestones against timestamped, tamper-evident site evidence."
        >
          {canCreate && (
            <button
              type="button"
              className="btn btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem' }}
              onClick={() => setIsCreateModalOpen(true)}
            >
              <Plus size={16} />
              <span>Register New Project</span>
            </button>
          )}
        </StandardPageHeader>

        {/* Metric Summary Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            marginBottom: '2rem',
          }}
        >
          <div style={{ background: 'var(--bg-card, #1e293b)', border: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))', borderRadius: '10px', padding: '1rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)', fontWeight: 600 }}>Total Projects</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary, #f8fafc)', marginTop: '0.2rem' }}>
              {summary.totalProjects}
            </div>
          </div>

          <div style={{ background: 'var(--bg-card, #1e293b)', border: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))', borderRadius: '10px', padding: '1rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)', fontWeight: 600 }}>Active Construction</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-main, #38bdf8)', marginTop: '0.2rem' }}>
              {summary.activeProjects}
            </div>
          </div>

          <div style={{ background: 'var(--bg-card, #1e293b)', border: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))', borderRadius: '10px', padding: '1rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)', fontWeight: 600 }}>Verified Completed</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#10b981', marginTop: '0.2rem' }}>
              {summary.completedProjects}
            </div>
          </div>

          <div style={{ background: 'var(--bg-card, #1e293b)', border: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))', borderRadius: '10px', padding: '1rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)', fontWeight: 600 }}>Sanctioned Outlay</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary, #f8fafc)', marginTop: '0.2rem' }}>
              {formatInr(summary.totalSanctionedBudgetInr)}
            </div>
          </div>
        </div>

        {/* Filter and Control Bar */}
        <div
          style={{
            background: 'var(--bg-card, #1e293b)',
            border: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
            borderRadius: '10px',
            padding: '1rem',
            marginBottom: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Search Input */}
            <div style={{ flex: '1 1 240px', position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary, #94a3b8)' }} />
              <input
                type="text"
                placeholder="Search projects by corridor, ward, or title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.55rem 0.75rem 0.55rem 2.25rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border-light, rgba(255, 255, 255, 0.15))',
                  background: 'rgba(0, 0, 0, 0.25)',
                  color: 'var(--text-primary, #f8fafc)',
                  fontSize: '0.85rem',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Category Dropdown */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              aria-label="Filter by project category"
              style={{
                padding: '0.55rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid var(--border-light, rgba(255, 255, 255, 0.15))',
                background: 'rgba(0, 0, 0, 0.25)',
                color: 'var(--text-primary, #f8fafc)',
                fontSize: '0.85rem',
              }}
            >
              <option value="">All Categories</option>
              {Object.entries(PROJECT_CATEGORY_LABELS).map(([cat, label]) => (
                <option key={cat} value={cat}>
                  {label}
                </option>
              ))}
            </select>

            {/* Status Dropdown */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by project status"
              style={{
                padding: '0.55rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid var(--border-light, rgba(255, 255, 255, 0.15))',
                background: 'rgba(0, 0, 0, 0.25)',
                color: 'var(--text-primary, #f8fafc)',
                fontSize: '0.85rem',
              }}
            >
              <option value="">All Statuses</option>
              {Object.values(PROJECT_STATUSES).map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>

            {/* Jurisdiction Dropdown */}
            <select
              value={jurisdictionFilter}
              onChange={(e) => setJurisdictionFilter(e.target.value)}
              aria-label="Filter by municipal ward"
              style={{
                padding: '0.55rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid var(--border-light, rgba(255, 255, 255, 0.15))',
                background: 'rgba(0, 0, 0, 0.25)',
                color: 'var(--text-primary, #f8fafc)',
                fontSize: '0.85rem',
              }}
            >
              <option value="">All Wards & Zones</option>
              <option value="Ward 18">Ward 18 (Radhakrishna Temple)</option>
              <option value="Ward 45">Ward 45 (Malleshwaram)</option>
              <option value="Ward 65">Ward 65 (Kadu Malleshwar)</option>
              <option value="Ward 112">Ward 112 (Domlur)</option>
            </select>

            {/* View Mode Toggle Button Group */}
            <div
              style={{
                display: 'inline-flex',
                borderRadius: '6px',
                border: '1px solid var(--border-light, rgba(255, 255, 255, 0.15))',
                overflow: 'hidden',
                marginLeft: 'auto',
              }}
              role="group"
              aria-label="Presentation view format"
            >
              <button
                type="button"
                onClick={() => setViewMode('map')}
                style={{
                  padding: '0.55rem 0.9rem',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  background: viewMode === 'map' ? 'var(--accent-main, #38bdf8)' : 'transparent',
                  color: viewMode === 'map' ? '#0f172a' : 'var(--text-secondary, #94a3b8)',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <Layers size={15} />
                <span>Map View</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('table')}
                style={{
                  padding: '0.55rem 0.9rem',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  background: viewMode === 'table' ? 'var(--accent-main, #38bdf8)' : 'transparent',
                  color: viewMode === 'table' ? '#0f172a' : 'var(--text-secondary, #94a3b8)',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <TableIcon size={15} />
                <span>Accessible Table</span>
              </button>
            </div>
          </div>
        </div>

        {/* Workspace Display Area */}
        {viewMode === 'map' ? (
          <ProjectMapViewer
            projects={projects}
            selectedProjectId={selectedProjectId}
            onSelectProject={handleSelectProject}
          />
        ) : (
          <ProjectAccessibleTable
            projects={projects}
            selectedProjectId={selectedProjectId}
            onSelectProject={handleSelectProject}
          />
        )}

        {/* Selected Project Milestone Evidence Timeline & Detail Drawer */}
        {selectedProject ? (
          <div
            id="project-detail-section"
            style={{
              marginTop: '2.5rem',
              background: 'var(--bg-card, #1e293b)',
              border: '1px solid var(--border-light, rgba(255, 255, 255, 0.12))',
              borderRadius: '12px',
              padding: '1.75rem',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
            }}
          >
            {/* Project Banner Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                gap: '1rem',
                marginBottom: '1.5rem',
                borderBottom: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
                paddingBottom: '1.25rem',
              }}
            >
              <div style={{ flex: 1, minWidth: '280px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      padding: '0.15rem 0.5rem',
                      borderRadius: '4px',
                      background: 'rgba(56, 189, 248, 0.15)',
                      color: 'var(--accent-main, #38bdf8)',
                    }}
                  >
                    {PROJECT_CATEGORY_LABELS[selectedProject.category] || selectedProject.category}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #94a3b8)' }}>
                    • {selectedProject.jurisdiction?.wardNumber} ({selectedProject.jurisdiction?.zone})
                  </span>
                </div>

                <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary, #f8fafc)' }}>
                  {selectedProject.title}
                </h2>

                <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary, #cbd5e1)', lineHeight: 1.5 }}>
                  {selectedProject.description}
                </p>
              </div>

              {/* Progress & Sanction Card */}
              <div
                style={{
                  background: 'rgba(0, 0, 0, 0.25)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '8px',
                  padding: '1rem',
                  minWidth: '220px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #94a3b8)' }}>Verified Progress</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 700, color: selectedProject.overallProgressPercent === 100 ? '#10b981' : 'var(--accent-main, #38bdf8)' }}>
                    {selectedProject.overallProgressPercent}%
                  </span>
                </div>

                <div
                  style={{
                    height: '8px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '4px',
                    overflow: 'hidden',
                    marginBottom: '0.75rem',
                  }}
                >
                  <div
                    style={{
                      width: `${selectedProject.overallProgressPercent}%`,
                      height: '100%',
                      background: selectedProject.overallProgressPercent === 100 ? '#10b981' : 'var(--accent-main, #38bdf8)',
                      borderRadius: '4px',
                    }}
                  />
                </div>

                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)' }}>
                  <div>Sanctioned: <strong>{formatInr(selectedProject.budgetReference?.sanctionedAmountInr)}</strong></div>
                  <div>Financial Year: {selectedProject.budgetReference?.financialYear}</div>
                </div>
              </div>
            </div>

            {/* Milestones & Evidence Timeline */}
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary, #f8fafc)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Clock size={18} style={{ color: 'var(--accent-main, #38bdf8)' }} />
                <span>Milestone Execution & Verifiable Evidence Timeline</span>
              </h3>

              <MilestoneEvidenceTimeline
                milestones={selectedProject.milestones}
                submissions={selectedProject.submissions}
                evidenceAssets={selectedProject.evidenceAssets}
                verificationReviews={selectedProject.verificationReviews}
                canVerify={canVerify}
                onOpenSubmitProgress={handleOpenSubmit}
                onOpenVerifyReview={handleOpenVerify}
              />
            </div>
          </div>
        ) : null}

        {/* Modals */}
        <ProgressSubmissionModal
          isOpen={isSubmitModalOpen}
          onClose={() => setIsSubmitModalOpen(false)}
          project={selectedProject}
          milestone={activeMilestone}
          onSubmitProgress={handleSubmitProgress}
        />

        <EvidenceReviewModal
          isOpen={isVerifyModalOpen}
          onClose={() => setIsVerifyModalOpen(false)}
          project={selectedProject}
          milestone={activeMilestone}
          submission={activeSubmission}
          onSaveReview={handleSaveReview}
        />

        {/* Quick Create Project Modal for Admins */}
        {canCreate && (
          <AccessibleModal
            isOpen={isCreateModalOpen}
            onClose={() => setIsCreateModalOpen(false)}
            title="Register New Public Infrastructure Project"
            subtitle="Author an official civic work with planned milestones and geo-boundaries"
          >
            <form onSubmit={handleCreateProjectSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem', color: 'var(--text-primary, #f8fafc)' }}>
                  Project Title <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ring Road Storm Drain Box Culvert Upgradation"
                  value={newProjectTitle}
                  onChange={(e) => setNewProjectTitle(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-light, rgba(255, 255, 255, 0.15))',
                    background: 'rgba(0,0,0,0.25)',
                    color: 'var(--text-primary, #f8fafc)',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem', color: 'var(--text-primary, #f8fafc)' }}>
                  Description <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Provide scope of civil works, target beneficiaries, and specifications..."
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-light, rgba(255, 255, 255, 0.15))',
                    background: 'rgba(0,0,0,0.25)',
                    color: 'var(--text-primary, #f8fafc)',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem', color: 'var(--text-primary, #f8fafc)' }}>
                    Category
                  </label>
                  <select
                    value={newProjectCategory}
                    onChange={(e) => setNewProjectCategory(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.6rem',
                      borderRadius: '6px',
                      border: '1px solid var(--border-light, rgba(255, 255, 255, 0.15))',
                      background: 'rgba(0,0,0,0.25)',
                      color: 'var(--text-primary, #f8fafc)',
                      fontSize: '0.85rem',
                      boxSizing: 'border-box',
                    }}
                  >
                    {Object.entries(PROJECT_CATEGORY_LABELS).map(([cat, label]) => (
                      <option key={cat} value={cat}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem', color: 'var(--text-primary, #f8fafc)' }}>
                    Ward Number
                  </label>
                  <input
                    type="text"
                    value={newProjectWard}
                    onChange={(e) => setNewProjectWard(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.6rem',
                      borderRadius: '6px',
                      border: '1px solid var(--border-light, rgba(255, 255, 255, 0.15))',
                      background: 'rgba(0,0,0,0.25)',
                      color: 'var(--text-primary, #f8fafc)',
                      fontSize: '0.85rem',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem', color: 'var(--text-primary, #f8fafc)' }}>
                  Sanctioned Budget (INR)
                </label>
                <input
                  type="number"
                  value={newProjectBudget}
                  onChange={(e) => setNewProjectBudget(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-light, rgba(255, 255, 255, 0.15))',
                    background: 'rgba(0,0,0,0.25)',
                    color: 'var(--text-primary, #f8fafc)',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {createError && (
                <div style={{ color: '#ef4444', fontSize: '0.8rem', padding: '0.4rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '4px' }}>
                  {createError}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsCreateModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Project
                </button>
              </div>
            </form>
          </AccessibleModal>
        )}
      </div>
    </div>
  );
};

export default PublicProjectsWorkspace;
