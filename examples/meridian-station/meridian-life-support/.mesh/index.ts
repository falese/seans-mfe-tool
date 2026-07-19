// @ts-nocheck
import { GraphQLResolveInfo, SelectionSetNode, FieldNode, GraphQLScalarType, GraphQLScalarTypeConfig } from 'graphql';
import type { GetMeshOptions } from '@graphql-mesh/runtime';
import type { YamlConfig } from '@graphql-mesh/types';
import { defaultImportFn, handleImport } from '@graphql-mesh/utils';
import { PubSub } from '@graphql-mesh/utils';
import { DefaultLogger } from '@graphql-mesh/utils';
import type { MeshResolvedSource } from '@graphql-mesh/runtime';
import type { MeshTransform, MeshPlugin } from '@graphql-mesh/types';
import { createMeshHTTPHandler, MeshHTTPHandler } from '@graphql-mesh/http';
import { getMesh, type ExecuteMeshFn, type SubscribeMeshFn, type MeshContext as BaseMeshContext, type MeshInstance } from '@graphql-mesh/runtime';
import { MeshStore, FsStoreStorageAdapter } from '@graphql-mesh/store';
import { path as pathModule } from '@graphql-mesh/cross-helpers';
import type { ImportFn } from '@graphql-mesh/types';
import type { StationOsTypes } from './sources/StationOS/types';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type RequireFields<T, K extends keyof T> = Omit<T, K> & { [P in K]-?: NonNullable<T[P]> };



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

export type WithIndex<TObject> = TObject & Record<string, any>;
export type ResolversObject<TObject> = WithIndex<TObject>;

export type ResolverTypeWrapper<T> = Promise<T> | T;


export type ResolverWithResolve<TResult, TParent, TContext, TArgs> = {
  resolve: ResolverFn<TResult, TParent, TContext, TArgs>;
};

export type LegacyStitchingResolver<TResult, TParent, TContext, TArgs> = {
  fragment: string;
  resolve: ResolverFn<TResult, TParent, TContext, TArgs>;
};

export type NewStitchingResolver<TResult, TParent, TContext, TArgs> = {
  selectionSet: string | ((fieldNode: FieldNode) => SelectionSetNode);
  resolve: ResolverFn<TResult, TParent, TContext, TArgs>;
};
export type StitchingResolver<TResult, TParent, TContext, TArgs> = LegacyStitchingResolver<TResult, TParent, TContext, TArgs> | NewStitchingResolver<TResult, TParent, TContext, TArgs>;
export type Resolver<TResult, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>, TArgs = Record<PropertyKey, never>> =
  | ResolverFn<TResult, TParent, TContext, TArgs>
  | ResolverWithResolve<TResult, TParent, TContext, TArgs>
  | StitchingResolver<TResult, TParent, TContext, TArgs>;

export type ResolverFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => Promise<TResult> | TResult;

export type SubscriptionSubscribeFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => AsyncIterable<TResult> | Promise<AsyncIterable<TResult>>;

export type SubscriptionResolveFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;

export interface SubscriptionSubscriberObject<TResult, TKey extends string, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<{ [key in TKey]: TResult }, TParent, TContext, TArgs>;
  resolve?: SubscriptionResolveFn<TResult, { [key in TKey]: TResult }, TContext, TArgs>;
}

export interface SubscriptionResolverObject<TResult, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<any, TParent, TContext, TArgs>;
  resolve: SubscriptionResolveFn<TResult, any, TContext, TArgs>;
}

export type SubscriptionObject<TResult, TKey extends string, TParent, TContext, TArgs> =
  | SubscriptionSubscriberObject<TResult, TKey, TParent, TContext, TArgs>
  | SubscriptionResolverObject<TResult, TParent, TContext, TArgs>;

export type SubscriptionResolver<TResult, TKey extends string, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>, TArgs = Record<PropertyKey, never>> =
  | ((...args: any[]) => SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>)
  | SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>;

export type TypeResolveFn<TTypes, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>> = (
  parent: TParent,
  context: TContext,
  info: GraphQLResolveInfo
) => Maybe<TTypes> | Promise<Maybe<TTypes>>;

