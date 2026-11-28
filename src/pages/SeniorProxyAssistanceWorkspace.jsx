import { useState, useEffect, useCallback } from 'react';
import {
  createProxyDelegation,
  approveProxyDelegation,
  revokeProxyDelegation,
  performDelegatedChecklistEdit,
  performDelegatedReminder,
  performDelegatedTrackingUpdate,
  getProxyActivityHistory,
  VALID_PROXY_PERMISSIONS,
} from '../services/seniorProxyAssistanceService.js';

export default function SeniorProxyAssistanceWorkspace({ seniorOwnerId = 'senior-owner-demo' }) {
  const [delegation, setDelegation] = useState(null);
  const [activity, setActivity] = useState([]);
  const [trackingRecord, setTrackingRecord] = useState(null);
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine === false : false
  );

  // Delegation form
  const [proxyActorId, setProxyActorId] = useState('helper-credential-1');
  const [proxyLabel, setProxyLabel] = useState('');
  const [selectedPerms, setSelectedPerms] = useState(['checklist_edit', 'reminders_manage', 'tracking_update']);
  const [expiryHours, setExpiryHours] = useState(24);

  // Proxy action simulation
  const [activeActor, setActiveActor] = useState(seniorOwnerId);
  const [appId, setAppId] = useState('PEN-2026-01');
  const [docLabel, setDocLabel] = useState('Life Certificate Form');
  const [reminderTitle, setReminderTitle] = useState('');
  const [trackStatus, setTrackStatus] = useState('in-progress');

  useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    if (typeof window !== 'undefined') {
      window.addEventListener('online', onOnline);
      window.addEventListener('offline', onOffline);
      return () => {
        window.removeEventListener('online', onOnline);
        window.removeEventListener('offline', onOffline);
      };
    }
    return undefined;
  }, []);

  const refreshHistory = useCallback((delId) => {
    if (!delId) return;
    setLoading(true);
    const res = getProxyActivityHistory({ delegationId: delId, actorId: seniorOwnerId });
    setLoading(false);
    if (res.ok) {
      setActivity(res.entries);
      setDelegation(res.delegation);
    }
  }, [seniorOwnerId]);

  const handleCreateDelegation = (e) => {
    e.preventDefault();
    setError('');
    const expiresAt = new Date(Date.now() + Number(expiryHours || 24) * 3600_000).toISOString();
    const res = createProxyDelegation({
      seniorOwnerId,
      proxyActorId,
      proxyLabel,
      permissions: selectedPerms,
      expiresAt,
      ownerApproved: false,
    });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setDelegation(res.delegation);
    setProxyLabel('');
    refreshHistory(res.delegation.delegationId);
  };

  const handleApprove = () => {
    if (!delegation) return;
    setError('');
    const res = approveProxyDelegation({ delegationId: delegation.delegationId, actorId: activeActor });
    if (!res.ok) {
      setError(res.error);
      refreshHistory(delegation.delegationId);
      return;
    }
    setDelegation(res.delegation);
    refreshHistory(delegation.delegationId);
  };

  const handleRevoke = () => {
    if (!delegation) return;
    setError('');
    const res = revokeProxyDelegation({ delegationId: delegation.delegationId, actorId: activeActor });
    if (!res.ok) {
      setError(res.error);
      refreshHistory(delegation.delegationId);
      return;
    }
    setDelegation(res.delegation);
    refreshHistory(delegation.delegationId);
  };

  const handleChecklistEdit = () => {
    if (!delegation) return;
    setError('');
    const res = performDelegatedChecklistEdit({
      delegationId: delegation.delegationId,
      actorId: activeActor,
      applicationId: appId,
      itemLabel: docLabel,
      checked: true,
      provenance: 'citizen_entered',
    });
    if (!res.ok) setError(res.error);
    refreshHistory(delegation.delegationId);
  };

  const handleAddReminder = (e) => {
    e.preventDefault();
    if (!delegation) return;
    setError('');
    const res = performDelegatedReminder({
      delegationId: delegation.delegationId,
      actorId: activeActor,
      title: reminderTitle,
      dueDate: new Date(Date.now() + 86400_000).toISOString(),
    });
    if (!res.ok) {
      setError(res.error);
      refreshHistory(delegation.delegationId);
      return;
    }
    setReminders((prev) => [...prev, res.reminder]);
    setReminderTitle('');
    refreshHistory(delegation.delegationId);
  };

  const handleTrackingUpdate = () => {
    if (!delegation) return;
    setError('');
    const res = performDelegatedTrackingUpdate({
      delegationId: delegation.delegationId,
      actorId: activeActor,
      applicationId: appId,
      status: trackStatus,
      note: 'Updated via Senior Proxy Workspace',
    });
    if (!res.ok) {
      setError(res.error);
      refreshHistory(delegation.delegationId);
      return;
    }
    setTrackingRecord(res.tracking);
    refreshHistory(delegation.delegationId);
  };

  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '1.5rem' }} aria-label="Senior-Citizen Public Service Proxy Workspace">
      <header style={{ marginBottom: '1.5rem' }}>
        <h1>Senior-Citizen Public Service Proxy &amp; Assistance</h1>
        <p>
          Delegate checklist editing, reminders, and application tracking to a trusted helper using separate credentials,
          owner approval, expiry, and instant revocation. Never enter Aadhaar numbers, PAN, OTPs, or passwords.
        </p>
      </header>

      {isOffline && (
        <div role="status" aria-live="polite" style={{ padding: '0.75rem', background: '#fef3c7', border: '1px solid #f59e0b', marginBottom: '1rem' }}>
          Offline mode: delegations and activity logs are persisted locally.
        </div>
      )}

      {error && (
        <div role="alert" style={{ padding: '0.75rem', background: '#fee2e2', border: '1px solid #ef4444', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {!delegation ? (
        <section aria-label="Create Proxy Delegation">
          <h2>Invite a Trusted Proxy Helper</h2>
          <form onSubmit={handleCreateDelegation} style={{ display: 'grid', gap: '0.75rem', maxWidth: 520 }}>
            <label>
              Proxy Credential ID (separate from owner)
              <input
                type="text"
                value={proxyActorId}
                onChange={(e) => setProxyActorId(e.target.value)}
                required
              />
            </label>
            <label>
              Helper Display Label
              <input
                type="text"
                value={proxyLabel}
                onChange={(e) => setProxyLabel(e.target.value)}
                placeholder="e.g., Son / Community Volunteer"
                required
              />
            </label>
            <label>
              Permission Expiry (hours)
              <input
                type="number"
                min={1}
                max={720}
                value={expiryHours}
                onChange={(e) => setExpiryHours(e.target.value)}
              />
            </label>
            <fieldset>
              <legend>Granular Permissions</legend>
              {VALID_PROXY_PERMISSIONS.map((perm) => (
                <label key={perm} style={{ display: 'block' }}>
                  <input
                    type="checkbox"
                    checked={selectedPerms.includes(perm)}
                    onChange={(e) => {
                      setSelectedPerms((prev) =>
                        e.target.checked ? [...prev, perm] : prev.filter((p) => p !== perm)
                      );
                    }}
                  />{' '}
                  {perm}
                </label>
              ))}
            </fieldset>
            <button type="submit">Create Proxy Delegation</button>
          </form>
        </section>
      ) : (
        <>
          <section aria-label="Delegation Status and Controls" style={{ border: '1px solid #cbd5e1', padding: '1rem', borderRadius: 6, marginBottom: '1rem' }}>
            <h2>
              Delegation for {delegation.proxyLabel} — <span>{delegation.status}</span>
            </h2>
            <p>
              Owner: <code>{delegation.seniorOwnerId}</code> | Separate Proxy Credential: <code>{delegation.proxyActorId}</code> | Expires:{' '}
              {delegation.expiresAt}
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <label>
                Acting As:{' '}
                <select value={activeActor} onChange={(e) => setActiveActor(e.target.value)}>
                  <option value={seniorOwnerId}>Senior Owner ({seniorOwnerId})</option>
                  <option value={delegation.proxyActorId}>Proxy Helper ({delegation.proxyActorId})</option>
                </select>
              </label>
              <button type="button" onClick={handleApprove}>Owner Approve</button>
              <button type="button" onClick={handleRevoke}>Revoke Immediately</button>
            </div>
          </section>

          <section aria-label="Delegated Actions" style={{ display: 'grid', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <h3>1. Checklist Editing (Citizen-Entered Fact)</h3>
              <input aria-label="Application ID" value={appId} onChange={(e) => setAppId(e.target.value)} />{' '}
              <input aria-label="Document Item" value={docLabel} onChange={(e) => setDocLabel(e.target.value)} />{' '}
              <button type="button" onClick={handleChecklistEdit}>Mark Item Ready</button>
            </div>

            <form onSubmit={handleAddReminder}>
              <h3>2. Reminders</h3>
              <input
                aria-label="Reminder Title"
                value={reminderTitle}
                onChange={(e) => setReminderTitle(e.target.value)}
                placeholder="e.g., Pension Life Certificate Renewal"
                required
              />{' '}
              <button type="submit">Schedule Reminder</button>
              {reminders.length > 0 && (
                <ul>
                  {reminders.map((r) => (
                    <li key={r.reminderId}>{r.title} [{r.provenance}]</li>
                  ))}
                </ul>
              )}
            </form>

            <div>
              <h3>3. Application Tracking</h3>
              <select aria-label="Tracking Status" value={trackStatus} onChange={(e) => setTrackStatus(e.target.value)}>
                <option value="submitted">Submitted</option>
                <option value="in-progress">In Progress</option>
                <option value="action-required">Action Required</option>
                <option value="completed">Completed</option>
              </select>{' '}
              <button type="button" onClick={handleTrackingUpdate}>Update Tracking</button>
              {trackingRecord && (
                <p>
                  Status: <strong>{trackingRecord.statusLabel}</strong> | Provenance: {trackingRecord.provenance} | Official Rule:{' '}
                  <strong>{trackingRecord.officialMetadata.verificationStatus}</strong>
                </p>
              )}
            </div>
          </section>

          <section aria-label="Non-PII Activity History">
            <h3>Activity History</h3>
            {loading && <p role="status">Refreshing activity history...</p>}
            {activity.length === 0 ? (
              <p>No activity recorded yet.</p>
            ) : (
              <ul>
                {activity.map((entry) => (
                  <li key={entry.activityId}>
                    <code>{entry.timestamp}</code> — <strong>{entry.action}</strong> ({entry.outcome}) by <code>{entry.actorId}</code>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}
