/**
 * HazardSummary Feature Component (Angular standalone)
 * Hazardous cargo currently on station, grouped by hazard class — the
 * status-rail companion to the full manifest.
 */
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { query } from '../../platform/bff/bff';
import { hazardColor } from '../shared/cargo';

interface ManifestLine { lineId: number; dockingId: number; sku: string; qty: number; declaredMassKg: number; hazardClass: string }
interface Docking { dockingId: number; statusCode: string }
interface HazardData { listManifestLines: ManifestLine[]; listDockings: Docking[] }

const HAZARD_QUERY = /* GraphQL */ `
  {
    listManifestLines { lineId dockingId sku qty declaredMassKg hazardClass }
    listDockings { dockingId statusCode }
  }
`;

@Component({
  selector: 'hazardsummary-component',
  standalone: true,
  imports: [CommonModule],
  styles: [`
    :host { display: block; font-family: system-ui, sans-serif; }
    .rail { background: #0e1226; color: #dfe4ff; border-radius: 12px; padding: 14px; }
    h2 { margin: 0 0 10px; font-size: 14px; }
    .row { display: flex; align-items: baseline; gap: 8px; padding: 5px 0; font-size: 12px; border-bottom: 1px solid #141a33; }
    .chip { font-size: 10px; font-weight: 700; padding: 1px 7px; border-radius: 999px; }
    .mass { margin-left: auto; color: #8b93b5; font-variant-numeric: tabular-nums; }
    .quiet { color: #5d6690; font-size: 12px; }
    .err { color: #c33b4e; font-size: 12px; }
  `],
  template: `
    <section class="rail">
      <h2>☣️ Hazardous Cargo Aboard</h2>
      <p *ngIf="error" class="err">{{ error }}</p>
      <p *ngIf="!error && groups.length === 0" class="quiet">No hazardous cargo docked.</p>
      <div class="row" *ngFor="let group of groups">
        <span class="chip" [style.color]="hazard(group.hazard)" [style.border]="'1px solid ' + hazard(group.hazard)">{{ group.hazard }}</span>
        <span>{{ group.skus.join(', ') }}</span>
        <span class="mass">{{ group.massKg.toLocaleString() }} kg</span>
      </div>
    </section>
  `,
})
export class HazardSummaryComponent implements OnInit {
  groups: Array<{ hazard: string; skus: string[]; massKg: number }> = [];
  error: string | null = null;

  async ngOnInit(): Promise<void> {
    try {
      const data = await query<HazardData>(HAZARD_QUERY);
      const docked = new Set(data.listDockings.filter((d) => d.statusCode === 'DOCKED').map((d) => d.dockingId));
      const byHazard = new Map<string, { skus: string[]; massKg: number }>();
      for (const line of data.listManifestLines) {
        if (line.hazardClass === 'NONE' || !docked.has(line.dockingId)) continue;
        const group = byHazard.get(line.hazardClass) ?? { skus: [], massKg: 0 };
        group.skus.push(line.sku);
        group.massKg += line.declaredMassKg;
        byHazard.set(line.hazardClass, group);
      }
      this.groups = [...byHazard.entries()].map(([hazard, group]) => ({ hazard, ...group }));
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    }
  }

  hazard(hazardClass: string): string { return hazardColor(hazardClass); }
}

export default HazardSummaryComponent;