export type IsTypeOfResolverFn<T = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>> = (obj: T, context: TContext, info: GraphQLResolveInfo) => boolean | Promise<boolean>;

export type NextResolverFn<T> = () => Promise<T>;

export type DirectiveResolverFn<TResult = Record<PropertyKey, never>, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>, TArgs = Record<PropertyKey, never>> = (
  next: NextResolverFn<TResult>,
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;





/** Mapping between all available schema types and the resolvers types */
export type ResolversTypes = ResolversObject<{
  Query: ResolverTypeWrapper<Record<PropertyKey, never>>;
  Int: ResolverTypeWrapper<Scalars['Int']['output']>;
  GetModules_200Response: ResolverTypeWrapper<GetModules_200Response>;
  Module: ResolverTypeWrapper<Module>;
  QueryGetModulesPagination: ResolverTypeWrapper<QueryGetModulesPagination>;
  GetTelemetry_200Response: ResolverTypeWrapper<GetTelemetry_200Response>;
  Telemetry: ResolverTypeWrapper<Telemetry>;
  Float: ResolverTypeWrapper<Scalars['Float']['output']>;
  DateTime: ResolverTypeWrapper<Scalars['DateTime']['output']>;
  QueryGetTelemetryPagination: ResolverTypeWrapper<QueryGetTelemetryPagination>;
  GetCrew_200Response: ResolverTypeWrapper<GetCrew_200Response>;
  Crew: ResolverTypeWrapper<Crew>;
  QueryGetCrewPagination: ResolverTypeWrapper<QueryGetCrewPagination>;
  GetCertifications_200Response: ResolverTypeWrapper<GetCertifications_200Response>;
  Certification: ResolverTypeWrapper<Certification>;
  QueryGetCertificationsPagination: ResolverTypeWrapper<QueryGetCertificationsPagination>;
  GetPassengers_200Response: ResolverTypeWrapper<GetPassengers_200Response>;
  Passenger: ResolverTypeWrapper<Passenger>;
  QueryGetPassengersPagination: ResolverTypeWrapper<QueryGetPassengersPagination>;
  GetVendors_200Response: ResolverTypeWrapper<GetVendors_200Response>;
  Vendor: ResolverTypeWrapper<Vendor>;
  QueryGetVendorsPagination: ResolverTypeWrapper<QueryGetVendorsPagination>;
  GetStalls_200Response: ResolverTypeWrapper<GetStalls_200Response>;
  Stall: ResolverTypeWrapper<Stall>;
  QueryGetStallsPagination: ResolverTypeWrapper<QueryGetStallsPagination>;
  HttpMethod: HttpMethod;
  ObjMap: ResolverTypeWrapper<Scalars['ObjMap']['output']>;
  String: ResolverTypeWrapper<Scalars['String']['output']>;
  Boolean: ResolverTypeWrapper<Scalars['Boolean']['output']>;
}>;

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = ResolversObject<{
  Query: Record<PropertyKey, never>;
  Int: Scalars['Int']['output'];
  GetModules_200Response: GetModules_200Response;
  Module: Module;
  QueryGetModulesPagination: QueryGetModulesPagination;
  GetTelemetry_200Response: GetTelemetry_200Response;
  Telemetry: Telemetry;
  Float: Scalars['Float']['output'];
  DateTime: Scalars['DateTime']['output'];
  QueryGetTelemetryPagination: QueryGetTelemetryPagination;
  GetCrew_200Response: GetCrew_200Response;
  Crew: Crew;
  QueryGetCrewPagination: QueryGetCrewPagination;
  GetCertifications_200Response: GetCertifications_200Response;
  Certification: Certification;
  QueryGetCertificationsPagination: QueryGetCertificationsPagination;
  GetPassengers_200Response: GetPassengers_200Response;
  Passenger: Passenger;
  QueryGetPassengersPagination: QueryGetPassengersPagination;
  GetVendors_200Response: GetVendors_200Response;
  Vendor: Vendor;
  QueryGetVendorsPagination: QueryGetVendorsPagination;
  GetStalls_200Response: GetStalls_200Response;
  Stall: Stall;
  QueryGetStallsPagination: QueryGetStallsPagination;
  ObjMap: Scalars['ObjMap']['output'];
  String: Scalars['String']['output'];
  Boolean: Scalars['Boolean']['output'];
}>;

export type httpOperationDirectiveArgs = {
  subgraph?: Maybe<Scalars['String']['input']>;
  path?: Maybe<Scalars['String']['input']>;
  operationSpecificHeaders?: Maybe<Array<Maybe<Array<Maybe<Scalars['String']['input']>>>>>;
  httpMethod?: Maybe<HttpMethod>;
  isBinary?: Maybe<Scalars['Boolean']['input']>;
  requestBaseBody?: Maybe<Scalars['ObjMap']['input']>;
  queryParamArgMap?: Maybe<Scalars['ObjMap']['input']>;
  queryStringOptionsByParam?: Maybe<Scalars['ObjMap']['input']>;
  jsonApiFields?: Maybe<Scalars['Boolean']['input']>;
  queryStringOptions?: Maybe<Scalars['ObjMap']['input']>;
};

export type httpOperationDirectiveResolver<Result, Parent, ContextType = MeshContext, Args = httpOperationDirectiveArgs> = DirectiveResolverFn<Result, Parent, ContextType, Args>;

export type transportDirectiveArgs = {
  subgraph?: Maybe<Scalars['String']['input']>;
  kind?: Maybe<Scalars['String']['input']>;
  location?: Maybe<Scalars['String']['input']>;
  headers?: Maybe<Array<Maybe<Array<Maybe<Scalars['String']['input']>>>>>;
  queryStringOptions?: Maybe<Scalars['ObjMap']['input']>;
  queryParams?: Maybe<Array<Maybe<Array<Maybe<Scalars['String']['input']>>>>>;
};

export type transportDirectiveResolver<Result, Parent, ContextType = MeshContext, Args = transportDirectiveArgs> = DirectiveResolverFn<Result, Parent, ContextType, Args>;

export type QueryResolvers<ContextType = MeshContext, ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']> = ResolversObject<{
  getModules?: Resolver<Maybe<ResolversTypes['GetModules_200Response']>, ParentType, ContextType, RequireFields<QuerygetModulesArgs, 'Page' | 'PageSize'>>;
  getModuleById?: Resolver<Maybe<ResolversTypes['Module']>, ParentType, ContextType, RequireFields<QuerygetModuleByIdArgs, 'ModuleId'>>;
  getTelemetry?: Resolver<Maybe<ResolversTypes['GetTelemetry_200Response']>, ParentType, ContextType, RequireFields<QuerygetTelemetryArgs, 'Page' | 'PageSize'>>;
  getCrew?: Resolver<Maybe<ResolversTypes['GetCrew_200Response']>, ParentType, ContextType, RequireFields<QuerygetCrewArgs, 'Page' | 'PageSize'>>;
  getCrewById?: Resolver<Maybe<ResolversTypes['Crew']>, ParentType, ContextType, RequireFields<QuerygetCrewByIdArgs, 'CrewId'>>;
  getCertifications?: Resolver<Maybe<ResolversTypes['GetCertifications_200Response']>, ParentType, ContextType, RequireFields<QuerygetCertificationsArgs, 'Page' | 'PageSize'>>;
  getPassengers?: Resolver<Maybe<ResolversTypes['GetPassengers_200Response']>, ParentType, ContextType, RequireFields<QuerygetPassengersArgs, 'Page' | 'PageSize'>>;
  getVendors?: Resolver<Maybe<ResolversTypes['GetVendors_200Response']>, ParentType, ContextType, RequireFields<QuerygetVendorsArgs, 'Page' | 'PageSize'>>;
  getVendorById?: Resolver<Maybe<ResolversTypes['Vendor']>, ParentType, ContextType, RequireFields<QuerygetVendorByIdArgs, 'VendorId'>>;
  getStalls?: Resolver<Maybe<ResolversTypes['GetStalls_200Response']>, ParentType, ContextType, RequireFields<QuerygetStallsArgs, 'Page' | 'PageSize'>>;
  telemetry?: Resolver<Maybe<Array<Maybe<ResolversTypes['Telemetry']>>>, ParentType, ContextType, RequireFields<QuerytelemetryArgs, 'Page' | 'PageSize'>>;
  modules?: Resolver<Maybe<Array<Maybe<ResolversTypes['Module']>>>, ParentType, ContextType, RequireFields<QuerymodulesArgs, 'Page' | 'PageSize'>>;
}>;

