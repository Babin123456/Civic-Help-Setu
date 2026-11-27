import { useId } from 'react';
import { AlertCircle, MapPin, ShieldCheck } from 'lucide-react';
import { TreeInventoryEmptyState as EmptyState, TreeStatusBadge as StatusBadge } from './TreeInventoryStates';

const cardStyle = {
  border: '1px solid var(--border-main)',
  borderRadius: '0.9rem',
  padding: '1rem',
  background: 'var(--surface-raised, var(--glass-bg))',
  display: 'grid',
  gap: '0.55rem',
};

const toneForCondition = (condition) => condition || 'unknown';
const toneForTiming = (timing) => timing?.status || 'unscheduled';

function PublicTreeCard({ tree, onReport }) {
  return (
    <article style={cardStyle} aria-labelledby={`tree-${tree.publicId}`}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h3 id={`tree-${tree.publicId}`} style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)' }}>
            {tree.species?.commonName || 'Unidentified tree'}
          </h3>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
            {tree.publicId} · {tree.ward}
            {tree.locality ? ` · ${tree.locality}` : ''}
          </p>
          {tree.species?.scientificName && (
            <p style={{ margin: '0.1rem 0 0', fontSize: '0.8rem', fontStyle: 'italic', color: 'var(--text-tertiary)' }}>
              {tree.species.scientificName}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
          <StatusBadge tone={toneForCondition(tree.condition)} label={`Condition: ${tree.conditionLabel}`} />
          <StatusBadge tone={toneForTiming(tree.inspectionTiming)} label={`Inspection: ${tree.inspectionTiming?.label}`} />
        </div>
      </div>

      <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.5rem', margin: 0, fontSize: '0.82rem' }}>
        <div>
          <dt style={{ fontWeight: 700, color: 'var(--text-tertiary)' }}>Approximate location</dt>
          <dd style={{ margin: 0, color: 'var(--text-secondary)' }}>
            {tree.approxLocation?.grid} · {tree.approxLocation?.precision}
          </dd>
        </div>
        <div>
          <dt style={{ fontWeight: 700, color: 'var(--text-tertiary)' }}>Planted</dt>
          <dd style={{ margin: 0, color: 'var(--text-secondary)' }}>{tree.plantedYear || 'Not recorded'}</dd>
        </div>
        <div>
          <dt style={{ fontWeight: 700, color: 'var(--text-tertiary)' }}>Last verified inspection</dt>
          <dd style={{ margin: 0, color: 'var(--text-secondary)' }}>
            {tree.lastInspectedAt ? new Date(tree.lastInspectedAt).toLocaleDateString('en-IN') : 'No verified inspection yet'}
          </dd>
        </div>
        <div>
          <dt style={{ fontWeight: 700, color: 'var(--text-tertiary)' }}>Risk review</dt>
          <dd style={{ margin: 0, color: 'var(--text-secondary)' }}>{tree.risk?.label}</dd>
        </div>
      </dl>

      <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
        Source: {tree.source}. Last updated {tree.updatedAt ? new Date(tree.updatedAt).toLocaleString('en-IN') : 'unknown'}.
        Precise coordinates and private notes are not published.
      </p>
      <button
        type="button"
        className="btn btn-secondary"
        style={{ justifySelf: 'start' }}
        onClick={() => onReport?.(tree)}
        aria-label={`Report visible damage for tree ${tree.publicId}`}
      >
        <AlertCircle size={15} aria-hidden="true" /> Report visible damage
      </button>
    </article>
  );
}

export default function TreePublicInventory({
  data,
  wardMap,
  view = 'list',
  onViewChange,
  onReport,
  onPageChange,
  onReset,
  generatedAt,
}) {
  const tableId = useId();
  if (!data || data.items.length === 0) {
    return <EmptyState onReset={onReset} title="No approved public trees match these filters" />;
  }
  const summary = data.summary;
  const pagination = {
    page: data.page,
    totalPages: data.totalPages,
    total: data.total,
  };

  return (
    <section aria-labelledby="public-tree-register-heading" style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center' }}>
        <div>
          <h2 id="public-tree-register-heading" style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)' }}>
            Approved public tree register
          </h2>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
            {summary.totalTrees} public tree{summary.totalTrees === 1 ? '' : 's'} in this view. Generated{' '}
            {generatedAt ? new Date(generatedAt).toLocaleString('en-IN') : 'just now'}.
          </p>
        </div>
        <div role="group" aria-label="Choose inventory view" style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={view === 'list' ? 'btn btn-primary' : 'btn btn-secondary'}
            aria-pressed={view === 'list'}
            onClick={() => onViewChange?.('list')}
          >
            List and table view
          </button>
          <button
            type="button"
            className={view === 'map' ? 'btn btn-primary' : 'btn btn-secondary'}
            aria-pressed={view === 'map'}
            onClick={() => onViewChange?.('map')}
          >
            Ward map and text table
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.7rem' }}>
        <div style={cardStyle}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-tertiary)' }}>Trees in view</span>
          <strong style={{ fontSize: '1.5rem', color: 'var(--text-primary)' }}>{summary.totalTrees}</strong>
        </div>
        <div style={cardStyle}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-tertiary)' }}>Inspections overdue</span>
          <strong style={{ fontSize: '1.5rem', color: 'var(--text-primary)' }}>{summary.inspectionsDue}</strong>
        </div>
        <div style={cardStyle}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-tertiary)' }}>Species represented</span>
          <strong style={{ fontSize: '1.5rem', color: 'var(--text-primary)' }}>{summary.bySpecies.length}</strong>
        </div>
        <div style={cardStyle}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-tertiary)' }}>Wards represented</span>
          <strong style={{ fontSize: '1.5rem', color: 'var(--text-primary)' }}>{summary.byWard.length}</strong>
        </div>
      </div>

      {view === 'map' ? (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <div
            role="group"
            aria-label="Ward map summary"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '0.6rem',
              padding: '0.9rem',
              border: '1px dashed var(--border-main)',
              borderRadius: '0.85rem',
            }}
          >
            {(wardMap?.cells || []).map((cell) => (
              <div key={cell.ward} style={{ ...cardStyle, padding: '0.75rem' }}>
                <span style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', fontWeight: 700, fontSize: '0.85rem' }}>
                  <MapPin size={14} aria-hidden="true" /> {cell.ward}
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{cell.textAlternative}</span>
              </div>
            ))}
          </div>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
            {wardMap?.caption || 'A text table below provides the same information as this ward map.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '0.8rem' }}>
          {data.items.map((tree) => (
            <PublicTreeCard key={tree.publicId} tree={tree} onReport={onReport} />
          ))}
        </div>
      )}

      <div style={{ overflowX: 'auto', border: '1px solid var(--border-main)', borderRadius: '0.7rem' }}>
        <table id={tableId} style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
          <caption style={{ textAlign: 'left', padding: '0.6rem 0.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            Public tree register — text alternative for the {view === 'map' ? 'ward map' : 'tree list'}
          </caption>
          <thead>
            <tr style={{ background: 'var(--glass-bg)' }}>
              {['Tree ID', 'Species', 'Ward', 'Condition', 'Inspection', 'Approximate grid', 'Last updated'].map((header) => (
                <th key={header} scope="col" style={{ textAlign: 'left', padding: '0.55rem 0.7rem', borderTop: '1px solid var(--border-light)' }}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.items.map((tree) => (
              <tr key={`row-${tree.publicId}`} style={{ borderTop: '1px solid var(--border-light)' }}>
                <th scope="row" style={{ textAlign: 'left', padding: '0.55rem 0.7rem', fontWeight: 600 }}>{tree.publicId}</th>
                <td style={{ padding: '0.55rem 0.7rem' }}>{tree.species?.commonName || 'Unidentified'}</td>
                <td style={{ padding: '0.55rem 0.7rem' }}>{tree.ward}</td>
                <td style={{ padding: '0.55rem 0.7rem' }}>{tree.conditionLabel}</td>
                <td style={{ padding: '0.55rem 0.7rem' }}>{tree.inspectionTiming?.label}</td>
                <td style={{ padding: '0.55rem 0.7rem' }}>{tree.approxLocation?.grid}</td>
                <td style={{ padding: '0.55rem 0.7rem' }}>
                  {tree.updatedAt ? new Date(tree.updatedAt).toLocaleDateString('en-IN') : 'Unknown'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <nav aria-label="Public tree register pages" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'center' }}>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => onPageChange?.(pagination.page - 1)}
          disabled={pagination.page <= 1}
        >
          Previous page
        </button>
        <span style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }} aria-live="polite">
          Page {pagination.page} of {pagination.totalPages} · {pagination.total} trees
        </span>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => onPageChange?.(pagination.page + 1)}
          disabled={pagination.page >= pagination.totalPages}
        >
          Next page
        </button>
        <span style={{ display: 'inline-flex', gap: '0.3rem', alignItems: 'center', fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
          <ShieldCheck size={14} aria-hidden="true" /> Public fields only
        </span>
      </nav>
    </section>
  );
}
