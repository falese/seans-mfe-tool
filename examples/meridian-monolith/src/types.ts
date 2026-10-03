// All the app's data types. Field names are normalized to camelCase by
// api/client.ts regardless of what each backend sends.

// ---- Harbormaster ----
export interface Berth {
  berthId: string;
  berthClass: string;
  occupiedFlag: number;
  maxMassKg: number;
  currentDockingId: number | null;
}

export interface Docking {
  dockingId: number;
  berthId: string;
  vesselRegistryNo: string;
  etaUtc: string;
  statusCode: string;
}

export interface ManifestLine {
  lineId: number;
  dockingId: number;
  sku: string;
  description: string;
  qty: number;
  declaredMassKg: number;
  hazardClass: string;
}

// ---- StellarLedger ----
export interface Charge {
  dockingRef: string;
  chargeType: string;
  amountCents: number;
  status: string;
}

export interface Valuation {
  manifestLineRef: string;
  declaredValueCents: number;
  insuranceClass: string;
}

export interface Settlement {
  merchantId: string;
  netCents: number;
  status: string;
}

export interface Payroll {
  payrollId: string;
  crewRef: string;
  grossCents: number;
  status: string;
}

// ---- StationOS ----
export interface Module {
  moduleId: number;
  moduleName: string;
  deckZone: string;
  moduleType: string;
}

export interface Reading {
  readingId: number;
  moduleId: number;
  metricKind: string;
  metricValue: number;
  recordedAtUtc: string;
  alertLevel: string;
}

export interface CrewMember {
  crewId: number;
  crewMemberName: string;
  section: string;
  dutyStatus: string;
}

export interface Certification {
  crewId: number;
  certificationCode: string;
  status: string;
}

export interface Vendor {
  vendorId: number;
  vendorName: string;
  concourseZone: string;
  cuisineOrCategory: string;
  licenseStatus: string;
}

export interface Stall {
  vendorId: number;
  stallNo: string;
  leaseCredits: number;
}