export type GetModules_200ResponseResolvers<ContextType = MeshContext, ParentType extends ResolversParentTypes['GetModules_200Response'] = ResolversParentTypes['GetModules_200Response']> = ResolversObject<{
  pagination?: Resolver<Maybe<ResolversTypes['QueryGetModulesPagination']>, ParentType, ContextType>;
}>;

export type ModuleResolvers<ContextType = MeshContext, ParentType extends ResolversParentTypes['Module'] = ResolversParentTypes['Module']> = ResolversObject<{
  moduleId?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  moduleName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  deckZone?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  moduleType?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
}>;

export type QueryGetModulesPaginationResolvers<ContextType = MeshContext, ParentType extends ResolversParentTypes['QueryGetModulesPagination'] = ResolversParentTypes['QueryGetModulesPagination']> = ResolversObject<{
  page?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  pageSize?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  totalPages?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
}>;

export type GetTelemetry_200ResponseResolvers<ContextType = MeshContext, ParentType extends ResolversParentTypes['GetTelemetry_200Response'] = ResolversParentTypes['GetTelemetry_200Response']> = ResolversObject<{
  pagination?: Resolver<Maybe<ResolversTypes['QueryGetTelemetryPagination']>, ParentType, ContextType>;
}>;

export type TelemetryResolvers<ContextType = MeshContext, ParentType extends ResolversParentTypes['Telemetry'] = ResolversParentTypes['Telemetry']> = ResolversObject<{
  readingId?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  moduleId?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  metricKind?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  metricValue?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  recordedAtUtc?: Resolver<Maybe<ResolversTypes['DateTime']>, ParentType, ContextType>;
  alertLevel?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
}>;

