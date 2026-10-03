import React, { useEffect, useState } from 'react';
import { getDockings, getManifestLines, getValuations } from '../../api/client';
import StatusChip from '../../components/StatusChip';
import { formatCents, hazardColor, toLineRef } from '../../utils/helpers';

interface Row {
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

const th: React.CSSProperties = { textAlign: 'left', color: '#5d6690', padding: '6px 8px', borderBottom: '1px solid #1c2340', textTransform: 'uppercase', fontSize: 10, letterSpacing: 1 };
const td: React.CSSProperties = { padding: '7px 8px', borderBottom: '1px solid #141a33' };

// Manifest lines live in the Harbormaster, their valuations in the ledger.
// Some lines have no valuation yet - show that rather than hiding the row.
export default function CargoManifest() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getManifestLines(), getValuations(), getDockings()])
      .then(([lines, valuations, dockings]) => {
        const valuationByRef = new Map(valuations.map((v) => [v.manifestLineRef, v]));
        const vesselByDocking = new Map(dockings.map((d) => [d.dockingId, d.vesselRegistryNo]));
        setRows(lines.map((line) => {
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
        }));
      })
      .catch((err) => setError(`Cargo manifest unavailable: ${err?.message ?? err}`));
  }, []);

  return (
    <section className="board" style={{ background: '#0e1226', color: '#dfe4ff', borderRadius: 12, padding: 20 }}>
      <h2 style={{ margin: '0 0 4px', fontSize: 18 }}>📦 Cargo Manifest</h2>
      <p style={{ margin: '0 0 16px', color: '#5d6690', fontSize: 12 }}>Harbormaster customs lines · StellarLedger valuations</p>
      {error && <p style={{ color: '#c33b4e' }}>{error}</p>}
      {!error && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr><th style={th}>Line ref</th><th style={th}>SKU</th><th style={th}>Qty</th><th style={th}>Mass</th><th style={th}>Hazard</th><th style={th}>Vessel</th><th style={th}>Declared value</th></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.ref}>
                <td style={{ ...td, color: '#8b93b5' }}>{row.ref}</td>
                <td style={td}><strong>{row.sku}</strong><br /><span style={{ color: '#8b93b5' }}>{row.description}</span></td>
                <td style={td}>{row.qty}</td>
                <td style={td}>{row.massKg.toLocaleString()} kg</td>
                <td style={td}><StatusChip small label={row.hazard} color={hazardColor(row.hazard)} /></td>
                <td style={td}>{row.vessel}</td>
                <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>
                  {row.value
                    ? <>{row.value} <span style={{ color: '#5d6690' }}>({row.insuranceClass})</span></>
                    : <span className="pending" style={{ color: '#d9a514', fontStyle: 'italic' }}>valuation pending — finance</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
