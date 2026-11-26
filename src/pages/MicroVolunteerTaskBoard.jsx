import { useCallback, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ClipboardList,
  Gavel,
  History,
  ListChecks,
  PlusCircle,
  Settings,
  Sparkles,
  UserRound,
} from 'lucide-react';
import StandardPageHeader from '../components/common/StandardPageHeader';
import { useAuth } from '../context/AuthContext';
import { useNetwork } from '../context/NetworkContext';
import { useToast } from '../context/ToastContext';
import { getCurrentActor } from '../services/accessControl';
import {
  MICRO_VOLUNTEER_ROLE_LABELS,
  hasCapability,
  resolveMicroVolunteerActor,
} from '../services/microVolunteerAccessControl';
import {
  archiveTask,
  buildRecommendationsForActor,
  claimTask,
  createTask,
  decideRecommendation,
  getMicroVolunteerBoardMeta,
  getPublicBoardSummary,
  getPublicTask,
  listAuditEvents,
  listJurisdictions,
  listModerationQueue,
  listMyActivity,
  listPublicCategoriesWithCounts,
  listPublicTasks,
  listTasksForStaff,
  listTaskCategories,
  moderateSubmission,
  publishTask,
  reopenTask,
  runRetentionPolicy,
  submitCompletion,
} from '../services/microVolunteerService';
import {
  resetMicroVolunteerStorageToEmpty,
  rollbackMicroVolunteerStorage,
} from '../services/microVolunteerMigrations';
import { toUserMessage } from '../services/microVolunteerValidation';
import MicroVolunteerTaskCard from '../components/microVolunteer/MicroVolunteerTaskCard';
import MicroVolunteerTaskDetail from '../components/microVolunteer/MicroVolunteerTaskDetail';
import MicroVolunteerEvidenceForm from '../components/microVolunteer/MicroVolunteerEvidenceForm';
import MicroVolunteerModerationPanel from '../components/microVolunteer/MicroVolunteerModerationPanel';
import MicroVolunteerRecommendations from '../components/microVolunteer/MicroVolunteerRecommendations';
import MicroVolunteerTaskForm from '../components/microVolunteer/MicroVolunteerTaskForm';
import MicroVolunteerAdminPanel from '../components/microVolunteer/MicroVolunteerAdminPanel';
import MicroVolunteerAuditPanel from '../components/microVolunteer/MicroVolunteerAuditPanel';
import {
  MicroVolunteerEmptyState,
  MicroVolunteerErrorState,
  MicroVolunteerOfflineBanner,
  MicroVolunteerPermissionDenied,
  MicroVolunteerSkeleton,
  MicroVolunteerStaleNotice,
  MicroVolunteerStatusBadge,
} from '../components/microVolunteer/MicroVolunteerStates';
import {
  CLAIM_STATUS_TONE,
  formatDateTime,
  generateIdempotencyKey,
} from '../components/microVolunteer/presentation';
import '../components/microVolunteer/microVolunteer.css';

const DEFAULT_FILTERS = {
  categoryId: '',
  jurisdictionId: '',
  status: '',
  search: '',
  sort: 'due_date',
  page: 1,
  pageSize: 9,
};

const safe = (work, fallback = null) => {
  try {
    return work();
  } catch (error) {
    return { error: toUserMessage(error), cause: error, ...(fallback || {}) };
  }
};

const isRecent = (value) => {
  if (!value) return false;
  return Date.now() - new Date(value).getTime() < 24 * 60 * 60 * 1000;
};

const TONE_FOR_CLAIM = (status) => CLAIM_STATUS_TONE[status] || 'neutral';

