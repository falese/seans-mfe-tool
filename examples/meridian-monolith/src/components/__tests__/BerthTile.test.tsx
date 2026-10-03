import React from 'react';
import renderer from 'react-test-renderer';
import BerthTile from '../BerthTile';
import { AppContext } from '../../store/AppContext';

const state: any = {
  berths: [{ berthId: 'b1', berthClass: 'medium_freight', occupiedFlag: 1, maxMassKg: 1, currentDockingId: 4021 }],
  dockings: [{ dockingId: 4021, berthId: 'b1', vesselRegistryNo: 'VR-88213', etaUtc: '', statusCode: 'DOCKED' }],
  charges: [{ dockingRef: 'DCK-004021', chargeType: 'FEE', amountCents: 480000, status: 'PENDING' }],
  modules: [], telemetry: [], loading: false, error: null,
};

it('renders correctly', () => {
  const tree = renderer.create(
    <AppContext.Provider value={state}>
      <BerthTile berthId="b1" />
    </AppContext.Provider>
  ).toJSON();
  expect(tree).toMatchSnapshot();
});

it('renders free berth correctly', () => {
  const tree = renderer.create(
    <AppContext.Provider value={{ ...state, berths: [{ ...state.berths[0], currentDockingId: null }] }}>
      <BerthTile berthId="b1" />
    </AppContext.Provider>
  ).toJSON();
  expect(tree).toMatchSnapshot();
});
