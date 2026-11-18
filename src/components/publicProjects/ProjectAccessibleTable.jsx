import {
  Clock,
  Compass,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  MapPin,
} from 'lucide-react';
import {
  PROJECT_STATUSES,
  PROJECT_CATEGORY_LABELS,
} from '../../services/publicProjectService';

const STATUS_ICONS = {
  [PROJECT_STATUSES.PLANNED]: Clock,
  [PROJECT_STATUSES.ACTIVE]: Compass,
  [PROJECT_STATUSES.DELAYED]: AlertTriangle,
  [PROJECT_STATUSES.COMPLETED]: CheckCircle2,
  [PROJECT_STATUSES.ABANDONED]: AlertTriangle,
};

const formatInr = (amount) => {
  if (typeof amount !== 'number') return '₹0';
  if (amount >= 10000000) {
    return `₹${(amount / 10000000).toFixed(2)} Cr`;
  }
  if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(2)} Lakh`;
  }
  return `₹${amount.toLocaleString('en-IN')}`;
};

const ProjectAccessibleTable = ({
  projects = [],
  selectedProjectId = null,
  onSelectProject,
}) => {
  if (!projects || projects.length === 0) {
    return (
      <div
        style={{
          padding: '2rem',
          textAlign: 'center',
          background: 'var(--bg-card, #1e293b)',
          borderRadius: '8px',
          border: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
          color: 'var(--text-secondary, #94a3b8)',
        }}
      >
        No public infrastructure projects match the selected filters.
      </div>
    );
  }

  return (
    <div
      className="project-accessible-table-wrapper"
      style={{
        overflowX: 'auto',
        background: 'var(--bg-card, #1e293b)',
        borderRadius: '12px',
        border: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
      }}
    >
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '0.875rem',
          textAlign: 'left',
        }}
        aria-label="Public Infrastructure Projects and Progress Register"
      >
        <caption className="sr-only" style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden' }}>
          Accessible Register of Public Infrastructure Projects showing progress and jurisdiction
        </caption>
        <thead>
          <tr
            style={{
              borderBottom: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
              background: 'rgba(255, 255, 255, 0.03)',
            }}
          >
            <th scope="col" style={{ padding: '0.9rem 1rem', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)' }}>
              Project & Corridor
            </th>
            <th scope="col" style={{ padding: '0.9rem 1rem', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)' }}>
              Category
            </th>
            <th scope="col" style={{ padding: '0.9rem 1rem', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)' }}>
              Ward / Zone
            </th>
            <th scope="col" style={{ padding: '0.9rem 1rem', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)' }}>
              Budget
            </th>
            <th scope="col" style={{ padding: '0.9rem 1rem', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)' }}>
              Status
            </th>
            <th scope="col" style={{ padding: '0.9rem 1rem', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)' }}>
              Progress
            </th>
            <th scope="col" style={{ padding: '0.9rem 1rem', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)', textAlign: 'right' }}>
              Action
            </th>
          </tr>
        </thead>
        <tbody>
          {projects.map((proj) => {
            const isSelected = proj.id === selectedProjectId;
            const Icon = STATUS_ICONS[proj.status] || Compass;

            return (
              <tr
                key={proj.id}
                style={{
                  borderBottom: '1px solid var(--border-light, rgba(255, 255, 255, 0.06))',
                  background: isSelected ? 'rgba(56, 189, 248, 0.08)' : 'transparent',
                  transition: 'background 0.15s ease',
                }}
              >
                <td style={{ padding: '0.85rem 1rem', maxWidth: '280px' }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary, #f8fafc)', marginBottom: '0.2rem' }}>
                    {proj.title}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <MapPin size={12} />
                    <span>{proj.locationGeometry?.landmark || 'Location mapped'}</span>
                  </div>
                </td>

                <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary, #94a3b8)' }}>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      padding: '0.2rem 0.5rem',
                      borderRadius: '4px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      display: 'inline-block',
                    }}
                  >
                    {PROJECT_CATEGORY_LABELS[proj.category] || proj.category}
                  </span>
                </td>

                <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary, #94a3b8)' }}>
                  <div style={{ fontWeight: 500, color: 'var(--text-primary, #f8fafc)' }}>
                    {proj.jurisdiction?.wardNumber}
                  </div>
                  <div style={{ fontSize: '0.75rem' }}>{proj.jurisdiction?.zone}</div>
                </td>

                <td style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--text-primary, #f8fafc)' }}>
                  {formatInr(proj.budgetReference?.sanctionedAmountInr)}
                </td>

                <td style={{ padding: '0.85rem 1rem' }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      padding: '0.2rem 0.6rem',
                      borderRadius: '999px',
                      background: 'rgba(255, 255, 255, 0.06)',
                      color: proj.status === 'COMPLETED' ? '#10b981' : proj.status === 'DELAYED' ? '#f59e0b' : '#38bdf8',
                    }}
                  >
                    <Icon size={12} />
                    {proj.status}
                  </span>
                </td>

                <td style={{ padding: '0.85rem 1rem', minWidth: '120px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div
                      style={{
                        flex: 1,
                        height: '6px',
                        background: 'rgba(255, 255, 255, 0.1)',
                        borderRadius: '3px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${proj.overallProgressPercent}%`,
                          height: '100%',
                          background: proj.overallProgressPercent === 100 ? '#10b981' : 'var(--accent-main, #38bdf8)',
                          borderRadius: '3px',
                        }}
                      />
                    </div>
                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary, #f8fafc)' }}>
                      {proj.overallProgressPercent}%
                    </span>
                  </div>
                </td>

                <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{
                      fontSize: '0.78rem',
                      padding: '0.35rem 0.75rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                    }}
                    onClick={() => onSelectProject && onSelectProject(proj.id)}
                    aria-label={`View timeline for ${proj.title}`}
                  >
                    <span>Timeline</span>
                    <ExternalLink size={13} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default ProjectAccessibleTable;
