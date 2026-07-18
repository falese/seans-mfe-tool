// @ts-nocheck

import type { InContextSdkMethod } from '@graphql-mesh/types';

export namespace StationOsTypes {
  export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  /** The `String` scalar type represents textual data, represented as UTF-8 character sequences. The String type is most often used by GraphQL to represent free-form human-readable text. */
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  /** The `Int` scalar type represents non-fractional signed whole numeric values. Int can represent values between -(2^31) and 2^31 - 1. */
  Int: { input: number; output: number; }
  /** The `Float` scalar type represents signed double-precision fractional values as specified by [IEEE 754](https://en.wikipedia.org/wiki/IEEE_floating_point). */
  Float: { input: number; output: number; }
  /** A date-time string at UTC, such as 2007-12-03T10:15:30Z, compliant with the `date-time` format outlined in section 5.6 of the RFC 3339 profile of the ISO 8601 standard for representation of dates and times using the Gregorian calendar. */
  DateTime: { input: Date | string; output: Date | string; }
  ObjMap: { input: unknown; output: unknown; }
};

export type Query = {
  /** List station modules */
  getModules?: Maybe<GetModules_200Response>;
  /** Get one module */
  getModuleById?: Maybe<Module>;
  /** List life-support telemetry readings */
  getTelemetry?: Maybe<GetTelemetry_200Response>;
  /** List crew members */
  getCrew?: Maybe<GetCrew_200Response>;
  /** Get one crew member */
  getCrewById?: Maybe<Crew>;
  /** List crew certifications */
  getCertifications?: Maybe<GetCertifications_200Response>;
  /** List passenger records */
  getPassengers?: Maybe<GetPassengers_200Response>;
  /** List concourse vendors */
  getVendors?: Maybe<GetVendors_200Response>;
  /** Get one vendor */
  getVendorById?: Maybe<Vendor>;
  /** List concourse stalls */
  getStalls?: Maybe<GetStalls_200Response>;
  telemetry?: Maybe<Array<Maybe<Telemetry>>>;
  modules?: Maybe<Array<Maybe<Module>>>;
};


export type QuerygetModulesArgs = {
  DeckZone?: InputMaybe<Scalars['String']['input']>;
  ModuleType?: InputMaybe<Scalars['String']['input']>;
  Page?: InputMaybe<Scalars['Int']['input']>;
  PageSize?: InputMaybe<Scalars['Int']['input']>;
};


export type QuerygetModuleByIdArgs = {
  ModuleId: Scalars['Int']['input'];
};


export type QuerygetTelemetryArgs = {
  ModuleId?: InputMaybe<Scalars['Int']['input']>;
  MetricKind?: InputMaybe<Scalars['String']['input']>;
  AlertLevel?: InputMaybe<Scalars['String']['input']>;
  Page?: InputMaybe<Scalars['Int']['input']>;
  PageSize?: InputMaybe<Scalars['Int']['input']>;
};


export type QuerygetCrewArgs = {
  Section?: InputMaybe<Scalars['String']['input']>;
  DutyStatus?: InputMaybe<Scalars['String']['input']>;
  Page?: InputMaybe<Scalars['Int']['input']>;
  PageSize?: InputMaybe<Scalars['Int']['input']>;
};


export type QuerygetCrewByIdArgs = {
  CrewId: Scalars['Int']['input'];
};


export type QuerygetCertificationsArgs = {
  CrewId?: InputMaybe<Scalars['Int']['input']>;
  Status?: InputMaybe<Scalars['String']['input']>;
  Page?: InputMaybe<Scalars['Int']['input']>;
  PageSize?: InputMaybe<Scalars['Int']['input']>;
};


export type QuerygetPassengersArgs = {
  DockingNo?: InputMaybe<Scalars['Int']['input']>;
  ClearanceStatus?: InputMaybe<Scalars['String']['input']>;
  Page?: InputMaybe<Scalars['Int']['input']>;
  PageSize?: InputMaybe<Scalars['Int']['input']>;
};


export type QuerygetVendorsArgs = {
  ConcourseZone?: InputMaybe<Scalars['String']['input']>;
  LicenseStatus?: InputMaybe<Scalars['String']['input']>;
  Page?: InputMaybe<Scalars['Int']['input']>;
  PageSize?: InputMaybe<Scalars['Int']['input']>;
};


export type QuerygetVendorByIdArgs = {
  VendorId: Scalars['Int']['input'];
};


export type QuerygetStallsArgs = {
  VendorId?: InputMaybe<Scalars['Int']['input']>;
  ConcourseZone?: InputMaybe<Scalars['String']['input']>;
  Page?: InputMaybe<Scalars['Int']['input']>;
  PageSize?: InputMaybe<Scalars['Int']['input']>;
};


