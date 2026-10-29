import { Link } from 'react-router-dom';

/** Shown on a service page when the guide has been archived (retired). */
const RetiredServiceNotice = ({ service }) => {
  if (!service || service.archived !== true) return null;
  return (
    <div className="retired-notice" role="status">
      <h2 className="retired-notice__title">This service guide has been retired</h2>
      <p className="retired-notice__text">
        It is no longer in the public directory
        {service.archivedAt ? ` (archived ${service.archivedAt})` : ''}, so the details below may be out of date.
        Check the official source before relying on them.
      </p>
      <Link to="/services" className="btn btn-secondary">
        Browse current services
      </Link>
    </div>
  );
};

export default RetiredServiceNotice;
