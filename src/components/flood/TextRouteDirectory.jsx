import { useState } from 'react';
import { getRoutePlan, generateTextRouteDirectory, getOfficialEmergencyContact, getHelpline, expireOldObservations, getSegmentsWithUnresolvedBlockages } from '../services/upFloodRouteService';

/**
 * Low-bandwidth text-only route directory component.
 * No maps, no geolocation, pure text — works offline without precise location permission.
 */
export default function TextRouteDirectory() {
  const [directoryContent, setDirectoryContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [expiredCount, setExpiredCount] = useState(0);

  useEffect(() => {
    // Load route plan and generate directory
    const plan = getRoutePlan();
    const text = generateTextRouteDirectory();
    setDirectoryContent(text);

    // Count expired observations
    const count = expireOldObservations();
    setExpiredCount(count);

    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="spinner spinner-sm" />
        <p>Loading route data...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      <header className="mb-6 border-b border-border pb-4">
        <h1 className="text-xl font-bold text-font">
          UP Flood Evacuation Route Text Directory
        </h1>
        <p className="text-sm text-muted-foreground">
          District: {getRoutePlan()?.district || 'Bahraich'} |
          Emergency: {getOfficialEmergencyContact()} ({getHelpline()})
          {expiredCount > 0 && ` • ${expiredCount} observations expired`}
        </p>
      </header>

      <pre
        className="bg-background p-4 rounded border border-border overflow-x-auto text-sm"
        dangerouslySetInnerHTML={{ __html: directoryContent }}
      />

      <footer className="mt-4 pt-4 border-t border-border text-center text-xs text-muted-foreground">
        • Never calculate a route through a reported flooded segment
        • Official emergency contact always shown first
        • This directory works offline — no location permission needed
        • Reports expire after 7 days unless revalidated by approved responder
      </footer>
    </div>
  );
}