import { useId, useState } from 'react';
import { ExternalLink, ChevronDown, Info } from 'lucide-react';
import { buildSourcePanelModel } from './sourcePanelModel';
import { safeHttpUrl } from '../../utils/safeContent';

/**
 * Expandable "Sources and limitations" disclosure for an assistant message.
 * Renders nothing when the message carries no source data.
 */
const SourcesAndLimitations = ({ message, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  const model = buildSourcePanelModel(message);

  if (!model.hasContent) return null;

  const count = model.sources.length + model.excerpts.length;

  return (
    <section className="sources-panel" aria-label="Sources and limitations">
      <button
        type="button"
        className="sources-panel__toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span>Sources and limitations ({count})</span>
        <ChevronDown size={16} aria-hidden="true" className={open ? 'sources-panel__chevron is-open' : 'sources-panel__chevron'} />
      </button>

      <div id={panelId} className="sources-panel__body" hidden={!open}>
        <p className="sources-panel__note sources-panel__note--generated">
          <Info size={14} aria-hidden="true" />
          <span><strong>Generated guidance.</strong> {model.limitation}</span>
        </p>

        {model.sources.length > 0 && (
          <div>
            <h4 className="sources-panel__heading">Source links</h4>
            <ul className="sources-panel__list">
              {model.sources.map((src, i) => (
                <li key={`${src.url || src.name}-${i}`} className="sources-panel__item">
                  {src.url ? (
                    <a href={safeHttpUrl(src.url) || undefined} target="_blank" rel="noopener noreferrer" className="sources-panel__link">
                      {src.name}
                      <span className="sr-only"> (opens in a new tab)</span>
                      <ExternalLink size={12} aria-hidden="true" />
                    </a>
                  ) : (
                    <span className="sources-panel__name">{src.name}</span>
                  )}
                  {src.url ? (
                    <span className="sources-panel__url">{src.url}</span>
                  ) : (
                    <span className="sources-panel__missing">Link unavailable</span>
                  )}
                  <span className={src.lastVerified ? 'sources-panel__meta' : 'sources-panel__missing'}>
                    {src.lastVerified ? `Last verified: ${src.lastVerified}` : 'Review date unavailable'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {model.excerpts.length > 0 && (
          <div>
            <h4 className="sources-panel__heading">Official source excerpts</h4>
            <ul className="sources-panel__list">
              {model.excerpts.map((ex, i) => (
                <li key={i} className="sources-panel__item sources-panel__item--official">
                  <span className="sources-panel__name">{ex.title}</span>
                  <blockquote className="sources-panel__quote">{ex.excerpt}</blockquote>
                  <span className="sources-panel__meta">{`From: ${ex.sourceName || 'source name unavailable'}`}</span>
                  <span className={ex.lastVerified ? 'sources-panel__meta' : 'sources-panel__missing'}>
                    {ex.lastVerified ? `Last verified: ${ex.lastVerified}` : 'Review date unavailable'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {model.disclaimer && (
          <p className="sources-panel__note">
            <Info size={14} aria-hidden="true" />
            <span>{model.disclaimer}</span>
          </p>
        )}
      </div>
    </section>
  );
};

export default SourcesAndLimitations;
