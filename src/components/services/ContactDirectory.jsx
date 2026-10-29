import { Phone, Mail, Globe, ShieldCheck, AlertTriangle } from 'lucide-react';
import { getServiceContacts } from '../../services/contactDirectoryService';
import { formatVerificationDate } from '../../services/sourceVerificationService';
import { safeHttpUrl } from '../../utils/safeContent';

const METHOD_ICON = { phone: Phone, email: Mail, web: Globe };
const ACTION_LABEL = { phone: 'Call', email: 'Email', web: 'Open website' };

const ContactItem = ({ item }) => {
  const { contact, status, typeLabel, methodLabel, href } = item;
  const Icon = METHOD_ICON[contact.method] || Globe;
  const verifiedOn = formatVerificationDate(contact.lastVerified);
  const isVerified = status === 'verified';
  const isInvalid = status === 'invalid';

  return (
    <li className={`contact-dir__item contact-dir__item--${status}`}>
      <div className="contact-dir__head">
        <h4 className="contact-dir__type">{typeLabel}</h4>
        {isVerified ? (
          <span className="contact-dir__badge contact-dir__badge--ok">
            <ShieldCheck size={13} aria-hidden="true" /> Verified
          </span>
        ) : (
          <span className="contact-dir__badge contact-dir__badge--warn">
            <AlertTriangle size={13} aria-hidden="true" /> Needs admin review
          </span>
        )}
      </div>

      {isInvalid ? (
        <p className="contact-dir__note">
          This contact entry is incomplete or malformed, so it is not shown. It has been flagged for admin review.
        </p>
      ) : (
        <>
          <p className="contact-dir__value">
            <Icon size={16} aria-hidden="true" />
            <span className="contact-dir__method">{methodLabel}:</span>{' '}
            {href ? (
              <a
                href={href}
                {...(contact.method === 'web' ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                aria-label={`${ACTION_LABEL[contact.method]} ${typeLabel}: ${contact.value}${contact.method === 'web' ? ' (opens in new tab)' : ''}`}
              >
                {contact.value}
              </a>
            ) : (
              <span>{contact.value}</span>
            )}
          </p>
          {contact.hours && (
            <p className="contact-dir__meta">Published hours: {contact.hours}</p>
          )}
          <p className="contact-dir__meta">
            {verifiedOn ? `Last verified ${verifiedOn}.` : null}{' '}
            <a href={safeHttpUrl(contact.sourceUrl) || undefined} target="_blank" rel="noopener noreferrer">
              Official source<span className="sr-only"> (opens in new tab)</span>
            </a>
          </p>
          {!isVerified && (
            <p className="contact-dir__note">
              This contact was last verified more than a year ago, or its date cannot be trusted. Confirm it on the official source before relying on it.
            </p>
          )}
        </>
      )}
    </li>
  );
};

const ContactDirectory = ({ service }) => {
  const { items, hasContacts } = getServiceContacts(service);

  return (
    <section className="contact-dir" aria-labelledby="contact-dir-heading">
      <h3 id="contact-dir-heading" className="contact-dir__title">
        Contact &amp; Escalation Directory
      </h3>
      <p className="contact-dir__intro">
        Official department, helpdesk and grievance channels for this service. These are not nearby physical offices.
      </p>
      {hasContacts ? (
        <ul className="contact-dir__list">
          {items.map((item, idx) => (
            <ContactItem key={idx} item={item} />
          ))}
        </ul>
      ) : (
        <p className="contact-dir__empty">No verified contact listed</p>
      )}
    </section>
  );
};

export default ContactDirectory;
