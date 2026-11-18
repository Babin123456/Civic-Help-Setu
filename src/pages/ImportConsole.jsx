import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Upload,
  Download,
  X,
  CheckCircle2,
  AlertTriangle,
  Copy,
  RefreshCw,
  History,
  ShieldCheck,
  Shield,
  Trash2,
  ArrowCurveLeft,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import importBatchService from '../services/importBatchService';
import importValidationService from '../services/importValidationService';
import importRollbackService from '../services/importRollbackService';
import { SERVICE_CATEGORIES, DELIVERY_TYPES, DIFFICULTIES, FEE_TYPES } from '../data/importContract';
import { buildImportPreview, csvTemplate } from '../services/importValidationService';
import ConfirmationDialog from '../components/common/ConfirmationDialog';

const IMPORT_BATCH_STATUS = {
  DRAFT: 'draft',
  UPLOADED: 'uploaded',
  PREVIEW_READY: 'preview_ready',
  VALIDATING: 'validating',
  VALIDATED: 'validated',
  APPROVED: 'approved',
  ROLLED_BACK: 'rolled_back',
  FAILED: 'failed',
  ARCHIVED: 'archived',
};

const STATUS_LABELS = {
  [IMPORT_BATCH_STATUS.DRAFT]: { label: 'Draft', class: 'bg-gray-100 text-gray-800' },
  [IMPORT_BATCH_STATUS.UPLOADED]: { label: 'Uploaded', class: 'bg-blue-100 text-blue-800' },
  [IMPORT_BATCH_STATUS.PREVIEW_READY]: { label: 'Preview Ready', class: 'bg-purple-100 text-purple-800' },
  [IMPORT_BATCH_STATUS.VALIDATING]: { label: 'Validating', class: 'bg-yellow-100 text-yellow-800' },
  [IMPORT_BATCH_STATUS.VALIDATED]: { label: 'Validated', class: 'bg-green-100 text-green-800' },
  [IMPORT_BATCH_STATUS.APPROVED]: { label: 'Approved', class: 'bg-green-500 text-white' },
  [IMPORT_BATCH_STATUS.ROLLED_BACK]: { label: 'Rolled Back', class: 'bg-red-500 text-white' },
  [IMPORT_BATCH_STATUS.FAILED]: { label: 'Failed', class: 'bg-red-100 text-red-800' },
  [IMPORT_BATCH_STATUS.ARCHIVED]: { label: 'Archived', class: 'bg-gray-500 text-gray-300' },
};

const VALIDATION_STATUS = {
  VALID: 'valid',
  INVALID: 'invalid',
  DUPLICATE: 'duplicate',
};

const IMPORTER_ROLES = {
  ADMIN: 'admin',
  CITIZEN: 'citizen',
};

ImportConsole.displayName = 'ImportConsole';

