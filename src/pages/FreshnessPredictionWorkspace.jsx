/**
 * src/pages/FreshnessPredictionWorkspace.jsx
 *
 * Page for the Civic Information Freshness Prediction and Review
 * Prioritization Engine (#1189).
 * Accessible at /freshness-prediction.
 */

import FreshnessPredictionWorkspace from '../components/freshnessPrediction/FreshnessPredictionWorkspace';

export default function FreshnessPredictionWorkspacePage() {
  return (
    <div className="section">
      <div className="container">
        <FreshnessPredictionWorkspace />
      </div>
    </div>
  );
}
