import { CalendarClock, ClipboardList, Eye, Lock, Plus, ShieldAlert, Wrench } from 'lucide-react';
import { TreeInventoryEmptyState, TreeStatusBadge } from './TreeInventoryStates';

const tableWrap = { overflowX: 'auto', border: '1px solid var(--border-main)', borderRadius: '0.7rem' };
const thStyle = { textAlign: 'left', padding: '0.55rem 0.7rem', fontSize: '0.78rem', whiteSpace: 'nowrap' };
const tdStyle = { padding: '0.55rem 0.7rem', fontSize: '0.82rem', verticalAlign: 'top' };

const toneForCondition = (condition) =>
  ['healthy', 'fair', 'poor', 'critical', 'dead', 'unknown'].includes(condition) ? condition : 'unknown';

export default function TreeStaffInventory({
  data,
  reminders,
  summary,
  onAction,
  onCreateTree,
  onRefresh,
  canCreate = false,
  canRisk = false,
  canTransition = false,
}) {
  if (!data || data.items.length === 0) {
    return (
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        <TreeInventoryEmptyState
          title="No tree assets match the staff filters"
          message="Adjust the ward, species, condition or inspection due filters. If the register is genuinely empty, register the first tree or import a validated CSV."
        />
        {canCreate && (
          <button type="button" className="btn btn-primary" onClick={onCreateTree} style={{ justifySelf: 'start' }}>
            <Plus size={15} aria-hidden="true" /> Register a tree
          </button>
        )}
      </div>
    );
  }

  return (
    <section aria-labelledby="staff-inventory-heading" style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '0.7rem', alignItems: 'center' }}>
        <div>
          <h2 id="staff-inventory-heading" style={{ margin: 0, fontSize: '1.15rem' }}>
            Staff tree register
          </h2>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
            {data.total} asset{data.total === 1 ? '' : 's'} in scope. Private coordinates and notes are visible only in this
            staff view.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secondary" onClick={onRefresh}>
            Refresh register
          </button>
          {canCreate && (
            <button type="button" className="btn btn-primary" onClick={onCreateTree}>
              <Plus size={15} aria-hidden="true" /> Register a tree
            </button>
          )}
        </div>
      </div>

      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.6rem' }}>
          {[
            ['Total trees', summary.totalTrees],
            ['Inspection overdue', summary.overdueInspections],
            ['Due within 30 days', summary.upcomingInspections],
            ['Open work orders', summary.openWorkOrders],
            ['Reports awaiting review', summary.pendingCitizenReports],
            ['Triage awaiting expert', summary.pendingTriageReview],
          ].map(([label, value]) => (
            <div key={label} style={{ border: '1px solid var(--border-main)', borderRadius: '0.75rem', padding: '0.7rem 0.8rem' }}>
              <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-tertiary)' }}>{label}</span>
              <strong style={{ fontSize: '1.3rem' }}>{value}</strong>
            </div>
          ))}
        </div>
      )}

      <div
        role="note"
        style={{
          display: 'flex',
          gap: '0.5rem',
          alignItems: 'flex-start',
          fontSize: '0.82rem',
          color: 'var(--text-secondary)',
          border: '1px solid var(--border-main)',
          borderRadius: '0.75rem',
          padding: '0.7rem 0.85rem',
        }}
      >
        <Lock size={16} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
        <span>
          Staff-only view. Coordinates are for operational use and must not be copied into public responses. Every action
          below is written to an append-only audit trail with the signed-in staff role.
        </span>
      </div>

      <div style={tableWrap} tabIndex={0} aria-label="Scrollable staff tree table">
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '980px' }}>
          <caption style={{ textAlign: 'left', padding: '0.6rem 0.75rem', fontWeight: 800 }}>
            Tree assets, inspection reminders and permitted staff actions
          </caption>
          <thead>
            <tr style={{ background: 'var(--glass-bg)' }}>
              {['Tree', 'Ward / location', 'Species', 'Condition', 'Status', 'Inspection due', 'Risk', 'Actions'].map((header) => (
                <th key={header} scope="col" style={thStyle}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.items.map((tree) => (
              <tr key={tree.id} style={{ borderTop: '1px solid var(--border-light)' }}>
                <th scope="row" style={{ ...tdStyle, fontWeight: 700 }}>
                  {tree.publicId}
                  <span style={{ display: 'block', fontWeight: 400, color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>
                    {tree.privateCoordinates
                      ? `Private point ${tree.privateCoordinates.lat}, ${tree.privateCoordinates.lng}`
                      : 'No precise point stored'}
                  </span>
                  <span style={{ display: 'block', fontWeight: 400, color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>
                    Public grid {tree.approxCoordinates ? `geo_${Number(tree.approxCoordinates.lat).toFixed(2)}_${Number(tree.approxCoordinates.lng).toFixed(2)}` : 'unknown'}
                  </span>
                </th>
                <td style={tdStyle}>
                  {tree.ward}
                  {tree.locality && <span style={{ display: 'block', color: 'var(--text-tertiary)' }}>{tree.locality}</span>}
                </td>
                <td style={tdStyle}>
                  {tree.species?.commonName || tree.speciesId}
                  <span style={{ display: 'block', fontStyle: 'italic', color: 'var(--text-tertiary)', fontSize: '0.76rem' }}>
                    {tree.species?.scientificName}
                  </span>
                </td>
                <td style={tdStyle}>
                  <TreeStatusBadge tone={toneForCondition(tree.condition)} label={tree.conditionLabel} prefix="Condition" />
                  {tree.privateNotes && (
                    <span style={{ display: 'block', marginTop: '0.3rem', color: 'var(--text-tertiary)', maxWidth: '24ch' }}>
                      Note: {tree.privateNotes}
                    </span>
                  )}
                </td>
                <td style={tdStyle}>{tree.statusLabel}</td>
                <td style={tdStyle}>
                  <TreeStatusBadge tone={tree.inspectionTiming?.status} label={tree.inspectionTiming?.label} prefix="Inspection" />
                  <span style={{ display: 'block', marginTop: '0.2rem', color: 'var(--text-tertiary)' }}>
                    {tree.inspectionDueAt ? new Date(tree.inspectionDueAt).toLocaleDateString('en-IN') : 'Not scheduled'}
                  </span>
                </td>
                <td style={tdStyle}>
                  {tree.riskLabel}
                  <span style={{ display: 'block', color: 'var(--text-tertiary)' }}>State: {tree.risk?.state || 'none'}</span>
                </td>
                <td style={tdStyle}>
                  <div style={{ display: 'grid', gap: '0.35rem', minWidth: '170px' }}>
                    <button type="button" className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.76rem' }} onClick={() => onAction?.('inspect', tree)}>
                      <CalendarClock size={13} aria-hidden="true" /> Schedule / inspect
                    </button>
                    <button type="button" className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.76rem' }} onClick={() => onAction?.('order', tree)}>
                      <Wrench size={13} aria-hidden="true" /> Maintenance order
                    </button>
                    {canRisk && (
                      <button type="button" className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.76rem' }} onClick={() => onAction?.('risk', tree)}>
                        <ShieldAlert size={13} aria-hidden="true" /> Propose risk
                      </button>
                    )}
                    {canTransition && (
                      <button type="button" className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.76rem' }} onClick={() => onAction?.('status', tree)}>
                        <ClipboardList size={13} aria-hidden="true" /> Lifecycle status
                      </button>
                    )}
                    <button type="button" className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.76rem' }} onClick={() => onAction?.('details', tree)}>
                      <Eye size={13} aria-hidden="true" /> Public preview
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {reminders && (reminders.overdue.length > 0 || reminders.upcoming.length > 0) && (
        <section aria-labelledby="inspection-reminders-heading" style={{ display: 'grid', gap: '0.5rem' }}>
          <h3 id="inspection-reminders-heading" style={{ margin: 0, fontSize: '1rem' }}>
            Preventive inspection reminders
          </h3>
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            {reminders.overdue.length} overdue and {reminders.upcoming.length} due within {reminders.dueWithinDays} days.
          </p>
          <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.82rem' }}>
            {[...reminders.overdue, ...reminders.upcoming].slice(0, 10).map((item) => (
              <li key={item.treeId}>
                {item.publicId} ({item.ward}, {item.species}) — {item.timing.label}
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}
