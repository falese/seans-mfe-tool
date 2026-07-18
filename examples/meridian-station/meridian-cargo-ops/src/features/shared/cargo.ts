/**
 * Cross-system glue for the cargo domain. The manifest is ONE logical
 * document split across two systems: header lines live in the Harbormaster
 * (customs), valuations in StellarLedger (finance) under the finance
 * team's invented composite ref "DCK-004021/7". This helper is the entire
 * Rosetta stone.
 */

export function toLineRef(dockingId: number, lineId: number): string {
  return `DCK-${String(dockingId).padStart(6, '0')}/${lineId}`;
}

export function formatCents(cents: number): string {
  return `₢ ${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
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