export default function MicroVolunteerTaskBoard() {
  const { user } = useAuth();
  const { isOnline } = useNetwork();
  const { toast } = useToast();

  const actor = user || getCurrentActor();
  const resolvedActor = useMemo(() => resolveMicroVolunteerActor(actor), [actor]);
  const isSignedIn = resolvedActor.authenticated;
  const canClaim = hasCapability('task.claim', actor);
  const canModerate = hasCapability('task.moderate', actor);
  const canCreate = hasCapability('task.create', actor);
  const canAudit = hasCapability('audit.read', actor);
  const canAdmin = hasCapability('retention.run', actor);
  const canRecommend = hasCapability('recommendation.view', actor);

  const [tab, setTab] = useState('browse');
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [selectedTaskRef, setSelectedTaskRef] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [recommendationRun, setRecommendationRun] = useState(null);
  const [retentionResult, setRetentionResult] = useState(null);
  const [reopenReason, setReopenReason] = useState('');
  const [archiveReason, setArchiveReason] = useState('');
  const tabRefs = useRef({});

  const refresh = useCallback(() => setRefreshTick((value) => value + 1), []);

  const tabs = useMemo(() => {
    const items = [{ id: 'browse', label: 'Browse tasks', icon: ClipboardList }];
    if (canClaim) items.push({ id: 'activity', label: 'My activity', icon: UserRound });
    if (canRecommend) items.push({ id: 'recommendations', label: 'Suggestions', icon: Sparkles });
    if (canModerate) items.push({ id: 'moderation', label: 'Moderation queue', icon: Gavel });
    if (canAudit) items.push({ id: 'audit', label: 'Audit trail', icon: History });
    if (canAdmin) items.push({ id: 'manage', label: 'Board operations', icon: Settings });
    return items;
  }, [canClaim, canRecommend, canModerate, canAudit, canAdmin]);

  const activeTab = tabs.some((item) => item.id === tab) ? tab : 'browse';

  const board = useMemo(() => {
    void refreshTick;
    const summary = safe(() => getPublicBoardSummary({ jurisdictionId: filters.jurisdictionId || null }));
    const categories = safe(() => listPublicCategoriesWithCounts());
    const jurisdictions = safe(() => listJurisdictions());
    const page = safe(() => listPublicTasks(filters));
    const meta = safe(() => getMicroVolunteerBoardMeta());
    const error = [summary, categories, jurisdictions, page, meta].find((item) => item?.error)?.error || '';
    return { summary, categories, jurisdictions, page, meta, error };
  }, [filters, refreshTick]);

  const detail = useMemo(() => {
    if (!selectedTaskRef) return null;
    void refreshTick;
    return safe(() => getPublicTask(selectedTaskRef));
  }, [selectedTaskRef, refreshTick]);

  const activity = useMemo(() => {
    if (activeTab !== 'activity' || !canClaim) return null;
    void refreshTick;
    return safe(() => listMyActivity({ actor }));
  }, [activeTab, canClaim, actor, refreshTick]);

  const moderationQueue = useMemo(() => {
    if (activeTab !== 'moderation' || !canModerate) return null;
    void refreshTick;
    return safe(() => listModerationQueue({ pageSize: 20 }, { actor }));
  }, [activeTab, canModerate, actor, refreshTick]);

  const auditEvents = useMemo(() => {
    if (activeTab !== 'audit' || !canAudit) return null;
    void refreshTick;
    return safe(() => listAuditEvents({ pageSize: 25 }, { actor }));
  }, [activeTab, canAudit, actor, refreshTick]);

  const drafts = useMemo(() => {
    if (!canCreate) return null;
    void refreshTick;
    return safe(() => listTasksForStaff({ status: 'draft', pageSize: 20 }, { actor }));
  }, [canCreate, actor, refreshTick]);

  const handleTabKeyDown = (event, index) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    let nextIndex = index;
    if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = tabs.length - 1;
    const next = tabs[nextIndex];
    setTab(next.id);
    tabRefs.current[next.id]?.focus();
  };

  const announce = (message) => {
    setAnnouncement(message);
    if (message) toast?.success?.(message);
  };

  const runAction = async (work, successMessage) => {
    setBusy(true);
    setActionError('');
    try {
      const result = await Promise.resolve().then(work);
      if (successMessage) announce(successMessage);
      refresh();
      return result;
    } catch (error) {
      const message = toUserMessage(error);
      setActionError(message);
      toast?.error?.(message);
      return null;
    } finally {
      setBusy(false);
    }
  };

  const handleClaim = async () => {
    if (!selectedTaskRef) return;
    const result = await runAction(
      () =>
        claimTask(selectedTaskRef, {
          actor,
          idempotencyKey: generateIdempotencyKey('claim'),
        }),
      'Task claimed. Open My activity to submit completion evidence.'
    );
    if (result) {
      setSelectedTaskRef(null);
      setTab(canClaim ? 'activity' : 'browse');
    }
  };

  const handleSubmitEvidence = async (claim, evidence) => {
    const result = await runAction(
      () =>
        submitCompletion(claim.claimPublicRef, evidence, {
          actor,
          idempotencyKey: generateIdempotencyKey('submission'),
        }),
      'Evidence submitted. A moderator will review it.'
    );
    if (result) setTab('activity');
  };

  const handleModerate = async (submissionPublicRef, decision) => {
    await runAction(
      () => moderateSubmission(submissionPublicRef, decision, { actor }),
      `Completion ${decision.decision === 'approve' ? 'approved' : decision.decision === 'reject' ? 'rejected' : 'returned for changes'}.`
    );
  };

  const handleReopenTask = async () => {
    if (!selectedTaskRef) return;
    const result = await runAction(
      () => reopenTask(selectedTaskRef, reopenReason, { actor }),
      'Task reopened. It is visible to contributors again.'
    );
    if (result) setReopenReason('');
  };

  const handleArchiveTask = async () => {
    if (!selectedTaskRef) return;
    const result = await runAction(
      () => archiveTask(selectedTaskRef, archiveReason, { actor }),
      'Task archived. Its history is retained for audit.'
    );
    if (result) {
      setArchiveReason('');
      setSelectedTaskRef(null);
    }
  };

  const handleCreateTask = async (input) => {
    const result = await runAction(
      () => createTask(input, { actor, idempotencyKey: generateIdempotencyKey('task') }),
      input.publish ? 'Task published to the board.' : 'Draft task saved.'
    );
    if (result) setShowCreateForm(false);
  };

  const handlePublishTask = async (taskPublicRef) => {
    await runAction(() => publishTask(taskPublicRef, { actor }), 'Draft task published.');
  };

  const handleGenerateRecommendations = async (preferences) => {
    const result = await runAction(
      () => buildRecommendationsForActor(preferences, { actor }),
      'Suggestions generated from the published ruleset.'
    );
    if (result) setRecommendationRun(result);
  };

  const handleDecideRecommendation = async (runPublicRef, taskPublicRef, decision) => {
    const result = await runAction(
      () => decideRecommendation(runPublicRef, taskPublicRef, decision, { actor }),
      'Your suggestion decision was saved.'
    );
    if (result) setRecommendationRun(result);
  };

  const handleRunRetention = async () => {
    const result = await runAction(
      () => runRetentionPolicy({ actor }),
      'Retention policy applied and recorded in the audit trail.'
    );
    if (result) setRetentionResult(result);
  };

  const handleRollbackSeed = async () => {
    await runAction(() => rollbackMicroVolunteerStorage(), 'Reviewed demo seed restored.');
  };

  const handleResetEmpty = async () => {
    await runAction(() => resetMicroVolunteerStorageToEmpty(), 'Empty board created.');
  };

  const updateFilter = (field, value) => {
    setFilters((current) => ({ ...current, [field]: value, page: field === 'page' ? value : 1 }));
  };

  const pageData = board.page?.items ? board.page : null;
  const summary = board.summary && !board.summary.error ? board.summary : null;
  const categories = board.categories?.error ? listTaskCategories() : board.categories || [];
  const jurisdictions = board.jurisdictions?.error ? [] : board.jurisdictions || [];
  const meta = board.meta && !board.meta.error ? board.meta : null;
  const lastSavedAt = meta?.migration?.lastSavedAt || null;

  return (
    <main className="mv-page">
      <StandardPageHeader
        eyebrow="Neighbourhood contribution"
        eyebrowIcon={<ListChecks size={16} />}
        title="Civic Micro-Volunteer Task Board"
        subtitle="Small, low-risk tasks that help neighbours understand public information. This board is separate from official government service applications and decisions."
        badgeText={`Signed in as ${MICRO_VOLUNTEER_ROLE_LABELS[resolvedActor.role]}`}
        badgeType={isSignedIn ? 'accent' : 'neutral'}
        align="left"
      />

      {!isOnline && <MicroVolunteerOfflineBanner lastSavedAt={lastSavedAt} />}
      {lastSavedAt && !isRecent(lastSavedAt) && (
        <MicroVolunteerStaleNotice lastSavedAt={lastSavedAt} onRefresh={refresh} />
      )}

      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>

      <div className="mv-tabs" role="tablist" aria-label="Micro-volunteer board sections">
        {tabs.map((item, index) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`mv-tab-${item.id}`}
              aria-selected={activeTab === item.id}
              aria-controls={`mv-panel-${item.id}`}
              tabIndex={activeTab === item.id ? 0 : -1}
              className="mv-tab"
              onClick={() => setTab(item.id)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
              ref={(element) => {
                tabRefs.current[item.id] = element;
              }}
            >
              <Icon size={15} aria-hidden="true" /> {item.label}
            </button>
          );
        })}
      </div>

      {actionError && (
        <p className="mv-error" role="alert" style={{ marginBottom: '1rem' }}>
          <AlertTriangle size={16} aria-hidden="true" /> {actionError}
        </p>
      )}

      {activeTab === 'browse' && (
        <section
          id="mv-panel-browse"
          role="tabpanel"
          aria-labelledby="mv-tab-browse"
          tabIndex={-1}
        >
          {board.error ? (
            <MicroVolunteerErrorState message={board.error} onRetry={refresh} />
          ) : !pageData ? (
            <MicroVolunteerSkeleton />
          ) : (
            <>
              {summary && (
                <div className="mv-summary-grid" aria-label="Board summary">
                  {[
                    { label: 'Open tasks', value: summary.totalOpen },
                    { label: 'Open places', value: summary.openPlaces },
                    { label: 'Awaiting moderation', value: summary.totalAwaitingReview },
                    { label: 'Approved contributions', value: summary.totalApprovedContributions },
                  ].map((item) => (
                    <div className="mv-card" key={item.label}>
                      <p className="mv-small mv-muted" style={{ margin: 0 }}>
                        {item.label}
                      </p>
                      <p style={{ fontSize: '1.7rem', fontWeight: 800, margin: '0.2rem 0 0' }}>
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <div className="mv-card" style={{ marginBottom: '1rem' }}>
                <h2 style={{ marginTop: 0, fontSize: '1.1rem' }}>Find a task that fits</h2>
                <div className="mv-filters">
                  <div className="mv-field">
                    <label htmlFor="mv-filter-category">Category</label>
                    <select
                      id="mv-filter-category"
                      className="mv-select"
                      value={filters.categoryId}
                      onChange={(event) => updateFilter('categoryId', event.target.value)}
                    >
                      <option value="">All categories</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.label} ({category.openCount ?? 0} open)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mv-field">
                    <label htmlFor="mv-filter-jurisdiction">Ward or jurisdiction</label>
                    <select
                      id="mv-filter-jurisdiction"
                      className="mv-select"
                      value={filters.jurisdictionId}
                      onChange={(event) => updateFilter('jurisdictionId', event.target.value)}
                    >
                      <option value="">All jurisdictions</option>
                      {jurisdictions.map((code) => (
                        <option key={code} value={code}>
                          {code}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mv-field">
                    <label htmlFor="mv-filter-status">Status</label>
                    <select
                      id="mv-filter-status"
                      className="mv-select"
                      value={filters.status}
                      onChange={(event) => updateFilter('status', event.target.value)}
                    >
                      <option value="">Any public status</option>
                      <option value="open">Open for claims</option>
                      <option value="assigned">Claimed</option>
                      <option value="awaiting_review">Awaiting review</option>
                      <option value="completed">Completed</option>
                      <option value="reopened">Reopened</option>
                    </select>
                  </div>
                  <div className="mv-field">
                    <label htmlFor="mv-filter-search">Search</label>
                    <input
                      id="mv-filter-search"
                      className="mv-input"
                      type="search"
                      value={filters.search}
                      onChange={(event) => updateFilter('search', event.target.value)}
                      placeholder="Title, locality or source"
                    />
                  </div>
                  <div className="mv-field">
                    <label htmlFor="mv-filter-sort">Sort by</label>
                    <select
                      id="mv-filter-sort"
                      className="mv-select"
                      value={filters.sort}
                      onChange={(event) => updateFilter('sort', event.target.value)}
                    >
                      <option value="due_date">Due date</option>
                      <option value="created_at">Newest first</option>
                      <option value="updated_at">Recently updated</option>
                    </select>
                  </div>
                </div>

                <div className="mv-inline-actions" style={{ justifyContent: 'space-between' }}>
                  <span className="mv-small mv-muted">
                    {pageData.pagination.total} task{pageData.pagination.total === 1 ? '' : 's'} match
                    your filters. Page {pageData.pagination.page} of {pageData.pagination.totalPages}.
                  </span>
                  {canCreate && (
                    <button
                      type="button"
                      className="mv-button mv-button-secondary"
                      onClick={() => setShowCreateForm((value) => !value)}
                    >
                      <PlusCircle size={16} aria-hidden="true" />
                      {showCreateForm ? 'Close task form' : 'Publish a task'}
                    </button>
                  )}
                </div>
              </div>

              {showCreateForm && canCreate && (
                <div style={{ marginBottom: '1rem' }}>
                  <MicroVolunteerTaskForm
                    onCreate={handleCreateTask}
                    busy={busy}
                    error={actionError}
                  />
                </div>
              )}

              {canCreate && drafts && !drafts.error && drafts.items.length > 0 && (
                <section className="mv-card" style={{ marginBottom: '1rem' }} aria-labelledby="mv-drafts-heading">
                  <h2 id="mv-drafts-heading" style={{ marginTop: 0, fontSize: '1.05rem' }}>
                    Draft tasks
                  </h2>
                  <p className="mv-small mv-muted">
                    Drafts are hidden from citizens. Publish when the instructions, evidence requirements
                    and safety note have been reviewed.
                  </p>
                  <ul className="mv-list" style={{ listStyle: 'none', padding: 0 }}>
                    {drafts.items.map((draft) => (
                      <li
                        key={draft.publicRef}
                        className="mv-inline-actions"
                        style={{ justifyContent: 'space-between', borderBottom: '1px solid var(--border-main)', paddingBottom: '0.5rem' }}
                      >
                        <span>
                          <strong>{draft.title}</strong>{' '}
                          <span className="mv-small mv-muted">
                            {draft.publicRef} · {draft.jurisdictionId}
                          </span>
                        </span>
                        <button
                          type="button"
                          className="mv-button mv-button-secondary"
                          onClick={() => handlePublishTask(draft.publicRef)}
                          disabled={busy}
                        >
                          Publish draft
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {selectedTaskRef && detail ? (
                detail.error ? (
                  <MicroVolunteerErrorState
                    title="This task could not be opened"
                    message={detail.error}
                    onRetry={refresh}
                  />
                ) : (
                  <div className="mv-detail">
                    <MicroVolunteerTaskDetail
                      task={detail.task}
                      approvedOutcomes={detail.approvedOutcomes}
                      canClaim={canClaim}
                      isSignedIn={isSignedIn}
                      busy={busy}
                      error={actionError}
                      onClaim={handleClaim}
                      onBack={() => setSelectedTaskRef(null)}
                    />
                    <aside className="mv-list">
                      <div className="mv-card">
                        <h3>Your role on this board</h3>
                        <p className="mv-small">
                          {MICRO_VOLUNTEER_ROLE_LABELS[resolvedActor.role]}.{' '}
                          {isSignedIn
                            ? 'Your role and jurisdiction are checked again when you claim or submit.'
                            : 'Sign in to claim tasks. Public browsing does not need an account.'}
                        </p>
                        <p className="mv-small mv-muted">
                          Public reference {detail.task.publicRef}. Only approved outcomes and aggregate
                          counts are public; account identifiers, internal record ids and private
                          moderation notes are never shown here.
                        </p>
                      </div>

                      {canModerate &&
                        ['completed', 'awaiting_review', 'assigned', 'reopened'].includes(detail.task.status) && (
                          <div className="mv-card">
                            <h3>Reopen this task</h3>
                            <p className="mv-small mv-muted">
                              Reopening keeps the audit history and lets contributors submit a new
                              completion. A reason is required.
                            </p>
                            <div className="mv-field">
                              <label htmlFor="mv-reopen-reason">Reason</label>
                              <textarea
                                id="mv-reopen-reason"
                                className="mv-textarea"
                                value={reopenReason}
                                onChange={(event) => setReopenReason(event.target.value)}
                              />
                            </div>
                            <button
                              type="button"
                              className="mv-button mv-button-secondary"
                              onClick={handleReopenTask}
                              disabled={busy || reopenReason.trim().length < 5}
                            >
                              Reopen task
                            </button>
                          </div>
                        )}

                      {canAdmin && detail.task.status !== 'archived' && (
                        <div className="mv-card">
                          <h3>Archive this task</h3>
                          <p className="mv-small mv-muted">
                            Archiving hides the task from citizens and keeps every moderation event.
                          </p>
                          <div className="mv-field">
                            <label htmlFor="mv-archive-reason">Reason</label>
                            <textarea
                              id="mv-archive-reason"
                              className="mv-textarea"
                              value={archiveReason}
                              onChange={(event) => setArchiveReason(event.target.value)}
                            />
                          </div>
                          <button
                            type="button"
                            className="mv-button mv-button-danger"
                            onClick={handleArchiveTask}
                            disabled={busy || archiveReason.trim().length < 5}
                          >
                            Archive task
                          </button>
                        </div>
                      )}
                    </aside>
                  </div>
                )
              ) : pageData.items.length === 0 ? (
                <MicroVolunteerEmptyState
                  title="No tasks match these filters"
                  description="Try another ward, category or status. New tasks appear here after a ward operator publishes them."
                />
              ) : (
                <div className="mv-task-grid">
                  {pageData.items.map((task) => (
                    <MicroVolunteerTaskCard
                      key={task.publicRef}
                      task={task}
                      selected={selectedTaskRef === task.publicRef}
                      onSelect={setSelectedTaskRef}
                    />
                  ))}
                </div>
              )}

              {pageData.pagination.totalPages > 1 && (
                <nav className="mv-inline-actions" aria-label="Task pages" style={{ marginTop: '1rem' }}>
                  <button
                    type="button"
                    className="mv-button mv-button-secondary"
                    onClick={() => updateFilter('page', Math.max(1, pageData.pagination.page - 1))}
                    disabled={pageData.pagination.page <= 1}
                  >
                    Previous page
                  </button>
                  <span className="mv-small mv-muted">
                    Page {pageData.pagination.page} of {pageData.pagination.totalPages}
                  </span>
                  <button
                    type="button"
                    className="mv-button mv-button-secondary"
                    onClick={() => updateFilter('page', pageData.pagination.page + 1)}
                    disabled={!pageData.pagination.hasNext}
                  >
                    Next page
                  </button>
                </nav>
              )}
            </>
          )}
        </section>
      )}

      {activeTab === 'activity' && (
        <section id="mv-panel-activity" role="tabpanel" aria-labelledby="mv-tab-activity" tabIndex={-1}>
          {!canClaim ? (
            <MicroVolunteerPermissionDenied action="My activity" />
          ) : activity?.error ? (
            <MicroVolunteerErrorState message={activity.error} onRetry={refresh} />
          ) : !activity ? (
            <MicroVolunteerSkeleton count={2} />
          ) : activity.claims.length === 0 ? (
            <MicroVolunteerEmptyState
              title="You have not claimed a task yet"
              description="Browse the board and claim a task that fits your time and ward. Your claims and moderation outcomes appear here."
            />
          ) : (
            <div className="mv-list">
              <h2>My activity</h2>
              {activity.claims.map((claim) => (
                <article className="mv-card" key={claim.claimPublicRef}>
                  <div className="mv-inline-actions" style={{ justifyContent: 'space-between' }}>
                    <MicroVolunteerStatusBadge
                      status={claim.status}
                      label={claim.statusLabel}
                      tone={TONE_FOR_CLAIM(claim.status)}
                    />
                    <span className="mv-small mv-muted">{claim.claimPublicRef}</span>
                  </div>
                  <h3>{claim.task?.title || claim.taskPublicRef}</h3>
                  <p className="mv-small mv-muted">
                    {claim.task?.categoryLabel} · {claim.jurisdictionId} · due{' '}
                    {claim.task?.dueDate || 'not recorded'} · claimed {formatDateTime(claim.createdAt)}
                  </p>
                  {claim.submission && (
                    <p className="mv-small">
                      Latest evidence: {claim.submission.statusLabel}
                      {claim.submission.publicOutcomeNote
                        ? ` — ${claim.submission.publicOutcomeNote}`
                        : ''}
                    </p>
                  )}
                  {['active', 'changes_requested', 'reopened'].includes(claim.status) && (
                    <MicroVolunteerEvidenceForm
                      claim={claim}
                      busy={busy}
                      onSubmit={(evidence) => handleSubmitEvidence(claim, evidence)}
                    />
                  )}
                </article>
              ))}
              <div className="mv-card">
                <h3>Moderation outcomes</h3>
                {activity.submissions.length === 0 ? (
                  <p className="mv-small mv-muted">No completion evidence submitted yet.</p>
                ) : (
                  <ul className="mv-small">
                    {activity.submissions.map((submission) => (
                      <li key={submission.submissionPublicRef}>
                        {submission.taskPublicRef}: {submission.statusLabel} ·{' '}
                        {formatDateTime(submission.submittedAt)}
                        {submission.moderationReason ? ` — ${submission.moderationReason}` : ''}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {activeTab === 'recommendations' && (
        <section
          id="mv-panel-recommendations"
          role="tabpanel"
          aria-labelledby="mv-tab-recommendations"
          tabIndex={-1}
        >
          {!canRecommend ? (
            <MicroVolunteerPermissionDenied action="suggestions" />
          ) : (
            <MicroVolunteerRecommendations
              categories={categories}
              jurisdictions={jurisdictions}
              run={recommendationRun}
              busy={busy}
              error={actionError}
              onGenerate={handleGenerateRecommendations}
              onDecide={handleDecideRecommendation}
            />
          )}
        </section>
      )}

      {activeTab === 'moderation' && (
        <section id="mv-panel-moderation" role="tabpanel" aria-labelledby="mv-tab-moderation" tabIndex={-1}>
          {!canModerate ? (
            <MicroVolunteerPermissionDenied action="the moderation queue" />
          ) : moderationQueue?.error ? (
            <MicroVolunteerErrorState message={moderationQueue.error} onRetry={refresh} />
          ) : !moderationQueue ? (
            <MicroVolunteerSkeleton count={2} />
          ) : (
            <MicroVolunteerModerationPanel
              queue={moderationQueue}
              busy={busy}
              error={actionError}
              onDecide={handleModerate}
            />
          )}
        </section>
      )}

      {activeTab === 'audit' && (
        <section id="mv-panel-audit" role="tabpanel" aria-labelledby="mv-tab-audit" tabIndex={-1}>
          {!canAudit ? (
            <MicroVolunteerPermissionDenied action="the audit trail" />
          ) : auditEvents?.error ? (
            <MicroVolunteerErrorState message={auditEvents.error} onRetry={refresh} />
          ) : !auditEvents ? (
            <MicroVolunteerSkeleton count={2} />
          ) : (
            <MicroVolunteerAuditPanel events={auditEvents} error={actionError} />
          )}
        </section>
      )}

      {activeTab === 'manage' && (
        <section id="mv-panel-manage" role="tabpanel" aria-labelledby="mv-tab-manage" tabIndex={-1}>
          {!canAdmin ? (
            <MicroVolunteerPermissionDenied action="board operations" />
          ) : (
            <MicroVolunteerAdminPanel
              meta={meta}
              busy={busy}
              error={actionError}
              retentionResult={retentionResult}
              onRunRetention={handleRunRetention}
              onRollbackSeed={handleRollbackSeed}
              onResetEmpty={handleResetEmpty}
            />
          )}
        </section>
      )}

      {canCreate && !showCreateForm && (
        <section className="mv-card" style={{ marginTop: '1.5rem' }} aria-labelledby="mv-operator-note">
          <h2 id="mv-operator-note" style={{ marginTop: 0, fontSize: '1.05rem' }}>
            Operator note
          </h2>
          <p className="mv-small mv-muted" style={{ margin: 0 }}>
            You can publish tasks from the Browse tab. Drafts are hidden from citizens until published.
            Archive instead of deleting so the audit trail remains complete. There is no public ranking
            of volunteers.
          </p>
        </section>
      )}

      <p className="mv-small mv-muted" style={{ marginTop: '1.5rem' }}>
        Board schema v{meta?.schemaVersion ?? 1} · ruleset {meta?.rulesetVersion || 'micro-volunteer-match-2026.1'} ·
        data stays on this device unless a deployment configures the server API. Need help? Read
        docs/micro-volunteer-task-board.md.
      </p>
    </main>
  );
}
