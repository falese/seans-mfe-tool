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
  /** The `Boolean` scalar type represents `true` or `false`. */
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
  GetModules?: Maybe<GetModules_200_response>;
  /** Get one module */
  GetModuleById?: Maybe<module>;
  /** List life-support telemetry readings */
  GetTelemetry?: Maybe<GetTelemetry_200_response>;
  /** List crew members */
  GetCrew?: Maybe<GetCrew_200_response>;
  /** Get one crew member */
  GetCrewById?: Maybe<crew>;
  /** List crew certifications */
  GetCertifications?: Maybe<GetCertifications_200_response>;
  /** List passenger records */
  GetPassengers?: Maybe<GetPassengers_200_response>;
  /** List concourse vendors */
  GetVendors?: Maybe<GetVendors_200_response>;
  /** Get one vendor */
  GetVendorById?: Maybe<vendor>;
  /** List concourse stalls */
  GetStalls?: Maybe<GetStalls_200_response>;
  vendors?: Maybe<Array<Maybe<vendor>>>;
  stalls?: Maybe<Array<Maybe<stall>>>;
};


export type QueryGetModulesArgs = {
  DeckZone?: InputMaybe<Scalars['String']['input']>;
  ModuleType?: InputMaybe<Scalars['String']['input']>;
  Page?: InputMaybe<Scalars['Int']['input']>;
  PageSize?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryGetModuleByIdArgs = {
  ModuleId: Scalars['Int']['input'];
};


export type QueryGetTelemetryArgs = {
  ModuleId?: InputMaybe<Scalars['Int']['input']>;
  MetricKind?: InputMaybe<Scalars['String']['input']>;
  AlertLevel?: InputMaybe<Scalars['String']['input']>;
  Page?: InputMaybe<Scalars['Int']['input']>;
  PageSize?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryGetCrewArgs = {
  Section?: InputMaybe<Scalars['String']['input']>;
  DutyStatus?: InputMaybe<Scalars['String']['input']>;
  Page?: InputMaybe<Scalars['Int']['input']>;
  PageSize?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryGetCrewByIdArgs = {
  CrewId: Scalars['Int']['input'];
};


export type QueryGetCertificationsArgs = {
  CrewId?: InputMaybe<Scalars['Int']['input']>;
  Status?: InputMaybe<Scalars['String']['input']>;
  Page?: InputMaybe<Scalars['Int']['input']>;
  PageSize?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryGetPassengersArgs = {
  DockingNo?: InputMaybe<Scalars['Int']['input']>;
  ClearanceStatus?: InputMaybe<Scalars['String']['input']>;
  Page?: InputMaybe<Scalars['Int']['input']>;
  PageSize?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryGetVendorsArgs = {
  ConcourseZone?: InputMaybe<Scalars['String']['input']>;
  LicenseStatus?: InputMaybe<Scalars['String']['input']>;
  Page?: InputMaybe<Scalars['Int']['input']>;
  PageSize?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryGetVendorByIdArgs = {
  VendorId: Scalars['Int']['input'];
};


export type QueryGetStallsArgs = {
  VendorId?: InputMaybe<Scalars['Int']['input']>;
  ConcourseZone?: InputMaybe<Scalars['String']['input']>;
  Page?: InputMaybe<Scalars['Int']['input']>;
  PageSize?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryvendorsArgs = {
  ConcourseZone?: InputMaybe<Scalars['String']['input']>;
  LicenseStatus?: InputMaybe<Scalars['String']['input']>;
  Page?: InputMaybe<Scalars['Int']['input']>;
  PageSize?: InputMaybe<Scalars['Int']['input']>;
};


export type QuerystallsArgs = {
  VendorId?: InputMaybe<Scalars['Int']['input']>;
  ConcourseZone?: InputMaybe<Scalars['String']['input']>;
  Page?: InputMaybe<Scalars['Int']['input']>;
  PageSize?: InputMaybe<Scalars['Int']['input']>;
};

export type GetModules_200_response = {
  Data?: Maybe<Array<Maybe<module>>>;
  Pagination?: Maybe<query_GetModules_Pagination>;
};

export type module = {
  ModuleId?: Maybe<Scalars['Int']['output']>;
  ModuleName?: Maybe<Scalars['String']['output']>;
  DeckZone?: Maybe<Scalars['String']['output']>;
  /** HABITAT | LIFE_SUPPORT | DOCKING | CONCOURSE | POWER */
  ModuleType?: Maybe<Scalars['String']['output']>;
};

export type query_GetModules_Pagination = {
  Page?: Maybe<Scalars['Int']['output']>;
  PageSize?: Maybe<Scalars['Int']['output']>;
  TotalPages?: Maybe<Scalars['Int']['output']>;
};

export type GetTelemetry_200_response = {
  Data?: Maybe<Array<Maybe<telemetry>>>;
  Pagination?: Maybe<query_GetTelemetry_Pagination>;
};

export type telemetry = {
  ReadingId?: Maybe<Scalars['Int']['output']>;
  ModuleId?: Maybe<Scalars['Int']['output']>;
  /** O2_PARTIAL_PRESSURE | CO2_PPM | TEMP_C | POWER_KW | PRESSURE_KPA */
  MetricKind?: Maybe<Scalars['String']['output']>;
  MetricValue?: Maybe<Scalars['Float']['output']>;
  RecordedAtUtc?: Maybe<Scalars['DateTime']['output']>;
  /** NOMINAL | WATCH | CRITICAL */
  AlertLevel?: Maybe<Scalars['String']['output']>;
};

export type query_GetTelemetry_Pagination = {
  Page?: Maybe<Scalars['Int']['output']>;
  PageSize?: Maybe<Scalars['Int']['output']>;
  TotalPages?: Maybe<Scalars['Int']['output']>;
};

export type GetCrew_200_response = {
  Data?: Maybe<Array<Maybe<crew>>>;
  Pagination?: Maybe<query_GetCrew_Pagination>;
};

export type crew = {
  CrewId?: Maybe<Scalars['Int']['output']>;
  CrewMemberName?: Maybe<Scalars['String']['output']>;
  /** OPERATIONS | MEDICAL | ENGINEERING | HOSPITALITY */
  Section?: Maybe<Scalars['String']['output']>;
  /** ON_DUTY | OFF_DUTY | LEAVE */
  DutyStatus?: Maybe<Scalars['String']['output']>;
  BerthAssignment?: Maybe<Scalars['String']['output']>;
};

export type query_GetCrew_Pagination = {
  Page?: Maybe<Scalars['Int']['output']>;
  PageSize?: Maybe<Scalars['Int']['output']>;
  TotalPages?: Maybe<Scalars['Int']['output']>;
};

export type GetCertifications_200_response = {
  Data?: Maybe<Array<Maybe<certification>>>;
  Pagination?: Maybe<query_GetCertifications_Pagination>;
};

export type certification = {
  CertificationId?: Maybe<Scalars['Int']['output']>;
  CrewId?: Maybe<Scalars['Int']['output']>;
  /** EVA | DOCKING_CONTROL | HAZMAT | MEDICAL | FOOD_SAFETY */
  CertificationCode?: Maybe<Scalars['String']['output']>;
  ExpiresOnUtc?: Maybe<Scalars['DateTime']['output']>;
  /** VALID | EXPIRING | EXPIRED */
  Status?: Maybe<Scalars['String']['output']>;
};

export type query_GetCertifications_Pagination = {
  Page?: Maybe<Scalars['Int']['output']>;
  PageSize?: Maybe<Scalars['Int']['output']>;
  TotalPages?: Maybe<Scalars['Int']['output']>;
};

export type GetPassengers_200_response = {
  Data?: Maybe<Array<Maybe<passenger>>>;
  Pagination?: Maybe<query_GetPassengers_Pagination>;
};

export type passenger = {
  PassengerId?: Maybe<Scalars['Int']['output']>;
  PassengerName?: Maybe<Scalars['String']['output']>;
  /** The harbormaster's docking_id */
  DockingNo?: Maybe<Scalars['Int']['output']>;
  /** ECONOMY | BUSINESS | STATEROOM */
  CabinClass?: Maybe<Scalars['String']['output']>;
  /** PENDING | CLEARED | FLAGGED */
  ClearanceStatus?: Maybe<Scalars['String']['output']>;
};

export type query_GetPassengers_Pagination = {
  Page?: Maybe<Scalars['Int']['output']>;
  PageSize?: Maybe<Scalars['Int']['output']>;
  TotalPages?: Maybe<Scalars['Int']['output']>;
};

export type GetVendors_200_response = {
  Pagination?: Maybe<query_GetVendors_Pagination>;
};

export type vendor = {
  VendorId?: Maybe<Scalars['Int']['output']>;
  VendorName?: Maybe<Scalars['String']['output']>;
  ConcourseZone?: Maybe<Scalars['String']['output']>;
  CuisineOrCategory?: Maybe<Scalars['String']['output']>;
  /** ACTIVE | PROBATION | SUSPENDED */
  LicenseStatus?: Maybe<Scalars['String']['output']>;
};

export type query_GetVendors_Pagination = {
  Page?: Maybe<Scalars['Int']['output']>;
  PageSize?: Maybe<Scalars['Int']['output']>;
  TotalPages?: Maybe<Scalars['Int']['output']>;
};

export type GetStalls_200_response = {
  Pagination?: Maybe<query_GetStalls_Pagination>;
};

export type stall = {
  StallId?: Maybe<Scalars['Int']['output']>;
  VendorId?: Maybe<Scalars['Int']['output']>;
  ConcourseZone?: Maybe<Scalars['String']['output']>;
  StallNo?: Maybe<Scalars['String']['output']>;
  /** Decimal credits per period — integer cents never made it over the wall from finance */
  LeaseCredits?: Maybe<Scalars['Float']['output']>;
};

export type query_GetStalls_Pagination = {
  Page?: Maybe<Scalars['Int']['output']>;
  PageSize?: Maybe<Scalars['Int']['output']>;
  TotalPages?: Maybe<Scalars['Int']['output']>;
};

export type HTTPMethod =
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

  GetModules: InContextSdkMethod<Query['GetModules'], QueryGetModulesArgs, BaseMeshContext>,
  /** Get one module **/

  GetModuleById: InContextSdkMethod<Query['GetModuleById'], QueryGetModuleByIdArgs, BaseMeshContext>,
  /** List life-support telemetry readings **/

  GetTelemetry: InContextSdkMethod<Query['GetTelemetry'], QueryGetTelemetryArgs, BaseMeshContext>,
  /** List crew members **/

  GetCrew: InContextSdkMethod<Query['GetCrew'], QueryGetCrewArgs, BaseMeshContext>,
  /** Get one crew member **/

  GetCrewById: InContextSdkMethod<Query['GetCrewById'], QueryGetCrewByIdArgs, BaseMeshContext>,
  /** List crew certifications **/

  GetCertifications: InContextSdkMethod<Query['GetCertifications'], QueryGetCertificationsArgs, BaseMeshContext>,
  /** List passenger records **/

  GetPassengers: InContextSdkMethod<Query['GetPassengers'], QueryGetPassengersArgs, BaseMeshContext>,
  /** List concourse vendors **/

  GetVendors: InContextSdkMethod<Query['GetVendors'], QueryGetVendorsArgs, BaseMeshContext>,
  /** Get one vendor **/

  GetVendorById: InContextSdkMethod<Query['GetVendorById'], QueryGetVendorByIdArgs, BaseMeshContext>,
  /** List concourse stalls **/

  GetStalls: InContextSdkMethod<Query['GetStalls'], QueryGetStallsArgs, BaseMeshContext>,
  
  vendors: InContextSdkMethod<Query['vendors'], QueryvendorsArgs, BaseMeshContext>,
  
  stalls: InContextSdkMethod<Query['stalls'], QuerystallsArgs, BaseMeshContext>
  };

  export type MutationSdk = {
    
  };

  export type SubscriptionSdk = {
    
  };

  export type Context = {
      ["StationOS"]: { Query: QuerySdk, Mutation: MutationSdk, Subscription: SubscriptionSdk },
      
    };
}
