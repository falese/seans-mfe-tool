/**
 * TelemetryDashboard Feature Component (Angular standalone)
 *
 * Every module's environmental readings from StationOS — the deliberate
 * single-source contrast to the docking board's two-source join. The
 * {Data, Pagination} ERP envelope never reaches this code: hoistField
 * unwrapped it at the graph, namingConvention camelCased the PascalCase.
 */
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { query } from '../../platform/bff/bff';
import { alertColor, formatMetric } from '../shared/metrics';

interface Module { moduleId: number; moduleName: string; deckZone: string; moduleType: string }
interface Reading { readingId: number; moduleId: number; metricKind: string; metricValue: number; recordedAtUtc: string; alertLevel: string }
interface DashboardData { modules: Module[]; telemetry: Reading[] }

const DASHBOARD_QUERY = /* GraphQL */ `
  { modules { moduleId moduleName deckZone moduleType }
    telemetry { readingId moduleId metricKind metricValue recordedAtUtc alertLevel } }
`;

interface ModulePanel { module: Module; readings: Reading[]; worst: string }

@Component({
  selector: 'telemetrydashboard-component',
  standalone: true,
  imports: [CommonModule],
  styles: [`
    :host { display: block; font-family: system-ui, sans-serif; }
    .board { background: #0e1226; color: #dfe4ff; border-radius: 12px; padding: 20px; }
    h2 { margin: 0 0 4px; font-size: 18px; }
    .sub { margin: 0 0 16px; color: #5d6690; font-size: 12px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
    .module { border: 1px solid #1c2340; border-radius: 10px; padding: 12px; }
    .module h3 { margin: 0 0 2px; font-size: 14px; display: flex; justify-content: space-between; }
    .zone { color: #5d6690; font-size: 11px; margin-bottom: 8px; }
    .metric { display: flex; justify-content: space-between; font-size: 12px; padding: 3px 0; }
    .kind { color: #8b93b5; }
    .dot { width: 9px; height: 9px; border-radius: 50%; display: inline-block; }
    .err { color: #c33b4e; }
  `],
  template: `
    <section class="board">
      <h2>🫁 Life Support Telemetry</h2>
      <p class="sub">StationOS environmental readings · single-source BFF</p>
      <p *ngIf="error" class="err">{{ error }}</p>
      <div class="grid">
        <div class="module" *ngFor="let panel of panels">
          <h3>{{ panel.module.moduleName }} <span class="dot" [style.background]="color(panel.worst)"></span></h3>
          <div class="zone">{{ panel.module.deckZone }} · {{ panel.module.moduleType }}</div>
          <div class="metric" *ngFor="let reading of panel.readings">
            <span class="kind">{{ reading.metricKind }}</span>
            <span [style.color]="color(reading.alertLevel)">{{ metric(reading) }}</span>
          </div>
        </div>
      </div>
    </section>
  `,
})
export class TelemetryDashboardComponent implements OnInit {
  panels: ModulePanel[] = [];
  error: string | null = null;

  async ngOnInit(): Promise<void> {
    try {
      const data = await query<DashboardData>(DASHBOARD_QUERY);
      const rank: Record<string, number> = { NOMINAL: 0, WATCH: 1, CRITICAL: 2 };
      this.panels = data.modules.map((module) => {
        const readings = data.telemetry.filter((r) => r.moduleId === module.moduleId);
        const worst = readings.reduce(
          (acc, r) => ((rank[r.alertLevel] ?? 0) > (rank[acc] ?? 0) ? r.alertLevel : acc),
          'NOMINAL'
        );
        return { module, readings, worst };
      });
    } catch (err) {
      this.error = `Telemetry unavailable: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  color(level: string): string { return alertColor(level); }
  metric(reading: Reading): string { return formatMetric(reading.metricKind, reading.metricValue); }
}

export default TelemetryDashboardComponent;