export interface DateTimeScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['DateTime'], any> {
  name: 'DateTime';
}

export type QueryGetTelemetryPaginationResolvers<ContextType = MeshContext, ParentType extends ResolversParentTypes['QueryGetTelemetryPagination'] = ResolversParentTypes['QueryGetTelemetryPagination']> = ResolversObject<{
  page?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  pageSize?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  totalPages?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
}>;

export type GetCrew_200ResponseResolvers<ContextType = MeshContext, ParentType extends ResolversParentTypes['GetCrew_200Response'] = ResolversParentTypes['GetCrew_200Response']> = ResolversObject<{
  data?: Resolver<Maybe<Array<Maybe<ResolversTypes['Crew']>>>, ParentType, ContextType>;
  pagination?: Resolver<Maybe<ResolversTypes['QueryGetCrewPagination']>, ParentType, ContextType>;
}>;

export type CrewResolvers<ContextType = MeshContext, ParentType extends ResolversParentTypes['Crew'] = ResolversParentTypes['Crew']> = ResolversObject<{
  crewId?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  crewMemberName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  section?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  dutyStatus?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  berthAssignment?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
}>;

export type QueryGetCrewPaginationResolvers<ContextType = MeshContext, ParentType extends ResolversParentTypes['QueryGetCrewPagination'] = ResolversParentTypes['QueryGetCrewPagination']> = ResolversObject<{
  page?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  pageSize?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  totalPages?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
}>;

export type GetCertifications_200ResponseResolvers<ContextType = MeshContext, ParentType extends ResolversParentTypes['GetCertifications_200Response'] = ResolversParentTypes['GetCertifications_200Response']> = ResolversObject<{
  data?: Resolver<Maybe<Array<Maybe<ResolversTypes['Certification']>>>, ParentType, ContextType>;
  pagination?: Resolver<Maybe<ResolversTypes['QueryGetCertificationsPagination']>, ParentType, ContextType>;
}>;

export type CertificationResolvers<ContextType = MeshContext, ParentType extends ResolversParentTypes['Certification'] = ResolversParentTypes['Certification']> = ResolversObject<{
  certificationId?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  crewId?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  certificationCode?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  expiresOnUtc?: Resolver<Maybe<ResolversTypes['DateTime']>, ParentType, ContextType>;
  status?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
}>;

