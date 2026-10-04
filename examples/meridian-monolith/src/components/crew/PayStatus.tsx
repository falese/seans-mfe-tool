import React, { useEffect, useState } from 'react';
import { getPayroll } from '../../api/client';
import { formatCents, payColor } from '../../utils/helpers';
import type { Payroll } from '../../types';

// Payroll that is NOT simply paid - what the crew office needs to chase.
export default function PayStatus() {
  const [rows, setRows] = useState<Payroll[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPayroll()
      .then((payroll) => setRows(payroll.filter((p) => p.status !== 'PAID')))
      .catch((err) => setError(String(err?.message ?? err)));
  }, []);

  return (
    <section className="wrap" style={{ background: '#0e1226', color: '#dfe4ff', borderRadius: 12, padding: 14 }}>
      <h2 style={{ margin: '0 0 10px', fontSize: 14 }}>💸 Pay Exceptions</h2>
      {error && <p style={{ color: '#c33b4e', fontSize: 12 }}>{error}</p>}
      {rows && rows.length === 0 && <p style={{ color: '#5d6690', fontSize: 12 }}>All payroll settled.</p>}
      {(rows ?? []).map((row) => (
        <div key={row.payrollId} style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 12, padding: '4px 0', borderBottom: '1px solid #141a33' }}>
          <span style={{ color: '#8b93b5' }}>{row.crewRef}</span>
          <span>{formatCents(row.grossCents)}</span>
          <span style={{ marginLeft: 'auto', color: payColor(row.status), fontWeight: 700, fontSize: 10 }}>{row.status}</span>
        </div>
      ))}
    </section>
  );
}
