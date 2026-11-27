import { useState, useCallback, useMemo } from 'react';
import {
  ClipboardCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  WifiOff,
  Plus,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNetwork } from '../context/NetworkContext';
import { CIVIC_OFFICES } from '../data/locationOffices';
import {
  EXPIRY_POLICY_PRESETS,
  PUBLIC_BADGE_LABELS,
  listLocalCampaigns,
  createLocalCampaign,
  submitLocalEvidence,
  reviewLocalVerification,
} from '../services/officeVerificationCampaignService';

const BADGE_STYLE = {
  VERIFIED_FRESH: { bg: '#dcfce7', color: '#166534' },
  EXPIRING_SOON: { bg: '#fef9c3', color: '#854d0e' },
  STALE_EXPIRED: { bg: '#fee2e2', color: '#991b1b' },
  UNVERIFIED: { bg: '#f1f5f9', color: '#475569' },
};

export default function OfficeVerificationCampaignWorkspace() {
  const { user } = useAuth();
  const { isOnline } = useNetwork();
  const isReviewer = user?.role === 'admin' || user?.role === 'municipal_officer';

  const [campaigns, setCampaigns] = useState(() => {
    try {
      return listLocalCampaigns();
    } catch {
      return [];
    }
  });
  const [title, setTitle] = useState('');
  const [assigneeId, setAssigneeId] = useState('ward-verifier-1');
  const [expiryDays, setExpiryDays] = useState(180);
  const [selectedOfficeIds, setSelectedOfficeIds] = useState(() =>
    CIVIC_OFFICES.slice(0, 2).map((o) => o.id)
  );
  const [evidenceInputs, setEvidenceInputs] = useState({});
  const [errorMsg, setErrorMsg] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const [isLoading] = useState(false);

  const refresh = useCallback(() => {
    try {
      setCampaigns(listLocalCampaigns());
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load verification campaigns.');
    }
  }, []);

  const officeChoices = useMemo(() => CIVIC_OFFICES.slice(0, 6), []);

  const toggleOffice = (id) => {
    setSelectedOfficeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleCreateCampaign = (e) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const created = createLocalCampaign({
        title: title.trim() || 'Quarterly Office Contact Audit',
        assigneeId: assigneeId.trim() || 'ward-verifier-1',
        officeIds: selectedOfficeIds,
        expiryPolicyDays: Number(expiryDays),
      });
      setTitle('');
      refresh();
      setAnnouncement(`Created campaign "${created.title}" with ${created.offices.length} offices.`);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to create campaign.');
    }
  };

  const handleSubmitEvidence = (campaignId, officeId) => {
    setErrorMsg('');
    const inp = evidenceInputs[`${campaignId}:${officeId}`] || {};
    try {
      submitLocalEvidence({
        campaignId,
        officeId,
        sourceUrl: inp.sourceUrl || 'https://edistrict.delhigovt.nic.in',
        effectiveDate: inp.effectiveDate || new Date().toISOString().slice(0, 10),
        notes: inp.notes || 'Confirmed against official portal directory',
        provenanceKind: 'official_record',
      });
      refresh();
      setAnnouncement(`Submitted official-source evidence for ${officeId}.`);
    } catch (err) {
      setErrorMsg(err.message || 'Evidence submission failed.');
    }
  };

  const handleReview = (campaignId, officeId, decision) => {
    setErrorMsg('');
    try {
      reviewLocalVerification({
        campaignId,
        officeId,
        decision,
        reviewerId: user?.id || 'reviewer_local',
        rationale: decision === 'APPROVE' ? 'Official source URL verified' : 'Source URL invalid or outdated',
      });
      refresh();
      setAnnouncement(`Office ${officeId} marked ${decision === 'APPROVE' ? 'VERIFIED' : 'REJECTED'}.`);
    } catch (err) {
      setErrorMsg(err.message || 'Review action failed.');
    }
  };

  return (
    <div className="section" style={{ padding: '1.5rem 1rem', maxWidth: '1150px', margin: '0 auto' }}>
      <div className="sr-only" role="status" aria-live="polite">
        {announcement}
      </div>

      <header style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border-main, #e2e8f0)', paddingBottom: '1rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <ClipboardCheck size={28} color="var(--primary, #2563eb)" aria-hidden="true" />
          Civic Office Contact Verification Campaign Manager
        </h1>
        <p style={{ margin: '0.35rem 0 0', color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
          Assign batches of civic office contact records for periodic verification, attach official-source evidence, enforce expiry policies, and surface public stale badges.
        </p>
      </header>

      {!isOnline && (
        <div
          role="status"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', borderRadius: '0.5rem', background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.4)', marginBottom: '1rem', fontSize: '0.88rem' }}
        >
          <WifiOff size={16} aria-hidden="true" />
          <span>Offline mode: campaign updates are saved locally and queued until reconnection.</span>
        </div>
      )}

      {errorMsg && (
        <div
          role="alert"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', borderRadius: '0.5rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.35)', color: '#b91c1c', marginBottom: '1rem', fontSize: '0.88rem' }}
        >
          <AlertTriangle size={16} aria-hidden="true" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {/* Left: Batch Assignment */}
        <section aria-label="Batch Assignment" style={{ padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid var(--border-main, #e2e8f0)', background: 'var(--bg-card, #fff)' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Plus size={18} aria-hidden="true" />
            Assign Verification Batch
          </h2>
          <form onSubmit={handleCreateCampaign} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div>
              <label htmlFor="camp-title" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                Campaign Title
              </label>
              <input
                id="camp-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Q4 District Collectorate Contact Audit"
                style={{ width: '100%', padding: '0.45rem 0.7rem', borderRadius: '0.4rem', border: '1px solid var(--border-main, #cbd5e1)' }}
              />
            </div>

            <div>
              <label htmlFor="camp-assignee" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                Verification Owner / Assignee
              </label>
              <input
                id="camp-assignee"
                type="text"
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                style={{ width: '100%', padding: '0.45rem 0.7rem', borderRadius: '0.4rem', border: '1px solid var(--border-main, #cbd5e1)' }}
              />
            </div>

            <div>
              <label htmlFor="camp-expiry" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                Expiry Policy
              </label>
              <select
                id="camp-expiry"
                value={expiryDays}
                onChange={(e) => setExpiryDays(Number(e.target.value))}
                style={{ width: '100%', padding: '0.45rem 0.7rem', borderRadius: '0.4rem', border: '1px solid var(--border-main, #cbd5e1)' }}
              >
                {EXPIRY_POLICY_PRESETS.map((p) => (
                  <option key={p.days} value={p.days}>{p.label}</option>
                ))}
              </select>
            </div>

            <div>
              <span style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Select Civic Offices ({selectedOfficeIds.length} selected)
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {officeChoices.map((o) => (
                  <label key={o.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={selectedOfficeIds.includes(o.id)}
                      onChange={() => toggleOffice(o.id)}
                    />
                    <span>{o.name} ({o.state})</span>
                  </label>
                ))}
              </div>
            </div>

            <button
              type="submit"
              style={{ padding: '0.55rem 1rem', borderRadius: '0.5rem', border: 'none', background: 'var(--primary, #2563eb)', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
            >
              Create Verification Campaign
            </button>
          </form>
        </section>

        {/* Right: Active Campaigns & Public Stale Badges */}
        <section aria-label="Verification Campaigns" style={{ padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid var(--border-main, #e2e8f0)', background: 'var(--bg-card, #fff)' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <ShieldCheck size={18} aria-hidden="true" />
            Active Campaigns ({campaigns.length})
          </h2>

          {isLoading ? (
            <p role="status">Loading campaigns...</p>
          ) : campaigns.length === 0 ? (
            <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <Clock size={32} aria-hidden="true" style={{ opacity: 0.5, marginBottom: '0.5rem' }} />
              <p style={{ margin: 0, fontWeight: 600 }}>No Verification Campaigns Yet</p>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem' }}>
                Assign a batch of offices on the left to start tracking official-source evidence and expiry cycles.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {campaigns.map((camp) => (
                <div key={camp.campaignId} style={{ padding: '0.9rem', borderRadius: '0.5rem', border: '1px solid var(--border-light, #e2e8f0)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <strong>{camp.title}</strong>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      Assignee: {camp.assigneeId} &bull; Policy: {camp.expiryPolicyDays}d
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {camp.offices.map((o) => {
                      const badgeStyle = BADGE_STYLE[o.publicBadge] || BADGE_STYLE.UNVERIFIED;
                      const key = `${camp.campaignId}:${o.officeId}`;
                      return (
                        <div key={o.officeId} style={{ padding: '0.65rem', borderRadius: '0.4rem', background: 'rgba(0,0,0,0.02)', fontSize: '0.82rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <strong>{o.officeName || o.officeId}</strong>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '999px', background: badgeStyle.bg, color: badgeStyle.color }}>
                              {PUBLIC_BADGE_LABELS[o.publicBadge] || o.publicBadge}
                            </span>
                          </div>

                          {o.evidence && (
                            <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: '0.3rem' }}>
                              Official Source:{' '}
                              <a href={o.evidence.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary, #2563eb)' }}>
                                {o.evidence.sourceUrl} <ExternalLink size={11} style={{ display: 'inline' }} />
                              </a>{' '}
                              &bull; Effective: {o.evidence.effectiveDate}
                              {o.lastVerifiedAt && ` • Last Verified: ${new Date(o.lastVerifiedAt).toLocaleDateString()}`}
                            </div>
                          )}

                          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.45rem' }}>
                            <input
                              type="url"
                              aria-label={`Official source URL for ${o.officeName || o.officeId}`}
                              placeholder="https://official-portal.gov.in/..."
                              value={evidenceInputs[key]?.sourceUrl || ''}
                              onChange={(e) => setEvidenceInputs((prev) => ({
                                ...prev,
                                [key]: { ...(prev[key] || {}), sourceUrl: e.target.value },
                              }))}
                              style={{ flex: '1 1 180px', padding: '0.25rem 0.5rem', borderRadius: '0.3rem', border: '1px solid var(--border-main, #cbd5e1)', fontSize: '0.76rem' }}
                            />
                            <button
                              type="button"
                              onClick={() => handleSubmitEvidence(camp.campaignId, o.officeId)}
                              style={{ padding: '0.25rem 0.6rem', borderRadius: '0.3rem', border: '1px solid var(--primary, #2563eb)', background: 'transparent', color: 'var(--primary, #2563eb)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                            >
                              Submit Official Evidence
                            </button>
                            {o.evidence && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleReview(camp.campaignId, o.officeId, 'APPROVE')}
                                  disabled={!isReviewer && Boolean(user?.role) && user.role === 'guest'}
                                  style={{ padding: '0.25rem 0.6rem', borderRadius: '0.3rem', border: 'none', background: '#16a34a', color: '#fff', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}
                                >
                                  <CheckCircle2 size={12} aria-hidden="true" /> Approve
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleReview(camp.campaignId, o.officeId, 'REJECT')}
                                  disabled={!isReviewer && Boolean(user?.role) && user.role === 'guest'}
                                  style={{ padding: '0.25rem 0.6rem', borderRadius: '0.3rem', border: 'none', background: '#dc2626', color: '#fff', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                                >
                                  Reject
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
