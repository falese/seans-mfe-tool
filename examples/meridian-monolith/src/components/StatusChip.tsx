import React from 'react';

interface Props {
  label: string;
  color: string;
  small?: boolean;
}

// Used everywhere for status pills.
export default function StatusChip({ label, color, small }: Props) {
  return (
    <span
      className="chip"
      style={{
        display: 'inline-block',
        padding: small ? '1px 7px' : '2px 8px',
        borderRadius: 999,
        fontSize: small ? 10 : 11,
        fontWeight: small ? 700 : 600,
        color,
        border: `1px solid ${color}`,
      }}
    >
      {label}
    </span>
  );
}
