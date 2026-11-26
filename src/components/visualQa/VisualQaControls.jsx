import { Download, Filter, Play, RotateCcw, Save, Server } from 'lucide-react';
import { CONTENT_LENGTHS, VIEWPORTS } from '../../services/catalogueVisualQaService';

const contentLengthLabel = { short: 'Short (typical)', long: 'Long (stress test)' };

export default function VisualQaControls({
  filters,
  categories,
  languages,
  onChange,
  onReset,
  onRunServerScan,
  onExport,
  onSaveBaseline,
  serverStatus = 'idle',
  exportDisabled = false,
  baselineDisabled = false,
}) {
  const toggleViewport = (id, checked) => {
    const current = new Set(filters.viewportIds);
    if (checked) current.add(id);
    else current.delete(id);
    const next = VIEWPORTS.map((viewport) => viewport.id).filter((viewportId) => current.has(viewportId));
    onChange({ viewportIds: next.length > 0 ? next : [id] });
  };

  return (
    <form
      className="qa-controls"
      aria-labelledby="qa-controls-heading"
      onSubmit={(event) => {
        event.preventDefault();
        onChange({ page: 1 });
      }}
    >
      <div className="qa-controls-heading">
        <div>
          <h2 id="qa-controls-heading">
            <Filter size={18} aria-hidden="true" /> Scan controls
          </h2>
          <p>
            Every value below changes only synthetic fixture generation. Production catalogue records and
            citizen data are never read.
          </p>
        </div>
        <div className="qa-control-actions">
          <button type="submit" className="qa-button qa-button--primary">
            <Play size={15} aria-hidden="true" /> Run local scan
          </button>
          <button type="button" className="qa-button" onClick={onReset}>
            <RotateCcw size={15} aria-hidden="true" /> Reset filters
          </button>
        </div>
      </div>

      <div className="qa-control-grid">
        <label className="qa-field">
          <span>Category</span>
          <select
            value={filters.category}
            onChange={(event) => onChange({ category: event.target.value, page: 1 })}
          >
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>

        <label className="qa-field">
          <span>Language / script</span>
          <select
            value={filters.language}
            onChange={(event) => onChange({ language: event.target.value, page: 1 })}
          >
            {languages.map((language) => (
              <option key={language.code} value={language.code}>
                {language.label} — {language.native}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="qa-field qa-fieldset">
          <legend>Content length</legend>
          <div className="qa-segmented">
            {CONTENT_LENGTHS.map((length) => (
              <label key={length}>
                <input
                  type="radio"
                  name="qa-content-length"
                  value={length}
                  checked={filters.contentLength === length}
                  onChange={() => onChange({ contentLength: length, page: 1 })}
                />
                <span>{contentLengthLabel[length]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="qa-field qa-fieldset">
          <legend>Viewports</legend>
          <div className="qa-check-row">
            {VIEWPORTS.map((viewport) => (
              <label key={viewport.id}>
                <input
                  type="checkbox"
                  checked={filters.viewportIds.includes(viewport.id)}
                  onChange={(event) => toggleViewport(viewport.id, event.target.checked)}
                />
                <span>
                  {viewport.label} <small>{viewport.width}px</small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="qa-field">
          <span>Fixture seed</span>
          <input
            type="number"
            min="0"
            max="2147483647"
            step="1"
            value={filters.seed}
            onChange={(event) => {
              const value = Number(event.target.value);
              if (Number.isSafeInteger(value) && value >= 0) onChange({ seed: value, page: 1 });
            }}
          />
          <small>The same seed and filters always produce the same synthetic fixtures.</small>
        </label>

        <label className="qa-field">
          <span>Cards per page</span>
          <select
            value={filters.pageSize}
            onChange={(event) => onChange({ page: 1, pageSize: Number(event.target.value) })}
          >
            {[6, 9, 12, 24].map((size) => (
              <option key={size} value={size}>
                {size} fixtures
              </option>
            ))}
          </select>
        </label>

        <label className="qa-check">
          <input
            type="checkbox"
            checked={filters.showBoxes}
            onChange={(event) => onChange({ showBoxes: event.target.checked })}
          />
          <span>Show bounding boxes and overflow markers</span>
        </label>
      </div>

      <div className="qa-control-footer">
        <div className="qa-control-actions">
          <button
            type="button"
            className="qa-button"
            onClick={onRunServerScan}
            disabled={serverStatus === 'loading'}
            aria-busy={serverStatus === 'loading'}
          >
            <Server size={15} aria-hidden="true" />
            {serverStatus === 'loading' ? 'Verifying on server…' : 'Verify on server'}
          </button>
          <button type="button" className="qa-button" onClick={onExport} disabled={exportDisabled}>
            <Download size={15} aria-hidden="true" /> Export review snapshot
          </button>
          <button type="button" className="qa-button" onClick={onSaveBaseline} disabled={baselineDisabled}>
            <Save size={15} aria-hidden="true" /> Set as screenshot baseline
          </button>
        </div>
        <p className="qa-control-note">
          Server verification repeats the same deterministic rules through <code>/api/catalogue-visual-qa</code>.
          Export is a browser download; it is not an official government status.
        </p>
      </div>
    </form>
  );
}
