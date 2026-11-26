/**
 * src/pages/RecommendationExperimentationWorkspace.jsx
 *
 * Page route for the Civic Service Recommendation Experimentation Platform
 * with Guardrails (#1193).
 * Accessible at /recommendation-experimentation.
 */

import RecommendationExperimentationWorkspace from '../components/recommendationExperimentation/RecommendationExperimentationWorkspace';

export default function RecommendationExperimentationWorkspacePage() {
  return (
    <div className="section">
      <div className="container">
        <RecommendationExperimentationWorkspace />
      </div>
    </div>
  );
}
