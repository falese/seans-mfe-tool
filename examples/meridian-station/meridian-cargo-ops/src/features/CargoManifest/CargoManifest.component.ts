/**
 * CargoManifest Feature Component (Angular standalone)
 *
 * THE flagship split-document view: Harbormaster manifest lines joined
 * with StellarLedger valuations by the composite line ref — including the
 * lines finance hasn't processed yet (DCK-004027/2 in the seed data). The
 * gap is the point: real integrations have holes, and the UI must say so.
 */
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { query } from '../../platform/bff/bff';
import { formatCents, hazardColor, toLineRef } from '../shared/cargo';

interface ManifestLine { lineId: number; dockingId: number; sku: string; description: string; qty: number; declaredMassKg: number; hazardClass: string }
interface Valuation { manifestLineRef: string; declaredValueCents: number; insuranceClass: string }
interface Docking { dockingId: number; berthId: string; vesselRegistryNo: string; statusCode: string }
interface ManifestData { listManifestLines: ManifestLine[]; valuations: Valuation[]; listDockings: Docking[] }

const MANIFEST_QUERY = /* GraphQL */ `
  {
    listManifestLines { lineId dockingId sku description qty declaredMassKg hazardClass }
    valuations { manifestLineRef declaredValueCents insuranceClass }
    listDockings { dockingId berthId vesselRegistryNo statusCode }
  }
`;

interface ManifestRow {
  ref: string;
  sku: string;
  description: string;
  qty: number;
  massKg: number;
  hazard: string;
  vessel: string;
  value: string | null;
  insuranceClass: string | null;
}

@Component({
  selector: 'cargomanifest-component',
  standalone: true,
  imports: [CommonModule],
  styles: [`
    :host { display: block; font-family: system-ui, sans-serif; }
    .board { background: #0e1226; color: #dfe4ff; border-radius: 12px; padding: 20px; }
    h2 { margin: 0 0 4px; font-size: 18px; }
    .sub { margin: 0 0 16px; color: #5d6690; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { text-align: left; color: #5d6690; padding: 6px 8px; border-bottom: 1px solid #1c2340; text-transform: uppercase; font-size: 10px; letter-spacing: 1px; }
    td { padding: 7px 8px; border-bottom: 1px solid #141a33; }
    .ref { color: #8b93b5; font-variant-numeric: tabular-nums; }
    .chip { font-size: 10px; font-weight: 700; padding: 1px 7px; border-radius: 999px; }
    .money { font-variant-numeric: tabular-nums; }
    .pending { color: #d9a514; font-style: italic; }
    .err { color: #c33b4e; }
  `],
  template: `
    <section class="board">
      <h2>📦 Cargo Manifest</h2>
      <p class="sub">Harbormaster customs lines · StellarLedger valuations — one document, two systems</p>
      <p *ngIf="error" class="err">{{ error }}</p>
      <table *ngIf="!error">
        <thead>
          <tr><th>Line ref</th><th>SKU</th><th>Qty</th><th>Mass</th><th>Hazard</th><th>Vessel</th><th>Declared value</th></tr>
        </thead>
        <tbody>
          <tr *ngFor="let row of rows">
            <td class="ref">{{ row.ref }}</td>
            <td><strong>{{ row.sku }}</strong><br /><span style="color:#8b93b5">{{ row.description }}</span></td>
            <td>{{ row.qty }}</td>
            <td>{{ row.massKg.toLocaleString() }} kg</td>
            <td><span class="chip" [style.color]="hazard(row.hazard)" [style.border]="'1px solid ' + hazard(row.hazard)">{{ row.hazard }}</span></td>
            <td>{{ row.vessel }}</td>
            <td class="money">
              <ng-container *ngIf="row.value; else pending">{{ row.value }} <span style="color:#5d6690">({{ row.insuranceClass }})</span></ng-container>
              <ng-template #pending><span class="pending">valuation pending — finance</span></ng-template>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  `,
})
export class CargoManifestComponent implements OnInit {
  rows: ManifestRow[] = [];
  error: string | null = null;

  async ngOnInit(): Promise<void> {
    try {
      const data = await query<ManifestData>(MANIFEST_QUERY);
      const valuationByRef = new Map(data.valuations.map((v) => [v.manifestLineRef, v]));
      const vesselByDocking = new Map(data.listDockings.map((d) => [d.dockingId, d.vesselRegistryNo]));
      this.rows = data.listManifestLines.map((line) => {
        const ref = toLineRef(line.dockingId, line.lineId);
        const valuation = valuationByRef.get(ref);
        return {
          ref,
          sku: line.sku,
          description: line.description,
          qty: line.qty,
          massKg: line.declaredMassKg,
          hazard: line.hazardClass,
          vessel: vesselByDocking.get(line.dockingId) ?? '—',
          value: valuation ? formatCents(valuation.declaredValueCents) : null,
          insuranceClass: valuation?.insuranceClass ?? null,
        };
      });
    } catch (err) {
      this.error = `Cargo manifest unavailable: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  hazard(hazardClass: string): string { return hazardColor(hazardClass); }
}

export default CargoManifestComponent;
