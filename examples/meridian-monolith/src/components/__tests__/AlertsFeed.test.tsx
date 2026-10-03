import React from 'react';
import { render } from '@testing-library/react';
import AlertsFeed from '../AlertsFeed';
import * as store from '../../store/AppContext';

jest.mock('../../store/AppContext', () => ({
  useAppState: jest.fn(),
}));

describe('AlertsFeed', () => {
  it('reads telemetry from the store', () => {
    (store.useAppState as jest.Mock).mockReturnValue({
      telemetry: [
        { readingId: 1, moduleId: 3, metricKind: 'CO2_PPM', metricValue: 900, recordedAtUtc: '2026-07-18T05:40:00Z', alertLevel: 'WATCH' },
      ],
      error: null,
    });
    render(<AlertsFeed />);
    expect(store.useAppState).toHaveBeenCalledTimes(1);
  });

  it('calls sort on the filtered readings', () => {
    const sortSpy = jest.spyOn(Array.prototype, 'sort');
    (store.useAppState as jest.Mock).mockReturnValue({ telemetry: [], error: null });
    render(<AlertsFeed />);
    expect(sortSpy).toHaveBeenCalled();
    sortSpy.mockRestore();
  });
});
