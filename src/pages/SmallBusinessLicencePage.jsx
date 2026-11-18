import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import SmallBusinessLicenceCentre from '../components/services/SmallBusinessLicenceCentre';

/**
 * SmallBusinessLicencePage Component
 *
 * Dedicated route view for the Small-Business Licence Renewal & Closure Checklist Centre (#721).
 * Accessible via `/services/business-licence-checklist` and `/business-licence-checklist`.
 */
export default function SmallBusinessLicencePage() {
  const navigate = useNavigate();

  return (
    <section className="section" style={{ paddingTop: '1.5rem', paddingBottom: '3rem' }}>
      <div className="container">
        <div style={{ marginBottom: '1rem' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate('/services')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.85rem' }}
          >
            <ArrowLeft size={15} />
            <span>Back to All Services</span>
          </button>
        </div>

        <SmallBusinessLicenceCentre />
      </div>
    </section>
  );
}
