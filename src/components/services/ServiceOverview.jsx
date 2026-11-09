import { useEffect, useRef, useState } from 'react';
import { Sparkles, RotateCcw } from 'lucide-react';
import { fetchServiceOverview, OVERVIEW_LABEL, OVERVIEW_NOTICE } from '../../ai/serviceOverview';

const muted = { color: 'var(--text-secondary)', fontSize: '0.82rem', lineHeight: 1.45, margin: 0 };

const chip = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.3rem',
  padding: '0.15rem 0.55rem',
  borderRadius: '999px',
  border: '1px solid var(--accent-main)',
  color: 'var(--accent-main)',
  fontSize: '0.74rem',
  fontWeight: 700,
};

/**
 * What a card can show, from props only. The state lives in ServiceOverview below.
 * Text from the guide is rendered as React children, never as markup.
 *
 * phase: 'idle' | 'loading' | 'done' | 'error'
 */
export const OverviewPanel = ({ phase, result, onRetry }) => {
  if (phase === 'loading') {
    return <p role="status" aria-live="polite" aria-busy="true" style={muted}>Preparing an overview…</p>;
  }
  if (phase === 'error') {
    return (
      <div>
        <p role="alert" style={muted}>The overview could not be made right now. The guide itself is unchanged.</p>
        <button type="button" className="compare-toggle" onClick={onRetry} style={{ marginTop: '0.4rem', fontFamily: 'inherit' }}>
          <RotateCcw size={13} aria-hidden="true" /> Try again
        </button>
      </div>
    );
  }
  if (phase === 'done' && result?.status === 'insufficient') {
    return <p role="status" style={muted}>{result.message}</p>;
  }
  if (phase === 'done' && result?.status === 'ready') {
    return (
      <div>
        <span style={chip}><Sparkles size={12} aria-hidden="true" /> {OVERVIEW_LABEL}</span>
        <p style={{ margin: '0.45rem 0 0', color: 'var(--text-primary)', fontSize: '0.9rem', lineHeight: 1.5 }}>{result.sentence}</p>
        <p style={{ ...muted, marginTop: '0.35rem' }}>{OVERVIEW_NOTICE}</p>
      </div>
    );
  }
  return null;
};

/**
 * An optional overview under a search result (#384). It sits outside the card's link, like the compare
 * toggle, so the card's title and details are exactly what they were. It only reads the service.
 */
const ServiceOverview = ({ service, fetchOverview = fetchServiceOverview }) => {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState('idle');
  const [result, setResult] = useState(null);
  const run = useRef(0);

  useEffect(() => () => { run.current = -1; }, []);

  const load = async () => {
    const mine = ++run.current;
    setPhase('loading');
    try {
      const out = await fetchOverview(service);
      if (run.current !== mine) return;
      if (!out || out.status === 'error' || out.status === 'cancelled') {
        setPhase('error');
        return;
      }
      setResult(out);
      setPhase('done');
    } catch {
      if (run.current === mine) setPhase('error');
    }
  };

  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (phase !== 'done') load();
  };

  const panelId = `overview-${service?.id}`;

  return (
    <div className="service-overview" data-testid={`service-overview-${service?.id}`}>
      <button
        type="button"
        className="compare-toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggle}
        style={{ fontFamily: 'inherit' }}
      >
        <Sparkles size={13} aria-hidden="true" />
        <span>
          {open ? 'Hide AI overview' : 'AI overview'}
          <span className="sr-only"> for {service?.name}</span>
        </span>
      </button>
      <div id={panelId} style={{ marginTop: open ? '0.5rem' : 0 }}>
        {open && <OverviewPanel phase={phase} result={result} onRetry={load} />}
      </div>
    </div>
  );
};

export default ServiceOverview;
