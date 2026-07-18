/**
 * DockingBoard Feature Component (Angular standalone)
 *
 * The full berth board: occupancy and traffic from the Harbormaster joined
 * with outstanding tariff status from StellarLedger — two systems, two
 * conventions, one normalized BFF graph (snake_case camelCased by
 * namingConvention; ledger envelopes unwrapped by hoistField). The one
 * thing the graph can't do yet is the cross-source join itself, so this
 * component issues one query and stitches rows by docking ref (see
 * shared/station.ts).
 */
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { query } from '../../platform/bff/bff';
import { formatCents, statusColor, toDockingRef } from '../shared/station';

interface Berth { berthId: string; berthClass: string; occupiedFlag: number; maxMassKg: number; currentDockingId: number | null }
interface Docking { dockingId: number; berthId: string; vesselRegistryNo: string; etaUtc: string; statusCode: string }
interface Charge { dockingRef: string; chargeType: string; amountCents: number; status: string }
interface BoardData { listBerths: Berth[]; listDockings: Docking[]; charges: Charge[] }

interface BoardRow {
  berthId: string;
  berthClass: string;
  vessel: string;
  status: string;
  outstanding: string | null;
  disputed: boolean;
}

const BOARD_QUERY = /* GraphQL */ `
  {
    listBerths { berthId berthClass occupiedFlag maxMassKg currentDockingId }
    listDockings { dockingId berthId vesselRegistryNo etaUtc statusCode }
    charges { dockingRef chargeType amountCents status }
  }
`;

@Component({
  selector: 'dockingboard-component',
  standalone: true,
  imports: [CommonModule],
  styles: [`
    :host { display: block; font-family: system-ui, sans-serif; }
    .board { background: #0e1226; color: #dfe4ff; border-radius: 12px; padding: 20px; }
    h2 { margin: 0 0 4px; font-size: 18px; }
    .sub { margin: 0 0 16px; color: #5d6690; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; color: #5d6690; font-weight: 600; padding: 6px 10px; border-bottom: 1px solid #1c2340; text-transform: uppercase; font-size: 11px; letter-spacing: 1px; }
    td { padding: 8px 10px; border-bottom: 1px solid #141a33; }
    .chip { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; }
    .free { color: #5d6690; }
    .money { font-variant-numeric: tabular-nums; }
    .disputed { color: #c33b4e; font-size: 11px; margin-left: 6px; font-weight: 700; }
    .err { color: #c33b4e; padding: 8px 0; }
  `],
  template: `
    <section class="board">
      <h2>🛰️ Docking Board</h2>
      <p class="sub">Harbormaster occupancy · StellarLedger outstanding tariffs</p>
      <p *ngIf="error" class="err">{{ error }}</p>
      <table *ngIf="!error">
        <thead>
          <tr><th>Berth</th><th>Class</th><th>Vessel</th><th>Status</th><th>Outstanding</th></tr>
        </thead>
        <tbody>
          <tr *ngFor="let row of rows">
            <td><strong>{{ row.berthId }}</strong></td>
            <td>{{ row.berthClass }}</td>
            <td>{{ row.vessel || '—' }}</td>
            <td>
              <span class="chip" [style.color]="color(row.status)" [style.border]="'1px solid ' + color(row.status)">
                {{ row.status }}
              </span>
            </td>
            <td class="money">
              <ng-container *ngIf="row.outstanding; else clear">{{ row.outstanding }}</ng-container>
              <ng-template #clear><span class="free">—</span></ng-template>
              <span *ngIf="row.disputed" class="disputed">DISPUTED</span>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  `,
})
export class DockingBoardComponent implements OnInit {
  rows: BoardRow[] = [];
  error: string | null = null;

  async ngOnInit(): Promise<void> {
    try {
      const data = await query<BoardData>(BOARD_QUERY);
      this.rows = this.buildRows(data);
    } catch (err) {
      this.error = `Docking board unavailable: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  color(status: string): string {
    return statusColor(status);
  }

  private buildRows(data: BoardData): BoardRow[] {
    const dockingById = new Map(data.listDockings.map((d) => [d.dockingId, d]));
    return data.listBerths.map((berth) => {
      const docking = berth.currentDockingId != null ? dockingById.get(berth.currentDockingId) : undefined;
      const ref = docking ? toDockingRef(docking.dockingId) : null;
      const open = ref
        ? data.charges.filter((c) => c.dockingRef === ref && (c.status === 'PENDING' || c.status === 'DISPUTED'))
        : [];
      const total = open.reduce((sum, c) => sum + c.amountCents, 0);
      return {
        berthId: berth.berthId,
        berthClass: berth.berthClass.replace(/_/g, ' '),
        vessel: docking?.vesselRegistryNo ?? '',
        status: docking?.statusCode ?? 'FREE',
        outstanding: total > 0 ? formatCents(total) : null,
        disputed: open.some((c) => c.status === 'DISPUTED'),
      };
    });
  }
}

export default DockingBoardComponent;
