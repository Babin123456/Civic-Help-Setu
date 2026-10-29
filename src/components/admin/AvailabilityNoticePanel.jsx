import { useState, useMemo } from 'react';
import {
  PUBLICATION_STATES,
  NOTICE_STATUS,
  NOTICE_TIME_ZONE_LABEL,
  MAX_MESSAGE_LENGTH,
  getAvailabilityNotices,
  addAvailabilityNotice,
  updateAvailabilityNotice,
  publishAvailabilityNotice,
  withdrawAvailabilityNotice,
  deleteAvailabilityNotice,
  getNoticeStatus,
  validateAvailabilityNotice,
  formatNoticeTime,
  istInputToIso,
  isoToIstInput,
} from '../../services/serviceAvailabilityNoticeService';
import { getAllServices } from '../../services/serviceCatalog';
import { AvailabilityNoticeCard } from '../services/ServiceAvailabilityNotice';

const EMPTY_FORM = {
  serviceId: '',
  message: '',
  startsAt: '',
  endsAt: '',
  ongoing: false,
  sourceName: '',
  sourceUrl: '',
  confirmed: false,
};

const STATUS_LABELS = {
  [NOTICE_STATUS.ACTIVE]: 'Showing now',
  [NOTICE_STATUS.UPCOMING]: 'Scheduled',
  [NOTICE_STATUS.EXPIRED]: 'Expired',
  [NOTICE_STATUS.DRAFT]: 'Draft',
  [NOTICE_STATUS.WITHDRAWN]: 'Withdrawn',
  [NOTICE_STATUS.MALFORMED]: 'Invalid, not shown',
};

