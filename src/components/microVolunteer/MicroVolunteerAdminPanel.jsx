import { AlertTriangle, Database, History, RotateCcw, ShieldCheck, Trash2 } from 'lucide-react';
import { MicroVolunteerLoadingButton } from './MicroVolunteerStates.jsx';
import { formatDateTime } from './presentation.js';

export default function MicroVolunteerAdminPanel({
  meta,
  busy,
  error,
  retentionResult,
  onRunRetention,
  onRollbackSeed,
  onResetEmpty,
}) {
  return (
    <section aria-labelledby="mv-admin-heading">
      <h2 id="mv-admin-heading">Board operations</h2>
      <p className="mv-muted">
        These controls change the local board bundle. Every action is documented in
        docs/micro-volunteer-task-board.md, including the rollback steps and retention limits.
      </p>

      {error && (
        <p className="mv-error" role="alert">
          <AlertTriangle size={16} aria-hidden="true" /> {error}
        </p>
      )}

      <div className="mv-detail">
        <div className="mv-card">
          <h3>
            <Database size={17} aria-hidden="true" /> Storage and schema
          </h3>
          <dl className="mv-small" style={{ margin: 0 }}>
            <dt>Storage key</dt>
            <dd style={{ margin: '0 0 0.5rem' }}>{meta?.key || 'civic_micro_volunteer_board_v1'}</dd>
            <dt>Storage mode</dt>
            <dd style={{ margin: '0 0 0.5rem' }}>{meta?.storageMode || 'browser'}</dd>
            <dt>Schema version</dt>
            <dd style={{ margin: '0 0 0.5rem' }}>{meta?.schemaVersion ?? 1}</dd>
            <dt>Ruleset version</dt>
            <dd style={{ margin: '0 0 0.5rem' }}>{meta?.rulesetVersion}</dd>
            <dt>Last saved</dt>
            <dd style={{ margin: '0 0 0.5rem' }}>{formatDateTime(meta?.migration?.lastSavedAt)}</dd>
            <dt>Seeded demo data</dt>
            <dd style={{ margin: 0 }}>{meta?.migration?.seeded ? 'Yes' : 'No'}</dd>
          </dl>
        </div>

        <div className="mv-card">
          <h3>
            <History size={17} aria-hidden="true" /> Migration history
          </h3>
          {meta?.migration?.migrationHistory?.length ? (
            <ul className="mv-small">
              {meta.migration.migrationHistory.map((entry, index) => (
                <li key={`${entry.from}-${entry.to}-${index}`}>
                  v{entry.from} → v{entry.to} ({entry.kind}) at {formatDateTime(entry.appliedAt)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mv-small mv-muted">No migrations have run on this device.</p>
          )}
          {meta?.migration?.warnings?.length > 0 && (
            <div role="status">
              <strong className="mv-small">Migration warnings</strong>
              <ul className="mv-small">
                {meta.migration.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="mv-card" style={{ marginTop: '1rem' }}>
        <h3>
          <ShieldCheck size={17} aria-hidden="true" /> Retention policy
        </h3>
        <p className="mv-small">{meta?.retention?.description}</p>
        <ul className="mv-small">
          <li>Completed tasks archived after {meta?.retention?.taskRetentionDays} days.</li>
          <li>Citizen references and evidence notes redacted after {meta?.retention?.claimRetentionDays} days.</li>
          <li>Withdrawn or expired claims removed after {meta?.retention?.purgeStaleClaimsDays} days.</li>
          <li>Moderation events retained for {meta?.retention?.eventRetentionDays} days.</li>
        </ul>
        <div className="mv-inline-actions">
          <MicroVolunteerLoadingButton
            className="mv-button mv-button-secondary"
            loading={busy}
            onClick={onRunRetention}
          >
            <ShieldCheck size={16} aria-hidden="true" /> Apply retention now
          </MicroVolunteerLoadingButton>
          <MicroVolunteerLoadingButton
            className="mv-button mv-button-secondary"
            loading={busy}
            onClick={onRollbackSeed}
          >
            <RotateCcw size={16} aria-hidden="true" /> Restore reviewed seed
          </MicroVolunteerLoadingButton>
          <MicroVolunteerLoadingButton
            className="mv-button mv-button-danger"
            loading={busy}
            onClick={onResetEmpty}
          >
            <Trash2 size={16} aria-hidden="true" /> Reset to an empty board
          </MicroVolunteerLoadingButton>
        </div>
        {retentionResult && (
          <p className="mv-success" role="status">
            Retention applied: {retentionResult.archivedTasks} archived, {retentionResult.redactedClaims}{' '}
            claims redacted, {retentionResult.redactedSubmissions} submissions redacted,{' '}
            {retentionResult.purgedClaims} stale claims removed, {retentionResult.removedEvents} old events
            removed.
          </p>
        )}
        <p className="mv-help">
          Rollback: restore the reviewed seed for training, or reset to an empty board for a new
          deployment. Both actions replace the whole bundle atomically; export the current bundle first if
          you need to keep it.
        </p>
      </div>
    </section>
  );
}
