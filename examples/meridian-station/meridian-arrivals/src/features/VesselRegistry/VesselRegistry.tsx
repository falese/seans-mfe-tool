/**
 * VesselRegistry Feature Component
 *
 * Every registered vessel, joined across two systems that share no id:
 * Harbormaster's registry and dockings (bare snake_case arrays) give the
 * vessel and where it is; StellarLedger's accounts (camelCase cursor
 * envelopes) give its operator's standing — matched by the operator's name,
 * because that is the only thing the two agree on (PDR-007).
 */
import React, { useEffect, useState } from 'react';
import { query } from '../../platform/bff/bff';

interface Vessel { vesselRegistryNo: string; vesselName: string; operatorName: string; maxCapacityKg: number }
interface Docking { dockingId: number; vesselRegistryNo: string; statusCode: string; etaUtc: string }
interface Account { accountId: string; displayName: string; standing: string; balanceCents: number }
interface RegistryData { listVessels: Vessel[]; listDockings: Docking[]; accounts: Account[] }

const REGISTRY_QUERY = /* GraphQL */ `
  {
    listVessels { vesselRegistryNo vesselName operatorName maxCapacityKg }
    listDockings { dockingId vesselRegistryNo statusCode etaUtc }
    accounts { accountId displayName standing balanceCents }
  }
`;

/** A vessel's most recent docking, by ETA; undefined when it never docked. */
export function latestDocking(registryNo: string, dockings: Docking[]): Docking | undefined {
  return dockings
    .filter((d) => d.vesselRegistryNo === registryNo)
    .sort((a, b) => b.etaUtc.localeCompare(a.etaUtc))[0];
}

/** Ledger cents as station credits: 1250000 → "₢ 12,500.00". */
export function formatCredits(cents: number): string {
  const amount = (Math.abs(cents) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${cents < 0 ? '−' : ''}₢ ${amount}`;
}

const dockingRef = (id: number): string => `DCK-${String(id).padStart(6, '0')}`;

const STATUS_COLOR: Record<string, string> = { DOCKED: '#2e9e6b', APPROACH: '#3b6ff5', SCHEDULED: '#8b93b5', DEPARTED: '#5d6690', ABORTED: '#c33b4e' };

const wrap: React.CSSProperties = { background: '#0e1226', color: '#dfe4ff', borderRadius: 12, padding: 20, fontFamily: 'system-ui, sans-serif' };
const cell: React.CSSProperties = { padding: '6px 8px', borderBottom: '1px solid #141a33', fontSize: 12, textAlign: 'left' };
const head: React.CSSProperties = { ...cell, color: '#5d6690', fontWeight: 600, fontSize: 11 };

export type VesselRegistryProps = Record<string, never>;

export const VesselRegistry: React.FC<VesselRegistryProps> = () => {
  const [data, setData] = useState<RegistryData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    query<RegistryData>(REGISTRY_QUERY).then(setData).catch((err) => setError(String(err?.message ?? err)));
  }, []);

  if (error) return <section style={wrap}><p style={{ color: '#c33b4e' }}>Vessel registry unavailable: {error}</p></section>;
  if (!data) return <section style={wrap}><p style={{ color: '#5d6690' }}>Reading the registry…</p></section>;

  const accountByName = new Map(data.accounts.map((a) => [a.displayName, a]));
  const delinquent = data.listVessels.filter((v) => accountByName.get(v.operatorName)?.standing === 'DELINQUENT').length;

  return (
    <section style={wrap}>
      <h2 style={{ margin: '0 0 4px', fontSize: 18 }}>🛳️ Vessel Registry</h2>
      <p style={{ margin: '0 0 16px', color: '#5d6690', fontSize: 12 }}>
        {`${data.listVessels.length} vessels · ${delinquent} with a delinquent operator`}
      </p>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={head}>Registry</th>
            <th style={head}>Vessel</th>
            <th style={head}>Capacity</th>
            <th style={head}>Latest docking</th>
            <th style={head}>Operator</th>
            <th style={head}>Ledger</th>
          </tr>
        </thead>
        <tbody>
          {data.listVessels.map((v) => {
            const docking = latestDocking(v.vesselRegistryNo, data.listDockings);
            const account = accountByName.get(v.operatorName);
            return (
              <tr key={v.vesselRegistryNo} data-vessel={v.vesselRegistryNo}>
                <td style={{ ...cell, fontFamily: 'monospace' }}>{v.vesselRegistryNo}</td>
                <td style={cell}>{v.vesselName}</td>
                <td style={cell}>{`${(v.maxCapacityKg / 1000).toLocaleString('en-US')} t`}</td>
                <td style={cell}>
                  {docking ? (
                    <>
                      <span style={{ color: STATUS_COLOR[docking.statusCode] ?? '#8b93b5', fontWeight: 700, fontSize: 10, marginRight: 6 }}>{docking.statusCode}</span>
                      <span style={{ color: '#5d6690' }}>{dockingRef(docking.dockingId)}</span>
                    </>
                  ) : (
                    <span style={{ color: '#5d6690', fontStyle: 'italic' }}>never docked</span>
                  )}
                </td>
                <td style={cell}>{v.operatorName}</td>
                <td style={cell}>
                  {account ? (
                    <>
                      <span style={{ color: account.standing === 'DELINQUENT' ? '#c33b4e' : '#2e9e6b', fontWeight: 700, fontSize: 10, marginRight: 6 }}>{account.standing}</span>
                      <span>{formatCredits(account.balanceCents)}</span>
                    </>
                  ) : (
                    <span style={{ color: '#d9a514', fontStyle: 'italic' }}>no ledger account</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
};

export default VesselRegistry;
