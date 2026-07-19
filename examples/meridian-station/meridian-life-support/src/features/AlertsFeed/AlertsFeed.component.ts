/**
 * AlertsFeed Feature Component (Angular standalone)
 * Readings at WATCH or CRITICAL, newest first — what the ops crew actually
 * looks at.
 */
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { query } from '../../platform/bff/bff';
import { alertColor, formatMetric } from '../shared/metrics';

interface Reading { readingId: number; moduleId: number; metricKind: string; metricValue: number; recordedAtUtc: string; alertLevel: string }
interface FeedData { telemetry: Reading[] }

const FEED_QUERY = /* GraphQL */ `
  { telemetry { readingId moduleId metricKind metricValue recordedAtUtc alertLevel } }
`;

@Component({
  selector: 'alertsfeed-component',
  standalone: true,
  imports: [CommonModule],
  styles: [`
    :host { display: block; font-family: system-ui, sans-serif; }
    .feed { background: #0e1226; color: #dfe4ff; border-radius: 12px; padding: 14px; }
    h2 { margin: 0 0 10px; font-size: 14px; }
    .entry { display: flex; gap: 8px; align-items: baseline; font-size: 12px; padding: 4px 0; border-bottom: 1px solid #141a33; }
    .when { color: #5d6690; font-variant-numeric: tabular-nums; }
    .chip { margin-left: auto; font-size: 10px; font-weight: 700; padding: 1px 7px; border-radius: 999px; }
    .quiet { color: #5d6690; font-size: 12px; }
    .err { color: #c33b4e; font-size: 12px; }
  `],
  template: `
    <section class="feed">
      <h2>🚨 Alerts</h2>
      <p *ngIf="error" class="err">{{ error }}</p>
      <p *ngIf="!error && alerts.length === 0" class="quiet">All systems nominal.</p>
      <div class="entry" *ngFor="let alert of alerts">
        <span class="when">{{ alert.recordedAtUtc.slice(11, 16) }}</span>
        <span>module {{ alert.moduleId }} · {{ metric(alert) }}</span>
        <span class="chip" [style.color]="color(alert.alertLevel)" [style.border]="'1px solid ' + color(alert.alertLevel)">
          {{ alert.alertLevel }}
        </span>
      </div>
    </section>
  `,
})
export class AlertsFeedComponent implements OnInit {
  alerts: Reading[] = [];
  error: string | null = null;

  async ngOnInit(): Promise<void> {
    try {
      const data = await query<FeedData>(FEED_QUERY);
      this.alerts = data.telemetry
        .filter((r) => r.alertLevel === 'WATCH' || r.alertLevel === 'CRITICAL')
        .sort((a, b) => b.recordedAtUtc.localeCompare(a.recordedAtUtc));
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    }
  }

  color(level: string): string { return alertColor(level); }
  metric(reading: Reading): string { return formatMetric(reading.metricKind, reading.metricValue); }
}

export default AlertsFeedComponent;
