import { describe, it, expect, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import TreePlantationSurvivalWorkspace from './TreePlantationSurvivalWorkspace.jsx';
import { resetLocalGreenAssetState } from '../services/treePlantationSurvivalStorage.js';

describe('TreePlantationSurvivalWorkspace (#1441)', () => {
  beforeEach(() => {
    resetLocalGreenAssetState();
  });

  it('renders heading, origin badges, planted vs verified counts, map/list toggles, and evidence history', () => {
    const html = renderToString(<TreePlantationSurvivalWorkspace />);
    expect(html).toContain('Tree-Plantation Survival &amp; Public Green Asset Registry');
    expect(html).toContain('Official Registry Record');
    expect(html).toContain('Citizen Survival Observation');
    expect(html).toContain('AI / Community Advisory');
    expect(html).toContain('Planted vs. Verified Surviving Summary');
    expect(html).toContain('Accessible List View');
    expect(html).toContain('Aggregate Geo-Map View');
    expect(html).toContain('Evidence History');
  });
});