export type QueryGetCertificationsPaginationResolvers<ContextType = MeshContext, ParentType extends ResolversParentTypes['QueryGetCertificationsPagination'] = ResolversParentTypes['QueryGetCertificationsPagination']> = ResolversObject<{
  page?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  pageSize?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  totalPages?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
}>;

export type GetPassengers_200ResponseResolvers<ContextType = MeshContext, ParentType extends ResolversParentTypes['GetPassengers_200Response'] = ResolversParentTypes['GetPassengers_200Response']> = ResolversObject<{
  data?: Resolver<Maybe<Array<Maybe<ResolversTypes['Passenger']>>>, ParentType, ContextType>;
  pagination?: Resolver<Maybe<ResolversTypes['QueryGetPassengersPagination']>, ParentType, ContextType>;
}>;

export type PassengerResolvers<ContextType = MeshContext, ParentType extends ResolversParentTypes['Passenger'] = ResolversParentTypes['Passenger']> = ResolversObject<{
  passengerId?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  passengerName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  dockingNo?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  cabinClass?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  clearanceStatus?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
}>;

export type QueryGetPassengersPaginationResolvers<ContextType = MeshContext, ParentType extends ResolversParentTypes['QueryGetPassengersPagination'] = ResolversParentTypes['QueryGetPassengersPagination']> = ResolversObject<{
  page?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  pageSize?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  totalPages?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
}>;

export type GetVendors_200ResponseResolvers<ContextType = MeshContext, ParentType extends ResolversParentTypes['GetVendors_200Response'] = ResolversParentTypes['GetVendors_200Response']> = ResolversObject<{
  data?: Resolver<Maybe<Array<Maybe<ResolversTypes['Vendor']>>>, ParentType, ContextType>;
  pagination?: Resolver<Maybe<ResolversTypes['QueryGetVendorsPagination']>, ParentType, ContextType>;
}>;

export type VendorResolvers<ContextType = MeshContext, ParentType extends ResolversParentTypes['Vendor'] = ResolversParentTypes['Vendor']> = ResolversObject<{
  vendorId?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  vendorName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  concourseZone?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  cuisineOrCategory?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  licenseStatus?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
}>;

export type QueryGetVendorsPaginationResolvers<ContextType = MeshContext, ParentType extends ResolversParentTypes['QueryGetVendorsPagination'] = ResolversParentTypes['QueryGetVendorsPagination']> = ResolversObject<{
  page?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  pageSize?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  totalPages?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
}>;

export type GetStalls_200ResponseResolvers<ContextType = MeshContext, ParentType extends ResolversParentTypes['GetStalls_200Response'] = ResolversParentTypes['GetStalls_200Response']> = ResolversObject<{
  data?: Resolver<Maybe<Array<Maybe<ResolversTypes['Stall']>>>, ParentType, ContextType>;
  pagination?: Resolver<Maybe<ResolversTypes['QueryGetStallsPagination']>, ParentType, ContextType>;
}>;

export type StallResolvers<ContextType = MeshContext, ParentType extends ResolversParentTypes['Stall'] = ResolversParentTypes['Stall']> = ResolversObject<{
  stallId?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  vendorId?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  concourseZone?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  stallNo?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  leaseCredits?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
}>;

export type QueryGetStallsPaginationResolvers<ContextType = MeshContext, ParentType extends ResolversParentTypes['QueryGetStallsPagination'] = ResolversParentTypes['QueryGetStallsPagination']> = ResolversObject<{
  page?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  pageSize?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  totalPages?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
}>;

export interface ObjMapScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['ObjMap'], any> {
  name: 'ObjMap';
}

