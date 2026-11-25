import { useId, useState } from 'react';
import { KeyRound, Plus } from 'lucide-react';

const initialState = {
  name: '',
  description: '',
  environment: 'sandbox',
  jurisdictionState: '',
  jurisdictionDistrict: '',
  allowedDatasetIds: [],
};

export default function CivicDataApiClientForm({ datasets, onCreate, submitting, error }) {
  const baseId = useId();
  const [values, setValues] = useState(initialState);
  const [localError, setLocalError] = useState('');

  const toggleDataset = (datasetId) => {
    setValues((previous) => ({
      ...previous,
      allowedDatasetIds: previous.allowedDatasetIds.includes(datasetId)
        ? previous.allowedDatasetIds.filter((id) => id !== datasetId)
        : [...previous.allowedDatasetIds, datasetId],
    }));
  };

  const submit = (event) => {
    event.preventDefault();
    setLocalError('');
    if (values.name.trim().length < 2) {
      setLocalError('Give the API client a name of at least 2 characters.');
      return;
    }
    onCreate({
      ...values,
      allowedDatasetIds: values.allowedDatasetIds.length > 0 ? values.allowedDatasetIds : datasets.map((dataset) => dataset.id),
    });
  };

  return (
    <form onSubmit={submit} aria-labelledby={`${baseId}-heading`} style={{ display: 'grid', gap: '0.85rem' }}>
      <div>
        <h3 id={`${baseId}-heading`} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <KeyRound size={18} aria-hidden="true" /> Create API client
        </h3>
        <p style={{ margin: '0.3rem 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Sandbox clients activate immediately with synthetic data. Production requests wait for an administrator.
        </p>
      </div>

      {(localError || error) && (
        <div role="alert" style={{ border: '1px solid rgba(220, 38, 38, 0.4)', background: 'rgba(220, 38, 38, 0.08)', color: 'var(--text-primary)', padding: '0.65rem 0.8rem', borderRadius: '0.5rem' }}>
          {localError || error}
        </div>
      )}

      <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <label style={{ display: 'grid', gap: '0.3rem', fontWeight: 600 }}>
          Client name
          <input className="input" value={values.name} maxLength={80} required onChange={(event) => setValues((previous) => ({ ...previous, name: event.target.value }))} placeholder="Ward dashboard prototype" />
        </label>
        <label style={{ display: 'grid', gap: '0.3rem', fontWeight: 600 }}>
          Environment
          <select className="input" value={values.environment} onChange={(event) => setValues((previous) => ({ ...previous, environment: event.target.value }))}>
            <option value="sandbox">Sandbox (synthetic data)</option>
            <option value="production">Production (admin approval)</option>
          </select>
        </label>
        <label style={{ display: 'grid', gap: '0.3rem', fontWeight: 600 }}>
          Jurisdiction state
          <input className="input" value={values.jurisdictionState} maxLength={60} onChange={(event) => setValues((previous) => ({ ...previous, jurisdictionState: event.target.value }))} placeholder="All or Karnataka" />
        </label>
        <label style={{ display: 'grid', gap: '0.3rem', fontWeight: 600 }}>
          Jurisdiction district
          <input className="input" value={values.jurisdictionDistrict} maxLength={60} onChange={(event) => setValues((previous) => ({ ...previous, jurisdictionDistrict: event.target.value }))} placeholder="All or Bengaluru Urban" />
        </label>
      </div>

      <label style={{ display: 'grid', gap: '0.3rem', fontWeight: 600 }}>
        Purpose
        <textarea className="input" rows={2} maxLength={300} value={values.description} onChange={(event) => setValues((previous) => ({ ...previous, description: event.target.value }))} placeholder="What will this integration build, and how often will it request data?" />
      </label>

      <fieldset style={{ border: '1px solid var(--border-main)', borderRadius: '0.6rem', padding: '0.75rem' }}>
        <legend style={{ fontWeight: 700, padding: '0 0.35rem' }}>Allowed datasets</legend>
        <div style={{ display: 'grid', gap: '0.45rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          {datasets.map((dataset) => (
            <label key={dataset.id} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.9rem' }}>
              <input
                type="checkbox"
                checked={values.allowedDatasetIds.includes(dataset.id)}
                onChange={() => toggleDataset(dataset.id)}
              />
              {dataset.name}
            </label>
          ))}
        </div>
      </fieldset>

      <button type="submit" className="btn btn-primary" disabled={submitting} style={{ justifySelf: 'start' }}>
        <Plus size={16} aria-hidden="true" /> {submitting ? 'Creating…' : 'Create client'}
      </button>
    </form>
  );
}
