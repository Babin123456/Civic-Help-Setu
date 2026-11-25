/**
 * CounterJourney page (#843)
 *
 * Renders the CounterJourneySimulator with service/office selection and
 * authentication‑aware behaviour. Accessible at
 *   /counter-journey                (public catalogue + evaluable for any citizen)
 *   /services/:serviceId/counter-journey  (focus on one service)
 */

import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEffect, useState } from 'react';
import CounterJourneySimulator from '../components/journey/CounterJourneySimulator';
import { COUNTER_JOURNEYS } from '../data/civicCounterJourneyData';

export default function CounterJourney() {
  const { serviceId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Resolve the journey id for the selected service (if multiple exist)
  const [journeyId, setJourneyId] = useState(() => {
    if (serviceId) {
      const found = COUNTER_JOURNEYS.find((j) => j.serviceId === serviceId);
      return found?.id || null;
    }
    return null;
  });

  useEffect(() => {
    if (serviceId) {
      const found = COUNTER_JOURNEYS.find((j) => j.serviceId === serviceId);
      if (found) setJourneyId(found.id);
    }
  }, [serviceId]);

  // If the user is signed out / guest, still allow the public catalogue +
  // evaluation (guest role). The component will show appropriate UI.
  const role = user?.role || 'guest';

  return (
    <div className="section">
      <div className="container">
        <header className="section-header">
          <h1 className="section-title">
            Counter Journey Simulator
          </h1>
          <p className="section-subtitle">
            Simulated counter sequence • Document checkpoints • Blockers •
            Export preparation checklist
          </p>
        </header>

        {/* Breadcrumb / back link */}
        <nav style={{ marginBottom: '1rem' }}>
          {serviceId ? (
            <Link
              to="/counter-journey"
              style={{ marginRight: '0.5rem', fontSize: '0.92rem' }}
              aria-label="Back to service selector"
            >
              ← Select service
            </Link>
          ) : (
            <span style={{ marginRight: '0.5rem', fontSize: '0.92rem' }}>All services</span>
          )}
          {serviceId && (
            <Link
              to={`/services/${serviceId}/counter-journey`}
              style={{ fontSize: '0.92rem' }}
              aria-label="Focus on this service's counter journey"
            >
              Focus on {serviceId.replace(/-/g, ' ')}
            </Link>
          )}
        </nav>

        <CounterJourneySimulator
          initialServiceId={serviceId || 'income-certificate'}
          mode="interactive"
          onExport={() => {
            // could integrate with share modals etc.
          }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The page also registers its route when the app mounts. The route definition
// lives in src/App.jsx – see the integration notes below.
// ---------------------------------------------------------------------------