import { Link } from 'react-router-dom';
import { FolderOpen, Layers, ArrowLeft, Search, PlusCircle } from 'lucide-react';

/**
 * CollectionEmptyState Component (#587)
 *
 * Rendered when a citizen chooses a collection that currently contains 0 saved guides.
 * Explains how collection membership works, clarifies that empty collections are temporary
 * until guides are assigned, and provides accessible fast actions to view all or browse services.
 */
const CollectionEmptyState = ({ collectionName, onShowAll }) => (
  <section
    className="card collection-empty glass-panel animate-fade-in"
    aria-labelledby="collection-empty-title"
    style={{
      textAlign: 'center',
      padding: 'clamp(2rem, 5vw, 3.5rem) clamp(1rem, 4vw, 2rem)',
      border: '1px dashed var(--border-light)',
      borderRadius: '1rem',
      maxWidth: '720px',
      margin: '0 auto',
      background: 'var(--glass-bg)',
    }}
  >
    <div
      style={{
        width: '56px',
        height: '56px',
        borderRadius: '50%',
        background: 'rgba(245, 158, 11, 0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 1.25rem',
        color: '#f59e0b',
      }}
    >
      <FolderOpen size={28} aria-hidden="true" className="collection-empty__icon" />
    </div>

    <h2
      id="collection-empty-title"
      className="collection-empty__title"
      style={{
        fontSize: '1.5rem',
        fontWeight: '800',
        marginBottom: '0.5rem',
        color: 'var(--text-primary)',
      }}
    >
      No guides in &ldquo;{collectionName}&rdquo; yet
    </h2>

    <p
      className="collection-empty__text"
      style={{
        color: 'var(--text-secondary)',
        lineHeight: '1.6',
        maxWidth: '560px',
        margin: '0 auto 1.5rem',
        fontSize: '0.92rem',
      }}
    >
      A guide belongs to one collection folder at a time. To add guides here, open any saved guide&apos;s
      <strong> Notes &amp; Collection</strong> menu and pick <em>&ldquo;{collectionName}&rdquo;</em>.
    </p>

    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.5rem 1rem',
        borderRadius: '0.5rem',
        background: 'var(--bg-main)',
        border: '1px solid var(--border-light)',
        color: 'var(--text-tertiary)',
        fontSize: '0.82rem',
        marginBottom: '2rem',
      }}
    >
      <Layers size={14} aria-hidden="true" />
      <span>Empty custom collections persist during this session until items are added.</span>
    </div>

    <div
      className="collection-empty__actions"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.75rem',
        justifyContent: 'center',
      }}
    >
      <button
        type="button"
        className="btn btn-primary"
        onClick={onShowAll}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          borderRadius: '99px',
          padding: '0.65rem 1.5rem',
        }}
      >
        <ArrowLeft size={16} aria-hidden="true" />
        <span>Show all saved guides</span>
      </button>

      <Link
        to="/services"
        className="btn btn-secondary"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          borderRadius: '99px',
          padding: '0.65rem 1.5rem',
        }}
      >
        <Search size={16} aria-hidden="true" />
        <span>Browse directory to save</span>
      </Link>
    </div>
  </section>
);

export default CollectionEmptyState;
