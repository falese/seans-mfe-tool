import React, { useEffect, useState } from 'react';
import { getCertifications, getCrew, getPayroll } from '../../api/client';
import { certColor, formatCents, payColor, toCrewRef } from '../../utils/helpers';
import type { Certification, CrewMember, Payroll } from '../../types';

const th: React.CSSProperties = { textAlign: 'left', color: '#5d6690', padding: '6px 10px', borderBottom: '1px solid #1c2340', textTransform: 'uppercase', fontSize: 10, letterSpacing: 1 };
const td: React.CSSProperties = { padding: '8px 10px', borderBottom: '1px solid #141a33', fontSize: 13 };
const chip = (color: string): React.CSSProperties => ({ display: 'inline-block', padding: '1px 7px', borderRadius: 999, fontSize: 10, fontWeight: 700, color, border: `1px solid ${color}`, marginRight: 4 });

interface RosterData { crew: CrewMember[]; certifications: Certification[]; payroll: Payroll[] }

export default function CrewRoster() {
  const [data, setData] = useState<RosterData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getCrew(), getCertifications(), getPayroll()])
      .then(([crew, certifications, payroll]) => setData({ crew, certifications, payroll }))
      .catch((err) => setError(String(err?.message ?? err)));
  }, []);

  if (error) return <section className="wrap" style={{ background: '#0e1226', borderRadius: 12, padding: 20 }}><p style={{ color: '#c33b4e' }}>Crew roster unavailable: {error}</p></section>;
  if (!data) return <section className="wrap" style={{ background: '#0e1226', borderRadius: 12, padding: 20 }}><p style={{ color: '#5d6690' }}>Loading roster…</p></section>;

  const payByRef = new Map(data.payroll.map((p) => [p.crewRef, p]));

  return (
    <section className="wrap" style={{ background: '#0e1226', color: '#dfe4ff', borderRadius: 12, padding: 20 }}>
      <h2 style={{ margin: '0 0 4px', fontSize: 18 }}>🧑‍🚀 Crew Roster</h2>
      <p style={{ margin: '0 0 16px', color: '#5d6690', fontSize: 12 }}>StationOS roster & certifications · StellarLedger payroll</p>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr><th style={th}>Crew</th><th style={th}>Section</th><th style={th}>Duty</th><th style={th}>Certifications</th><th style={th}>Last pay</th></tr>
        </thead>
        <tbody>
          {data.crew.map((member) => {
            const certs = data.certifications.filter((c) => c.crewId === member.crewId);
            const pay = payByRef.get(toCrewRef(member.crewId));
            return (
              <tr key={member.crewId}>
                <td style={td}><strong>{member.crewMemberName}</strong></td>
                <td style={td}>{member.section}</td>
                <td style={{ ...td, color: member.dutyStatus === 'ON_DUTY' ? '#2e9e6b' : '#8b93b5' }}>{member.dutyStatus}</td>
                <td style={td}>
                  {certs.length === 0 && <span style={{ color: '#5d6690' }}>—</span>}
                  {certs.map((cert) => <span key={cert.certificationCode} style={chip(certColor(cert.status))}>{cert.certificationCode}</span>)}
                </td>
                <td style={td}>
                  {pay
                    ? <span style={{ color: payColor(pay.status) }}>{formatCents(pay.grossCents)} · {pay.status}</span>
                    : <span style={{ color: '#5d6690' }}>no ledger record</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