export type Resolvers<ContextType = MeshContext> = ResolversObject<{
  Query?: QueryResolvers<ContextType>;
  GetModules_200Response?: GetModules_200ResponseResolvers<ContextType>;
  Module?: ModuleResolvers<ContextType>;
  QueryGetModulesPagination?: QueryGetModulesPaginationResolvers<ContextType>;
  GetTelemetry_200Response?: GetTelemetry_200ResponseResolvers<ContextType>;
  Telemetry?: TelemetryResolvers<ContextType>;
  DateTime?: GraphQLScalarType;
  QueryGetTelemetryPagination?: QueryGetTelemetryPaginationResolvers<ContextType>;
  GetCrew_200Response?: GetCrew_200ResponseResolvers<ContextType>;
  Crew?: CrewResolvers<ContextType>;
  QueryGetCrewPagination?: QueryGetCrewPaginationResolvers<ContextType>;
  GetCertifications_200Response?: GetCertifications_200ResponseResolvers<ContextType>;
  Certification?: CertificationResolvers<ContextType>;
  QueryGetCertificationsPagination?: QueryGetCertificationsPaginationResolvers<ContextType>;
  GetPassengers_200Response?: GetPassengers_200ResponseResolvers<ContextType>;
  Passenger?: PassengerResolvers<ContextType>;
  QueryGetPassengersPagination?: QueryGetPassengersPaginationResolvers<ContextType>;
  GetVendors_200Response?: GetVendors_200ResponseResolvers<ContextType>;
  Vendor?: VendorResolvers<ContextType>;
  QueryGetVendorsPagination?: QueryGetVendorsPaginationResolvers<ContextType>;
  GetStalls_200Response?: GetStalls_200ResponseResolvers<ContextType>;
  Stall?: StallResolvers<ContextType>;
  QueryGetStallsPagination?: QueryGetStallsPaginationResolvers<ContextType>;
  ObjMap?: GraphQLScalarType;
}>;

export type DirectiveResolvers<ContextType = MeshContext> = ResolversObject<{
  httpOperation?: httpOperationDirectiveResolver<any, any, ContextType>;
  transport?: transportDirectiveResolver<any, any, ContextType>;
}>;

export type MeshInContextSDK = StationOsTypes.Context;

export type MeshContext = BaseMeshContext & MeshInContextSDK;


const baseDir = pathModule.join(typeof __dirname === 'string' ? __dirname : '/', '..');

const importFn: ImportFn = <T>(moduleId: string) => {
  const relativeModuleId = (pathModule.isAbsolute(moduleId) ? pathModule.relative(baseDir, moduleId) : moduleId).split('\\').join('/').replace(baseDir + '/', '');
  switch(relativeModuleId) {
    case "src/platform/bff/mesh-context.js":
      return import("./../src/platform/bff/mesh-context.js") as T;
    
    case ".mesh/sources/StationOS/schemaWithAnnotations":
      return import("./sources/StationOS/schemaWithAnnotations") as T;
    
    case "src/platform/bff/mock-switch":
      return import("./../src/platform/bff/mock-switch") as T;
    
    default:
      return Promise.reject(new Error(`Cannot find module '${relativeModuleId}'.`));
  }
};

const rootStore = new MeshStore('.mesh', new FsStoreStorageAdapter({
  cwd: baseDir,
  importFn,
  fileType: "ts",
}), {
  readonly: true,
  validate: false
});

