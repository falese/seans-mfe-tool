/**
 * TrafficLog Feature Component (Angular standalone)
 *
 * The station traffic picture: recent and scheduled dockings straight from
 * the Harbormaster (single-source view — contrast with DockingBoard's
 * two-source join).
 */
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { query } from '../../platform/bff/bff';
import { statusColor } from '../shared/station';

interface Docking { dockingId: number; berthId: string; vesselRegistryNo: string; etaUtc: string; statusCode: string }
interface TrafficData { listDockings: Docking[] }

const TRAFFIC_QUERY = /* GraphQL */ `
  { listDockings { dockingId berthId vesselRegistryNo etaUtc statusCode } }
`;

@Component({
  selector: 'trafficlog-component',
  standalone: true,
  imports: [CommonModule],
  styles: [`
    :host { display: block; font-family: system-ui, sans-serif; }
    .log { background: #0e1226; color: #dfe4ff; border-radius: 12px; padding: 16px; }
    h2 { margin: 0 0 12px; font-size: 15px; }
    .entry { display: flex; gap: 10px; align-items: baseline; padding: 6px 0; border-bottom: 1px solid #141a33; font-size: 12px; }
    .eta { color: #5d6690; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .vessel { font-weight: 600; }
    .berth { color: #8b93b5; }
    .chip { margin-left: auto; font-size: 10px; font-weight: 700; padding: 1px 7px; border-radius: 999px; }
    .err { color: #c33b4e; font-size: 12px; }
  `],
  template: `
    <section class="log">
      <h2>🚦 Traffic Log</h2>
      <p *ngIf="error" class="err">{{ error }}</p>
      <div *ngFor="let entry of entries" class="entry">
        <span class="eta">{{ entry.etaUtc.slice(5, 16).replace('T', ' ') }}</span>
        <span class="vessel">{{ entry.vesselRegistryNo }}</span>
        <span class="berth">→ {{ entry.berthId }}</span>
        <span class="chip" [style.color]="color(entry.statusCode)" [style.border]="'1px solid ' + color(entry.statusCode)">
          {{ entry.statusCode }}
        </span>
      </div>
    </section>
  `,
})
export class TrafficLogComponent implements OnInit {
  entries: Docking[] = [];
  error: string | null = null;

  async ngOnInit(): Promise<void> {
    try {
      const data = await query<TrafficData>(TRAFFIC_QUERY);
      this.entries = [...data.listDockings].sort((a, b) => b.etaUtc.localeCompare(a.etaUtc));
    } catch (err) {
      this.error = `Traffic log unavailable: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  color(status: string): string {
    return statusColor(status);
  }
}

export default TrafficLogComponent;
