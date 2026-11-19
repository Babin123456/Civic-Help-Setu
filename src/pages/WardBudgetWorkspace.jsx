import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users,
  PlusCircle,
  Search,
  RefreshCw,
  Table,
  Grid,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useNetwork } from '../context/NetworkContext';
import {
  PROPOSAL_CATEGORIES,
  PROPOSAL_STATUSES,
} from '../data/wardBudgetContract.js';
import { wardBudgetService } from '../services/wardBudgetService.js';
import ProposalCard from '../components/wardBudget/ProposalCard.jsx';
import ProposalDetailModal from '../components/wardBudget/ProposalDetailModal.jsx';
import ProposalIntakeWizard from '../components/wardBudget/ProposalIntakeWizard.jsx';
import AdvisoryVotingModal from '../components/wardBudget/AdvisoryVotingModal.jsx';
import ReviewQueueModal from '../components/wardBudget/ReviewQueueModal.jsx';

export default function WardBudgetWorkspace() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { isOnline } = useNetwork();

  // State
  const [activeTab, setActiveTab] = useState('browse'); // browse | ballot | tracking | official
  const [cycle, setCycle] = useState(() => {
    try {
      return wardBudgetService.getBudgetCycle();
    } catch {
      return null;
    }
  });
  const [proposals, setProposals] = useState(() => {
    try {
      return wardBudgetService.listProposals().proposals;
    } catch {
      return [];
    }
  });
  const [loading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('cards'); // cards | table

  // Modals
  const [selectedProposal, setSelectedProposal] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [intakeWizardOpen, setIntakeWizardOpen] = useState(false);
  const [votingModalOpen, setVotingModalOpen] = useState(false);
  const [votingProposal, setVotingProposal] = useState(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewProposal, setReviewProposal] = useState(null);

  // User state
  const [userVotedIds, setUserVotedIds] = useState(new Set());
  const [offlinePendingCount, setOfflinePendingCount] = useState(0);

  const currentUser = useMemo(() => {
    return {
      id: user?.id || 'CIT-ANON',
      name: user?.name || user?.email?.split('@')[0] || 'Resident',
      role: user?.role || (user?.email?.includes('admin') ? 'admin' : 'citizen'),
    };
  }, [user]);

  const isOfficial = currentUser.role === 'reviewer' || currentUser.role === 'admin';

  // Reload data helper
  const reloadData = useCallback(() => {
    try {
      const budgetCycle = wardBudgetService.getBudgetCycle();
      setCycle(budgetCycle);

      const res = wardBudgetService.listProposals();
      setProposals(res.proposals);

      const off = wardBudgetService.getOfflineStatus();
      setOfflinePendingCount(off.pendingActionsCount);
    } catch (err) {
      toast?.show?.(err.message || 'Error loading proposals', 'error');
    }
  }, [toast]);

  // Flush offline queue when reconnected
  useEffect(() => {
    if (!isOnline || offlinePendingCount <= 0) return;
    const timer = setTimeout(() => {
      const synced = wardBudgetService.flushOfflineQueue();
      if (synced.length > 0) {
        toast?.show?.(`Synced ${synced.length} offline proposals to the platform.`, 'success');
        const res = wardBudgetService.listProposals();
        setProposals(res.proposals);
        setOfflinePendingCount(0);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [isOnline, offlinePendingCount, toast]);

  // Filtered proposals
  const filteredProposals = useMemo(() => {
    let list = proposals;

    if (activeTab === 'ballot') {
      list = list.filter((p) => p.status === 'approved_for_voting');
    } else if (activeTab === 'tracking') {
      list = list.filter((p) => p.status === 'funded' || p.status === 'work_in_progress' || p.status === 'completed');
    } else if (activeTab === 'official') {
      list = list.filter((p) => p.status === 'submitted' || p.status === 'under_review');
    }

    if (selectedCategory !== 'all') {
      list = list.filter((p) => p.category === selectedCategory);
    }

    if (selectedStatus !== 'all') {
      list = list.filter((p) => p.status === selectedStatus);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.title?.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q) ||
          p.approximateLocation?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [proposals, activeTab, selectedCategory, selectedStatus, searchQuery]);

  const handleSelectProposal = (p) => {
    setSelectedProposal(p);
    setDetailModalOpen(true);
  };

  const handleOpenVoting = (p) => {
    setVotingProposal(p);
    setVotingModalOpen(true);
  };

  const handleConfirmVote = (proposalId, citizenId) => {
    const res = wardBudgetService.castAdvisoryVote(proposalId, citizenId, cycle?.id);
    setUserVotedIds((prev) => new Set([...prev, proposalId]));
    toast?.show?.('Advisory vote successfully recorded!', 'success');
    reloadData();
    return res;
  };

  const handleSubmitProposal = (payload) => {
    const res = wardBudgetService.createProposal(payload, {
      isOffline: !isOnline,
      user: currentUser,
    });
    if (res.proposal?.isOfflineQueued) {
      toast?.show?.('Proposal queued locally. Will sync when back online.', 'info');
      setOfflinePendingCount((c) => c + 1);
    } else {
      toast?.show?.('Proposal submitted for public deliberation!', 'success');
      reloadData();
    }
  };

  const handleAddComment = (commentPayload) => {
    const newComm = wardBudgetService.addComment(commentPayload, currentUser);
    toast?.show?.('Comment posted to public thread.', 'success');
    reloadData();
    // Update selected proposal metrics in modal
    if (selectedProposal && selectedProposal.id === commentPayload.proposalId) {
      setSelectedProposal((prev) => ({
        ...prev,
        metrics: {
          ...prev.metrics,
          commentCount: (prev.metrics?.commentCount || 0) + 1,
        },
      }));
    }
    return newComm;
  };

  const handleOpenReview = (p) => {
    setReviewProposal(p);
    setReviewModalOpen(true);
  };

  const handleSaveDecision = (decisionPayload) => {
    wardBudgetService.recordReviewDecision(decisionPayload, currentUser);
    toast?.show?.('Review decision recorded and state updated.', 'success');
    setDetailModalOpen(false);
    reloadData();
  };

  const formatCurrency = (num) => (num ? `₹${Number(num).toLocaleString('en-IN')}` : '₹0');

  return (
    <div className="ward-budget-workspace" style={{ padding: '1.5rem 1rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header Banner */}
      <header
        style={{
          background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
          color: '#ffffff',
          borderRadius: '1rem',
          padding: '2rem 1.75rem',
          marginBottom: '1.75rem',
          boxShadow: '0 10px 15px -3px rgba(37, 99, 235, 0.2)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ maxWidth: '750px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <Users size={24} />
              <span style={{ fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.9 }}>
                Participatory Budgeting &amp; Civic Deliberation
              </span>
            </div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: '0 0 0.5rem 0', lineHeight: 1.25 }}>
              {cycle?.title || 'Participatory Ward Budget Platform'}
            </h1>
            <p style={{ fontSize: '0.95rem', margin: 0, opacity: 0.9, lineHeight: 1.5 }}>
              Empowering residents to submit, deliberate, and prioritize local infrastructure improvements for roads, sanitation, footpaths, and public lighting.
            </p>
          </div>

          <button
            type="button"
            className="btn btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.75rem 1.25rem',
              fontWeight: 700,
              fontSize: '0.95rem',
              background: '#ffffff',
              color: '#1e3a8a',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
            }}
            onClick={() => setIntakeWizardOpen(true)}
          >
            <PlusCircle size={18} />
            <span>Submit Ward Proposal</span>
          </button>
        </div>

        {/* Budget Metric Pills */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '1rem',
            marginTop: '1.5rem',
            paddingTop: '1.25rem',
            borderTop: '1px solid rgba(255, 255, 255, 0.2)',
          }}
        >
          <div>
            <span style={{ fontSize: '0.75rem', opacity: 0.8, display: 'block' }}>Ward Pool Ceiling</span>
            <span style={{ fontSize: '1.15rem', fontWeight: 800 }}>{formatCurrency(cycle?.totalBudgetCap)}</span>
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', opacity: 0.8, display: 'block' }}>Allocated / Under Works</span>
            <span style={{ fontSize: '1.15rem', fontWeight: 800 }}>{formatCurrency(cycle?.allocatedBudget)}</span>
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', opacity: 0.8, display: 'block' }}>Current Stage</span>
            <span style={{ fontSize: '1.15rem', fontWeight: 800, textTransform: 'capitalize' }}>
              {cycle?.status?.replace(/_/g, ' ')}
            </span>
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', opacity: 0.8, display: 'block' }}>Active Jurisdiction</span>
            <span style={{ fontSize: '1.15rem', fontWeight: 800 }}>{cycle?.ward}</span>
          </div>
        </div>
      </header>

      {/* Advisory Notice */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.75rem 1rem',
          background: '#fef3c7',
          color: '#92400e',
          borderRadius: '0.5rem',
          fontSize: '0.85rem',
          marginBottom: '1.5rem',
          border: '1px solid #fde68a',
        }}
      >
        <ShieldCheck size={18} style={{ flexShrink: 0 }} />
        <span>
          <strong>Advisory Notice:</strong> Citizen voting and comments on this platform are advisory under Municipal Ward Committee rules. Allocations are confirmed after technical feasibility scrutiny.
        </span>
      </div>

      {/* Navigation Tabs */}
      <div
        role="tablist"
        aria-label="Ward Budget Sections"
        style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '2px solid var(--border-light, #e2e8f0)',
          marginBottom: '1.5rem',
          overflowX: 'auto',
          paddingBottom: '2px',
        }}
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'browse'}
          className={`tab-btn ${activeTab === 'browse' ? 'active' : ''}`}
          onClick={() => setActiveTab('browse')}
          style={{
            padding: '0.6rem 1rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'browse' ? '3px solid #2563eb' : '3px solid transparent',
            color: activeTab === 'browse' ? '#2563eb' : 'var(--text-secondary)',
            fontWeight: activeTab === 'browse' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.9rem',
          }}
        >
          Browse &amp; Deliberate ({proposals.length})
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'ballot'}
          className={`tab-btn ${activeTab === 'ballot' ? 'active' : ''}`}
          onClick={() => setActiveTab('ballot')}
          style={{
            padding: '0.6rem 1rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'ballot' ? '3px solid #2563eb' : '3px solid transparent',
            color: activeTab === 'ballot' ? '#2563eb' : 'var(--text-secondary)',
            fontWeight: activeTab === 'ballot' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.9rem',
          }}
        >
          Active Citizen Ballot
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'tracking'}
          className={`tab-btn ${activeTab === 'tracking' ? 'active' : ''}`}
          onClick={() => setActiveTab('tracking')}
          style={{
            padding: '0.6rem 1rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'tracking' ? '3px solid #2563eb' : '3px solid transparent',
            color: activeTab === 'tracking' ? '#2563eb' : 'var(--text-secondary)',
            fontWeight: activeTab === 'tracking' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.9rem',
          }}
        >
          Ground Implementation Tracking
        </button>

        {isOfficial && (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'official'}
            className={`tab-btn ${activeTab === 'official' ? 'active' : ''}`}
            onClick={() => setActiveTab('official')}
            style={{
              padding: '0.6rem 1rem',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'official' ? '3px solid #2563eb' : '3px solid transparent',
              color: activeTab === 'official' ? '#2563eb' : 'var(--text-secondary)',
              fontWeight: activeTab === 'official' ? 700 : 500,
              cursor: 'pointer',
              fontSize: '0.9rem',
            }}
          >
            Official Review Queue
          </button>
        )}
      </div>

      {/* Search & Filter Toolbar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: '260px' }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: '420px' }}>
            <Search
              size={16}
              style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by street, landmark, or works..."
              style={{
                width: '100%',
                padding: '0.55rem 0.75rem 0.55rem 2.25rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--border-light, #cbd5e1)',
                fontSize: '0.875rem',
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
              }}
              aria-label="Search proposals"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{
              padding: '0.55rem 0.75rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--border-light, #cbd5e1)',
              fontSize: '0.85rem',
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
            }}
            aria-label="Filter by civic category"
          >
            <option value="all">All Categories</option>
            {Object.entries(PROPOSAL_CATEGORIES).map(([key, cat]) => (
              <option key={key} value={key}>
                {cat.label}
              </option>
            ))}
          </select>

          {activeTab === 'browse' && (
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              style={{
                padding: '0.55rem 0.75rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--border-light, #cbd5e1)',
                fontSize: '0.85rem',
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
              }}
              aria-label="Filter by proposal status"
            >
              <option value="all">All Statuses</option>
              {Object.entries(PROPOSAL_STATUSES).map(([key, st]) => (
                <option key={key} value={key}>
                  {st.label}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* View Mode Toggle (Accessible alternative) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setViewMode('cards')}
            style={{
              padding: '0.4rem 0.6rem',
              background: viewMode === 'cards' ? 'var(--accent-subtle, #eff6ff)' : 'transparent',
              borderColor: viewMode === 'cards' ? '#3b82f6' : 'var(--border-light)',
            }}
            aria-label="Card view mode"
          >
            <Grid size={16} />
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setViewMode('table')}
            style={{
              padding: '0.4rem 0.6rem',
              background: viewMode === 'table' ? 'var(--accent-subtle, #eff6ff)' : 'transparent',
              borderColor: viewMode === 'table' ? '#3b82f6' : 'var(--border-light)',
            }}
            aria-label="Accessible table view mode"
          >
            <Table size={16} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>
          <RefreshCw className="spin" size={32} style={{ margin: '0 auto 1rem auto' }} />
          <p>Loading ward proposals &amp; deliberation records...</p>
        </div>
      ) : filteredProposals.length === 0 ? (
        <div
          style={{
            padding: '3rem 1.5rem',
            textAlign: 'center',
            background: 'var(--bg-card, #ffffff)',
            borderRadius: '0.75rem',
            border: '1px dashed var(--border-light, #cbd5e1)',
          }}
        >
          <Users size={40} color="var(--text-tertiary)" style={{ margin: '0 auto 0.75rem auto' }} />
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>No Proposals Found</h3>
          <p style={{ margin: '0 0 1rem 0', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            No proposals match your current filters. Be the first to propose an improvement for your street!
          </p>
          <button type="button" className="btn btn-primary" onClick={() => setIntakeWizardOpen(true)}>
            Submit First Proposal
          </button>
        </div>
      ) : viewMode === 'table' ? (
        /* Accessible Table Alternative */
        <div style={{ overflowX: 'auto', background: 'var(--bg-card)', borderRadius: '0.75rem', border: '1px solid var(--border-light)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-tag, #f8fafc)', borderBottom: '1px solid var(--border-light)' }}>
                <th style={{ padding: '0.75rem 1rem' }}>Title &amp; Location</th>
                <th style={{ padding: '0.75rem 1rem' }}>Category</th>
                <th style={{ padding: '0.75rem 1rem' }}>Cost Range</th>
                <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                <th style={{ padding: '0.75rem 1rem' }}>Support</th>
                <th style={{ padding: '0.75rem 1rem' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProposals.map((p) => (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <strong>{p.title}</strong>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>{p.approximateLocation}</div>
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>{PROPOSAL_CATEGORIES[p.category]?.label || p.category}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    {formatCurrency(p.costEstimateRange?.min)} - {formatCurrency(p.costEstimateRange?.max)}
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: 'var(--bg-tag)' }}>
                      {PROPOSAL_STATUSES[p.status]?.label || p.status}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    👍 {p.metrics?.voteCount || 0} | 💬 {p.metrics?.commentCount || 0}
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}
                      onClick={() => handleSelectProposal(p)}
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* Card Grid */
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '1.25rem',
          }}
        >
          {filteredProposals.map((p) => (
            <ProposalCard
              key={p.id}
              proposal={p}
              onSelect={handleSelectProposal}
              onVoteClick={handleOpenVoting}
              userVoteStatus={userVotedIds.has(p.id)}
              formatCurrency={formatCurrency}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <ProposalDetailModal
        proposal={selectedProposal}
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        comments={selectedProposal ? wardBudgetService.listComments(selectedProposal.id) : []}
        decisions={selectedProposal ? wardBudgetService.listDecisionsForProposal(selectedProposal.id) : []}
        updates={selectedProposal ? wardBudgetService.listImplementationUpdates(selectedProposal.id) : []}
        onAddComment={handleAddComment}
        onVoteClick={handleOpenVoting}
        userVoteStatus={selectedProposal ? userVotedIds.has(selectedProposal.id) : false}
        currentUser={currentUser}
        onOpenReview={handleOpenReview}
        formatCurrency={formatCurrency}
      />

      <ProposalIntakeWizard
        isOpen={intakeWizardOpen}
        onClose={() => setIntakeWizardOpen(false)}
        onSubmitProposal={handleSubmitProposal}
        existingProposals={proposals}
        currentWard={cycle?.ward || 'Ward 150 - Bellandur'}
        isOffline={!isOnline}
      />

      <AdvisoryVotingModal
        isOpen={votingModalOpen}
        onClose={() => setVotingModalOpen(false)}
        proposal={votingProposal}
        onConfirmVote={handleConfirmVote}
        alreadyVoted={votingProposal ? userVotedIds.has(votingProposal.id) : false}
        currentUser={currentUser}
      />

      <ReviewQueueModal
        isOpen={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        proposal={reviewProposal}
        onSaveDecision={handleSaveDecision}
        allProposals={proposals}
      />
    </div>
  );
}
