import { describe, it, expect, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import ParkMaintenanceScheduleWorkspace from './ParkMaintenanceScheduleWorkspace.jsx';
import { resetLocalParkScheduleState } from '../services/parkMaintenanceScheduleStorage.js';

describe('ParkMaintenanceScheduleWorkspace (#1440)', () => {
  beforeEach(() => {
    resetLocalParkScheduleState();
  });

  it('renders heading, origin badges, closure alerts, separate amenities, and photo moderation controls', () => {
    const html = renderToString(<ParkMaintenanceScheduleWorkspace />);
    expect(html).toContain('Public Park Maintenance &amp; Amenity Inspection Schedule');
    expect(html).toContain('Official Municipal Schedule');
    expect(html).toContain('Resident Observation');
    expect(html).toContain('AI / Community Advisory');
    expect(html).toContain('Temporary Closure Alerts');
    expect(html).toContain('play_area');
    expect(html).toContain('public_toilet');
    expect(html).toContain('drinking_water');
    expect(html).toContain('Photo EXIF Metadata Stripped');
  });
});
