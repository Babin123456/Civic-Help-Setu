import {
  FileText,
  Plus,
} from 'lucide-react';
import { ROAD_AUTHORITY_METADATA } from '../../data/upSchoolZoneSafetyContract';

export default function SchoolZoneDirectoryTable({
  schools = [],
  onConductAuditForSchool,
  onExportSmcForSchool,
}) {
  return (
    <div style={{ marginTop: '0.5rem', overflowX: 'auto' }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          background: 'var(--bg-card, #ffffff)',
          borderRadius: '0.625rem',
          border: '1px solid var(--border-light, #e2e8f0)',
          fontSize: '0.86rem',
        }}
      >
        <thead>
          <tr style={{ background: 'rgba(15, 23, 42, 0.03)', textAlign: 'left', borderBottom: '1px solid var(--border-light, #e2e8f0)' }}>
            <th style={{ padding: '0.75rem 1rem' }}>UDISE+ & School Name</th>
            <th style={{ padding: '0.75rem 1rem' }}>District & Scope</th>
            <th style={{ padding: '0.75rem 1rem' }}>Verified Entrance Gates</th>
            <th style={{ padding: '0.75rem 1rem' }}>Default Road Authority</th>
            <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {schools.map((school) => {
            const primaryEntrance = school.verifiedEntrances?.[0];
            const authorityMeta = ROAD_AUTHORITY_METADATA[primaryEntrance?.defaultAuthority];

            return (
              <tr key={school.id} style={{ borderBottom: '1px solid var(--border-light, #f1f5f9)' }}>
                <td style={{ padding: '0.75rem 1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '0.1rem 0.4rem',
                        borderRadius: '0.25rem',
                        background: 'rgba(59, 130, 246, 0.1)',
                        color: 'var(--primary, #2563eb)',
                        fontFamily: 'monospace',
                      }}
                    >
                      {school.udiseCode}
                    </span>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary, #64748b)' }}>
                      (~{school.studentCount} students)
                    </span>
                  </div>
                  <div style={{ fontWeight: 700, marginTop: '0.2rem' }}>{school.name}</div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-tertiary, #64748b)' }}>
                    {school.category}
                  </div>
                </td>

                <td style={{ padding: '0.75rem 1rem' }}>
                  <div style={{ fontWeight: 600 }}>{school.district}</div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary, #64748b)' }}>
                    {school.blockOrWard}
                  </div>
                  <span
                    style={{
                      display: 'inline-block',
                      marginTop: '0.2rem',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      padding: '0.1rem 0.35rem',
                      borderRadius: '0.2rem',
                      background: 'rgba(100, 116, 139, 0.1)',
                      color: 'var(--text-secondary, #475569)',
                      textTransform: 'capitalize',
                    }}
                  >
                    {school.locationType} corridor
                  </span>
                </td>

                <td style={{ padding: '0.75rem 1rem' }}>
                  {school.verifiedEntrances?.map((ent) => (
                    <div key={ent.gateId} style={{ marginBottom: '0.35rem', fontSize: '0.8rem' }}>
                      <strong>{ent.name}:</strong> Facing {ent.facingRoadName}
                    </div>
                  ))}
                </td>

                <td style={{ padding: '0.75rem 1rem' }}>
                  <div style={{ fontWeight: 600 }}>{authorityMeta?.shortName || primaryEntrance?.defaultAuthority}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary, #64748b)' }}>
                    {primaryEntrance?.authoritySource}
                  </div>
                </td>

                <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                  <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => onExportSmcForSchool(school.id)}
                      style={{ padding: '0.35rem 0.6rem', fontSize: '0.78rem' }}
                      title="Generate SMC printable dossier"
                    >
                      <FileText size={14} /> SMC
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => onConductAuditForSchool(school.id)}
                      style={{
                        padding: '0.35rem 0.75rem',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        background: 'var(--primary, #2563eb)',
                        color: '#ffffff',
                      }}
                    >
                      <Plus size={14} /> Audit
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
