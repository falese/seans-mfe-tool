/**
 * BerthTile Feature Component (Angular standalone)
 *
 * The compact single-berth card for the console's KEYED berth strip
 * (ADR-069): the registry resolves meridian.berth.<id> to this capability
 * with props.berthId, placed into meridian-console/berth.<id>. Six tiles =
 * six independent control-plane round trips into six keyed slots.
 */
import { Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { query } from '../../platform/bff/bff';
import { formatCents, statusColor, toDockingRef } from '../shared/station';

interface TileData {
  getBerth: { berthId: string; berthClass: string; occupiedFlag: number; currentDockingId: number | null } | null;
  listDockings: Array<{ dockingId: number; vesselRegistryNo: string; statusCode: string }>;
  charges: Array<{ dockingRef: string; amountCents: number; status: string }>;
}

const TILE_QUERY = /* GraphQL */ `
  query BerthTile($berthId: String!) {
    getBerth(berth_id: $berthId) { berthId berthClass occupiedFlag currentDockingId }
    listDockings(berth_id: $berthId) { dockingId vesselRegistryNo statusCode }
    charges { dockingRef amountCents status }
  }
`;

@Component({
  selector: 'berthtile-component',
  standalone: true,
  imports: [CommonModule],
  styles: [`
    :host { display: block; font-family: system-ui, sans-serif; height: 100%; }
    .tile { background: #0e1226; color: #dfe4ff; border-radius: 10px; padding: 10px 12px; height: 100%; box-sizing: border-box; display: flex; flex-direction: column; gap: 4px; }
    .row { display: flex; justify-content: space-between; align-items: baseline; }
    .id { font-weight: 700; font-size: 14px; }
    .chip { font-size: 10px; font-weight: 700; padding: 1px 7px; border-radius: 999px; }
    .vessel { font-size: 12px; color: #8b93b5; }
    .money { font-size: 11px; font-variant-numeric: tabular-nums; color: #d9a514; }
    .free { color: #5d6690; font-size: 12px; }
    .err { color: #c33b4e; font-size: 11px; }
  `],
  template: `
    <div class="tile">
      <div class="row">
        <span class="id">{{ berthId }}</span>
        <span class="chip" [style.color]="color(status)" [style.border]="'1px solid ' + color(status)">{{ status }}</span>
      </div>
      <span *ngIf="vessel" class="vessel">{{ vessel }}</span>
      <span *ngIf="!vessel && !error" class="free">berth available</span>
      <span *ngIf="outstanding" class="money">{{ outstanding }} due</span>
      <span *ngIf="error" class="err">{{ error }}</span>
    </div>
  `,
})
export class BerthTileComponent implements OnInit, OnChanges {
  /** Injected by the registry route's props (meridian.berth.<id>). */
  @Input() berthId = 'b1';

  status = '…';
  vessel = '';
  outstanding: string | null = null;
  error: string | null = null;

  /** The berth id the current data belongs to — dedupes init vs changes. */
  private loadedFor: string | null = null;

  // The runtime applies registry props through ComponentRef.setInput AFTER
  // bootstrap (ngOnInit already ran with the default), so the real berthId
  // arrives via ngOnChanges. ngOnInit stays as the standalone/dev fallback.
  ngOnChanges(changes: SimpleChanges): void {
    if ('berthId' in changes) void this.load();
  }

  ngOnInit(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    if (this.loadedFor === this.berthId) return;
    this.loadedFor = this.berthId;
    const target = this.berthId;
    try {
      const data = await query<TileData>(TILE_QUERY, { berthId: target });
      // A slower response for a superseded berth id (the ngOnInit default
      // racing the setInput-delivered registry prop) must not stomp state.
      if (target !== this.berthId) return;
      const current = data.getBerth?.currentDockingId ?? null;
      const docking = data.listDockings.find((d) => d.dockingId === current);
      this.status = docking?.statusCode ?? 'FREE';
      this.vessel = docking?.vesselRegistryNo ?? '';
      if (docking) {
        const ref = toDockingRef(docking.dockingId);
        const due = data.charges
          .filter((c) => c.dockingRef === ref && (c.status === 'PENDING' || c.status === 'DISPUTED'))
          .reduce((sum, c) => sum + c.amountCents, 0);
        this.outstanding = due > 0 ? formatCents(due) : null;
      }
    } catch (err) {
      if (target !== this.berthId) return;
      this.status = 'OFFLINE';
      this.error = err instanceof Error ? err.message : String(err);
    }
  }

  color(status: string): string {
    return statusColor(status);
  }
}

export default BerthTileComponent;