export type QuerytelemetryArgs = {
  ModuleId?: InputMaybe<Scalars['Int']['input']>;
  MetricKind?: InputMaybe<Scalars['String']['input']>;
  AlertLevel?: InputMaybe<Scalars['String']['input']>;
  Page?: InputMaybe<Scalars['Int']['input']>;
  PageSize?: InputMaybe<Scalars['Int']['input']>;
};


export type QuerymodulesArgs = {
  DeckZone?: InputMaybe<Scalars['String']['input']>;
  ModuleType?: InputMaybe<Scalars['String']['input']>;
  Page?: InputMaybe<Scalars['Int']['input']>;
  PageSize?: InputMaybe<Scalars['Int']['input']>;
};

export type GetModules_200Response = {
  pagination?: Maybe<QueryGetModulesPagination>;
};

export type Module = {
  moduleId?: Maybe<Scalars['Int']['output']>;
  moduleName?: Maybe<Scalars['String']['output']>;
  deckZone?: Maybe<Scalars['String']['output']>;
  /** HABITAT | LIFE_SUPPORT | DOCKING | CONCOURSE | POWER */
  moduleType?: Maybe<Scalars['String']['output']>;
};

export type QueryGetModulesPagination = {
  page?: Maybe<Scalars['Int']['output']>;
  pageSize?: Maybe<Scalars['Int']['output']>;
  totalPages?: Maybe<Scalars['Int']['output']>;
};

export type GetTelemetry_200Response = {
  pagination?: Maybe<QueryGetTelemetryPagination>;
};

export type Telemetry = {
  readingId?: Maybe<Scalars['Int']['output']>;
  moduleId?: Maybe<Scalars['Int']['output']>;
  /** O2_PARTIAL_PRESSURE | CO2_PPM | TEMP_C | POWER_KW | PRESSURE_KPA */
  metricKind?: Maybe<Scalars['String']['output']>;
  metricValue?: Maybe<Scalars['Float']['output']>;
  recordedAtUtc?: Maybe<Scalars['DateTime']['output']>;
  /** NOMINAL | WATCH | CRITICAL */
  alertLevel?: Maybe<Scalars['String']['output']>;
};

export type QueryGetTelemetryPagination = {
  page?: Maybe<Scalars['Int']['output']>;
  pageSize?: Maybe<Scalars['Int']['output']>;
  totalPages?: Maybe<Scalars['Int']['output']>;
};

export type GetCrew_200Response = {
  data?: Maybe<Array<Maybe<Crew>>>;
  pagination?: Maybe<QueryGetCrewPagination>;
};

export type Crew = {
  crewId?: Maybe<Scalars['Int']['output']>;
  crewMemberName?: Maybe<Scalars['String']['output']>;
  /** OPERATIONS | MEDICAL | ENGINEERING | HOSPITALITY */
  section?: Maybe<Scalars['String']['output']>;
  /** ON_DUTY | OFF_DUTY | LEAVE */
  dutyStatus?: Maybe<Scalars['String']['output']>;
  berthAssignment?: Maybe<Scalars['String']['output']>;
};

export type QueryGetCrewPagination = {
  page?: Maybe<Scalars['Int']['output']>;
  pageSize?: Maybe<Scalars['Int']['output']>;
  totalPages?: Maybe<Scalars['Int']['output']>;
};

export type GetCertifications_200Response = {
  data?: Maybe<Array<Maybe<Certification>>>;
  pagination?: Maybe<QueryGetCertificationsPagination>;
};

export type Certification = {
  certificationId?: Maybe<Scalars['Int']['output']>;
  crewId?: Maybe<Scalars['Int']['output']>;
  /** EVA | DOCKING_CONTROL | HAZMAT | MEDICAL | FOOD_SAFETY */
  certificationCode?: Maybe<Scalars['String']['output']>;
  expiresOnUtc?: Maybe<Scalars['DateTime']['output']>;
  /** VALID | EXPIRING | EXPIRED */
  status?: Maybe<Scalars['String']['output']>;
};

export type QueryGetCertificationsPagination = {
  page?: Maybe<Scalars['Int']['output']>;
  pageSize?: Maybe<Scalars['Int']['output']>;
  totalPages?: Maybe<Scalars['Int']['output']>;
};

export type GetPassengers_200Response = {
  data?: Maybe<Array<Maybe<Passenger>>>;
  pagination?: Maybe<QueryGetPassengersPagination>;
};

