import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getBerths, getCharges, getDockings, getModules, getTelemetry } from '../api/client';
import { REFRESH_MS } from '../utils/constants';
import type { Berth, Charge, Docking, Module, Reading } from '../types';

// App-wide state. The berth strip and the sidebar are always on screen, so
// the data they need is loaded once here and kept fresh; screens that need
// it too read it from here instead of fetching again.
export interface AppState {
  berths: Berth[];
  dockings: Docking[];
  charges: Charge[];
  modules: Module[];
  telemetry: Reading[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refresh: () => Promise<void>;
}

const initial: AppState = {
  berths: [],
  dockings: [],
  charges: [],
  modules: [],
  telemetry: [],
  loading: true,
  error: null,
  lastUpdated: null,
  refresh: async () => {},
};

export const AppContext = createContext<AppState>(initial);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(initial);

  const refresh = useCallback(async () => {
    try {
      const [berths, dockings, charges, modules, telemetry] = await Promise.all([
        getBerths(), getDockings(), getCharges(), getModules(), getTelemetry(),
      ]);
      setState((s) => ({ ...s, berths, dockings, charges, modules, telemetry, loading: false, error: null, lastUpdated: new Date() }));
    } catch (err: any) {
      setState((s) => ({ ...s, loading: false, error: err?.message ?? String(err) }));
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  return <AppContext.Provider value={{ ...state, refresh }}>{children}</AppContext.Provider>;
}

export function useAppState(): AppState {
  return useContext(AppContext);
}
