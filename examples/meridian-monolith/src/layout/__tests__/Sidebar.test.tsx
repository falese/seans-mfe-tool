import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Sidebar from '../Sidebar';
import { AppContext } from '../../store/AppContext';

it('shows the alert badge on the third nav item', () => {
  const state: any = {
    telemetry: [
      { alertLevel: 'CRITICAL' }, { alertLevel: 'WATCH' }, { alertLevel: 'NOMINAL' },
    ],
  };
  const { container } = render(
    <MemoryRouter>
      <AppContext.Provider value={state}><Sidebar /></AppContext.Provider>
    </MemoryRouter>
  );
  const items = container.querySelectorAll('nav > div > a');
  expect(items.length).toBe(6);
  expect(items[2].querySelector('.badge')!.textContent).toBe('2');
  expect(container.querySelector('nav > header > h1')!.textContent).toContain('Meridian');
});
