import { useEffect, useRef, useState } from 'react';
import { Sparkles, RotateCcw, ExternalLink } from 'lucide-react';
import { simplifyService, SIMPLIFIER_LABEL, SIMPLIFIER_NOTICE } from '../../ai/serviceSimplifier';
import { safeHttpUrl } from '../../utils/safeContent';

const box = {
  marginTop: '1rem',
  padding: '1rem 1.1rem',
  maxWidth: '600px',
  background: 'var(--glass-bg)',
  border: '1px solid var(--border-main)',
  borderRadius: '0.75rem',
};

const muted = { color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.5, margin: 0 };

const labelChip = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.35rem',
  padding: '0.2rem 0.6rem',
  borderRadius: '999px',
  border: '1px solid var(--accent-main)',
  color: 'var(--accent-main)',
  fontSize: '0.78rem',
  fontWeight: 700,
};

const PARTS = [
  ['purpose', 'What it is'],
  ['audience', 'Who it is for'],
  ['nextStep', 'What to do first'],
];

/**
 * Everything the panel can show, from props only. The state lives in ServiceSimplifier below.
 * Dynamic text is rendered as React children, never as markup.
 *
 * phase: 'idle' | 'loading' | 'done' | 'error'; view: 'simple' | 'original'
 */
export const SimplifierPanel = ({ phase, result, view = 'simple', officialText, onSimplify, onShowView }) => {
  if (phase === 'loading') {
    return (
      <section style={box} aria-label="Plain-language summary" data-testid="service-simplifier">
        <p role="status" aria-live="polite" aria-busy="true" style={muted}>Simplifying this guide…</p>
      </section>
    );
  }

  if (phase === 'error') {
    return (
      <section style={box} aria-label="Plain-language summary" data-testid="service-simplifier">
        <p role="alert" style={muted}>
          We could not simplify this guide right now. The official description above has not changed.
        </p>
        <button type="button" className="btn btn-secondary" onClick={onSimplify} style={{ marginTop: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          <RotateCcw size={15} aria-hidden="true" /> Try again
        </button>
      </section>
    );
  }

  if (phase === 'done' && result?.status === 'unavailable') {
    return (
      <section style={box} aria-label="Plain-language summary" data-testid="service-simplifier">
        <p role="status" style={muted}>{result.message}</p>
      </section>
    );
  }

  if (phase === 'done' && result?.status === 'ready') {
    const sourceUrl = result.source ? safeHttpUrl(result.source.url) : '';
    return (
      <section style={box} aria-label="Plain-language summary" data-testid="service-simplifier">
        <div role="group" aria-label="Choose which text to read" style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.9rem' }}>
          <button type="button" className="btn btn-secondary" aria-pressed={view === 'simple'} onClick={() => onShowView('simple')} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', borderColor: view === 'simple' ? 'var(--accent-main)' : undefined }}>
            Simplified
          </button>
          <button type="button" className="btn btn-secondary" aria-pressed={view === 'original'} onClick={() => onShowView('original')} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', borderColor: view === 'original' ? 'var(--accent-main)' : undefined }}>
            Original
          </button>
        </div>

        {view === 'simple' ? (
          <div>
            <span style={labelChip}><Sparkles size={13} aria-hidden="true" /> {SIMPLIFIER_LABEL}</span>
            <dl style={{ margin: '0.8rem 0 0' }}>
              {PARTS.map(([key, title]) =>
                result[key] ? (
                  <div key={key} style={{ marginBottom: '0.7rem' }}>
                    <dt style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{title}</dt>
                    <dd style={{ margin: '0.15rem 0 0', color: 'var(--text-primary)', lineHeight: 1.55 }}>{result[key]}</dd>
                  </div>
                ) : (
                  <div key={key} style={{ marginBottom: '0.7rem' }}>
                    <dt style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{title}</dt>
                    <dd style={{ margin: '0.15rem 0 0', ...muted }}>This guide does not say.</dd>
                  </div>
                ),
              )}
            </dl>
            {result.terms.length > 0 && (
              <div style={{ marginTop: '0.4rem' }}>
                <p style={{ ...muted, fontWeight: 700, color: 'var(--text-primary)' }}>Words in this guide, in plain terms</p>
                <ul style={{ margin: '0.3rem 0 0', paddingLeft: '1.2rem', ...muted }}>
                  {result.terms.map((t) => (
                    <li key={t.id}><strong>{t.term}:</strong> {t.meaning}</li>
                  ))}
                </ul>
              </div>
            )}
            <p style={{ ...muted, marginTop: '0.8rem' }}>{SIMPLIFIER_NOTICE}</p>
            {result.source && sourceUrl && (
              <p style={{ ...muted, marginTop: '0.4rem' }}>
                <a href={sourceUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: 'var(--accent-main)' }}>
                  Official source: {result.source.name} <ExternalLink size={13} aria-hidden="true" />
                </a>
              </p>
            )}
          </div>
        ) : (
          <div>
            <p style={{ fontWeight: 700, fontSize: '0.85rem', margin: 0, color: 'var(--text-primary)' }}>Official description</p>
            <p style={{ margin: '0.3rem 0 0', color: 'var(--text-primary)', lineHeight: 1.55 }}>{officialText}</p>
            <p style={{ ...muted, marginTop: '0.6rem' }}>This is the text from the guide, unchanged.</p>
          </div>
        )}
      </section>
    );
  }

  return (
    <div style={{ marginTop: '1rem' }} data-testid="service-simplifier">
      <button type="button" className="btn btn-secondary" onClick={onSimplify} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
        <Sparkles size={16} aria-hidden="true" /> Simplify this service
      </button>
      <p style={{ ...muted, marginTop: '0.4rem' }}>Get a short plain-language summary of this guide.</p>
    </div>
  );
};

/**
 * "Simplify this service" on a service page (#382). The official description stays where it is; this adds a
 * separate, labelled summary that can be switched back to the original text. The guide itself is never changed.
 * Give it a `key` of the service id so that it starts again when the page shows another service.
 */
const ServiceSimplifier = ({ service, simplify = simplifyService }) => {
  const [phase, setPhase] = useState('idle');
  const [result, setResult] = useState(null);
  const [view, setView] = useState('simple');
  const run = useRef(0);

  useEffect(() => () => { run.current = -1; }, []);

  const handleSimplify = async () => {
    const mine = ++run.current;
    setPhase('loading');
    try {
      const out = await simplify(service);
      if (run.current !== mine) return;
      if (!out || out.status === 'error' || out.status === 'cancelled') {
        setPhase('error');
        return;
      }
      setResult(out);
      setView('simple');
      setPhase('done');
    } catch {
      if (run.current === mine) setPhase('error');
    }
  };

  return (
    <SimplifierPanel
      phase={phase}
      result={result}
      view={view}
      officialText={service?.shortDescription || ''}
      onSimplify={handleSimplify}
      onShowView={setView}
    />
  );
};

export default ServiceSimplifier;
