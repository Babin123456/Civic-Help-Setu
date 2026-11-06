import { useState } from 'react';
import { Upload, Download, X } from 'lucide-react';
import {
  buildImportPreview,
  csvTemplate,
  MAX_IMPORT_BYTES,
  MAX_IMPORT_ROWS,
} from '../../services/serviceImportService';
import { importAdminServices } from '../../services/adminService';
import ImportReviewTable from './ImportReviewTable';

const ServiceImportPanel = ({ existingServices, actorName, onImported, onClose }) => {
  const [fileName, setFileName] = useState('');
  const [report, setReport] = useState(null);
  const [readError, setReadError] = useState('');

  const reset = () => {
    setFileName('');
    setReport(null);
    setReadError('');
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    reset();
    setFileName(file.name);
    if (!file.size) {
      setReadError(`"${file.name}" is empty. Choose a file with content.`);
      return;
    }
    if (file.size > MAX_IMPORT_BYTES) {
      setReadError(`"${file.name}" is larger than ${MAX_IMPORT_BYTES / 1024} KB. Split it into smaller files.`);
      return;
    }
    const idx = file.name.lastIndexOf('.');
    const ext = idx === -1 ? '' : file.name.slice(idx + 1).toLowerCase();
    if (!['csv', 'json'].includes(ext)) {
      setReadError(`Unsupported file format (.${ext || 'unknown'}). Only CSV and JSON files are allowed.`);
      return;
    }
    const mime = (file.type || '').split(';')[0].trim().toLowerCase();
    if (mime) {
      const csvMimes = ['text/csv', 'application/csv', 'text/plain'];
      const jsonMimes = ['application/json', 'text/plain'];
      if (ext === 'csv' && !csvMimes.includes(mime)) {
        setReadError(`The file extension (.csv) does not match its content type (${file.type}).`);
        return;
      }
      if (ext === 'json' && !jsonMimes.includes(mime)) {
        setReadError(`The file extension (.json) does not match its content type (${file.type}).`);
        return;
      }
    }
    try {
      const text = await file.text();
      setReport(buildImportPreview(text, { fileName: file.name, existingServices }));
    } catch (err) {
      setReadError(`Could not read "${file.name}": ${err.message}`);
    }
  };

  const handleDownloadTemplate = () => {
    const blob = new Blob([csvTemplate()], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'service-import-template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleConfirm = () => {
    if (!report?.valid.length) return;
    const result = importAdminServices(
      report.valid.map((v) => v.service),
      actorName,
    );
    onImported(result);
    if (result.ok) reset();
  };

  const validCount = report?.valid.length || 0;

  return (
    <div className="glass-panel animate-fade-in" style={{ padding: '1.25rem', borderRadius: '0.85rem', marginBottom: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
        <div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: '800', margin: 0 }}>Import services from CSV or JSON</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.35rem 0 0' }}>
            Records are checked before anything is saved. Up to {MAX_IMPORT_ROWS} records per file. In CSV, separate
            list values (eligibility, documents, warnings) with <code>|</code>. Steps can only be imported from JSON.
            Imported official sources are saved as unverified until an admin reviews the service.
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close import panel" style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
          <X size={18} />
        </button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '1rem', alignItems: 'center' }}>
        <label className="btn btn-primary" style={{ fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
          <Upload size={16} /> Choose file
          <input type="file" accept=".csv,.json,text/csv,application/json" onChange={handleFile} aria-describedby="import-file-hint" style={{ display: 'none' }} />
        </label>
        <button type="button" className="btn btn-secondary" onClick={handleDownloadTemplate} style={{ fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          <Download size={16} /> Download CSV template
        </button>
        {fileName && <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{fileName}</span>}
      </div>
      <p id="import-file-hint" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0.5rem 0 0' }}>
        Allowed formats: CSV or JSON, up to {MAX_IMPORT_BYTES / 1024} KB.
      </p>

      <div aria-live="polite">
        {readError && <p role="alert" style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '1rem' }}>{readError}</p>}

        {report?.fileErrors.length > 0 && (
          <div role="alert" style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '1rem' }}>
            {report.fileErrors.map((msg) => <p key={msg} style={{ margin: '0.2rem 0' }}>{msg}</p>)}
          </div>
        )}

        {report && report.fileErrors.length === 0 && (
          <p style={{ fontSize: '0.85rem', fontWeight: '600', marginTop: '1rem' }}>
            {report.total} record{report.total === 1 ? '' : 's'} found: {validCount} ready to import,{' '}
            {report.invalid.length} with errors, {report.duplicates.length} duplicate{report.duplicates.length === 1 ? '' : 's'}.
          </p>
        )}
      </div>

      {report?.warnings.length > 0 && (
        <ul style={{ fontSize: '0.8rem', color: '#f59e0b', margin: '0.5rem 0 0', paddingLeft: '1.1rem' }}>
          {report.warnings.map((w) => <li key={w}>{w}</li>)}
        </ul>
      )}

      {report && report.fileErrors.length === 0 && <ImportReviewTable report={report} />}

      {report && report.fileErrors.length === 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
          <button type="button" className="btn btn-secondary" onClick={reset} style={{ fontSize: '0.85rem' }}>
            Clear
          </button>
          <button type="button" className="btn btn-primary" onClick={handleConfirm} disabled={!validCount} style={{ fontSize: '0.85rem' }}>
            {validCount ? `Import ${validCount} service${validCount === 1 ? '' : 's'}` : 'Nothing to import'}
          </button>
        </div>
      )}
    </div>
  );
};

export default ServiceImportPanel;
