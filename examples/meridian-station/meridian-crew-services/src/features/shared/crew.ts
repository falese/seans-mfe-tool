/**
 * Cross-system glue for the crew domain: StationOS knows crew as integer
 * CrewId 42; StellarLedger pays them as crewRef "CRW-0042".
 */
export function toCrewRef(crewId: number): string {
  return `CRW-${String(crewId).padStart(4, '0')}`;
}

export function formatCents(cents: number): string {
  return `₢ ${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
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