const ImportConsole = () => {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  // State for upload phase
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploadStatus, setUploadStatus] = useState('ready'); // ready, parsing, previewing, validated, failed
  const [uploadError, setUploadError] = useState('');

  // State for preview phase
  const [showPreview, setShowPreview] = useState(false);
  const [previewReport, setPreviewReport] = useState(null);
  const [focusField, setFocusField] = useState('');

  // State for import execution
  const [executeImport, setExecuteImport] = useState(false);
  const [importInProgress, setImportInProgress] = useState(false);

  // State for batch list
  const [batches, setBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [loadingBatches, setLoadingBatches] = useState(true);

  // State for rollback
  const [showRollback, setShowRollback] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState(null);

  // Load batches on mount
  useEffect(() => {
    setLoadingBatches(true);
    importBatchService.listBatches().then((batches) => {
      setBatches(batches);
      setLoadingBatches(false);
    });
  }, []);

  // Computed batch status label
  const batchStatusLabel = useMemo(
    () => (batchId) => {
      const batch = batches.find((b) => b.id === batchId);
      return batch ? STATUS_LABELS[batch.status] || STATUS_LABELS['draft'] : STATUS_LABELS['draft'];
    },
    [batches]
  );

  // Compute stats
  const stats = useMemo(() => {
    const total = batches.length;
    const approved = batches.filter((b) => b.status === IMPORT_BATCH_STATUS.APPROVED).length;
    const failed = batches.filter((b) => b.status === IMPORT_BATCH_STATUS.FAILED).length;
    const rolledBack = batches.filter((b) => b.status === IMPORT_BATCH_STATUS.ROLLED_BACK).length;
    const totalRows = batches.reduce((sum, b) => sum + (b.totalRows || 0), 0);
    const validRows = batches.reduce((sum, b) => sum + (b.validRows || 0), 0);
    const invalidRows = batches.reduce((sum, b) => sum + (b.invalidRows || 0), 0);
    const duplicateRows = batches.reduce((sum, b) => sum + (b.duplicateRows || 0), 0);

    return { total, approved, failed, rolledBack, totalRows, validRows, invalidRows, duplicateRows };
  }, [batches]);

  // Upload file handler
  const handleUploadFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadFileName(file.name);
    setUploadStatus('parsing');
    setUploadError('');

    try {
      const text = await file.text();
      const format = importValidationService.detectImportFormat(file.name, text);

      // Build preview
      const preview = importValidationService.buildImportPreview(text, { fileName: file.name });

      if (preview.fileErrors.length > 0) {
        setUploadStatus('failed');
        setUploadError(preview.fileErrors[0]);
        toast?.error?.(preview.fileErrors[0]);
        return;
      }

      if (preview.total === 0) {
        setUploadStatus('failed');
        setUploadError('No service records found in the file');
        toast?.error('No service records found in the file');
        return;
      }

      if (preview.total > 500) {
        setUploadStatus('failed');
        setUploadError(`File has ${preview.total} records; limit is 500 per import`);
        toast?.error(`File has ${preview.total} records; limit is 500 per import`);
        return;
      }

      setPreviewReport(preview);
      setUploadStatus('previewing');
    } catch (err) {
      setUploadStatus('failed');
      const message = err.message || 'Failed to read file';
      setUploadError(message);
      toast?.error(message);
    }
  };

  // Preview confirm - execute import
  const handleExecuteImport = () => {
    if (!previewReport || !selectedBatch) return;

    setImportInProgress(true);
    const result = importValidationService.executeImport(previewReport, selectedBatch.id);

    setImportInProgress(false);

    if (result.ok) {
      setShowPreview(false);
      setShowUpload(false);
      setPreviewReport(null);
      setSelectedBatch(null);
      setUploadFileName('');
      setUploadStatus('ready');
      setUploadError('');

      toast?.success?.(
        `${result.imported} service${result.imported === 1 ? '' : 's'} imported. ${result.invalid} with errors, ${result.duplicates} duplicate${result.duplicates === 1 ? '' : 's'}`
      );

      // Refresh batches
      importBatchService.listBatches().then((batches) => setBatches(batches));
    } else {
      toast?.error?.(result.error || 'Import failed');
    }
  };

  // Preview cancel
  const handlePreviewCancel = () => {
    setShowPreview(false);
    setPreviewReport(null);
    setUploadStatus('ready');
    setUploadError('');
    setUploadFileName('');
  };

  // Approve batch
  const handleApproveBatch = () => {
    if (!selectedBatch) return;

    importBatchService
      .updateBatchStatus(selectedBatch.id, IMPORT_BATCH_STATUS.APPROVED, {
        approvalEvent: {
          action: 'approved',
          batchId: selectedBatch.id,
          notes: `Batch approved by ${actorLabel(user)}`,
          actor: actorLabel(user) || 'Admin',
        },
      })
      .then((result) => {
        if (result.ok) {
          toast?.success?.('Import batch approved successfully');
          setSelectedBatch(null);
          importBatchService.listBatches().then((batches) => setBatches(batches));
        } else {
          toast?.error?.(result.error || 'Failed to approve batch');
        }
      });
  };

  // Rollback batch
  const handleRollbackBatch = () => {
    if (!selectedBatch || !selectedSnapshot) return;

    importRollbackService
      .rollbackToSnapshot(selectedSnapshot.id)
      .then((result) => {
        if (result.ok) {
          toast?.success?.(
            `Batch ${selectedBatch.id} rolled back to snapshot "${selectedSnapshot.title}"`
          );
          setShowRollback(false);
          setSelectedSnapshot(null);
          importBatchService.listBatches().then((batches) => setBatches(batches));
        } else {
          toast?.error?.(result.error || 'Rollback failed');
        }
      });
  };

  // Create rollback snapshot
  const handleCreateSnapshot = () => {
    if (!selectedBatch) return;

    importBatchService
      .createRollbackSnapshot({
        batchId: selectedBatch.id,
        snapshotType: 'post_validation',
        title: `Snapshot before ${new Date().toLocaleDateString()}`,
        description: `Automated snapshot taken before modification. ${selectedBatch.validRows || 0} valid rows, ${selectedBatch.invalidRows || 0} invalid rows`,
        rowCount: selectedBatch.validRows + (selectedBatch.invalidRows || 0),
        fieldMappings: selectedBatch.fieldMappings || [],
      })
      .then((result) => {
        if (result.ok) {
          toast?.success?.('Rollback snapshot created successfully');
          importBatchService.listBatches().then((batches) => setBatches(batches));
        } else {
          toast?.error?.(result.error || 'Failed to create snapshot');
        }
      });
  };

  // Delete batch
  const handleDeleteBatch = (batchId) => {
    setSelectedBatch({ id: batchId, title: 'Import Batch' });
    setShowRollback(true);
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Batch row count display
  const getRowStatusText = (batch) => {
    const valid = batch.validRows || 0;
    const invalid = batch.invalidRows || 0;
    const duplicate = batch.duplicateRows || 0;
    const total = batch.totalRows || 0;

    if (total === 0) return 'No rows';
    if (valid > 0 && invalid === 0 && duplicate === 0) return `${valid} valid row${valid !== 1 ? 's' : ''}`;
    if (valid > 0) return `${valid} valid, ${invalid} invalid${invalid !== 1 ? 's' : ''}, ${duplicate} duplicate${duplicate !== 1 ? 's' : ''} ${total} total`;
    return `${invalid} invalid${invalid !== 1 ? 's' : ''}, ${duplicate} duplicate${duplicate !== 1 ? 's' : ''} ${total} total`;
  };

  // Allowed transitions for current status
  const allowedTransitions = useMemo(() => {
    const batch = batches.find((b) => b.id === selectedBatch?.id);
    if (!batch) return {};
    const transitions = importBatchService.getBatch ? importBatchService.getBatch(selectedBatch.id) : null;
    // Simple transition map based on status
    const map = {
      draft: ['upload'],
      uploaded: ['preview', 'fail'],
      preview_ready: ['validate', 'fail'],
      validating: ['validated', 'fail'],
      validated: ['approve', 'rollback'],
      approved: ['rollback', 'archive'],
      rolled_back: ['archive'],
      failed: ['upload', 'archive'],
      archived: [],
    };
    const statusKey = batch.status;
    return map[statusKey] || [];
  }, [batches, selectedBatch?.id]);

  // Render status badge
  const renderStatusBadge = (status) => {
    const label = STATUS_LABELS[status];
    if (!label) return <span className="text-gray-600">Unknown</span>;
    return (
      <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${label.class}`}
      >
        {label.label}
      </span>
    );
  };

  // Render validation status badge
  const renderValidationStatusBadge = (status) => {
    const colors = {
      valid: 'bg-green-100 text-green-800',
      invalid: 'bg-red-100 text-red-800',
      duplicate: 'bg-yellow-100 text-yellow-800',
    };
    const classes = colors[status] || 'bg-gray-100 text-gray-800';
    return (
      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${classes}`}>
        {status}
      </span>
    );
  };

  // Empty state
  const emptyState = (
    <div
      className="glass-panel text-center py-12 rounded-lg border border-dashed border-gray-200"
      style={{ margin: '2rem 0' }}
    >
      <Download size={48} className="mx-auto mb-3 text-gray-300" />
      <h3 className="text-lg font-medium text-gray-600 mb-2">No import batches</h3>
      <p className="text-sm text-gray-500 mb-4">
        Create your first import by uploading a CSV or JSON file.
      </p>
      {user?.role === 'admin' && (
        <button
          className="btn btn-primary mt-3"
          onClick={() => setShowUpload(true)}
        >
          <Upload size={16} /> Upload Dataset
        </button>
      )}
    </div>
  );

  // Batch card
  const BatchCard = ({ batch }) => {
    const StatusLabel = batchStatusLabel(batch.id);
    const rowText = getRowStatusText(batch);

    return (
      <div
        key={batch.id}
        className="glass-panel rounded-lg border border-border p-4 hover:shadow-sm transition-shadow cursor-pointer"
        onClick={() => setSelectedBatch(batch)}
        style={{ borderColor: batch.status === 'approved' ? 'border-green-500' : 'border-border' }}
      >
        <div className="flex justify-between items-start">
          <div>
            <h4 className="font-medium truncate">{batch.title || 'Import Batch'}</h4>
            <p className="text-sm text-gray-500 mb-1">
              {batch.sourceFile || 'Untitled'} • {batch.sourceFormat || 'csv'}
            </p>
            <p className="text-xs text-gray-400">{rowText}</p>
          </div>
          <div className="flex items-center gap-2">
            {renderStatusBadge(batch.status)}
            {batch.status !== 'archived' && batch.status !== 'failed' ? (
              <button
                className="btn btn-link text-sm text-blue-600 hover:text-blue-800"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedBatch(batch);
                }}
              >
                View
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  // Validation error row
  const ValidationErrorRow = ({ error }) => {
    const codeMap = {
      required_field: 'Required field',
      invalid_format: 'Invalid format',
      duplicate_id: 'Duplicate ID',
      duplicate_name: 'Duplicate name',
      invalid_value: 'Invalid value',
      unknown_column: 'Unknown column',
    };

    const codeLabel = codeMap[error.code] || error.code;
    return (
      <tr key={error.id}>
        <td className="font-medium">{error.rowNumber}</td>
        <td>{error.field || '—'}</td>
        <td className="text-sm">{codeLabel}</td>
        <td>{error.message}</td>
        <td>
          {error.suggestedValue ? (
            <code title="Suggested fix">{error.suggestedValue}</code>
          ) : null}
        </td>
      </tr>
    );
  };

  // Preview table section
  const PreviewSection = () => {
    if (!previewReport) return null;

    const { valid, invalid, duplicates } = previewReport;
    const total = valid.length + invalid.length + duplicates.length;

    return (
      <section
        className="import-review"
        aria-labelledby="import-review-title"
        style={{ marginTop: '1.5rem' }}
      >
        <h4 id="import-review-title" className="import-review__title">
          Import Preview ({total} records)
        </h4>

        <div className="import-review__controls" style={{ marginBottom: '1rem' }}>
          <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
            <span>
              <renderValidationStatusBadge VALID /> {valid.length} valid
            </span>
            <span className="mx-2">|</span>
            <span>
              <renderValidationStatusBadge INVALID /> {invalid.length} invalid
            </span>
            <span className="mx-2">|</span>
            <span>
              <renderValidationStatusBadge DUPLICATE /> {duplicates.length} duplicate
            </span>
          </div>
        </div>

        {valid.length > 0 && (
          <div className="import-review__section">
            <h5 className="import-review__section-header text-sm font-medium text-gray-600 mb-2">
              {valid.length} record{valid.length === 1 ? '' : 's'} will be imported
            </h5>
            <ImportReviewTable report={{ valid, invalid, duplicates }} />
          </div>
        )}

        {invalid.length > 0 && (
          <div className="import-review__section" style={{ borderTop: '1px solid var(--border-main)', paddingTop: '1rem' }}>
            <h5 className="import-review__section-header text-sm font-medium text-gray-600 mb-2">
              {invalid.length} record{invalid.length === 1 ? '' : 's'} has errors
            </h5>
            <table className="import-review__table w-full">
              <caption className="sr-only">Validation errors by row</caption>
              <thead>
                <tr>
                  <th scope="col" className="text-left">
                    <span className="sr-only">Row</span>
                  </th>
                  <th scope="col" className="text-left">
                    <span className="sr-only">Name</span>
                  </th>
                  <th scope="col" className="text-left">
                    <span className="sr-only">Field</span>
                  </th>
                  <th scope="col" className="text-left">
                    <span className="sr-only">Problem</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {invalid.map((err) => (
                  <ValidationErrorRow key={err.id} error={err} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {duplicates.length > 0 && (
          <div className="import-review__section" style={{ borderTop: '1px solid var(--border-main)', paddingTop: '1rem' }}>
            <h5 className="import-review__section-header text-sm font-medium text-gray-600 mb-2">
              {duplicates.length} record{duplicates.length === 1 ? '' : 's'} is/are duplicate{duplicates.length === 1 ? '' : 's'}
            </h5>
            <table className="import-review__table w-full">
              <caption className="sr-only">Duplicate records</caption>
              <thead>
                <tr>
                  <th scope="col" className="text-left">
                    <span className="sr-only">Row</span>
                  </th>
                  <th scope="col" className="text-left">
                    <span className="sr-only">Name</span>
                  </th>
                  <th scope="col" className="text-left">
                    <span className="sr-only">Reason</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {duplicates.map((dup) => (
                  <tr key={dup.id} className="text-sm">
                    <td>{dup.row}</td>
                    <td>{dup.name || '—'}</td>
                    <td>{dup.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {valid.length === 0 && invalid.length === 0 && duplicates.length === 0 && (
          <p className="text-sm text-gray-500 mt-2">No records to display.</p>
        )}
      </section>
    );
  };

  // Render main content
  const content = (
    <div className="pt-4">
      {/* Header */}
      <header className="mb-4">
        <h2 className="text-2xl font-bold tracking-tight">Staged Import Console</h2>
        <p className="text-text-muted">
          Upload, validate, preview, approve, and rollback civic datasets with controlled approval workflows.
        </p>
      </header>

      {/* Stats summary */}
      {stats.total > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <div className="glass-panel rounded-lg p-3">
            <p className="text-sm text-gray-500">Total batches</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </div>
          <div className="glass-panel rounded-lg p-3" style={{ borderLeft: '4px solid #10b981' }}>
            <p className="text-sm text-gray-500">Approved</p>
            <p className="text-2xl font-bold">{stats.approved}</p>
          </div>
          <div className="glass-panel rounded-lg p-3" style={{ borderLeft: '4px solid #f87171' }}>
            <p className="text-sm text-gray-500">Failed</p>
            <p className="text-2xl font-bold">{stats.failed}</p>
          </div>
          <div className="glass-panel rounded-lg p-3" style={{ borderLeft: '4px solid #f59e0b' }}>
            <p className="text-sm text-gray-500">Rolled back</p>
            <p className="text-2xl font-bold">{stats.rolledBack}</p>
          </div>
        </div>
      )}

      {/* Batches list */}
      <section className="mt-4">
        <h3 className="text-font text-lg font-medium mb-3">
          Import Batches {stats.total > 0 && <span className="text-sm text-gray-400">({stats.total} total)</span>}
        </h3>

        {loadingBatches ? (
          <div className="glass-panel p-4 rounded-border">Loading batches...</div>
        ) : batches.length === 0 ? (
          emptyState
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {batches.map((batch) => <BatchCard key={batch.id} batch={batch} />)}
          </div>
        )}
      </section>

      {/* Upload panel */}
      {showUpload && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center">
          <div
            className="glass-panel rounded-2xl w-full max-w-3xl max-h-screen p-6 overflow-y-auto"
            style={{ maxWidth: '90vw', maxHeight: '90vh' }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">Upload Dataset</h3>
              <button
                className="btn btn-ghost text-gray-500 hover:text-gray-700"
                onClick={() => setShowUpload(false)}
                aria-label="Close upload panel"
              >
                <X size={18} />
              </button>
            </div>

            {uploadError && (
              <div
                role="alert"
                style={{ color: '#ef4444', marginBottom: '1rem', fontSize: '0.85rem' }}
              >
                {uploadError}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const file = e.target.elements.file?.files?.[0];
                if (file) handleUploadFile({ target: { files: [file] } });
              }}
              style={{ display: 'none' }}
            >
              <input type="file" name="file" accept=".csv,.json" onChange={handleUploadFile} style={{ display: 'none' }} />
            </form>

            <div style={{ marginBottom: '1.5rem' }}>
              <label className="btn btn-primary w-full mb-3" style={{ fontSize: '0.95rem' }}>
                <Upload size={16} /> Choose CSV or JSON file
                <input
                  type="file"
                  accept=".csv,.json,text/csv,application/json"
                  onChange={handleUploadFile}
                  aria-describedby="upload-file-hint"
                />
              </label>
              <p
                id="upload-file-hint"
                className="text-sm text-gray-500 mt-1"
                style={{ fontSize: '0.8rem' }}
              >
                Allowed formats: CSV or JSON. Max size: {formatFileSize(MAX_IMPORT_BYTES)}. Max rows: {MAX_IMPORT_ROWS}.
              </p>
            </div>

            {/* Preview section */}
            {uploadStatus === 'previewing' && !previewReport && (
              <p className="text-sm text-gray-500">Processing file…</p>
            )}

            {uploadStatus === 'previewing' && previewReport && (
              <PreviewReportPreview report={previewReport} onCancel={handlePreviewCancel} />
            )}

            {uploadStatus === 'validated' && (
              <div className="mt-4">
                <p className="text-green-600 font-medium">
                  {previewReport?.valid.length} records ready to import
                </p>
                <div className="mt-3">
                  <button
                    className="btn btn-primary"
                    onClick={() => setShowUpload(false)}
                    disabled={importInProgress}
                  >
                    {importInProgress ? 'Importing…' : 'Execute Import'}
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={handlePreviewCancel}
                    disabled={importInProgress}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {uploadStatus === 'failed' && (
              <div role="alert" style={{ color: '#ef4444', marginTop: '1rem' }}>
                {uploadError || 'Failed to process the file'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Approve batch modal */}
      {selectedBatch && showRollback && (
        <ConfirmationDialog
          title="Rollback Import Batch"
          text={`Are you sure you want to roll back import batch "${selectedBatch.title}"? This will revert the batch to its previous state.`}
          confirmText="Rollback"
          onConfirm={handleRollbackBatch}
          onCancel={() => setShowRollback(false)}
        />
      )}

      {/* Snapshot creation after selection */}
      {selectedBatch && !showRollback && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="glass-panel rounded-2xl w-full max-w-3xl max-h-screen p-6 overflow-y-auto" style={{ maxWidth: '90vw', maxHeight: '90vh' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">Rollback Confirmation</h3>
              <button
                className="btn btn-ghost text-gray-500 hover:text-gray-700"
                onClick={() => setShowRollback(true)}
                aria-label="Create rollback snapshot"
              >
                <History size={18} /> Create Snapshot
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              A rollback snapshot will allow you to revert this import if needed. This creates a point-in-time backup of the batch state.
            </p>
            <div className="mt-4">
              <button
                className="btn btn-primary w-full"
                onClick={handleCreateSnapshot}
              >
                <History size={16} /> Create Rollback Snapshot
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <main className="min-h-screen bg-background">
      <div class="container mx-auto px-4 py-6">
        {content}
      </div>
    </main>
  );
};

export default ImportConsole;

// Preview report component
const PreviewReportPreview = ({ report, onCancel }) => {
  const { valid, invalid, duplicates } = report;
  const total = valid.length + invalid.length + duplicates.length;

  return (
    <div>
      <p className="text-sm text-gray-500">File contains {total} records</p>
      <div className="grid grid-cols-2 gap-2 mt-3">
        <span>
          <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">{valid.length} valid</span>
        </span>
        <span className="mx-2">|</span>
        <span>
          <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded">{invalid.length} invalid</span>
        </span>
        <span className="mx-2">|</span>
        <span>
          <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded">{duplicates.length} duplicate</span>
        </span>
      </div>
      <button onClick={onCancel} className="btn btn-secondary mt-2">Cancel</button>
    </div>
  );
};