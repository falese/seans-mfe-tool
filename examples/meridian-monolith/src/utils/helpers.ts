// Shared helpers. Anything used in more than one screen goes here.

// ---- money ----------------------------------------------------------------

/** Integer cents -> display credits (the ledger stores cents). */
export function formatCents(cents: number): string {
  return `₢ ${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

// ---- cross-system ids -----------------------------------------------------
// Harbormaster, StationOS and the ledger all number things differently.

/** Harbormaster docking_id 4021 -> ledger dockingRef "DCK-004021". */
export function toDockingRef(dockingId: number): string {
  return `DCK-${String(dockingId).padStart(6, '0')}`;
}

/** Harbormaster manifest line -> ledger line ref "DCK-004021/7". */
export function toLineRef(dockingId: number, lineId: number): string {
  return `${toDockingRef(dockingId)}/${lineId}`;
}

/** StationOS CrewId 42 -> ledger crewRef "CRW-0042". */
export function toCrewRef(crewId: number): string {
  return `CRW-${String(crewId).padStart(4, '0')}`;
}

/** StationOS VendorId 105 -> ledger merchant account "ACC-7105". */
export function toMerchantId(vendorId: number): string {
  return `ACC-7${String(vendorId).padStart(3, '0')}`;
}

// ---- colors ---------------------------------------------------------------

export function statusColor(status: string): string {
  switch (status) {
    case 'DOCKED': return '#2e9e6b';
    case 'APPROACH': return '#d9a514';
    case 'SCHEDULED': return '#3b6ff5';
    case 'DEPARTED': return '#5d6690';
    case 'ABORTED': return '#c33b4e';
    case 'PENDING': return '#d9a514';
    case 'DISPUTED': return '#c33b4e';
    case 'PAID': return '#2e9e6b';
    default: return '#8b93b5';
  }
}

export function alertColor(level: string): string {
  switch (level) {
    case 'CRITICAL': return '#c33b4e';
    case 'WATCH': return '#d9a514';
    default: return '#2e9e6b';
  }
}

export function hazardColor(hazard: string): string {
  switch (hazard) {
    case 'CRYO': return '#3b9ff5';
    case 'CORROSIVE': return '#d9a514';
    case 'RADIOLOGICAL': return '#c33b4e';
    case 'BIO': return '#2e9e6b';
    default: return '#5d6690';
  }
}

export function certColor(status: string): string {
  switch (status) {
    case 'EXPIRED': return '#c33b4e';
    case 'EXPIRING': return '#d9a514';
    default: return '#2e9e6b';
  }
}

export function payColor(status: string): string {
  switch (status) {
    case 'HELD': return '#c33b4e';
    case 'SCHEDULED': return '#d9a514';
    default: return '#2e9e6b';
  }
}

export function licenseColor(status: string): string {
  switch (status) {
    case 'SUSPENDED': return '#c33b4e';
    case 'PROBATION': return '#d9a514';
    default: return '#2e9e6b';
  }
}

// ---- telemetry ------------------------------------------------------------

const UNITS: Record<string, string> = {
  O2_PARTIAL_PRESSURE: 'kPa',
  CO2_PPM: 'ppm',
  TEMP_C: '°C',
  POWER_KW: 'kW',
  PRESSURE_KPA: 'kPa',
};

export function formatMetric(kind: string, value: number): string {
  return `${value.toLocaleString('en-US')} ${UNITS[kind] ?? ''}`.trim();
}

const ALERT_RANK: Record<string, number> = { NOMINAL: 0, WATCH: 1, CRITICAL: 2 };

/** Worst alert level in a list of readings. */
export function worstLevel(levels: string[]): string {
  return levels.reduce((acc, l) => ((ALERT_RANK[l] ?? 0) > (ALERT_RANK[acc] ?? 0) ? l : acc), 'NOMINAL');
}

// ---- misc -----------------------------------------------------------------

/** "2026-03-14T09:30:00Z" -> "03-14 09:30" */
export function shortTime(iso: string): string {
  return iso.slice(5, 16).replace('T', ' ');
}
