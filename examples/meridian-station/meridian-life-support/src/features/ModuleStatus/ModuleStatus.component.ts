/**
 * ModuleStatus Feature Component (Angular standalone)
 * Compact per-module status card for the console status rail: the worst
 * current alert level per module, at a glance.
 */
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { query } from '../../platform/bff/bff';
import { alertColor } from '../shared/metrics';

interface Module { moduleId: number; moduleName: string; deckZone: string }
interface Reading { moduleId: number; alertLevel: string }
interface StatusData { modules: Module[]; telemetry: Reading[] }

const STATUS_QUERY = /* GraphQL */ `
  { modules { moduleId moduleName deckZone }
    telemetry { moduleId alertLevel } }
`;

@Component({
  selector: 'modulestatus-component',
  standalone: true,
  imports: [CommonModule],
  styles: [`
    :host { display: block; font-family: system-ui, sans-serif; }
    .rail { background: #0e1226; color: #dfe4ff; border-radius: 12px; padding: 14px; }
    h2 { margin: 0 0 10px; font-size: 14px; }
    .row { display: flex; align-items: center; gap: 8px; padding: 5px 0; font-size: 12px; border-bottom: 1px solid #141a33; }
    .dot { width: 9px; height: 9px; border-radius: 50%; }
    .zone { margin-left: auto; color: #5d6690; font-size: 10px; }
    .err { color: #c33b4e; font-size: 12px; }
  `],
  template: `
    <section class="rail">
      <h2>🧯 Module Status</h2>
      <p *ngIf="error" class="err">{{ error }}</p>
      <div class="row" *ngFor="let row of rows">
        <span class="dot" [style.background]="color(row.level)"></span>
        <span>{{ row.name }}</span>
        <span class="zone">{{ row.zone }}</span>
      </div>
    </section>
  `,
})
export class ModuleStatusComponent implements OnInit {
  rows: Array<{ name: string; zone: string; level: string }> = [];
  error: string | null = null;

  async ngOnInit(): Promise<void> {
    try {
      const data = await query<StatusData>(STATUS_QUERY);
      const rank: Record<string, number> = { NOMINAL: 0, WATCH: 1, CRITICAL: 2 };
      this.rows = data.modules.map((module) => {
        const level = data.telemetry
          .filter((r) => r.moduleId === module.moduleId)
          .reduce((acc, r) => ((rank[r.alertLevel] ?? 0) > (rank[acc] ?? 0) ? r.alertLevel : acc), 'NOMINAL');
        return { name: module.moduleName, zone: module.deckZone, level };
      });
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    }
  }

  color(level: string): string { return alertColor(level); }
}

export default ModuleStatusComponent;
