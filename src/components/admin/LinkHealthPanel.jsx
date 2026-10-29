import { useState } from 'react';
import { safeHttpUrl } from '../../utils/safeContent';
import { MOCK_SERVICES } from '../../data/services';
import {
  LINK_STATUS,
  checkLinkWithRetry,
  getApplicationLinks,
  getLinkHealthRecords,
  needsAttention,
  recordManualCheck,
  reviewRedirect,
  saveLinkCheck,
} from '../../services/linkHealthService';

const formatTime = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString();
};

export const StatusBadge = ({ status }) => {
  const info = LINK_STATUS[status];
  if (!info) return null;
  return (
    <span className={`lhp-badge lhp-badge--${info.tone}`}>
      <span className="lhp-dot" aria-hidden="true" />
      {info.label}
    </span>
  );
};

const LinkRow = ({ service, link, index, record, onChanged }) => {
  const key = `${service.id}:${index}`;
  const [busy, setBusy] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [outcome, setOutcome] = useState('reachable');
  const [destination, setDestination] = useState('');
  const [error, setError] = useState('');

  const run = async () => {
    setBusy(true);
    setError('');
    try {
      const result = await checkLinkWithRetry(link.raw);
      saveLinkCheck(key, result);
      onChanged();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const saveManual = (e) => {
    e.preventDefault();
    setError('');
    try {
      recordManualCheck(key, link.url, outcome, { destination });
      setManualOpen(false);
      setDestination('');
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  };

  const review = () => {
    try {
      reviewRedirect(key);
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  };

  const info = record ? LINK_STATUS[record.status] : null;
  const inputId = `lhp-dest-${service.id}-${index}`;

  return (
    <li className="lhp-link">
      <div className="lhp-link__head">
        <div className="lhp-link__main">
          <div className="lhp-link__name">{link.name}</div>
          <div className="lhp-link__url">{link.raw}</div>
        </div>
        {record ? <StatusBadge status={record.status} /> : <span className="lhp-badge lhp-badge--none">Not checked yet</span>}
      </div>

      {record && (
        <p className="lhp-link__detail">
          {info.note} Checked {formatTime(record.checkedAt)}
          {record.method === 'manual' ? ' by hand' : ''}.
          {record.status === 'redirected' && record.redirectedTo && (
            <>
              {' '}
              It now leads to <strong className="lhp-link__dest">{record.redirectedTo}</strong>. The guide still shows the original address.{' '}
              {record.reviewed ? `Reviewed by ${record.reviewedBy || 'an admin'}.` : 'Not reviewed yet.'}
            </>
          )}
        </p>
      )}

      <div className="lhp-link__actions">
        {link.url ? (
          <>
            <button type="button" className="btn btn-primary lhp-btn" onClick={run} disabled={busy}>
              {busy ? 'Checking...' : record ? 'Check again' : 'Check link'}
            </button>
            <a className="btn btn-secondary lhp-btn" href={safeHttpUrl(link.url)} target="_blank" rel="noopener noreferrer">
              Open portal (new tab)
            </a>
            <button type="button" className="btn btn-secondary lhp-btn" onClick={() => setManualOpen((v) => !v)} aria-expanded={manualOpen}>
              Record what I saw
            </button>
          </>
        ) : (
          <>
            <StatusBadge status="invalid" />
            <button type="button" className="btn btn-secondary lhp-btn" onClick={run}>
              Mark as not a web link
            </button>
          </>
        )}
        {record && record.status === 'redirected' && !record.reviewed && (
          <button type="button" className="btn btn-primary lhp-btn" onClick={review}>
            I have reviewed this redirect
          </button>
        )}
      </div>

      {manualOpen && (
        <form className="lhp-manual" onSubmit={saveManual}>
          <fieldset>
            <legend>After opening the link, what happened?</legend>
            {[
              ['reachable', 'It opened the expected page'],
              ['redirected', 'It sent me to a different address'],
              ['unavailable', 'It did not work or the page was gone'],
            ].map(([value, text]) => (
              <label key={value} className="lhp-radio">
                <input type="radio" name={`lhp-outcome-${key}`} value={value} checked={outcome === value} onChange={() => setOutcome(value)} />
                {text}
              </label>
            ))}
          </fieldset>
          {outcome === 'redirected' && (
            <div className="lhp-field">
              <label htmlFor={inputId}>Address you ended up on</label>
              <input id={inputId} type="url" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="https://" required />
            </div>
          )}
          <div className="lhp-link__actions">
            <button type="submit" className="btn btn-primary lhp-btn">Save result</button>
            <button type="button" className="btn btn-secondary lhp-btn" onClick={() => setManualOpen(false)}>Cancel</button>
          </div>
        </form>
      )}

      {error && (
        <p role="alert" className="lhp-error">
          {error}
        </p>
      )}
    </li>
  );
};

const LinkHealthPanel = ({ services = MOCK_SERVICES }) => {
  const [records, setRecords] = useState(() => getLinkHealthRecords());
  const [onlyAttention, setOnlyAttention] = useState(false);
  const refresh = () => setRecords(getLinkHealthRecords());

  const rows = services
    .map((service) => ({ service, links: getApplicationLinks(service) }))
    .filter((r) => r.links.length > 0)
    .filter((r) => !onlyAttention || r.links.some((_, i) => needsAttention(records[`${r.service.id}:${i}`])));

  const withLinks = services.filter((s) => getApplicationLinks(s).length > 0);
  const total = withLinks.reduce((n, s) => n + getApplicationLinks(s).length, 0);
  const attention = Object.values(records).filter(needsAttention).length;

  return (
    <section className="lhp" aria-labelledby="lhp-title">
      <h2 id="lhp-title" className="lhp__title">Official Link Health</h2>
      <p className="lhp__intro">
        Check that each official application link still works. A check only opens the address once; it never signs in or submits anything.
        Many government portals do not let a browser read their reply, so those show as &quot;Unable to verify&quot; rather than down. For those,
        open the portal yourself and record what you saw. Changed addresses are shown here for you to review and are never saved into a guide automatically.
      </p>
      <p className="lhp__summary" role="status">
        {total} links across {withLinks.length} guides. {attention} need attention.
      </p>
      <label className="lhp-radio">
        <input type="checkbox" checked={onlyAttention} onChange={(e) => setOnlyAttention(e.target.checked)} />
        Show only links that need attention
      </label>
      {rows.length === 0 ? (
        <p className="lhp__empty">{onlyAttention ? 'No links need attention.' : 'No guides have official links to check.'}</p>
      ) : (
        <ul className="lhp__list">
          {rows.map(({ service, links }) => (
            <li key={service.id} className="lhp-service">
              <h3 className="lhp-service__name">{service.name || service.title || service.id}</h3>
              <ul className="lhp-links">
                {links.map((link, i) => (
                  <LinkRow key={`${service.id}:${i}`} service={service} link={link} index={i} record={records[`${service.id}:${i}`]} onChanged={refresh} />
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default LinkHealthPanel;
