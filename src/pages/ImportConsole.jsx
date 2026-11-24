import { useState, useEffect, useMemo } from 'react';
import {
  Upload,
  Download,
  X,
  AlertTriangle,
  RefreshCw,
  History,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { IMPORT_BATCH_STATUS } from '../data/importContract';
import importBatchService from '../services/importBatchService';
import importValidationService, {
  buildImportPreview,
  generateFailedRowsCsv,
  MAX_IMPORT_BYTES,
  MAX_IMPORT_ROWS,
} from '../services/importValidationService';
import importRollbackService from '../services/importRollbackService';
import { actorLabel } from '../services/accessControl';
import ConfirmationDialog from '../components/common/ConfirmationDialog';
import ImportReviewTable from '../components/admin/ImportReviewTable';

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

const formatFileSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getRowStatusText = (batch) => {
  const { validRows: valid = 0, invalidRows: invalid = 0, duplicateRows: duplicate = 0, totalRows: total = 0 } = batch;
  if (total === 0) return 'No rows';
  if (valid > 0 && invalid === 0 && duplicate === 0) return `${valid} valid row${valid !== 1 ? 's' : ''}`;
  return `${valid} valid, ${invalid} invalid, ${duplicate} duplicate (${total} total)`;
};

const renderStatusBadge = (status) => {
  const label = STATUS_LABELS[status];
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${label?.class || 'bg-gray-100 text-gray-800'}`}>
      {label?.label || 'Unknown'}
    </span>
  );
};

const renderValidationStatusBadge = (status) => {
  const colors = {
    valid: 'bg-green-100 text-green-800',
    invalid: 'bg-red-100 text-red-800',
    duplicate: 'bg-yellow-100 text-yellow-800',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
      {status}
    </span>
  );
};

const BatchCard = ({ batch, onSelect, onDownloadFailedRows, onRetryBatch }) => {
  const quarantinedCount = batch.deadLetterQueue?.length || 0;

  return (
    <div
      className="glass-panel rounded-lg border border-border p-4 hover:shadow-sm transition-shadow cursor-pointer"
      onClick={() => onSelect(batch)}
      style={{ borderColor: batch.status === 'approved' ? '#10b981' : undefined }}
    >
      <div className="flex justify-between items-start">
        <div>
          <h4 className="font-medium truncate">{batch.title || 'Import Batch'}</h4>
          <p className="text-sm text-gray-500 mb-1">
            {batch.sourceFile || 'Untitled'} • {batch.sourceFormat || 'csv'}
          </p>
          <p className="text-xs text-gray-400">{getRowStatusText(batch)}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-1">
            {renderStatusBadge(batch.status)}
            {quarantinedCount > 0 && (
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-800">
                {quarantinedCount} quarantined
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            {quarantinedCount > 0 && (
              <>
                <button
                  type="button"
                  className="btn btn-ghost text-xs text-blue-600 hover:text-blue-800 p-1 flex items-center gap-1"
                  title="Download Failed Rows (CSV)"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDownloadFailedRows(batch);
                  }}
                >
                  <Download size={13} /> CSV
                </button>
                <button
                  type="button"
                  className="btn btn-ghost text-xs text-amber-600 hover:text-amber-800 p-1 flex items-center gap-1"
                  title="Retry Quarantined Rows"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRetryBatch(batch);
                  }}
                >
                  <RefreshCw size={13} /> Retry
                </button>
              </>
            )}
            <button
              type="button"
              className="btn btn-link text-xs text-blue-600 hover:text-blue-800"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(batch);
              }}
            >
              View
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

ImportConsole.displayName = 'ImportConsole';

const ImportConsole = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [showUpload, setShowUpload] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('ready');
  const [uploadError, setUploadError] = useState('');
  const [previewReport, setPreviewReport] = useState(null);
  const [importInProgress, setImportInProgress] = useState(false);
  const [batches, setBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [loadingBatches, setLoadingBatches] = useState(true);
  const [showRollback, setShowRollback] = useState(false);

  useEffect(() => {
    importBatchService.listBatches().then((bList) => {
      setBatches(bList);
      setLoadingBatches(false);
    });
  }, []);

  const stats = useMemo(() => {
    return {
      total: batches.length,
      approved: batches.filter((b) => b.status === IMPORT_BATCH_STATUS.APPROVED).length,
      failed: batches.filter((b) => b.status === IMPORT_BATCH_STATUS.FAILED).length,
      rolledBack: batches.filter((b) => b.status === IMPORT_BATCH_STATUS.ROLLED_BACK).length,
      totalRows: batches.reduce((sum, b) => sum + (b.totalRows || 0), 0),
      validRows: batches.reduce((sum, b) => sum + (b.validRows || 0), 0),
      invalidRows: batches.reduce((sum, b) => sum + (b.invalidRows || 0), 0),
      duplicateRows: batches.reduce((sum, b) => sum + (b.duplicateRows || 0), 0),
    };
  }, [batches]);

  const handleUploadFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadStatus('parsing');
    setUploadError('');

    try {
      const text = await file.text();
      const format = importValidationService.detectImportFormat(file.name, text);
      const preview = buildImportPreview(text, { fileName: file.name });

      if (preview.fileErrors.length > 0) {
        setUploadStatus('failed');
        setUploadError(preview.fileErrors[0]);
        toast?.error?.(preview.fileErrors[0]);
        return;
      }

      if (preview.total === 0) {
        setUploadStatus('failed');
        setUploadError('No service records found in the file');
        toast?.error?.('No service records found in the file');
        return;
      }

      if (preview.total > 500) {
        setUploadStatus('failed');
        setUploadError(`File has ${preview.total} records; limit is 500 per import`);
        toast?.error?.(`File has ${preview.total} records; limit is 500 per import`);
        return;
      }

      const batchResult = importBatchService.createBatch({
        title: `Import: ${file.name}`,
        sourceFile: file.name,
        sourceFormat: format,
      });

      if (batchResult.ok) {
        setSelectedBatch(batchResult.batch);
      }

      setPreviewReport(preview);
      setUploadStatus('previewing');
    } catch (err) {
      setUploadStatus('failed');
      const message = err.message || 'Failed to read file';
      setUploadError(message);
      toast?.error?.(message);
    }
  };

  const handleExecuteImport = () => {
    if (!previewReport || !selectedBatch) return;

    setImportInProgress(true);
    const result = importValidationService.executeImport(previewReport, selectedBatch.id);
    setImportInProgress(false);

    if (result.ok) {
      setShowUpload(false);
      setPreviewReport(null);
      setUploadStatus('ready');
      setUploadError('');

      toast?.success?.(
        `${result.imported} service${result.imported === 1 ? '' : 's'} imported. ` +
        `${result.invalid} with errors, ${result.duplicates} duplicate${result.duplicates === 1 ? '' : 's'} quarantined.`
      );

      importBatchService.listBatches().then((bList) => {
        setBatches(bList);
        const updated = bList.find((b) => b.id === selectedBatch.id);
        setSelectedBatch(updated || result.batch);
      });
    } else {
      toast?.error?.(result.error || 'Import failed');
    }
  };

  const handlePreviewCancel = () => {
    setPreviewReport(null);
    setUploadStatus('ready');
    setUploadError('');
  };

  const handleApproveBatch = () => {
    if (!selectedBatch) return;

    importBatchService
      .updateBatchStatus(selectedBatch.id, IMPORT_BATCH_STATUS.APPROVED, {
        approvalEvent: {
          action: 'approved',
          batchId: selectedBatch.id,
          notes: `Batch approved by ${actorLabel()}`,
          actor: actorLabel(),
        },
      })
      .then((result) => {
        if (result.ok) {
          toast?.success?.('Import batch approved successfully');
          importBatchService.listBatches().then((bList) => {
            setBatches(bList);
            setSelectedBatch(result.batch);
          });
        } else {
          toast?.error?.(result.error || 'Failed to approve batch');
        }
      });
  };

  const handleDownloadFailedRows = (batch) => {
    let dlq = batch?.deadLetterQueue;
    if (!dlq?.length && previewReport && (previewReport.invalid?.length || previewReport.duplicates?.length)) {
      dlq = [
        ...previewReport.invalid.map((item) => ({
          rowIndex: item.row,
          rawData: item.raw || {},
          errors: item.errors || [],
          reasonCodes: item.errorDetails?.map((d) => d.code) || ['invalid_value'],
          fields: item.errorDetails?.map((d) => d.field) || ['unknown'],
          reason: item.errors?.[0] || 'Validation error',
          attemptCount: 1,
        })),
        ...previewReport.duplicates.map((item) => ({
          rowIndex: item.row,
          rawData: item.raw || {},
          errors: [item.reason],
          reasonCodes: [item.code || 'duplicate_id'],
          fields: [item.field || 'id'],
          reason: item.reason,
          attemptCount: 1,
        })),
      ];
    }

    if (!dlq?.length) {
      toast?.info?.('No quarantined or failed rows to download');
      return;
    }

    const csvContent = generateFailedRowsCsv(dlq);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const baseName = (batch?.sourceFile || previewReport?.fileName || 'import').replace(/\.[^/.]+$/, '');
    link.download = `${baseName}_failed_rows.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast?.success?.(`Downloaded ${dlq.length} quarantined row${dlq.length === 1 ? '' : 's'}`);
  };

  const handleRetryBatch = (batch) => {
    if (!batch) return;

    const result = importBatchService.retryBatch(batch.id);
    if (result.ok) {
      toast?.success?.(
        `Retry complete: ${result.succeeded} succeeded, ${result.remaining} remaining in quarantine`
      );
      importBatchService.listBatches().then((bList) => {
        setBatches(bList);
        const updated = bList.find((b) => b.id === batch.id);
        if (updated) setSelectedBatch(updated);
      });
    } else {
      toast?.error?.(result.error || 'Retry failed');
    }
  };

  const handleRollbackBatch = () => {
    if (!selectedBatch) return;

    const snapshots = importRollbackService.listRollbackSnapshots(selectedBatch.id);
    const latestSnapshot = snapshots[snapshots.length - 1];

    if (!latestSnapshot) {
      toast?.error?.('No rollback snapshot found for this batch');
      setShowRollback(false);
      return;
    }

    importRollbackService.rollbackToSnapshot(latestSnapshot.id).then((result) => {
      if (result.ok) {
        toast?.success?.(`Batch ${selectedBatch.id} rolled back successfully`);
        setShowRollback(false);
        importBatchService.listBatches().then((bList) => {
          setBatches(bList);
          const updated = bList.find((b) => b.id === selectedBatch.id);
          setSelectedBatch(updated || null);
        });
      } else {
        toast?.error?.(result.error || 'Rollback failed');
      }
    });
  };

  const handleCreateSnapshot = () => {
    if (!selectedBatch) return;

    importBatchService.createRollbackSnapshot({
      batchId: selectedBatch.id,
      snapshotType: 'post_validation',
      title: `Manual snapshot ${new Date().toLocaleDateString()}`,
      description: `Snapshot with ${selectedBatch.validRows || 0} valid and ${selectedBatch.invalidRows || 0} invalid rows`,
      rowCount: (selectedBatch.validRows || 0) + (selectedBatch.invalidRows || 0),
      fieldMappings: selectedBatch.fieldMappings || [],
    });
    toast?.success?.('Rollback snapshot created successfully');
  };

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6">
        <header className="mb-4">
          <h2 className="text-2xl font-bold tracking-tight">Staged Import Console</h2>
          <p className="text-text-muted">
            Upload, validate, preview, quarantine, approve, retry, and rollback civic datasets with full provenance.
          </p>
        </header>

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
              <p className="text-sm text-gray-500">Failed / Rejected</p>
              <p className="text-2xl font-bold">{stats.failed}</p>
            </div>
            <div className="glass-panel rounded-lg p-3" style={{ borderLeft: '4px solid #f59e0b' }}>
              <p className="text-sm text-gray-500">Rolled back</p>
              <p className="text-2xl font-bold">{stats.rolledBack}</p>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium">
            Import Batches {stats.total > 0 && <span className="text-sm text-gray-400">({stats.total} total)</span>}
          </h3>
          {user?.role === 'admin' && (
            <button className="btn btn-primary" onClick={() => setShowUpload(true)}>
              <Upload size={16} /> Upload Dataset
            </button>
          )}
        </div>

        <section>
          {loadingBatches ? (
            <div className="glass-panel p-4 rounded-lg">Loading batches...</div>
          ) : batches.length === 0 ? (
            <div className="glass-panel text-center py-12 rounded-lg border border-dashed border-gray-200">
              <Download size={48} className="mx-auto mb-3 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-600 mb-2">No import batches</h3>
              <p className="text-sm text-gray-500 mb-4">
                Create your first import by uploading a CSV or JSON file.
              </p>
              {user?.role === 'admin' && (
                <button className="btn btn-primary mt-3" onClick={() => setShowUpload(true)}>
                  <Upload size={16} /> Upload Dataset
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {batches.map((batch) => (
                <BatchCard
                  key={batch.id}
                  batch={batch}
                  onSelect={setSelectedBatch}
                  onDownloadFailedRows={handleDownloadFailedRows}
                  onRetryBatch={handleRetryBatch}
                />
              ))}
            </div>
          )}
        </section>

        {showUpload && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass-panel rounded-2xl w-full max-w-3xl max-h-[90vh] p-6 overflow-y-auto">
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
                <div role="alert" className="text-red-500 text-sm mb-4">
                  {uploadError}
                </div>
              )}

              <div className="mb-6">
                <label className="btn btn-primary w-full mb-3 text-sm">
                  <Upload size={16} /> Choose CSV or JSON file
                  <input
                    type="file"
                    accept=".csv,.json,text/csv,application/json"
                    onChange={handleUploadFile}
                    aria-describedby="upload-file-hint"
                    className="hidden"
                  />
                </label>
                <p id="upload-file-hint" className="text-xs text-gray-500 mt-1">
                  Allowed formats: CSV or JSON. Max size: {formatFileSize(MAX_IMPORT_BYTES)}. Max rows: {MAX_IMPORT_ROWS}.
                </p>
              </div>

              {uploadStatus === 'previewing' && previewReport && (
                <div>
                  <section className="import-review mt-6" aria-labelledby="import-review-title">
                    <div className="flex items-center justify-between mb-2">
                      <h4 id="import-review-title" className="import-review__title font-semibold">
                        Import Preview ({previewReport.total} records)
                      </h4>
                      {(previewReport.invalid.length > 0 || previewReport.duplicates.length > 0) && (
                        <button
                          type="button"
                          className="btn btn-secondary text-xs flex items-center gap-1"
                          onClick={() => handleDownloadFailedRows({ deadLetterQueue: null, sourceFile: previewReport.fileName })}
                        >
                          <Download size={14} /> Download Failed Rows (CSV)
                        </button>
                      )}
                    </div>

                    <div className="import-review__controls mb-4">
                      <div className="flex gap-2 flex-wrap items-center">
                        <span>{renderValidationStatusBadge('valid')} {previewReport.valid.length} valid</span>
                        <span className="text-gray-300">|</span>
                        <span>{renderValidationStatusBadge('invalid')} {previewReport.invalid.length} invalid</span>
                        <span className="text-gray-300">|</span>
                        <span>{renderValidationStatusBadge('duplicate')} {previewReport.duplicates.length} duplicate</span>
                      </div>
                    </div>

                    {previewReport.valid.length > 0 && (
                      <div className="import-review__section mb-4">
                        <h5 className="text-sm font-medium text-gray-600 mb-2">
                          {previewReport.valid.length} record{previewReport.valid.length === 1 ? '' : 's'} ready to import
                        </h5>
                        <ImportReviewTable report={previewReport} />
                      </div>
                    )}
                  </section>

                  <div className="flex gap-2 mt-4">
                    <button
                      className="btn btn-primary"
                      onClick={handleExecuteImport}
                      disabled={importInProgress || previewReport.valid.length === 0}
                    >
                      {importInProgress ? 'Importing…' : `Import ${previewReport.valid.length} Valid Records`}
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
            </div>
          </div>
        )}

        {selectedBatch && !showRollback && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass-panel rounded-2xl w-full max-w-3xl max-h-[90vh] p-6 overflow-y-auto">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-xl font-bold">{selectedBatch.title}</h3>
                  <p className="text-sm text-gray-500">
                    ID: <code>{selectedBatch.id}</code> • File: {selectedBatch.sourceFile}
                  </p>
                </div>
                <button
                  className="btn btn-ghost text-gray-500 hover:text-gray-700"
                  onClick={() => setSelectedBatch(null)}
                  aria-label="Close batch details"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex items-center gap-3 my-3">
                {renderStatusBadge(selectedBatch.status)}
                <span className="text-sm text-gray-500">{getRowStatusText(selectedBatch)}</span>
                {selectedBatch.retryAttempts > 0 && (
                  <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                    Retried {selectedBatch.retryAttempts} time{selectedBatch.retryAttempts === 1 ? '' : 's'}
                  </span>
                )}
              </div>

              {selectedBatch.deadLetterQueue && selectedBatch.deadLetterQueue.length > 0 && (
                <div className="mt-4 border border-red-200 rounded-lg p-4 bg-red-50/40">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={18} className="text-red-500" />
                      <h4 className="font-semibold text-red-900">
                        Dead-Letter Quarantine ({selectedBatch.deadLetterQueue.length} rows)
                      </h4>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="btn btn-secondary text-xs flex items-center gap-1"
                        onClick={() => handleDownloadFailedRows(selectedBatch)}
                      >
                        <Download size={13} /> Download Failed Rows (CSV)
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary text-xs flex items-center gap-1"
                        onClick={() => handleRetryBatch(selectedBatch)}
                      >
                        <RefreshCw size={13} /> Retry Failed Rows
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-red-700 mb-3">
                    These records were rejected or flagged as duplicates. Their original row data is preserved below.
                    Retrying will re-evaluate only these quarantined rows against the catalog.
                  </p>

                  <div className="max-h-60 overflow-y-auto border border-red-100 rounded bg-white text-xs">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b">
                          <th className="p-2">Row</th>
                          <th className="p-2">Name</th>
                          <th className="p-2">Field(s)</th>
                          <th className="p-2">Reason</th>
                          <th className="p-2">Attempts</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedBatch.deadLetterQueue.map((item, idx) => (
                          <tr key={item.id || idx} className="border-b hover:bg-gray-50/80">
                            <td className="p-2 font-mono">{item.rowIndex || item.rowNumber || idx + 1}</td>
                            <td className="p-2 font-medium">{item.rawData?.name || item.rawData?.id || '—'}</td>
                            <td className="p-2 text-gray-500">
                              {Array.isArray(item.fields) ? item.fields.join(', ') : (item.fields || '—')}
                            </td>
                            <td className="p-2 text-red-600">{item.reason || item.errors?.[0] || 'Validation error'}</td>
                            <td className="p-2 text-center">{item.attemptCount || 1}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 mt-6 pt-4 border-t border-gray-100">
                <div className="flex gap-2">
                  {selectedBatch.status === IMPORT_BATCH_STATUS.VALIDATED && user?.role === 'admin' && (
                    <button className="btn btn-primary text-sm" onClick={handleApproveBatch}>
                      Approve Batch
                    </button>
                  )}
                  <button className="btn btn-secondary text-sm flex items-center gap-1" onClick={handleCreateSnapshot}>
                    <History size={14} /> Snapshot
                  </button>
                  <button
                    className="btn btn-ghost text-sm text-red-600 hover:text-red-800"
                    onClick={() => setShowRollback(true)}
                  >
                    Rollback Batch
                  </button>
                </div>
                <button className="btn btn-secondary text-sm" onClick={() => setSelectedBatch(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {selectedBatch && showRollback && (
          <ConfirmationDialog
            title="Rollback Import Batch"
            text={`Are you sure you want to roll back import batch "${selectedBatch.title}"? This will revert the batch to its previous snapshot state.`}
            confirmText="Rollback"
            onConfirm={handleRollbackBatch}
            onCancel={() => setShowRollback(false)}
          />
        )}
      </div>
    </main>
  );
};

export default ImportConsole;