/** Admin form for manual service availability notices (#274). */
const AvailabilityNoticePanel = () => {
  const services = useMemo(() => getAllServices(), []);
  const [notices, setNotices] = useState(() => getAvailabilityNotices());
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const refresh = () => setNotices(getAvailabilityNotices());
  const setField = (name, value) => setForm((f) => ({ ...f, [name]: value }));
  const serviceName = (id) => services.find((s) => s.id === id)?.name || 'Unknown service';

  // What the form would look like to citizens, built from the typed values.
  const draft = {
    id: 'preview',
    serviceId: form.serviceId,
    message: form.message,
    startsAt: istInputToIso(form.startsAt),
    endsAt: form.ongoing ? '' : istInputToIso(form.endsAt),
    ongoing: form.ongoing,
    sourceName: form.sourceName,
    sourceUrl: form.sourceUrl,
    confirmed: form.confirmed,
    state: PUBLICATION_STATES.DRAFT,
    updatedAt: new Date().toISOString(),
  };
  const draftCheck = validateAvailabilityNotice(draft, services);

  const run = (action, success) => {
    setError('');
    setMessage('');
    try {
      action();
      setMessage(success);
      refresh();
      return true;
    } catch (err) {
      setError(err.message || 'Something went wrong.');
      return false;
    }
  };

  const save = (state) => {
    const payload = { ...draft, state };
    delete payload.id;
    delete payload.updatedAt;
    const ok = run(
      () => (editingId ? updateAvailabilityNotice(editingId, payload) : addAvailabilityNotice(payload)),
      state === PUBLICATION_STATES.PUBLISHED ? 'Notice published.' : 'Notice saved as a draft.'
    );
    if (ok) {
      setForm(EMPTY_FORM);
      setEditingId(null);
    }
  };

  const startEdit = (n) => {
    setEditingId(n.id);
    setError('');
    setMessage('');
    setForm({
      serviceId: n.serviceId || '',
      message: n.message || '',
      startsAt: isoToIstInput(n.startsAt),
      endsAt: isoToIstInput(n.endsAt),
      ongoing: n.ongoing === true,
      sourceName: n.sourceName || '',
      sourceUrl: n.sourceUrl || '',
      confirmed: n.confirmed === true,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError('');
  };

  return (
    <section className="avail-admin" aria-labelledby="avail-admin-title" style={{ marginTop: '2.5rem' }}>
      <h2 id="avail-admin-title" style={{ fontSize: '1.4rem', marginBottom: '0.5rem' }}>
        Service availability notices
      </h2>
      <p className="avail-admin__help">
        Post a temporary notice on a service guide when an official portal is known to be unavailable.
        This is entered by hand and is not an automatic portal check. The guide itself is never changed.
        Times are read and shown in {NOTICE_TIME_ZONE_LABEL}.
      </p>

      <form
        className="avail-admin__form"
        onSubmit={(e) => {
          e.preventDefault();
          save(PUBLICATION_STATES.PUBLISHED);
        }}
      >
        <h3 style={{ fontSize: '1.1rem' }}>{editingId ? 'Edit notice' : 'New notice'}</h3>

        <label className="avail-admin__field">
          <span>Affected service</span>
          <select className="input-field" value={form.serviceId} onChange={(e) => setField('serviceId', e.target.value)} required>
            <option value="">Choose a service</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>

        <label className="avail-admin__field">
          <span>Short explanation ({form.message.length}/{MAX_MESSAGE_LENGTH})</span>
          <textarea
            className="input-field"
            rows={3}
            maxLength={MAX_MESSAGE_LENGTH}
            value={form.message}
            onChange={(e) => setField('message', e.target.value)}
            required
          />
        </label>

        <div className="avail-admin__row">
          <label className="avail-admin__field">
            <span>Starts ({NOTICE_TIME_ZONE_LABEL})</span>
            <input className="input-field" type="datetime-local" value={form.startsAt} onChange={(e) => setField('startsAt', e.target.value)} required />
          </label>
          <label className="avail-admin__field">
            <span>Ends ({NOTICE_TIME_ZONE_LABEL})</span>
            <input
              className="input-field"
              type="datetime-local"
              value={form.ongoing ? '' : form.endsAt}
              onChange={(e) => setField('endsAt', e.target.value)}
              disabled={form.ongoing}
              required={!form.ongoing}
            />
          </label>
        </div>

        <label className="avail-admin__check">
          <input type="checkbox" checked={form.ongoing} onChange={(e) => setField('ongoing', e.target.checked)} />
          <span>Ongoing: the official announcement gives no end time</span>
        </label>

        <div className="avail-admin__row">
          <label className="avail-admin__field">
            <span>Official source name</span>
            <input className="input-field" type="text" value={form.sourceName} onChange={(e) => setField('sourceName', e.target.value)} required />
          </label>
          <label className="avail-admin__field">
            <span>Link to the announcement</span>
            <input className="input-field" type="url" value={form.sourceUrl} onChange={(e) => setField('sourceUrl', e.target.value)} placeholder="https://" />
          </label>
        </div>

        <label className="avail-admin__check">
          <input type="checkbox" checked={form.confirmed} onChange={(e) => setField('confirmed', e.target.checked)} />
          <span>Mark as confirmed (only when an official announcement, linked above, backs this notice)</span>
        </label>

        <div className="avail-admin__preview">
          <h4>Preview</h4>
          {draftCheck.isValid ? (
            <AvailabilityNoticeCard notice={draft} serviceName={serviceName(draft.serviceId)} headingLevel="h5" />
          ) : (
            <ul className="avail-admin__problems" aria-live="polite">
              {draftCheck.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
        </div>

        {error && <p role="alert" className="avail-admin__error">{error}</p>}
        {message && <p role="status" className="avail-admin__ok">{message}</p>}

        <div className="avail-admin__actions">
          <button type="submit" className="btn btn-primary">{editingId ? 'Save and publish' : 'Publish'}</button>
          <button type="button" className="btn btn-secondary" onClick={() => save(PUBLICATION_STATES.DRAFT)}>Save as draft</button>
          {editingId && <button type="button" className="btn btn-secondary" onClick={cancelEdit}>Cancel edit</button>}
        </div>
      </form>

      <h3 style={{ fontSize: '1.1rem', margin: '2rem 0 0.75rem' }}>All notices ({notices.length})</h3>
      {notices.length === 0 ? (
        <p className="avail-admin__help">No availability notices yet.</p>
      ) : (
        <ul className="avail-admin__list">
          {notices.map((n) => {
            const status = getNoticeStatus(n, new Date(), services);
            return (
              <li key={n.id} className="avail-admin__item">
                <div>
                  <strong>{serviceName(n.serviceId)}</strong>{' '}
                  <span className={`avail-admin__status avail-admin__status--${status}`}>{STATUS_LABELS[status]}</span>
                  {n.confirmed && <span className="avail-admin__status avail-admin__status--confirmed">Confirmed</span>}
                  <p className="avail-admin__help">{n.message}</p>
                  <p className="avail-admin__help">
                    {formatNoticeTime(n.startsAt) || 'No valid start'} to {n.ongoing ? 'ongoing' : formatNoticeTime(n.endsAt) || 'no valid end'}.
                    Source: {n.sourceName || 'none'}. Updated {formatNoticeTime(n.updatedAt) || 'unknown'}.
                  </p>
                </div>
                <div className="avail-admin__actions">
                  <button type="button" className="btn btn-secondary" onClick={() => startEdit(n)}>Edit</button>
                  {n.state !== PUBLICATION_STATES.PUBLISHED && (
                    <button type="button" className="btn btn-secondary" onClick={() => run(() => publishAvailabilityNotice(n.id), 'Notice published.')}>Publish</button>
                  )}
                  {n.state === PUBLICATION_STATES.PUBLISHED && (
                    <button type="button" className="btn btn-secondary" onClick={() => run(() => withdrawAvailabilityNotice(n.id), 'Notice withdrawn.')}>Withdraw</button>
                  )}
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      if (window.confirm('Delete this notice permanently? The service guide is not affected.')) {
                        run(() => deleteAvailabilityNotice(n.id), 'Notice deleted.');
                      }
                    }}
                  >
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

export default AvailabilityNoticePanel;
