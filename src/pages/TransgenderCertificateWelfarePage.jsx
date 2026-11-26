import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import TransgenderCertificateWelfareGuide from '../components/services/TransgenderCertificateWelfareGuide';

/**
 * Transgender Certificate and Welfare Scheme Application Navigator Page
 * GitHub Issue #1104
 *
 * Routes:
 * - /services/transgender-certificate-welcome
 * - /transgender-certificate-welcome
 * - /services/transgender-certificate-welfare
 * - /transgender-certificate-welfare
 *
 * Privacy-first: all guidance runs browser-local. No identity documents collected.
 * Respectful, inclusive language. Accessible and multilingual.
 */
export default function TransgenderCertificateWelfarePage() {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Transgender Certificate & Welfare Navigator | Civic Help Setu';
  }, []);

  return (
    <section className="section" style={{ paddingTop: '1.5rem', paddingBottom: '3rem' }}>
      <div className="container">
        <TransgenderCertificateWelfareGuide onBack={() => navigate('/services')} />
      </div>
    </section>
  );
}
