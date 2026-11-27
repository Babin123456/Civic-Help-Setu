import AccessibleModal from '../common/AccessibleModal';
import {
  ExternalLink,
  Clock,
  BookOpen,
  Globe,
  FileText,
  AlertCircle,
  Building2,
  CheckCircle,
  HelpCircle,
  ShieldCheck,
  Accessibility,
} from 'lucide-react';
import { LIBRARY_TYPE_LABELS, MEMBERSHIP_CATEGORY_LABELS, DIGITAL_ACCESS_TYPE_LABELS } from '../../data/libraryContract';
import { REQUIREMENT_LABELS } from '../../services/requirementTypes';
import { safeHttpUrl } from '../../utils/safeContent';

export default function LibraryDetailModal({
  isOpen,
  onClose,
  library,
  onOpenChecklist,
}) {
  if (!library) return null;

  const typeLabel = LIBRARY_TYPE_LABELS[library.libraryType] || 'Public Library';
  const portalUrl = safeHttpUrl(library.officialContact?.portalUrl);
  const opacUrl = safeHttpUrl(library.officialContact?.opacCatalogueUrl);
  const sourceUrl = safeHttpUrl(library.auditMetadata?.sourceUrl);

  return (
    <AccessibleModal
      isOpen={isOpen}
      onClose={onClose}
      title={library.name}
      subtitle={`${typeLabel} • Managed by ${library.managingAuthority}`}
      maxWidth="720px"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Anti-Guesswork / Live Availability Disclaimer Banner */}
        <div
          role="note"
          aria-label="Important information regarding facility status"
          style={{
            backgroundColor: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            borderRadius: '0.75rem',
            padding: '0.75rem 1rem',
            fontSize: '0.85rem',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.5rem',
          }}
        >
          <AlertCircle size={18} style={{ color: 'var(--warning, #f59e0b)', flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong style={{ color: 'var(--text-primary)' }}>Live Seating Disclaimer:</strong> Civic Help Setu does not track live seat vacancy or real-time reading hall queues. Official regulations prohibit speculative seat counts. Please consult the circulation desk directly upon arrival.
          </div>
        </div>

        {/* Official Authority & Contacts */}
        <section style={{ backgroundColor: 'var(--bg-main)', padding: '1rem', borderRadius: '0.75rem', border: '1px solid var(--border-light)' }}>
          <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Building2 size={16} /> Library Authority & Official Contacts
          </h4>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
            <strong>Address:</strong> {library.address}, {library.district}, {library.state} - {library.pincode}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.85rem' }}>
            <div>
              <strong>Official Phone:</strong>{' '}
              {library.officialContact?.phone?.map((ph, idx) => (
                <a key={idx} href={`tel:${ph.replace(/\s+/g, '')}`} style={{ color: 'var(--accent-main)', textDecoration: 'underline', marginRight: '0.5rem' }}>
                  {ph}
                </a>
              ))}
            </div>
            {portalUrl && (
              <div>
                <a href={portalUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-main)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', textDecoration: 'underline' }}>
                  Official Portal <ExternalLink size={13} />
                </a>
              </div>
            )}
            {opacUrl && (
              <div>
                <a href={opacUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-main)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', textDecoration: 'underline' }}>
                  OPAC Online Catalogue <ExternalLink size={13} />
                </a>
              </div>
            )}
          </div>
        </section>

        {/* Operating Hours */}
        <section>
          <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Clock size={16} /> Operating Hours & Reading Hall Timings
          </h4>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <div><strong>General Library Hours:</strong> {library.operatingHours?.hours || 'Operating hours not officially published.'}</div>
            {library.operatingHours?.readingRoomHours && (
              <div><strong>Reading Room Hours:</strong> {library.operatingHours.readingRoomHours}</div>
            )}
            {Array.isArray(library.operatingHours?.closedDays) && library.operatingHours.closedDays.length > 0 && (
              <div><strong>Closed on:</strong> {library.operatingHours.closedDays.join(', ')}</div>
            )}
          </div>
        </section>

        {/* Official Instructions vs Editorial Summaries Separator */}
        <div style={{ padding: '0.5rem 0.75rem', backgroundColor: 'var(--bg-main)', borderLeft: '4px solid var(--accent-main)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          <strong style={{ color: 'var(--text-primary)' }}>Official Sourced Instructions:</strong> The membership tariffs, document requirements, and renewal rules below reflect dated gazette records published by {library.managingAuthority}. Editorial interpretations are excluded.
        </div>

        {/* Membership Categories & Sourced Statutory Charges */}
        <section>
          <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <BookOpen size={16} /> Membership Categories & Statutory Charges
          </h4>
          {Array.isArray(library.membershipCategories) && library.membershipCategories.length > 0 ? (
            <div style={{ border: '1px solid var(--border-light)', borderRadius: '0.5rem', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                <thead style={{ backgroundColor: 'var(--bg-main)', borderBottom: '1px solid var(--border-light)' }}>
                  <tr>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Category</th>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Annual Fee</th>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Caution Deposit</th>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Book Quota</th>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Loan Period</th>
                  </tr>
                </thead>
                <tbody>
                  {library.membershipCategories.map((cat, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                        {MEMBERSHIP_CATEGORY_LABELS[cat.category] || cat.category}
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>₹{cat.annualFee}</td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>
                        ₹{cat.cautionDeposit || 0}{' '}
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                          ({cat.isDepositRefundable ? 'Refundable' : 'Non-ref'})
                        </span>
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>{cat.maxBooksAllowed} books</td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>{cat.loanPeriodDays} days</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
              Official statutory fee schedule is unavailable from published records. Please verify directly with the librarian at the circulation desk.
            </p>
          )}

          {library.statutoryCharges?.lateFinesPerDay !== undefined && (
            <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              <strong>Overdue Fine:</strong> ₹{library.statutoryCharges.lateFinesPerDay} per day per overdue item.
            </div>
          )}
        </section>

        {/* Renewal Rules */}
        <section>
          <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            Book Loan & Renewal Rules
          </h4>
          {library.renewalRules ? (
            <div style={{ backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-light)', borderRadius: '0.5rem', padding: '0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <div>• <strong>Standard Borrowing Period:</strong> {library.renewalRules.loanPeriodDays} calendar days.</div>
              <div>• <strong>Maximum Consecutive Renewals:</strong> {library.renewalRules.maxRenewalsAllowed} time(s).</div>
              <div>
                • <strong>Online OPAC Renewal:</strong>{' '}
                {library.renewalRules.onlineRenewalAvailable
                  ? 'Supported online via library catalogue portal.'
                  : 'Not supported online. In-person counter presentation of books is mandatory.'}
              </div>
              {library.renewalRules.conditions && (
                <div style={{ marginTop: '0.25rem' }}>• <strong>Conditions:</strong> {library.renewalRules.conditions}</div>
              )}
            </div>
          ) : (
            <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
              Renewal regulations not verified in published public circulars.
            </p>
          )}
        </section>

        {/* Government Digital Learning Resources */}
        <section>
          <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Globe size={16} /> Government-Supported Digital Learning Resources
          </h4>
          {Array.isArray(library.digitalLearningResources) && library.digitalLearningResources.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {library.digitalLearningResources.map((res, idx) => {
                const safeUrl = safeHttpUrl(res.url);
                return (
                  <div
                    key={idx}
                    style={{
                      border: '1px solid var(--border-light)',
                      borderRadius: '0.5rem',
                      padding: '0.75rem',
                      backgroundColor: 'var(--bg-main)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{res.name}</strong>
                      <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem', borderRadius: '4px', backgroundColor: 'rgba(56, 189, 248, 0.12)', color: 'var(--accent-main)' }}>
                        {DIGITAL_ACCESS_TYPE_LABELS[res.accessType] || res.accessType}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', margin: '0.2rem 0 0.4rem' }}>
                      Provider: {res.provider}
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 0.4rem', lineHeight: 1.4 }}>
                      {res.description}
                    </p>
                    {safeUrl && (
                      <a
                        href={safeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: '0.8rem',
                          color: 'var(--accent-main)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          textDecoration: 'underline',
                        }}
                      >
                        Access Learning Resource <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
              No digital learning resources registered for this facility.
            </p>
          )}
        </section>

        {/* Required Documents & Verification States */}
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <FileText size={16} /> Application Requirements & Proofs
            </h4>
            {onOpenChecklist && (
              <button
                type="button"
                onClick={() => onOpenChecklist(library)}
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: 'var(--accent-main)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Open Checklist
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {Array.isArray(library.requiredDocuments) && library.requiredDocuments.length > 0 ? (
              library.requiredDocuments.map((doc, idx) => {
                const badgeColor =
                  doc.type === 'required' ? 'rgba(22, 163, 74, 0.15)' :
                  doc.type === 'conditional' ? 'rgba(56, 189, 248, 0.15)' :
                  doc.type === 'optional' ? 'rgba(147, 51, 234, 0.15)' : 'rgba(148, 163, 184, 0.2)';
                const textColor =
                  doc.type === 'required' ? 'var(--success, #16a34a)' :
                  doc.type === 'conditional' ? 'var(--accent-main, #0284c7)' :
                  doc.type === 'optional' ? '#9333ea' : 'var(--text-tertiary)';

                return (
                  <div
                    key={idx}
                    style={{
                      padding: '0.6rem 0.75rem',
                      backgroundColor: 'var(--bg-main)',
                      borderRadius: '0.5rem',
                      border: '1px solid var(--border-light)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.2rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>{doc.name}</span>
                      <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '4px', backgroundColor: badgeColor, color: textColor, fontWeight: 600 }}>
                        {REQUIREMENT_LABELS[doc.type] || 'Unverified'}
                      </span>
                    </div>
                    {doc.condition && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Condition: {doc.condition}</span>
                    )}
                  </div>
                );
              })
            ) : (
              <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                Application document requirements are unverified for this library. Check with the official desk.
              </p>
            )}
          </div>
        </section>

        {/* Accessibility Details */}
        <section>
          <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Accessibility size={16} /> Physical & Digital Accessibility
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              {library.accessibility?.wheelchairAccessible ? <CheckCircle size={15} color="var(--success, #16a34a)" /> : <HelpCircle size={15} color="var(--text-tertiary)" />}
              <span>Wheelchair Accessible: {library.accessibility?.wheelchairAccessible ? 'Yes' : 'Not verified'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              {library.accessibility?.brailleSection ? <CheckCircle size={15} color="var(--success, #16a34a)" /> : <HelpCircle size={15} color="var(--text-tertiary)" />}
              <span>Braille Book Section: {library.accessibility?.brailleSection ? 'Available' : 'Unavailable'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              {library.accessibility?.screenReaderWorkstations ? <CheckCircle size={15} color="var(--success, #16a34a)" /> : <HelpCircle size={15} color="var(--text-tertiary)" />}
              <span>Screen Reader Workstations: {library.accessibility?.screenReaderWorkstations ? 'Available' : 'Unavailable'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              {library.accessibility?.audioBooksAvailable ? <CheckCircle size={15} color="var(--success, #16a34a)" /> : <HelpCircle size={15} color="var(--text-tertiary)" />}
              <span>DAISY / Audiobooks: {library.accessibility?.audioBooksAvailable ? 'Available' : 'Unavailable'}</span>
            </div>
          </div>
        </section>

        {/* Audit Provenance & Verification Details */}
        <section style={{ backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-light)', borderRadius: '0.75rem', padding: '0.75rem 1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            <ShieldCheck size={16} color="var(--success, #16a34a)" /> Official Sourced Provenance
          </div>
          <div>All jurisdiction-specific claims in this record are derived from published statutory gazette circulars.</div>
          <div style={{ marginTop: '0.35rem', display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
            {sourceUrl && (
              <div>
                <strong>Official Source:</strong>{' '}
                <a href={sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-main)', textDecoration: 'underline' }}>
                  Dated Authority Document <ExternalLink size={11} />
                </a>
              </div>
            )}
            <div><strong>Effective Date:</strong> {library.auditMetadata?.effectiveDate || 'Unspecified'}</div>
            <div><strong>Last Verified:</strong> {library.auditMetadata?.lastVerified || 'Pending'}</div>
            <div><strong>Verified By:</strong> {library.auditMetadata?.verifiedBy || 'Civic Help Setu Audit Team'}</div>
          </div>
        </section>
      </div>
    </AccessibleModal>
  );
}