export const rawServeConfig: YamlConfig.Config['serve'] = {"endpoint":"/graphql","playground":true} as any
export async function getMeshOptions(): Promise<GetMeshOptions> {
const pubsub = new PubSub();
const sourcesStore = rootStore.child('sources');
const logger = new DefaultLogger("");
const MeshCache = await import("@graphql-mesh/cache-localforage").then(handleImport);
  const cache = new MeshCache({
      ...{},
      importFn,
      store: rootStore.child('cache'),
      pubsub,
      logger,
    })
const fetchFn = await import('@whatwg-node/fetch').then(m => m?.fetch || m);
const sources: MeshResolvedSource[] = [];
const transforms: MeshTransform[] = [];
const additionalEnvelopPlugins: MeshPlugin<any>[] = [];
const stationOsTransforms = [];
const additionalTypeDefs = [] as any[];
const StationOsHandler = await import("@graphql-mesh/openapi").then(handleImport);
const stationOsHandler = new StationOsHandler({
              name: "StationOS",
              config: {"source":"./specs/station-os.yaml"},
              baseDir,
              cache,
              pubsub,
              store: sourcesStore.child("StationOS"),
              logger: logger.child({ source: "StationOS" }),
              importFn,
            });
const RootTransform_0 = await import("@graphql-mesh/transform-resolvers-composition").then(handleImport);
transforms[0] = new RootTransform_0({
            apiName: '',
            config: {"mode":"bare","compositions":[{"resolver":"Query.*","composer":"./src/platform/bff/mock-switch#mockSwitch"}]},
            baseDir,
            cache,
            pubsub,
            importFn,
            logger,
          })
const RootTransform_1 = await import("@graphql-mesh/transform-naming-convention").then(handleImport);
transforms[1] = new RootTransform_1({
            apiName: '',
            config: {"typeNames":"pascalCase","fieldNames":"camelCase"},
            baseDir,
            cache,
            pubsub,
            importFn,
            logger,
          })
const useResponseCache = await import("@graphql-mesh/plugin-response-cache").then(handleImport);
additionalEnvelopPlugins[0] = await useResponseCache({
          ...({
  "ttl": 300000,
  "if": "context.headers?.get?.('x-bff-mode') == null"
}),
          logger: logger.child({ plugin: "responseCache" }),
          cache,
          pubsub,
          baseDir,
          importFn,
        })
const usePrometheus = await import("@graphql-mesh/plugin-prometheus").then(handleImport);
additionalEnvelopPlugins[1] = await usePrometheus({
          ...({}),
          logger: logger.child({ plugin: "prometheus" }),
          cache,
          pubsub,
          baseDir,
          importFn,
        })
const StationOsTransforms_0 = await import("@graphql-mesh/transform-hoist-field").then(handleImport);
stationOsTransforms[0] = new StationOsTransforms_0({
                  apiName: "StationOS",
                  config: [{"typeName":"Query","pathConfig":["GetTelemetry","Data"],"newFieldName":"telemetry"},{"typeName":"Query","pathConfig":["GetModules","Data"],"newFieldName":"modules"}],
                  baseDir,
                  cache,
                  pubsub,
                  importFn,
                  logger,
                });
sources[0] = {
          name: 'StationOS',
          handler: stationOsHandler,
          transforms: stationOsTransforms
        }
const additionalResolvers = [] as any[]
const Merger = await import("@graphql-mesh/merger-bare").then(handleImport);
const merger = new Merger({
        cache,
        pubsub,
        logger: logger.child({ merger: "bare" }),
        store: rootStore.child("bare")
      })
const importedAdditionalEnvelopPlugins = await import("../src/platform/bff/mesh-context.js").then(handleImport);
additionalEnvelopPlugins.push(...importedAdditionalEnvelopPlugins)

  return {
    sources,
    transforms,
    additionalTypeDefs,
    additionalResolvers,
    cache,
    pubsub,
    merger,
    logger,
    additionalEnvelopPlugins,
    get documents() {
      return [
      
    ];
    },
    fetchFn,
  };
}

export function createBuiltMeshHTTPHandler<TServerContext = {}>(): MeshHTTPHandler<TServerContext> {
  return createMeshHTTPHandler<TServerContext>({
    baseDir,
    getBuiltMesh: getBuiltMesh,
    rawServeConfig: {"endpoint":"/graphql","playground":true},
  })
}


let meshInstance$: Promise<MeshInstance> | undefined;

export const pollingInterval = null;

export function getBuiltMesh(): Promise<MeshInstance> {
  if (meshInstance$ == null) {
    if (pollingInterval) {
      setInterval(() => {
        getMeshOptions()
        .then(meshOptions => getMesh(meshOptions))
        .then(newMesh =>
          meshInstance$.then(oldMesh => {
            oldMesh.destroy()
            meshInstance$ = Promise.resolve(newMesh)
          })
        ).catch(err => {
          console.error("Mesh polling failed so the existing version will be used:", err);
        });
      }, pollingInterval)
    }
    meshInstance$ = getMeshOptions().then(meshOptions => getMesh(meshOptions)).then(mesh => {
      const id = mesh.pubsub.subscribe('destroy', () => {
        meshInstance$ = undefined;
        mesh.pubsub.unsubscribe(id);
      });
      return mesh;
    }).catch((err) => {
      meshInstance$ = undefined;
      return Promise.reject(err);
    });
  }
  return meshInstance$;
}

export const execute: ExecuteMeshFn = (...args) => getBuiltMesh().then(({ execute }) => execute(...args));

export const subscribe: SubscribeMeshFn = (...args) => getBuiltMesh().then(({ subscribe }) => subscribe(...args));