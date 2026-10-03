export interface Domain {
  id: string;
  path: string;
  title: string;
  emoji: string;
  color: string;
  blurb: string;
}

export const DOMAINS: Domain[] = [
  { id: 'docking', path: '/docking', title: 'Docking Control', emoji: '🛰️', color: '#3b6ff5', blurb: 'Berths, traffic, assignments' },
  { id: 'docking-simulation', path: '/simulator', title: 'Docking Simulator', emoji: '🎮', color: '#ff6b9d', blurb: 'First-person 3D docking gameplay' },
  { id: 'life-support', path: '/life-support', title: 'Life Support', emoji: '🫁', color: '#2e9e6b', blurb: 'Telemetry, environment, alerts' },
  { id: 'cargo', path: '/cargo', title: 'Cargo Operations', emoji: '📦', color: '#c77b21', blurb: 'Manifests, hazards, valuations' },
  { id: 'crew', path: '/crew', title: 'Crew Services', emoji: '🧑‍🚀', color: '#8455d6', blurb: 'Roster, certifications, pay' },
  { id: 'concourse', path: '/concourse', title: 'Concourse', emoji: '🍜', color: '#d64570', blurb: 'Vendors, stalls, settlements' },
];

export const BERTHS = ['b1', 'b2', 'b3', 'b4', 'b5', 'b6'];

// TODO: move to env config
export const REFRESH_MS = 30000;
