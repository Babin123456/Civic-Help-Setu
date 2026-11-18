import { Link } from 'react-router-dom';
import { FileWarning } from 'lucide-react';
import ComparisonSourceLink from './ComparisonSourceLink';
import { buildComparisonRows } from '../../services/officeComparisonService';

/**
 * Semantic comparison table (#824).
 *
 * Offices are columns and attributes are rows. A caption describes the table,
 * every column and row has a proper header, and the scroll container is
 * keyboard-focusable. The table is the non-visual alternative to the cards and
 * map; it repeats every value as text and never relies on colour alone.
 */
const ComparisonTable = ({ records = [], service = null, onReportOutdated }) => {
  const rows = buildComparisonRows(records);
  const serviceName = service?.name || 'selected service';
  const serviceQuery = service?.id ? `?service=${encodeURIComponent(service.id)}` : '';
  const recordHref = (id) => `/office/${encodeURIComponent(id)}${serviceQuery}`;

  if (!Array.isArray(records) || records.length < 2) {
    return (
      <section className="comparison-table-empty" role="status">
        <h3>Select at least two offices</h3>
        <p>
          Choose two or three offices on the cards to build a side-by-side comparison. Selected offices stay selected
          when you change pages.
        </p>
      </section>
    );
  }

  return (
    <div
      className="comparison-table-wrap"
      role="region"
      aria-label={`Comparison table for ${serviceName}`}
      tabIndex={0}
    >
      <p className="comparison-table-hint">
        On a narrow screen, scroll this table horizontally. The same information is available in the office cards.
      </p>
      <table className="comparison-table">
        <caption>
          Side-by-side comparison for {serviceName}. All values come from the local office registry, data version{' '}
          {records[0]?.dataVersion || 'unknown'}. Match labels are deterministic suggestions, not official decisions.
        </caption>
        <thead>
          <tr>
            <th scope="col">Attribute</th>
            {records.map((record) => (
              <th scope="col" key={record.id}>
                <Link to={recordHref(record.id)}>{record.name}</Link>
                <span className="comparison-table__subhead">{record.jurisdiction.officeLabel}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <th scope="row">{row.label}</th>
              {row.cells.map((cell, index) => (
                <td
                  key={`${row.key}-${records[index].id}`}
                  className={cell.isUnknown ? 'is-unknown' : ''}
                  data-tone={cell.tone || undefined}
                >
                  <span className="comparison-table__value">{cell.isUnknown ? 'Unknown' : cell.value}</span>
                  {cell.detail && <span className="comparison-table__detail">{cell.detail}</span>}
                  {cell.source && <ComparisonSourceLink source={cell.source} label="Source" />}
                </td>
              ))}
            </tr>
          ))}
          <tr>
            <th scope="row">Actions</th>
            {records.map((record) => (
              <td key={`actions-${record.id}`}>
                <Link className="comparison-table__action" to={recordHref(record.id)}>
                  Open record
                </Link>
                {onReportOutdated && (
                  <button
                    type="button"
                    className="comparison-table__action"
                    onClick={() => onReportOutdated(record.id)}
                  >
                    <FileWarning size={13} aria-hidden="true" /> Report outdated
                  </button>
                )}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default ComparisonTable;
