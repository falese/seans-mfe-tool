import React, { useEffect, useState } from 'react';
import { getSettlements, getStalls, getVendors } from '../api/client';
import { useAppState } from '../store/AppContext';
import { licenseColor, shortTime, toMerchantId } from '../utils/helpers';
import type { Settlement, Stall, Vendor } from '../types';

function settlementLabel(settlements: Settlement[]): string {
  if (settlements.length === 0) return 'no ledger account';
  if (settlements.find((s) => s.status === 'HELD')) return 'settlement HELD';
  if (settlements.find((s) => s.status === 'OPEN')) return 'period open';
  return 'settled';
}

const card: React.CSSProperties = { border: '1px solid #1c2340', borderRadius: 10, padding: 12 };

// Concourse directory: vendors + stalls (StationOS), settlement standing
// (ledger), inbound supply dockings (from the global store).
export default function ConcoursePage() {
  const { dockings } = useAppState();
  const [vendors, setVendors] = useState<Vendor[] | null>(null);
  const [stalls, setStalls] = useState<Stall[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getVendors(), getStalls(), getSettlements()])
      .then(([v, s, st]) => { setVendors(v); setStalls(s); setSettlements(st); })
      .catch((err) => setError(String(err?.message ?? err)));
  }, []);

  if (error) return <section className="wrap" style={{ background: '#0e1226', borderRadius: 12, padding: 20 }}><p style={{ color: '#c33b4e' }}>Concourse unavailable: {error}</p></section>;
  if (!vendors) return <section className="wrap" style={{ background: '#0e1226', borderRadius: 12, padding: 20 }}><p style={{ color: '#5d6690' }}>Opening the concourse…</p></section>;

  const stallByVendor = new Map(stalls.map((s) => [s.vendorId, s]));
  const inbound = dockings.filter((d) => d.statusCode === 'APPROACH' || d.statusCode === 'SCHEDULED');

  return (
    <section className="wrap" style={{ background: '#0e1226', color: '#dfe4ff', borderRadius: 12, padding: 20 }}>
      <h2 style={{ margin: '0 0 4px', fontSize: 18 }}>🍜 Concourse Directory</h2>
      <p style={{ margin: '0 0 16px', color: '#5d6690', fontSize: 12 }}>StationOS stalls · StellarLedger settlements · Harbormaster inbound supplies</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 12 }}>
        {vendors.map((vendor) => {
          const stall = stallByVendor.get(vendor.vendorId);
          const mine = settlements.filter((s) => s.merchantId === toMerchantId(vendor.vendorId));
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
                {stall ? `lease ${stall.leaseCredits.toLocaleString()} cr · ` : ''}{settlementLabel(mine)}
              </div>
            </div>
          );
        })}
      </div>
      <h3 style={{ margin: '18px 0 8px', fontSize: 13, color: '#8b93b5' }}>🚚 Inbound supplies (Harbormaster)</h3>
      {inbound.length === 0 && <p style={{ color: '#5d6690', fontSize: 12 }}>Nothing scheduled.</p>}
      {inbound.map((docking) => (
        <div key={docking.dockingId} style={{ display: 'flex', gap: 10, fontSize: 12, padding: '4px 0', borderBottom: '1px solid #141a33' }}>
          <span style={{ color: '#5d6690' }}>{shortTime(docking.etaUtc)}</span>
          <span><strong>{docking.vesselRegistryNo}</strong></span>
          <span style={{ marginLeft: 'auto', color: '#3b6ff5', fontWeight: 700, fontSize: 10 }}>{docking.statusCode}</span>
        </div>
      ))}
    </section>
  );
}
