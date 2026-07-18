/** Display helpers shared by the life-support components. */

export function alertColor(level: string): string {
  switch (level) {
    case 'CRITICAL': return '#c33b4e';
    case 'WATCH': return '#d9a514';
    default: return '#2e9e6b';
  }
}

const UNITS: Record<string, string> = {
  O2_PARTIAL_PRESSURE: 'kPa',
  CO2_PPM: 'ppm',
  TEMP_C: '°C',
  POWER_KW: 'kW',
  PRESSURE_KPA: 'kPa',
};

export function formatMetric(kind: string, value: number): string {
  return `${value.toLocaleString('en-US')} ${UNITS[kind] ?? ''}`.trim();
}
