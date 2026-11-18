import React, { useState } from 'react';
import { X, Download, Copy, Check, FileText } from 'lucide-react';
import { exportCodebook } from '../../services/surveyService.js';

const SurveyCodebookExportModal = ({ survey, onClose }) => {
  const [copied, setCopied] = useState(false);
  const codebookItems = exportCodebook(survey.id, 'json');

  const handleDownloadCSV = () => {
    const csvContent = exportCodebook(survey.id, 'csv');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${survey.id}_codebook.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadJSON = () => {
    const jsonStr = JSON.stringify(codebookItems, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${survey.id}_codebook.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyMarkdown = async () => {
    const headers = '| # | Variable Name | Data Type | Required | Question Prompt |\n|---|---|---|---|---|';
    const rows = codebookItems.map(
      (item) => `| ${item.itemOrder} | \`${item.variableName}\` | ${item.storageDataType} | ${item.required ? 'Yes' : 'No'} | ${item.prompt} |`
    );
    const markdown = `# Codebook: ${survey.title}\nVersion: ${survey.activeVersionId}\n\n${headers}\n${rows.join('\n')}`;

    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(markdown);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // Ignore
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        zIndex: 1000,
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="codebook-modal-title"
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '850px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-main)',
          border: '1px solid var(--border-light)',
          borderRadius: '1rem',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem',
            borderBottom: '1px solid var(--border-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText size={20} color="var(--accent-main)" />
            <div>
              <h2 id="codebook-modal-title" style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>
                Survey Codebook &amp; Data Dictionary
              </h2>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                {survey.title} ({survey.activeVersionId})
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '0.25rem' }}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Table */}
        <div style={{ padding: '1.25rem', overflowY: 'auto', flex: 1 }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-light)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '0.5rem' }}>#</th>
                  <th style={{ padding: '0.5rem' }}>Variable Name</th>
                  <th style={{ padding: '0.5rem' }}>Type</th>
                  <th style={{ padding: '0.5rem' }}>Required</th>
                  <th style={{ padding: '0.5rem' }}>Prompt &amp; Allowed Values</th>
                </tr>
              </thead>
              <tbody>
                {codebookItems.map((item) => (
                  <tr key={item.questionId} style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <td style={{ padding: '0.6rem 0.5rem', fontWeight: 600 }}>{item.itemOrder}</td>
                    <td style={{ padding: '0.6rem 0.5rem' }}>
                      <code style={{ background: 'var(--glass-bg)', padding: '0.15rem 0.4rem', borderRadius: '4px', color: 'var(--accent-main)' }}>
                        {item.variableName}
                      </code>
                    </td>
                    <td style={{ padding: '0.6rem 0.5rem', color: 'var(--text-secondary)' }}>{item.storageDataType}</td>
                    <td style={{ padding: '0.6rem 0.5rem' }}>{item.required ? 'Yes' : 'No'}</td>
                    <td style={{ padding: '0.6rem 0.5rem' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>{item.prompt}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                        {Array.isArray(item.allowedValues) ? item.allowedValues.join(', ') : item.allowedValues}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Action Footer */}
        <div
          style={{
            padding: '1rem 1.25rem',
            borderTop: '1px solid var(--border-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.5rem',
            background: 'var(--glass-bg)',
          }}
        >
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            Codebooks follow open research standard variable specifications.
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={handleCopyMarkdown}
              className="btn btn-secondary"
              style={{ fontSize: '0.8rem', padding: '0.45rem 0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
              {copied ? 'Copied' : 'Copy Markdown'}
            </button>
            <button
              type="button"
              onClick={handleDownloadCSV}
              className="btn btn-secondary"
              style={{ fontSize: '0.8rem', padding: '0.45rem 0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <Download size={14} /> Download CSV
            </button>
            <button
              type="button"
              onClick={handleDownloadJSON}
              className="btn btn-primary"
              style={{ fontSize: '0.8rem', padding: '0.45rem 0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <Download size={14} /> Export JSON
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SurveyCodebookExportModal;

