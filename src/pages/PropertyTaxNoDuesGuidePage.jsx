import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import PropertyTaxNoDuesGuide from '../components/services/PropertyTaxNoDuesGuide';

/**
 * PropertyTaxNoDuesGuidePage Component
 *
 * Dedicated route view for the Property Tax No-Dues Certificate and Payment Receipt Guide (#531).
 * Accessible via `/services/property-tax-no-dues` and `/property-tax-no-dues`.
 */
export default function PropertyTaxNoDuesGuidePage() {
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

        <PropertyTaxNoDuesGuide onBack={() => navigate('/services')} />
      </div>
    </section>
  );
}