export type Passenger = {
  passengerId?: Maybe<Scalars['Int']['output']>;
  passengerName?: Maybe<Scalars['String']['output']>;
  /** The harbormaster's docking_id */
  dockingNo?: Maybe<Scalars['Int']['output']>;
  /** ECONOMY | BUSINESS | STATEROOM */
  cabinClass?: Maybe<Scalars['String']['output']>;
  /** PENDING | CLEARED | FLAGGED */
  clearanceStatus?: Maybe<Scalars['String']['output']>;
};

export type QueryGetPassengersPagination = {
  page?: Maybe<Scalars['Int']['output']>;
  pageSize?: Maybe<Scalars['Int']['output']>;
  totalPages?: Maybe<Scalars['Int']['output']>;
};

export type GetVendors_200Response = {
  data?: Maybe<Array<Maybe<Vendor>>>;
  pagination?: Maybe<QueryGetVendorsPagination>;
};

export type Vendor = {
  vendorId?: Maybe<Scalars['Int']['output']>;
  vendorName?: Maybe<Scalars['String']['output']>;
  concourseZone?: Maybe<Scalars['String']['output']>;
  cuisineOrCategory?: Maybe<Scalars['String']['output']>;
  /** ACTIVE | PROBATION | SUSPENDED */
  licenseStatus?: Maybe<Scalars['String']['output']>;
};

export type QueryGetVendorsPagination = {
  page?: Maybe<Scalars['Int']['output']>;
  pageSize?: Maybe<Scalars['Int']['output']>;
  totalPages?: Maybe<Scalars['Int']['output']>;
};

export type GetStalls_200Response = {
  data?: Maybe<Array<Maybe<Stall>>>;
  pagination?: Maybe<QueryGetStallsPagination>;
};

export type Stall = {
  stallId?: Maybe<Scalars['Int']['output']>;
  vendorId?: Maybe<Scalars['Int']['output']>;
  concourseZone?: Maybe<Scalars['String']['output']>;
  stallNo?: Maybe<Scalars['String']['output']>;
  /** Decimal credits per period — integer cents never made it over the wall from finance */
  leaseCredits?: Maybe<Scalars['Float']['output']>;
};

export type QueryGetStallsPagination = {
  page?: Maybe<Scalars['Int']['output']>;
  pageSize?: Maybe<Scalars['Int']['output']>;
  totalPages?: Maybe<Scalars['Int']['output']>;
};

export type HttpMethod =
  | 'GET'
  | 'HEAD'
  | 'POST'
  | 'PUT'
  | 'DELETE'
  | 'CONNECT'
  | 'OPTIONS'
  | 'TRACE'
  | 'PATCH';

  export type QuerySdk = {
      /** List station modules **/

  getModules: InContextSdkMethod<Query['getModules'], QuerygetModulesArgs, BaseMeshContext>,
  /** Get one module **/

  getModuleById: InContextSdkMethod<Query['getModuleById'], QuerygetModuleByIdArgs, BaseMeshContext>,
  /** List life-support telemetry readings **/

  getTelemetry: InContextSdkMethod<Query['getTelemetry'], QuerygetTelemetryArgs, BaseMeshContext>,
  /** List crew members **/

  getCrew: InContextSdkMethod<Query['getCrew'], QuerygetCrewArgs, BaseMeshContext>,
  /** Get one crew member **/

  getCrewById: InContextSdkMethod<Query['getCrewById'], QuerygetCrewByIdArgs, BaseMeshContext>,
  /** List crew certifications **/

  getCertifications: InContextSdkMethod<Query['getCertifications'], QuerygetCertificationsArgs, BaseMeshContext>,
  /** List passenger records **/

  getPassengers: InContextSdkMethod<Query['getPassengers'], QuerygetPassengersArgs, BaseMeshContext>,
  /** List concourse vendors **/

  getVendors: InContextSdkMethod<Query['getVendors'], QuerygetVendorsArgs, BaseMeshContext>,
  /** Get one vendor **/

  getVendorById: InContextSdkMethod<Query['getVendorById'], QuerygetVendorByIdArgs, BaseMeshContext>,
  /** List concourse stalls **/

  getStalls: InContextSdkMethod<Query['getStalls'], QuerygetStallsArgs, BaseMeshContext>,
  
  telemetry: InContextSdkMethod<Query['telemetry'], QuerytelemetryArgs, BaseMeshContext>,
  
  modules: InContextSdkMethod<Query['modules'], QuerymodulesArgs, BaseMeshContext>
  };

  export type MutationSdk = {
    
  };

  export type SubscriptionSdk = {
    
  };

  export type Context = {
      ["StationOS"]: { Query: QuerySdk, Mutation: MutationSdk, Subscription: SubscriptionSdk },
      
    };
}
