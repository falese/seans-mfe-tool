import axios from 'axios';
import type {
  Berth, Certification, Charge, CrewMember, Docking, ManifestLine, Module,
  Payroll, Reading, Settlement, Stall, Valuation, Vendor,
} from '../types';

// One client for every backend. Each system has its own conventions:
//   Harbormaster  - bare JSON arrays, snake_case keys
//   StellarLedger - { result: [...], meta: { cursor, hasMore } }, camelCase
//   StationOS     - { Data: [...], Pagination: {...} }, PascalCase keys
// Everything that leaves this file is camelCase and unwrapped.

const http = axios.create({ timeout: 10000 });

const BASE = {
  harbormaster: '/api/harbormaster',
  ledger: '/api/ledger',
  stationOs: '/api/stationos',
};

type Json = Record<string, unknown>;

function snakeToCamel(key: string): string {
  return key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

function pascalToCamel(key: string): string {
  return key.charAt(0).toLowerCase() + key.slice(1);
}

function mapKeys(obj: Json, fn: (k: string) => string): Json {
  const out: Json = {};
  for (const [k, v] of Object.entries(obj)) out[fn(k)] = v;
  return out;
}

// Harbormaster
async function hm<T>(path: string, params?: Json): Promise<T[]> {
  const res = await http.get(`${BASE.harbormaster}${path}`, { params });
  return (res.data as Json[]).map((row) => mapKeys(row, snakeToCamel) as T);
}

// StellarLedger - TODO: follow meta.cursor when hasMore (never happens yet)
async function ledger<T>(path: string): Promise<T[]> {
  const res = await http.get(`${BASE.ledger}${path}`);
  return (res.data.result ?? []) as T[];
}

// StationOS
async function sos<T>(path: string): Promise<T[]> {
  const res = await http.get(`${BASE.stationOs}${path}`);
  return ((res.data.Data ?? []) as Json[]).map((row) => mapKeys(row, pascalToCamel) as T);
}

// ---- Harbormaster ----
export const getBerths = () => hm<Berth>('/berths');
export const getDockings = (berthId?: string) => hm<Docking>('/dockings', berthId ? { berth_id: berthId } : undefined);
export const getManifestLines = () => hm<ManifestLine>('/manifest_lines');

// ---- StellarLedger ----
export const getCharges = () => ledger<Charge>('/charges');
export const getValuations = () => ledger<Valuation>('/valuations');
export const getSettlements = () => ledger<Settlement>('/settlements');
export const getPayroll = () => ledger<Payroll>('/payroll');

// ---- StationOS ----
export const getModules = () => sos<Module>('/modules');
export const getTelemetry = () => sos<Reading>('/telemetry');
export const getCrew = () => sos<CrewMember>('/crew');
export const getCertifications = () => sos<Certification>('/certifications');
export const getVendors = () => sos<Vendor>('/vendors');
export const getStalls = () => sos<Stall>('/stalls');

export default http;
