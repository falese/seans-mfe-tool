/**
 * MarketDirectory Feature Component
 *
 * The three-source screen: StationOS vendors + stalls (PascalCase pages),
 * StellarLedger settlement standing (camelCase cursor envelopes, merchant
 * "ACC-7105"), and Harbormaster inbound supply dockings (bare snake_case
 * arrays) — every convention in the station on one normalized graph.
 * Vendor identity is the cross-system pun: VendorId 105 <-> ACC-7105.
 */
import React, { useEffect, useState } from 'react';
import { query } from '../../platform/bff/bff';

interface Vendor { vendorId: number; vendorName: string; concourseZone: string; cuisineOrCategory: string; licenseStatus: string }
interface Stall { vendorId: number; stallNo: string; leaseCredits: number }
interface Settlement { merchantId: string; netCents: number; status: string }
interface Docking { dockingId: number; vesselRegistryNo: string; statusCode: string; etaUtc: string }
interface MarketData { vendors: Vendor[]; stalls: Stall[]; settlements: Settlement[]; listDockings: Docking[] }

const MARKET_QUERY = /* GraphQL */ `
  {
    vendors { vendorId vendorName concourseZone cuisineOrCategory licenseStatus }
    stalls { vendorId stallNo leaseCredits }
    settlements { merchantId netCents status }
    listDockings { dockingId vesselRegistryNo statusCode etaUtc }
  }
`;

/** VendorId 105 -> the ledger's merchant account "ACC-7105". */
export function toMerchantId(vendorId: number): string {
  return `ACC-7${String(vendorId).padStart(3, '0')}`;
}

function licenseColor(status: string): string {
  switch (status) {
    case 'SUSPENDED': return '#c33b4e';
    case 'PROBATION': return '#d9a514';
    default: return '#2e9e6b';
  }
}

function settlementLabel(settlements: Settlement[]): string {
  if (settlements.length === 0) return 'no ledger account';
  const held = settlements.find((s) => s.status === 'HELD');
  if (held) return 'settlement HELD';
  const open = settlements.find((s) => s.status === 'OPEN');
  if (open) return 'period open';
  return 'settled';
}

const wrap: React.CSSProperties = { background: '#0e1226', color: '#dfe4ff', borderRadius: 12, padding: 20, fontFamily: 'system-ui, sans-serif' };
const card: React.CSSProperties = { border: '1px solid #1c2340', borderRadius: 10, padding: 12 };

export const MarketDirectory: React.FC = () => {
  const [data, setData] = useState<MarketData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    query<MarketData>(MARKET_QUERY).then(setData).catch((err) => setError(String(err?.message ?? err)));
  }, []);

  if (error) return <section style={wrap}><p style={{ color: '#c33b4e' }}>Concourse unavailable: {error}</p></section>;
  if (!data) return <section style={wrap}><p style={{ color: '#5d6690' }}>Opening the concourse…</p></section>;

  const stallByVendor = new Map(data.stalls.map((s) => [s.vendorId, s]));
  const inbound = data.listDockings.filter((d) => d.statusCode === 'APPROACH' || d.statusCode === 'SCHEDULED');

  return (
    <section style={wrap}>
      <h2 style={{ margin: '0 0 4px', fontSize: 18 }}>🍜 Concourse Directory</h2>
      <p style={{ margin: '0 0 16px', color: '#5d6690', fontSize: 12 }}>
        StationOS stalls · StellarLedger settlements · Harbormaster inbound supplies — three conventions, one graph
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 12 }}>
        {data.vendors.map((vendor) => {
          const stall = stallByVendor.get(vendor.vendorId);
          const settlements = data.settlements.filter((s) => s.merchantId === toMerchantId(vendor.vendorId));
          return (
            <div key={vendor.vendorId} style={card} data-vendor={vendor.vendorId}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <strong style={{ fontSize: 14 }}>{vendor.vendorName}</strong>
                <span style={{ fontSize: 10, fontWeight: 700, color: licenseColor(vendor.licenseStatus), border: `1px solid ${licenseColor(vendor.licenseStatus)}`, borderRadius: 999, padding: '1px 7px' }}>
                  {vendor.licenseStatus}
                </span>
              </div>
              <div style={{ color: '#8b93b5', fontSize: 12, margin: '4px 0' }}>
                {vendor.cuisineOrCategory} · {vendor.concourseZone}{stall ? ` · stall ${stall.stallNo}` : ''}
              </div>
              <div style={{ fontSize: 11, color: '#5d6690' }}>
                {stall ? `lease ${stall.leaseCredits.toLocaleString()} cr · ` : ''}{settlementLabel(settlements)}
              </div>
            </div>
          );
        })}
      </div>
      <h3 style={{ margin: '18px 0 8px', fontSize: 13, color: '#8b93b5' }}>🚚 Inbound supplies (Harbormaster)</h3>
      {inbound.length === 0 && <p style={{ color: '#5d6690', fontSize: 12 }}>Nothing scheduled.</p>}
      {inbound.map((docking) => (
        <div key={docking.dockingId} style={{ display: 'flex', gap: 10, fontSize: 12, padding: '4px 0', borderBottom: '1px solid #141a33' }}>
          <span style={{ color: '#5d6690' }}>{docking.etaUtc.slice(5, 16).replace('T', ' ')}</span>
          <span><strong>{docking.vesselRegistryNo}</strong></span>
          <span style={{ marginLeft: 'auto', color: '#3b6ff5', fontWeight: 700, fontSize: 10 }}>{docking.statusCode}</span>
        </div>
      ))}
    </section>
  );
};

export default MarketDirectory;
