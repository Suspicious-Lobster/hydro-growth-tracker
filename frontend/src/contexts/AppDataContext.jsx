import React, { createContext, useContext, useReducer, useEffect, useCallback, useMemo } from 'react';
import api, { apiErrorMessage } from '../api/api';

const AppDataContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export const useAppData = () => {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used within an AppDataProvider');
  return ctx;
};

const initialState = {
  plants: [],
  logs: [],
  schedules: [],
  settings: { units: { length: 'cm', volume: 'liters', temp: 'C' }, ppm_scale: 500, default_species: null },
  loading: true,
  error: null,
};

function reducer(state, action) {
  switch (action.type) {
    case 'LOAD_START':
      return { ...state, loading: true, error: null };
    case 'LOAD_SUCCESS':
      return { ...state, loading: false, error: null, ...action.payload };
    case 'LOAD_ERROR':
      return { ...state, loading: false, error: action.error };
    case 'SET_SETTINGS':
      return { ...state, settings: action.settings };
    default:
      return state;
  }
}

export const AppDataProvider = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Single fetch of all collections. Used on mount and after any mutation so
  // local state always reflects the persisted source of truth.
  const loadAll = useCallback(async () => {
    dispatch({ type: 'LOAD_START' });
    try {
      const [plants, logs, schedules, settings] = await Promise.all([
        api.get('/plants'),
        api.get('/logs'),
        api.get('/feeding'),
        api.get('/settings'),
      ]);
      dispatch({
        type: 'LOAD_SUCCESS',
        payload: {
          plants: Array.isArray(plants.data) ? plants.data : [],
          logs: Array.isArray(logs.data) ? logs.data : [],
          schedules: Array.isArray(schedules.data) ? schedules.data : [],
          settings: settings.data || initialState.settings,
        },
      });
    } catch (err) {
      dispatch({ type: 'LOAD_ERROR', error: apiErrorMessage(err, 'Failed to load data') });
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Mutations: call the API, refresh, and return/throw so callers can toast.
  const after = useCallback(async (promise) => {
    const res = await promise;
    await loadAll();
    return res.data;
  }, [loadAll]);

  const actions = useMemo(() => ({
    refresh: loadAll,

    // Plants
    createPlant: (payload) => after(api.post('/plants', payload)),
    updatePlant: (id, payload) => after(api.put(`/plants/${id}`, payload)),
    archivePlant: (id) => after(api.post(`/plants/${id}/archive`)),
    deletePlant: (id) => after(api.delete(`/plants/${id}`)),

    // Logs
    createLog: (payload, config) => after(api.post('/logs', payload, config)),
    updateLog: (id, payload) => after(api.put(`/logs/${id}`, payload)),
    deleteLog: (id) => after(api.delete(`/logs/${id}`)),

    // Schedules
    createSchedule: (payload) => after(api.post('/feeding', payload)),
    updateSchedule: (id, payload) => after(api.put(`/feeding/${id}`, payload)),
    deleteSchedule: (id) => after(api.delete(`/feeding/${id}`)),
    markFed: (id) => after(api.post(`/feeding/${id}/fed`)),

    // Settings (no full refresh needed — update in place)
    updateSettings: async (payload) => {
      const res = await api.put('/settings', payload);
      dispatch({ type: 'SET_SETTINGS', settings: res.data });
      return res.data;
    },
  }), [loadAll, after]);

  // Derived lookups.
  const derived = useMemo(() => {
    const plantsById = new Map(state.plants.map((p) => [p.id, p]));
    const logsByPlantId = new Map();
    for (const log of state.logs) {
      const key = log.plant_id ?? `name:${log.plant_name}`;
      if (!logsByPlantId.has(key)) logsByPlantId.set(key, []);
      logsByPlantId.get(key).push(log);
    }
    return {
      plantsById,
      logsByPlantId,
      getPlantLogs: (plant) => {
        if (!plant) return [];
        return logsByPlantId.get(plant.id) || logsByPlantId.get(`name:${plant.name}`) || [];
      },
    };
  }, [state.plants, state.logs]);

  const value = { ...state, ...actions, ...derived };

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
};
