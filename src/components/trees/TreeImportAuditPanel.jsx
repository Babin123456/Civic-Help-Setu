import { useState } from 'react';
import {
  AlertTriangle,
  ArrowDownToLine,
  Database,
  FileUp,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import { TreeInlineAlert, TreeStatusBadge } from './TreeInventoryStates';

const fieldStyle = { display: 'grid', gap: '0.3rem', fontSize: '0.82rem', fontWeight: 700 };
const tableWrap = { overflowX: 'auto', border: '1px solid var(--border-main)', borderRadius: '0.7rem' };
const thStyle = { textAlign: 'left', padding: '0.55rem 0.7rem', fontSize: '0.78rem', whiteSpace: 'nowrap' };
const tdStyle = { padding: '0.55rem 0.7rem', fontSize: '0.8rem', verticalAlign: 'top' };

const formatDateTime = (value) => {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? new Date(parsed).toLocaleString('en-IN') : 'Unknown';
};

/**
 * Validated CSV import, schema migration controls, retention policy and the
 * append-only audit trail. Import preview must succeed before it can be
 * applied; the service re-validates every row inside the transaction.
 */
export default function TreeImportAuditPanel({
  audit,
  migration,
  preview,
  onPreview,
  onImport,
  onMigrate,
  onRollback,
  onRetention,
  onRefresh,
  canImport = false,
  canAudit = false,
  canMigrate = false,
  canRetention = false,
}) {
  const [csvText, setCsvText] = useState('');
  const [reason, setReason] = useState('Bulk tree register import from validated municipal CSV');
  const [fileError, setFileError] = useState('');

  const handleFile = (event) => {
    const file = event.target.files?.[0];
    setFileError('');
    if (!file) return;
    if (file.size > 256 * 1024) {
      setFileError('CSV exceeds the 256 KB limit.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setCsvText(reader.result);
    };
    reader.onerror = () => setFileError('The file could not be read. Paste the CSV instead.');
    reader.readAsText(file);
  };

  const chainValid = audit?.chainValid !== false;

  return (
    <section aria-labelledby="tree-import-audit-heading" style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '0.6rem', alignItems: 'center' }}>
        <div>
          <h2 id="tree-import-audit-heading" style={{ margin: 0, fontSize: '1.1rem' }}>
            Import, migration and audit
          </h2>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
            CSV rows are validated against the species catalogue, coordinates, duplicates and jurisdiction before any write.
            Audit events are append-only and hash-chained.
          </p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={onRefresh}>
          <RefreshCw size={14} aria-hidden="true" /> Refresh
        </button>
      </div>

      {canImport && (
        <div style={{ border: '1px solid var(--border-main)', borderRadius: '0.85rem', padding: '0.9rem', display: 'grid', gap: '0.7rem' }}>
          <h3 style={{ margin: 0, fontSize: '0.98rem', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <FileUp size={16} aria-hidden="true" /> Bulk CSV import
          </h3>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Required columns: ward, species_id, condition, latitude, longitude. Optional: public_id, locality, planted_on,
            planting_site_id, notes. Preview first; nothing is written until you apply a valid file.
          </p>
          <label style={fieldStyle}>
            Choose a CSV file
            <input type="file" accept=".csv,text/csv" onChange={handleFile} />
            {fileError && <span style={{ color: 'var(--error, #ef4444)' }}>{fileError}</span>}
          </label>
          <label style={fieldStyle}>
            Or paste CSV text
            <textarea className="form-input" rows={5} value={csvText} onChange={(event) => setCsvText(event.target.value)} />
          </label>
          <label style={fieldStyle}>
            Import reason (recorded in the audit trail)
            <input className="form-input" maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
          </label>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-secondary" onClick={() => onPreview?.(csvText)}>
              <Database size={14} aria-hidden="true" /> Preview validation
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!preview?.canApply || reason.trim().length < 10}
              onClick={() => onImport?.(csvText, reason)}
            >
              <ArrowDownToLine size={14} aria-hidden="true" /> Apply import
            </button>
          </div>

          {preview && (
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              <TreeInlineAlert tone={preview.canApply ? 'success' : 'error'} title={preview.canApply ? 'CSV is valid' : 'CSV has errors and cannot be imported'}>
                {preview.totalRows} data row{preview.totalRows === 1 ? '' : 's'}: {preview.validRows} valid, {preview.invalidRows} invalid,{' '}
                {preview.duplicateRows} duplicate warning{preview.duplicateRows === 1 ? '' : 's'}. Limits: {preview.limits.maxRows} rows /{' '}
                {Math.round(preview.limits.maxBytes / 1024)} KB.
              </TreeInlineAlert>
              {preview.errors.length > 0 && (
                <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.8rem', color: 'var(--error, #ef4444)', maxHeight: '10rem', overflowY: 'auto' }}>
                  {preview.errors.slice(0, 30).map((error, index) => (
                    <li key={`${error.rowNumber}-${index}`}>Row {error.rowNumber} · {error.field}: {error.message}</li>
                  ))}
                </ul>
              )}
              {preview.previewRows.length > 0 && (
                <div style={tableWrap} tabIndex={0} aria-label="CSV preview table">
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '760px' }}>
                    <caption style={{ textAlign: 'left', padding: '0.55rem 0.7rem', fontWeight: 800 }}>Validated preview (first 20 rows)</caption>
                    <thead>
                      <tr style={{ background: 'var(--glass-bg)' }}>
                        {['Row', 'Ward', 'Species', 'Condition', 'Planted', 'Status', 'Messages'].map((header) => (
                          <th key={header} scope="col" style={thStyle}>{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.previewRows.map((row) => (
                        <tr key={row.rowNumber} style={{ borderTop: '1px solid var(--border-light)' }}>
                          <th scope="row" style={tdStyle}>{row.rowNumber}</th>
                          <td style={tdStyle}>{row.ward}</td>
                          <td style={tdStyle}>{row.species || row.speciesId}</td>
                          <td style={tdStyle}>{row.condition}</td>
                          <td style={tdStyle}>{row.plantedOn || 'Not recorded'}</td>
                          <td style={tdStyle}>
                            <TreeStatusBadge tone={row.valid ? 'success' : 'overdue'} label={row.valid ? 'Valid' : 'Invalid'} prefix="Row" />
                          </td>
                          <td style={tdStyle}>{row.messages.join(' ') || 'No issues'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {canMigrate && migration && (
        <div style={{ border: '1px solid var(--border-main)', borderRadius: '0.85rem', padding: '0.9rem', display: 'grid', gap: '0.6rem' }}>
          <h3 style={{ margin: 0, fontSize: '0.98rem', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <Database size={16} aria-hidden="true" /> Schema migration
          </h3>
          <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.6rem', margin: 0, fontSize: '0.82rem' }}>
            <div>
              <dt style={{ fontWeight: 700, color: 'var(--text-tertiary)' }}>Current version</dt>
              <dd style={{ margin: 0 }}>{migration.currentVersion}</dd>
            </div>
            <div>
              <dt style={{ fontWeight: 700, color: 'var(--text-tertiary)' }}>Target version</dt>
              <dd style={{ margin: 0 }}>{migration.targetVersion}</dd>
            </div>
            <div>
              <dt style={{ fontWeight: 700, color: 'var(--text-tertiary)' }}>Backup available</dt>
              <dd style={{ margin: 0 }}>{migration.backupAvailable ? 'Yes — rollback possible' : 'No'}</dd>
            </div>
            <div>
              <dt style={{ fontWeight: 700, color: 'var(--text-tertiary)' }}>Records</dt>
              <dd style={{ margin: 0 }}>
                {migration.counts.trees} trees · {migration.counts.inspections} inspections · {migration.counts.workOrders} orders ·{' '}
                {migration.counts.citizenReports} reports
              </dd>
            </div>
          </dl>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-secondary" onClick={onMigrate} disabled={!migration.needsMigration}>
              Run migration {migration.needsMigration ? '' : '(already current)'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={onRollback} disabled={!migration.backupAvailable}>
              <RotateCcw size={14} aria-hidden="true" /> Roll back to backup
            </button>
            {canRetention && (
              <button type="button" className="btn btn-secondary" onClick={onRetention}>
                Apply 365-day retention policy
              </button>
            )}
          </div>
          <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
            Running a migration writes a pre-migration snapshot to this device first. Rollback restores that snapshot exactly.
          </p>
        </div>
      )}

      {canAudit && (
        <div style={{ display: 'grid', gap: '0.6rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '0.98rem', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <ShieldCheck size={16} aria-hidden="true" /> Append-only audit trail
            </h3>
            <TreeStatusBadge
              tone={chainValid ? 'success' : 'overdue'}
              label={chainValid ? 'Hash chain verified' : 'Hash chain broken'}
              prefix="Audit"
            />
          </div>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {audit?.total || 0} event{(audit?.total || 0) === 1 ? '' : 's'} in this view. Every privileged action carries an actor,
            role, reason and previous-event hash.
          </p>
          {!chainValid && (
            <div role="alert" style={{ display: 'flex', gap: '0.4rem', color: 'var(--error, #ef4444)', fontSize: '0.82rem' }}>
              <AlertTriangle size={15} aria-hidden="true" /> The audit chain does not verify. Stop using this local copy and
              restore from a trusted backup.
            </div>
          )}
          <div style={tableWrap} tabIndex={0} aria-label="Scrollable audit trail table">
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '880px' }}>
              <caption style={{ textAlign: 'left', padding: '0.55rem 0.7rem', fontWeight: 800 }}>Most recent audit events</caption>
              <thead>
                <tr style={{ background: 'var(--glass-bg)' }}>
                  {['When', 'Action', 'Entity', 'Actor / role', 'Reason', 'Hash'].map((header) => (
                    <th key={header} scope="col" style={thStyle}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(audit?.events || []).map((event) => (
                  <tr key={event.id} style={{ borderTop: '1px solid var(--border-light)' }}>
                    <td style={tdStyle}>{formatDateTime(event.createdAt)}</td>
                    <td style={tdStyle}>{event.action}</td>
                    <td style={tdStyle}>{event.entityType}<span style={{ display: 'block', color: 'var(--text-tertiary)' }}>{event.entityId}</span></td>
                    <td style={tdStyle}>{event.actorLabel}<span style={{ display: 'block', color: 'var(--text-tertiary)' }}>{event.actorRole}</span></td>
                    <td style={{ ...tdStyle, maxWidth: '28ch' }}>{event.reason || 'No reason recorded'}</td>
                    <td style={{ ...tdStyle, fontFamily: 'var(--font-mono, monospace)', fontSize: '0.72rem' }}>
                      {String(event.hash || '').slice(0, 12)}…
                      <span style={{ display: 'block', color: 'var(--text-tertiary)' }}>prev {String(event.previousHash || '').slice(0, 8)}…</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(audit?.events || []).length === 0 && (
              <p style={{ margin: 0, padding: '0.7rem', fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>
                No audit events in this jurisdiction yet.
              </p>
            )}
          </div>
        </div>
      )}

      {!canImport && !canAudit && !canMigrate && (
        <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-tertiary)' }}>
          Your role does not include bulk import, migration or audit access. Ask an inventory administrator.
        </p>
      )}
    </section>
  );
}
