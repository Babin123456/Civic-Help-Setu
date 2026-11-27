import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import UpHeatwaveReliefMap from './UpHeatwaveReliefMap';
import HeatwaveFacilityList from '../components/heatwaveRelief/HeatwaveFacilityList';
import HeatwaveInteractiveMap from '../components/heatwaveRelief/HeatwaveInteractiveMap';
import HeatEmergencyGuidanceModal from '../components/heatwaveRelief/HeatEmergencyGuidanceModal';
import HeatwaveObservationModal from '../components/heatwaveRelief/HeatwaveObservationModal';
import { SEED_HEATWAVE_FACILITIES } from '../data/upHeatwaveReliefSeed';
import { _resetStorageForTesting } from '../services/upHeatwaveReliefService';

describe('UpHeatwaveReliefMap Page & Components (#983)', () => {
  beforeEach(() => {
    _resetStorageForTesting();
  });

  const renderComponent = (ui) => {
    return renderToStaticMarkup(
      <MemoryRouter>
        {ui}
      </MemoryRouter>
    );
  };

  it('renders page header, DDMA pilot badge, and Lucknow heat advisory', () => {
    const html = renderComponent(<UpHeatwaveReliefMap />);

    expect(html).toContain('UP Community Heatwave Exposure &amp; Cooling-Relief Coordination Map');
    expect(html).toContain('Pilot: Lucknow DDMA');
    expect(html).toContain('Official Heat Advisory');
    expect(html).toContain('1077'); // DDMA emergency control room
    expect(html).toContain('108'); // Ambulance
  });

  it('renders verified heat-relief facilities with authorities and operating hours', () => {
    const html = renderComponent(<UpHeatwaveReliefMap />);

    expect(html).toContain('Hazratganj Municipal Community Hall Cooling Center');
    expect(html).toContain('Lucknow Municipal Corporation (LMC)');
    expect(html).toContain('Charbagh Railway Station Municipal Cold Piyau &amp; Water Booth');
    expect(html).toContain('KGMU Emergency Gate Public Health Heat-Respite Help Desk');
  });

  it('renders mandatory non-medical disclaimer banner', () => {
    const html = renderComponent(<UpHeatwaveReliefMap />);

    expect(html).toContain('Medical Disclaimer:');
    expect(html).toContain('Not a medical diagnostic tool');
    expect(html).toContain('call 108 emergency ambulance immediately');
  });

  it('renders low-bandwidth mode and text-only list view toggles', () => {
    const html = renderComponent(<UpHeatwaveReliefMap />);

    expect(html).toContain('Low-Bandwidth Mode');
    expect(html).toContain('Text-Only List');
  });

  it('renders HeatwaveInteractiveMap in schematic mode when isLowBandwidth is true', () => {
    const html = renderComponent(
      <HeatwaveInteractiveMap
        facilities={SEED_HEATWAVE_FACILITIES.slice(0, 3)}
        selectedFacility={null}
        onSelectFacility={() => {}}
        onOpenObservationModal={() => {}}
        isLowBandwidth={true}
        district="Lucknow"
      />
    );

    expect(html).toContain('Low-Bandwidth Mode');
    expect(html).toContain('Heavy vector tiles disabled');
  });

  it('renders HeatEmergencyGuidanceModal with ORS recipe, heatstroke warning, and emergency helplines', () => {
    const html = renderComponent(<HeatEmergencyGuidanceModal onClose={() => {}} />);

    expect(html).toContain('Offline Heatwave Emergency &amp; First-Aid Guide');
    expect(html).toContain('Recognizing Symptoms: Heat Exhaustion vs Heat Stroke');
    expect(html).toContain('Standard Homemade ORS (Oral Rehydration Salts) Formula');
    expect(html).toContain('1 Liter Clean Water');
    expect(html).toContain('6 Teaspoons Sugar');
    expect(html).toContain('1/2 Teaspoon Salt');
    expect(html).toContain('108');
  });

  it('renders HeatwaveObservationModal with zero-PII advisory and location consent checkbox', () => {
    const html = renderComponent(
      <HeatwaveObservationModal
        facility={SEED_HEATWAVE_FACILITIES[0]}
        onClose={() => {}}
        onSubmitObservation={() => {}}
        isSubmitting={false}
      />
    );

    expect(html).toContain('Submit Live Heat-Relief Observation');
    expect(html).toContain('Zero PII policy: Do not enter phone numbers');
    expect(html).toContain('Attach anonymous location for proximity verification');
    expect(html).toContain('No precise GPS is stored without your explicit consent');
  });
});
