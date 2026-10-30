import { useState } from 'react';
import {
  MIGRATIONS,
  applyMigration,
  exportCatalogue,
  listSnapshots,
  planMigration,
  rollbackToSnapshot,
} from '../../services/catalogueMigration';

const formatTime = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString();
};

const STATUS_LABEL = { changed: 'Will change', unchanged: 'No change', invalid: 'Skipped (needs a decision)' };

const download = (filename, text) => {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

/** Counts and the records that need attention. Shown for a dry run, so nothing here has been written. */
export const MigrationReport = ({ report }) => {
  const attention = report.records.filter((r) => r.status !== 'unchanged');
  return (
    <div className="cmp-report">
      <dl className="cmp-counts" aria-label="Dry run result">
        <div>
          <dt>Records checked</dt>
          <dd>{report.total}</dd>
        </div>
        <div>
          <dt>Would change</dt>
          <dd>{report.changed}</dd>
        </div>
        <div>
          <dt>Already up to date</dt>
          <dd>{report.unchanged}</dd>
        </div>
        <div>
          <dt>Skipped as invalid</dt>
          <dd>{report.invalid}</dd>
        </div>
      </dl>
      <ul className="cmp-lines">
        {MIGRATIONS.map((m) => (
          <li key={m.id}>
            v{m.version} {m.title}: {report.perMigration[m.id] ?? 0} record{report.perMigration[m.id] === 1 ? '' : 's'}
          </li>
        ))}
      </ul>
      {report.unknownFieldNames.length > 0 && (
        <p className="cmp-hint">
          Fields outside the documented contract are kept exactly as they are: {report.unknownFieldNames.join(', ')}.
        </p>
      )}
      {attention.length === 0 ? (
        <p className="cmp-hint">Nothing to migrate. Every saved record is already in the current format.</p>
      ) : (
        <div className="cmp-table-wrap" role="region" aria-label="Records that would change or be skipped" tabIndex={0}>
          <table className="cmp-table">
            <caption>Records that would change or be skipped</caption>
            <thead>
              <tr>
                <th scope="col">Record</th>
                <th scope="col">Result</th>
                <th scope="col">Details</th>
              </tr>
            </thead>
            <tbody>
              {attention.map((r) => (
                <tr key={`${r.index}:${r.id}`}>
                  <th scope="row">{r.id}</th>
                  <td>{STATUS_LABEL[r.status]}</td>
                  <td>
                    <ul className="cmp-lines">
                      {r.changes.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                      {r.errors.map((e) => (
                        <li key={`${e.migration}:${e.message}`}>
                          {e.migration === '-' ? '' : `${e.migration}: `}
                          {e.message}
                        </li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

/**
 * Admin tab for catalogue data migrations. Nothing runs on its own: a dry run only reads, and applying or
 * rolling back asks for confirmation. Docs: docs/CATALOGUE_MIGRATIONS.md
 */
export default function CatalogueMigrationPanel({ onChanged = () => {} }) {
  const [report, setReport] = useState(null);
  const [snapshots, setSnapshots] = useState(() => {
    try {
      return listSnapshots();
    } catch {
      return [];
    }
  });
  const [confirmApply, setConfirmApply] = useState(false);
  const [confirmRollback, setConfirmRollback] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const run = (fn) => {
    try {
      setError('');
      return fn();
    } catch (err) {
      setError(err.message);
      return null;
    }
  };

  const refreshSnapshots = () => setSnapshots(listSnapshots());

  const doDryRun = () => {
    const result = run(() => planMigration());
    if (!result) return;
    setReport(result);
    setConfirmApply(false);
    setMessage(`Dry run finished. Nothing was changed. ${result.changed} record${result.changed === 1 ? '' : 's'} would change.`);
  };

  const doBackup = () => {
    const text = run(() => exportCatalogue());
    if (text === null) return;
    download(`catalogue-backup-${new Date().toISOString().slice(0, 10)}.json`, text);
    setMessage('Downloaded a copy of the saved catalogue.');
  };

  const doApply = () => {
    const result = run(() => applyMigration({ confirm: true }));
    if (!result) return;
    setConfirmApply(false);
    setReport(null);
    refreshSnapshots();
    onChanged();
    setMessage(
      result.applied
        ? `Migrated ${result.changed} record${result.changed === 1 ? '' : 's'}. ${result.invalid} skipped. Backup ${result.snapshotId} was saved first.`
        : 'Nothing needed to change, so nothing was written.'
    );
  };

  const doRollback = (snapshotId) => {
    const result = run(() => rollbackToSnapshot(snapshotId, { confirm: true }));
    if (!result) return;
    setConfirmRollback(null);
    setReport(null);
    refreshSnapshots();
    onChanged();
    setMessage(`Restored ${result.restored} record${result.restored === 1 ? '' : 's'} from ${result.snapshotId}. The state before the rollback was saved as ${result.previousSnapshotId}.`);
  };

  const doExportSnapshot = (snapshotId) => {
    const text = run(() => exportCatalogue({ snapshotId }));
    if (text !== null) download(`${snapshotId}.json`, text);
  };

  return (
    <section className="cmp" aria-labelledby="cmp-title">
      <h3 id="cmp-title" className="cmp-title">
        Catalogue data migrations
      </h3>
      <p className="cmp-intro">
        Brings saved service guides up to the current record format. It only touches the guides saved in this browser, never
        profiles or the document vault, and never runs by itself. Start with a dry run, which changes nothing.
      </p>

      <ol className="cmp-list" aria-label="Migrations in order">
        {MIGRATIONS.map((m) => (
          <li key={m.id}>
            <strong>
              v{m.version} {m.title}
            </strong>
            : {m.description}
          </li>
        ))}
      </ol>

      <div className="cmp-actions">
        <button type="button" className="btn btn-outline cmp-btn" onClick={doBackup}>
          Download a copy of the catalogue
        </button>
        <button type="button" className="btn btn-primary cmp-btn" onClick={doDryRun}>
          Run dry run
        </button>
      </div>

      <p className="cmp-notice" role="status" aria-live="polite">
        {message}
      </p>
      {error && (
        <p className="cmp-error" role="alert">
          {error}
        </p>
      )}

      {report && (
        <>
          <MigrationReport report={report} />
          {report.changed > 0 && !confirmApply && (
            <button type="button" className="btn btn-primary cmp-btn" onClick={() => setConfirmApply(true)}>
              Apply migration…
            </button>
          )}
          {confirmApply && (
            <div className="cmp-confirm" role="group" aria-label="Confirm migration">
              <p>
                <strong>
                  Change {report.changed} saved record{report.changed === 1 ? '' : 's'}?
                </strong>{' '}
                A backup is saved first and can be restored below. {report.invalid} invalid record{report.invalid === 1 ? ' will be left exactly as it is' : 's will be left exactly as they are'}.
              </p>
              <button type="button" className="btn btn-primary cmp-btn" onClick={doApply}>
                Confirm and apply
              </button>
              <button type="button" className="btn btn-outline cmp-btn" onClick={() => setConfirmApply(false)}>
                Not yet
              </button>
            </div>
          )}
        </>
      )}

      <h4 className="cmp-subhead">Backups</h4>
      {snapshots.length === 0 ? (
        <p className="cmp-hint">No backups yet. One is saved automatically before a migration is applied.</p>
      ) : (
        <ul className="cmp-snapshots">
          {snapshots.map((s) => (
            <li key={s.id} className="cmp-snapshot">
              <div className="cmp-snapshot__main">
                <div className="cmp-snapshot__name">{s.id}</div>
                <div className="cmp-snapshot__meta">
                  {formatTime(s.createdAt)} · {s.count} record{s.count === 1 ? '' : 's'} · {s.reason}
                </div>
              </div>
              <div className="cmp-actions">
                <button type="button" className="btn btn-outline cmp-btn" onClick={() => doExportSnapshot(s.id)} aria-label={`Download backup ${s.id}`}>
                  Download
                </button>
                {confirmRollback === s.id ? (
                  <>
                    <button type="button" className="btn btn-primary cmp-btn" onClick={() => doRollback(s.id)} aria-label={`Confirm rollback to ${s.id}`}>
                      Confirm rollback
                    </button>
                    <button type="button" className="btn btn-outline cmp-btn" onClick={() => setConfirmRollback(null)}>
                      Keep current
                    </button>
                  </>
                ) : (
                  <button type="button" className="btn btn-outline cmp-btn" onClick={() => setConfirmRollback(s.id)} aria-label={`Roll back to ${s.id}`}>
                    Roll back…
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
