import React from 'react';
import renderer from 'react-test-renderer';
import LifeSupportPage from '../LifeSupportPage';
import { AppContext } from '../../store/AppContext';

it('matches snapshot', () => {
  const state: any = {
    modules: [{ moduleId: 3, moduleName: 'Life Support Ring B', deckZone: 'RING-B', moduleType: 'LIFE_SUPPORT' }],
    telemetry: [
      { readingId: 91001, moduleId: 3, metricKind: 'O2_PARTIAL_PRESSURE', metricValue: 21.2, recordedAtUtc: '2026-07-18T05:40:00Z', alertLevel: 'NOMINAL' },
      { readingId: 91002, moduleId: 3, metricKind: 'CO2_PPM', metricValue: 640, recordedAtUtc: '2026-07-18T05:40:00Z', alertLevel: 'WATCH' },
    ],
    error: null,
  };
  const tree = renderer.create(
    <AppContext.Provider value={state}>
      <LifeSupportPage />
    </AppContext.Provider>
  ).toJSON();
  expect(tree).toMatchSnapshot();
});
