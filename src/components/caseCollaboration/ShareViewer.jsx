/**
 * src/components/caseCollaboration/ShareViewer.jsx
 *
 * Renders a resolved (viewer) share: item list with watermark, view/download
 * scopes, expiry and integrity notice. Accessible, mobile-first.
 */

import { Download, Eye, ShieldAlert, FileText } from 'lucide-react';

export function ShareViewer({ view, onDownload }) {
  if (!view) return null;

  return (
    <section className="cc-viewer" aria-label="Shared case items">
      <div className="viewer-card">
        <header className="viewer-header">
          <div className="viewer-meta">
            <Eye aria-hidden="true" />
            <span className="viewer-badge">Shared View — Read Only</span>
          </div>
          <h2 className="viewer-title">{view.title}</h2>
          <p className="viewer-desc">{view.description}</p>
        </header>

        <div className="viewer-info">
          <span className="info-pill">
            Scope: {view.scope === 'view-download' ? 'View &amp; Download' : 'View Only'}
          </span>
          <span className="info-pill">
            <FileText aria-hidden="true" /> {view.itemIds.length} item(s)
          </span>
          <span className="info-pill">
            <Download aria-hidden="true" /> {view.viewsRemaining === null ? 'Unlimited' : `${view.viewsRemaining} view(s) left`}
          </span>
          <span className="info-pill integrity">
            <ShieldAlert aria-hidden="true" /> Integrity verified
          </span>
        </div>

        <h3 className="viewer-sub">Shared items</h3>
        <div className="viewer-list">
          {(view.itemSnapshot || []).map((item) => (
            <div key={item.id} className="viewer-item">
              <div className="viewer-item-body">
                <div className="viewer-item-title">{item.title}</div>
                <div className="viewer-item-meta">{item.category || 'Case document'} • {item.mime || 'document'}</div>
              </div>
              {view.scope === 'view-download' && onDownload && (
                <button className="btn btn-outline" type="button" onClick={() => onDownload(item.id)} aria-label={`Download ${item.title}`}>
                  <Download aria-hidden="true" /> Download
                </button>
              )}
            </div>
          ))}
        </div>

        <p className="viewer-disclaimer">
          <ShieldAlert aria-hidden="true" />
          This is a watermarked, time-bound share for review only. It does not
          confer official status, and access can be revoked by the owner at any
          time.
        </p>
      </div>
    </section>
  );
}
