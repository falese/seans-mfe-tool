/**
 * Cross-system glue for the docking domain. The Harbormaster addresses a
 * docking by numeric id (4021); StellarLedger by formatted string ref
 * ("DCK-004021"). The BFF exposes both systems on one graph, but the ref
 * translation itself is feature-level knowledge until the DSL supports
 * additionalResolvers (see the Meridian README's roadmap notes).
 */

/** Harbormaster docking_id → StellarLedger dockingRef. */
export function toDockingRef(dockingId: number): string {
  return `DCK-${String(dockingId).padStart(6, '0')}`;
}

/** Integer cents → display credits (StellarLedger's convention). */
export function formatCents(cents: number): string {
  return `₢ ${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

/** Status → accent color, shared by the docking components. */
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
