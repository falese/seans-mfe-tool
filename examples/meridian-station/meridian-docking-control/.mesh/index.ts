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
import type { HarbormasterTypes } from './sources/Harbormaster/types';
import type { StellarLedgerTypes } from './sources/StellarLedger/types';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type RequireFields<T, K extends keyof T> = Omit<T, K> & { [P in K]-?: NonNullable<T[P]> };



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
  /** Represents date values */
  Date: { input: string; output: string; }
};

export type Query = {
  /** List berths */
  listBerths?: Maybe<Array<Maybe<Berth>>>;
  /** Get one berth */
  getBerth?: Maybe<Berth>;
  /** List dockings */
  listDockings?: Maybe<Array<Maybe<Docking>>>;
  /** Get one docking */
  getDocking?: Maybe<Docking>;
  /** List cargo manifest lines (customs filing headers) */
  listManifestLines?: Maybe<Array<Maybe<ManifestLine>>>;
  /** List registered vessels */
  listVessels?: Maybe<Array<Maybe<Vessel>>>;
  /** Get one vessel by registry number */
  getVessel?: Maybe<Vessel>;
  /** List accounts */
  listAccounts?: Maybe<ListAccounts_200Response>;
  /** Get one account */
  getAccount?: Maybe<Account>;
  /** List tariff charges */
  listCharges?: Maybe<ListCharges_200Response>;
  /** List cargo line valuations */
  listValuations?: Maybe<ListValuations_200Response>;
  /** List merchant settlements */
  listSettlements?: Maybe<ListSettlements_200Response>;
  /** List crew payroll records */
  listPayroll?: Maybe<ListPayroll_200Response>;
  charges?: Maybe<Array<Maybe<Charge>>>;
  valuations?: Maybe<Array<Maybe<Valuation>>>;
  accounts?: Maybe<Array<Maybe<Account>>>;
};


export type QuerylistBerthsArgs = {
  berth_class?: InputMaybe<Scalars['String']['input']>;
  occupied_flag?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
};


export type QuerygetBerthArgs = {
  berth_id: Scalars['String']['input'];
};


export type QuerylistDockingsArgs = {
  berth_id?: InputMaybe<Scalars['String']['input']>;
  status_code?: InputMaybe<Scalars['String']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
};


export type QuerygetDockingArgs = {
  docking_id: Scalars['Int']['input'];
};


export type QuerylistManifestLinesArgs = {
  docking_id?: InputMaybe<Scalars['Int']['input']>;
  hazard_class?: InputMaybe<Scalars['String']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
};


export type QuerylistVesselsArgs = {
  operator_name?: InputMaybe<Scalars['String']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
};


export type QuerygetVesselArgs = {
  vessel_registry_no: Scalars['String']['input'];
};


export type QuerylistAccountsArgs = {
  accountType?: InputMaybe<Scalars['String']['input']>;
  standing?: InputMaybe<Scalars['String']['input']>;
  cursor?: InputMaybe<Scalars['String']['input']>;
  pageSize?: InputMaybe<Scalars['Int']['input']>;
};


export type QuerygetAccountArgs = {
  accountId: Scalars['String']['input'];
};


export type QuerylistChargesArgs = {
  dockingRef?: InputMaybe<Scalars['String']['input']>;
  accountId?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<Scalars['String']['input']>;
  cursor?: InputMaybe<Scalars['String']['input']>;
  pageSize?: InputMaybe<Scalars['Int']['input']>;
};


export type QuerylistValuationsArgs = {
  manifestLineRef?: InputMaybe<Scalars['String']['input']>;
  dockingRef?: InputMaybe<Scalars['String']['input']>;
  cursor?: InputMaybe<Scalars['String']['input']>;
  pageSize?: InputMaybe<Scalars['Int']['input']>;
};


export type QuerylistSettlementsArgs = {
  merchantId?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<Scalars['String']['input']>;
  cursor?: InputMaybe<Scalars['String']['input']>;
  pageSize?: InputMaybe<Scalars['Int']['input']>;
};


export type QuerylistPayrollArgs = {
  crewRef?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<Scalars['String']['input']>;
  cursor?: InputMaybe<Scalars['String']['input']>;
  pageSize?: InputMaybe<Scalars['Int']['input']>;
};


export type QuerychargesArgs = {
  dockingRef?: InputMaybe<Scalars['String']['input']>;
  accountId?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<Scalars['String']['input']>;
  cursor?: InputMaybe<Scalars['String']['input']>;
  pageSize?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryvaluationsArgs = {
  manifestLineRef?: InputMaybe<Scalars['String']['input']>;
  dockingRef?: InputMaybe<Scalars['String']['input']>;
  cursor?: InputMaybe<Scalars['String']['input']>;
  pageSize?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryaccountsArgs = {
  accountType?: InputMaybe<Scalars['String']['input']>;
  standing?: InputMaybe<Scalars['String']['input']>;
  cursor?: InputMaybe<Scalars['String']['input']>;
  pageSize?: InputMaybe<Scalars['Int']['input']>;
};

export type Berth = {
  berthId?: Maybe<Scalars['String']['output']>;
  /** light_personnel | medium_freight | heavy_bulk */
  berthClass?: Maybe<Scalars['String']['output']>;
  /** 0 or 1 — booleans were added to the schema language after this system shipped */
  occupiedFlag?: Maybe<Scalars['Int']['output']>;
  maxMassKg?: Maybe<Scalars['Float']['output']>;
  currentDockingId?: Maybe<Scalars['Int']['output']>;
};

export type Docking = {
  dockingId?: Maybe<Scalars['Int']['output']>;
  berthId?: Maybe<Scalars['String']['output']>;
  vesselRegistryNo?: Maybe<Scalars['String']['output']>;
  etaUtc?: Maybe<Scalars['DateTime']['output']>;
  departedUtc?: Maybe<Scalars['DateTime']['output']>;
  /** SCHEDULED | APPROACH | DOCKED | DEPARTED | ABORTED */
  statusCode?: Maybe<Scalars['String']['output']>;
};

export type ManifestLine = {
  lineId?: Maybe<Scalars['Int']['output']>;
  dockingId?: Maybe<Scalars['Int']['output']>;
  sku?: Maybe<Scalars['String']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  qty?: Maybe<Scalars['Int']['output']>;
  declaredMassKg?: Maybe<Scalars['Float']['output']>;
  /** NONE | CRYO | CORROSIVE | RADIOLOGICAL | BIO */
  hazardClass?: Maybe<Scalars['String']['output']>;
};

export type Vessel = {
  vesselRegistryNo?: Maybe<Scalars['String']['output']>;
  vesselName?: Maybe<Scalars['String']['output']>;
  operatorName?: Maybe<Scalars['String']['output']>;
  maxCapacityKg?: Maybe<Scalars['Float']['output']>;
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

export type ListAccounts_200Response = {
  meta?: Maybe<QueryListAccountsMeta>;
};

export type Account = {
  accountId?: Maybe<Scalars['String']['output']>;
  displayName?: Maybe<Scalars['String']['output']>;
  /** OPERATOR | MERCHANT | CREW */
  accountType?: Maybe<Scalars['String']['output']>;
  /** GOOD | DELINQUENT | FROZEN */
  standing?: Maybe<Scalars['String']['output']>;
  balanceCents?: Maybe<Scalars['Int']['output']>;
  currency?: Maybe<Scalars['String']['output']>;
};

export type QueryListAccountsMeta = {
  cursor?: Maybe<Scalars['String']['output']>;
  hasMore?: Maybe<Scalars['Boolean']['output']>;
};

export type ListCharges_200Response = {
  meta?: Maybe<QueryListChargesMeta>;
};

export type Charge = {
  chargeId?: Maybe<Scalars['String']['output']>;
  dockingRef?: Maybe<Scalars['String']['output']>;
  accountId?: Maybe<Scalars['String']['output']>;
  /** DOCKING_FEE | MASS_TARIFF | HAZMAT_SURCHARGE | LATE_DEPARTURE */
  chargeType?: Maybe<Scalars['String']['output']>;
  amountCents?: Maybe<Scalars['Int']['output']>;
  currency?: Maybe<Scalars['String']['output']>;
  /** PENDING | PAID | DISPUTED | WAIVED */
  status?: Maybe<Scalars['String']['output']>;
};

export type QueryListChargesMeta = {
  cursor?: Maybe<Scalars['String']['output']>;
  hasMore?: Maybe<Scalars['Boolean']['output']>;
};

export type ListValuations_200Response = {
  meta?: Maybe<QueryListValuationsMeta>;
};

export type Valuation = {
  valuationId?: Maybe<Scalars['String']['output']>;
  manifestLineRef?: Maybe<Scalars['String']['output']>;
  declaredValueCents?: Maybe<Scalars['Int']['output']>;
  currency?: Maybe<Scalars['String']['output']>;
  /** STANDARD | SPECIALIZED | UNINSURABLE */
  insuranceClass?: Maybe<Scalars['String']['output']>;
};

export type QueryListValuationsMeta = {
  cursor?: Maybe<Scalars['String']['output']>;
  hasMore?: Maybe<Scalars['Boolean']['output']>;
};

export type ListSettlements_200Response = {
  result?: Maybe<Array<Maybe<Settlement>>>;
  meta?: Maybe<QueryListSettlementsMeta>;
};

export type Settlement = {
  settlementId?: Maybe<Scalars['String']['output']>;
  merchantId?: Maybe<Scalars['String']['output']>;
  periodStart?: Maybe<Scalars['Date']['output']>;
  periodEnd?: Maybe<Scalars['Date']['output']>;
  grossCents?: Maybe<Scalars['Int']['output']>;
  feeCents?: Maybe<Scalars['Int']['output']>;
  netCents?: Maybe<Scalars['Int']['output']>;
  /** OPEN | SETTLED | HELD */
  status?: Maybe<Scalars['String']['output']>;
};

export type QueryListSettlementsMeta = {
  cursor?: Maybe<Scalars['String']['output']>;
  hasMore?: Maybe<Scalars['Boolean']['output']>;
};

export type ListPayroll_200Response = {
  result?: Maybe<Array<Maybe<Payroll>>>;
  meta?: Maybe<QueryListPayrollMeta>;
};

export type Payroll = {
  payrollId?: Maybe<Scalars['String']['output']>;
  crewRef?: Maybe<Scalars['String']['output']>;
  periodEnd?: Maybe<Scalars['Date']['output']>;
  grossCents?: Maybe<Scalars['Int']['output']>;
  /** SCHEDULED | PAID | HELD */
  status?: Maybe<Scalars['String']['output']>;
};

export type QueryListPayrollMeta = {
  cursor?: Maybe<Scalars['String']['output']>;
  hasMore?: Maybe<Scalars['Boolean']['output']>;
};

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
  Berth: ResolverTypeWrapper<Berth>;
  Float: ResolverTypeWrapper<Scalars['Float']['output']>;
  Docking: ResolverTypeWrapper<Docking>;
  DateTime: ResolverTypeWrapper<Scalars['DateTime']['output']>;
  ManifestLine: ResolverTypeWrapper<ManifestLine>;
  Vessel: ResolverTypeWrapper<Vessel>;
  HttpMethod: HttpMethod;
  ObjMap: ResolverTypeWrapper<Scalars['ObjMap']['output']>;
  ListAccounts_200Response: ResolverTypeWrapper<ListAccounts_200Response>;
  Account: ResolverTypeWrapper<Account>;
  QueryListAccountsMeta: ResolverTypeWrapper<QueryListAccountsMeta>;
  ListCharges_200Response: ResolverTypeWrapper<ListCharges_200Response>;
  Charge: ResolverTypeWrapper<Charge>;
  QueryListChargesMeta: ResolverTypeWrapper<QueryListChargesMeta>;
  ListValuations_200Response: ResolverTypeWrapper<ListValuations_200Response>;
  Valuation: ResolverTypeWrapper<Valuation>;
  QueryListValuationsMeta: ResolverTypeWrapper<QueryListValuationsMeta>;
  ListSettlements_200Response: ResolverTypeWrapper<ListSettlements_200Response>;
  Settlement: ResolverTypeWrapper<Settlement>;
  Date: ResolverTypeWrapper<Scalars['Date']['output']>;
  QueryListSettlementsMeta: ResolverTypeWrapper<QueryListSettlementsMeta>;
  ListPayroll_200Response: ResolverTypeWrapper<ListPayroll_200Response>;
  Payroll: ResolverTypeWrapper<Payroll>;
  QueryListPayrollMeta: ResolverTypeWrapper<QueryListPayrollMeta>;
  String: ResolverTypeWrapper<Scalars['String']['output']>;
  Boolean: ResolverTypeWrapper<Scalars['Boolean']['output']>;
}>;

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = ResolversObject<{
  Query: Record<PropertyKey, never>;
  Int: Scalars['Int']['output'];
  Berth: Berth;
  Float: Scalars['Float']['output'];
  Docking: Docking;
  DateTime: Scalars['DateTime']['output'];
  ManifestLine: ManifestLine;
  Vessel: Vessel;
  ObjMap: Scalars['ObjMap']['output'];
  ListAccounts_200Response: ListAccounts_200Response;
  Account: Account;
  QueryListAccountsMeta: QueryListAccountsMeta;
  ListCharges_200Response: ListCharges_200Response;
  Charge: Charge;
  QueryListChargesMeta: QueryListChargesMeta;
  ListValuations_200Response: ListValuations_200Response;
  Valuation: Valuation;
  QueryListValuationsMeta: QueryListValuationsMeta;
  ListSettlements_200Response: ListSettlements_200Response;
  Settlement: Settlement;
  Date: Scalars['Date']['output'];
  QueryListSettlementsMeta: QueryListSettlementsMeta;
  ListPayroll_200Response: ListPayroll_200Response;
  Payroll: Payroll;
  QueryListPayrollMeta: QueryListPayrollMeta;
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
  listBerths?: Resolver<Maybe<Array<Maybe<ResolversTypes['Berth']>>>, ParentType, ContextType, RequireFields<QuerylistBerthsArgs, 'limit'>>;
  getBerth?: Resolver<Maybe<ResolversTypes['Berth']>, ParentType, ContextType, RequireFields<QuerygetBerthArgs, 'berth_id'>>;
  listDockings?: Resolver<Maybe<Array<Maybe<ResolversTypes['Docking']>>>, ParentType, ContextType, RequireFields<QuerylistDockingsArgs, 'limit'>>;
  getDocking?: Resolver<Maybe<ResolversTypes['Docking']>, ParentType, ContextType, RequireFields<QuerygetDockingArgs, 'docking_id'>>;
  listManifestLines?: Resolver<Maybe<Array<Maybe<ResolversTypes['ManifestLine']>>>, ParentType, ContextType, RequireFields<QuerylistManifestLinesArgs, 'limit'>>;
  listVessels?: Resolver<Maybe<Array<Maybe<ResolversTypes['Vessel']>>>, ParentType, ContextType, RequireFields<QuerylistVesselsArgs, 'limit'>>;
  getVessel?: Resolver<Maybe<ResolversTypes['Vessel']>, ParentType, ContextType, RequireFields<QuerygetVesselArgs, 'vessel_registry_no'>>;
  listAccounts?: Resolver<Maybe<ResolversTypes['ListAccounts_200Response']>, ParentType, ContextType, RequireFields<QuerylistAccountsArgs, 'pageSize'>>;
  getAccount?: Resolver<Maybe<ResolversTypes['Account']>, ParentType, ContextType, RequireFields<QuerygetAccountArgs, 'accountId'>>;
  listCharges?: Resolver<Maybe<ResolversTypes['ListCharges_200Response']>, ParentType, ContextType, RequireFields<QuerylistChargesArgs, 'pageSize'>>;
  listValuations?: Resolver<Maybe<ResolversTypes['ListValuations_200Response']>, ParentType, ContextType, RequireFields<QuerylistValuationsArgs, 'pageSize'>>;
  listSettlements?: Resolver<Maybe<ResolversTypes['ListSettlements_200Response']>, ParentType, ContextType, RequireFields<QuerylistSettlementsArgs, 'pageSize'>>;
  listPayroll?: Resolver<Maybe<ResolversTypes['ListPayroll_200Response']>, ParentType, ContextType, RequireFields<QuerylistPayrollArgs, 'pageSize'>>;
  charges?: Resolver<Maybe<Array<Maybe<ResolversTypes['Charge']>>>, ParentType, ContextType, RequireFields<QuerychargesArgs, 'pageSize'>>;
  valuations?: Resolver<Maybe<Array<Maybe<ResolversTypes['Valuation']>>>, ParentType, ContextType, RequireFields<QueryvaluationsArgs, 'pageSize'>>;
  accounts?: Resolver<Maybe<Array<Maybe<ResolversTypes['Account']>>>, ParentType, ContextType, RequireFields<QueryaccountsArgs, 'pageSize'>>;
}>;

export type BerthResolvers<ContextType = MeshContext, ParentType extends ResolversParentTypes['Berth'] = ResolversParentTypes['Berth']> = ResolversObject<{
  berthId?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  berthClass?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  occupiedFlag?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  maxMassKg?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  currentDockingId?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
}>;

export type DockingResolvers<ContextType = MeshContext, ParentType extends ResolversParentTypes['Docking'] = ResolversParentTypes['Docking']> = ResolversObject<{
  dockingId?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  berthId?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  vesselRegistryNo?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  etaUtc?: Resolver<Maybe<ResolversTypes['DateTime']>, ParentType, ContextType>;
  departedUtc?: Resolver<Maybe<ResolversTypes['DateTime']>, ParentType, ContextType>;
  statusCode?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
}>;

export interface DateTimeScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['DateTime'], any> {
  name: 'DateTime';
}

export type ManifestLineResolvers<ContextType = MeshContext, ParentType extends ResolversParentTypes['ManifestLine'] = ResolversParentTypes['ManifestLine']> = ResolversObject<{
  lineId?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  dockingId?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  sku?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  description?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  qty?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  declaredMassKg?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  hazardClass?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
}>;

export type VesselResolvers<ContextType = MeshContext, ParentType extends ResolversParentTypes['Vessel'] = ResolversParentTypes['Vessel']> = ResolversObject<{
  vesselRegistryNo?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  vesselName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  operatorName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  maxCapacityKg?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
}>;

export interface ObjMapScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['ObjMap'], any> {
  name: 'ObjMap';
}

export type ListAccounts_200ResponseResolvers<ContextType = MeshContext, ParentType extends ResolversParentTypes['ListAccounts_200Response'] = ResolversParentTypes['ListAccounts_200Response']> = ResolversObject<{
  meta?: Resolver<Maybe<ResolversTypes['QueryListAccountsMeta']>, ParentType, ContextType>;
}>;

export type AccountResolvers<ContextType = MeshContext, ParentType extends ResolversParentTypes['Account'] = ResolversParentTypes['Account']> = ResolversObject<{
  accountId?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  displayName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  accountType?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  standing?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  balanceCents?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  currency?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
}>;

export type QueryListAccountsMetaResolvers<ContextType = MeshContext, ParentType extends ResolversParentTypes['QueryListAccountsMeta'] = ResolversParentTypes['QueryListAccountsMeta']> = ResolversObject<{
  cursor?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  hasMore?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
}>;

export type ListCharges_200ResponseResolvers<ContextType = MeshContext, ParentType extends ResolversParentTypes['ListCharges_200Response'] = ResolversParentTypes['ListCharges_200Response']> = ResolversObject<{
  meta?: Resolver<Maybe<ResolversTypes['QueryListChargesMeta']>, ParentType, ContextType>;
}>;

export type ChargeResolvers<ContextType = MeshContext, ParentType extends ResolversParentTypes['Charge'] = ResolversParentTypes['Charge']> = ResolversObject<{
  chargeId?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  dockingRef?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  accountId?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  chargeType?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  amountCents?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  currency?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  status?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
}>;

export type QueryListChargesMetaResolvers<ContextType = MeshContext, ParentType extends ResolversParentTypes['QueryListChargesMeta'] = ResolversParentTypes['QueryListChargesMeta']> = ResolversObject<{
  cursor?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  hasMore?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
}>;

export type ListValuations_200ResponseResolvers<ContextType = MeshContext, ParentType extends ResolversParentTypes['ListValuations_200Response'] = ResolversParentTypes['ListValuations_200Response']> = ResolversObject<{
  meta?: Resolver<Maybe<ResolversTypes['QueryListValuationsMeta']>, ParentType, ContextType>;
}>;

export type ValuationResolvers<ContextType = MeshContext, ParentType extends ResolversParentTypes['Valuation'] = ResolversParentTypes['Valuation']> = ResolversObject<{
  valuationId?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  manifestLineRef?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  declaredValueCents?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  currency?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  insuranceClass?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
}>;

export type QueryListValuationsMetaResolvers<ContextType = MeshContext, ParentType extends ResolversParentTypes['QueryListValuationsMeta'] = ResolversParentTypes['QueryListValuationsMeta']> = ResolversObject<{
  cursor?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  hasMore?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
}>;

export type ListSettlements_200ResponseResolvers<ContextType = MeshContext, ParentType extends ResolversParentTypes['ListSettlements_200Response'] = ResolversParentTypes['ListSettlements_200Response']> = ResolversObject<{
  result?: Resolver<Maybe<Array<Maybe<ResolversTypes['Settlement']>>>, ParentType, ContextType>;
  meta?: Resolver<Maybe<ResolversTypes['QueryListSettlementsMeta']>, ParentType, ContextType>;
}>;

export type SettlementResolvers<ContextType = MeshContext, ParentType extends ResolversParentTypes['Settlement'] = ResolversParentTypes['Settlement']> = ResolversObject<{
  settlementId?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  merchantId?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  periodStart?: Resolver<Maybe<ResolversTypes['Date']>, ParentType, ContextType>;
  periodEnd?: Resolver<Maybe<ResolversTypes['Date']>, ParentType, ContextType>;
  grossCents?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  feeCents?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  netCents?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  status?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
}>;

export interface DateScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['Date'], any> {
  name: 'Date';
}

export type QueryListSettlementsMetaResolvers<ContextType = MeshContext, ParentType extends ResolversParentTypes['QueryListSettlementsMeta'] = ResolversParentTypes['QueryListSettlementsMeta']> = ResolversObject<{
  cursor?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  hasMore?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
}>;

export type ListPayroll_200ResponseResolvers<ContextType = MeshContext, ParentType extends ResolversParentTypes['ListPayroll_200Response'] = ResolversParentTypes['ListPayroll_200Response']> = ResolversObject<{
  result?: Resolver<Maybe<Array<Maybe<ResolversTypes['Payroll']>>>, ParentType, ContextType>;
  meta?: Resolver<Maybe<ResolversTypes['QueryListPayrollMeta']>, ParentType, ContextType>;
}>;

export type PayrollResolvers<ContextType = MeshContext, ParentType extends ResolversParentTypes['Payroll'] = ResolversParentTypes['Payroll']> = ResolversObject<{
  payrollId?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  crewRef?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  periodEnd?: Resolver<Maybe<ResolversTypes['Date']>, ParentType, ContextType>;
  grossCents?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  status?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
}>;

export type QueryListPayrollMetaResolvers<ContextType = MeshContext, ParentType extends ResolversParentTypes['QueryListPayrollMeta'] = ResolversParentTypes['QueryListPayrollMeta']> = ResolversObject<{
  cursor?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  hasMore?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
}>;

export type Resolvers<ContextType = MeshContext> = ResolversObject<{
  Query?: QueryResolvers<ContextType>;
  Berth?: BerthResolvers<ContextType>;
  Docking?: DockingResolvers<ContextType>;
  DateTime?: GraphQLScalarType;
  ManifestLine?: ManifestLineResolvers<ContextType>;
  Vessel?: VesselResolvers<ContextType>;
  ObjMap?: GraphQLScalarType;
  ListAccounts_200Response?: ListAccounts_200ResponseResolvers<ContextType>;
  Account?: AccountResolvers<ContextType>;
  QueryListAccountsMeta?: QueryListAccountsMetaResolvers<ContextType>;
  ListCharges_200Response?: ListCharges_200ResponseResolvers<ContextType>;
  Charge?: ChargeResolvers<ContextType>;
  QueryListChargesMeta?: QueryListChargesMetaResolvers<ContextType>;
  ListValuations_200Response?: ListValuations_200ResponseResolvers<ContextType>;
  Valuation?: ValuationResolvers<ContextType>;
  QueryListValuationsMeta?: QueryListValuationsMetaResolvers<ContextType>;
  ListSettlements_200Response?: ListSettlements_200ResponseResolvers<ContextType>;
  Settlement?: SettlementResolvers<ContextType>;
  Date?: GraphQLScalarType;
  QueryListSettlementsMeta?: QueryListSettlementsMetaResolvers<ContextType>;
  ListPayroll_200Response?: ListPayroll_200ResponseResolvers<ContextType>;
  Payroll?: PayrollResolvers<ContextType>;
  QueryListPayrollMeta?: QueryListPayrollMetaResolvers<ContextType>;
}>;

export type DirectiveResolvers<ContextType = MeshContext> = ResolversObject<{
  httpOperation?: httpOperationDirectiveResolver<any, any, ContextType>;
  transport?: transportDirectiveResolver<any, any, ContextType>;
}>;

export type MeshInContextSDK = HarbormasterTypes.Context & StellarLedgerTypes.Context;

export type MeshContext = BaseMeshContext & MeshInContextSDK;


const baseDir = pathModule.join(typeof __dirname === 'string' ? __dirname : '/', '..');

const importFn: ImportFn = <T>(moduleId: string) => {
  const relativeModuleId = (pathModule.isAbsolute(moduleId) ? pathModule.relative(baseDir, moduleId) : moduleId).split('\\').join('/').replace(baseDir + '/', '');
  switch(relativeModuleId) {
    case "src/platform/bff/mesh-context.js":
      return import("./../src/platform/bff/mesh-context.js") as T;
    
    case ".mesh/sources/Harbormaster/schemaWithAnnotations":
      return import("./sources/Harbormaster/schemaWithAnnotations") as T;
    
    case ".mesh/sources/StellarLedger/schemaWithAnnotations":
      return import("./sources/StellarLedger/schemaWithAnnotations") as T;
    
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
const harbormasterTransforms = [];
const stellarLedgerTransforms = [];
const additionalTypeDefs = [] as any[];
const HarbormasterHandler = await import("@graphql-mesh/openapi").then(handleImport);
const harbormasterHandler = new HarbormasterHandler({
              name: "Harbormaster",
              config: {"source":"./specs/harbormaster.yaml"},
              baseDir,
              cache,
              pubsub,
              store: sourcesStore.child("Harbormaster"),
              logger: logger.child({ source: "Harbormaster" }),
              importFn,
            });
const StellarLedgerHandler = await import("@graphql-mesh/openapi").then(handleImport);
const stellarLedgerHandler = new StellarLedgerHandler({
              name: "StellarLedger",
              config: {"source":"./specs/stellar-ledger.yaml"},
              baseDir,
              cache,
              pubsub,
              store: sourcesStore.child("StellarLedger"),
              logger: logger.child({ source: "StellarLedger" }),
              importFn,
            });
sources[0] = {
          name: 'Harbormaster',
          handler: harbormasterHandler,
          transforms: harbormasterTransforms
        }
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
const StellarLedgerTransforms_0 = await import("@graphql-mesh/transform-hoist-field").then(handleImport);
stellarLedgerTransforms[0] = new StellarLedgerTransforms_0({
                  apiName: "StellarLedger",
                  config: [{"typeName":"Query","pathConfig":["listCharges","result"],"newFieldName":"charges"},{"typeName":"Query","pathConfig":["listValuations","result"],"newFieldName":"valuations"},{"typeName":"Query","pathConfig":["listAccounts","result"],"newFieldName":"accounts"}],
                  baseDir,
                  cache,
                  pubsub,
                  importFn,
                  logger,
                });
sources[1] = {
          name: 'StellarLedger',
          handler: stellarLedgerHandler,
          transforms: stellarLedgerTransforms
        }
const additionalResolvers = [] as any[]
const Merger = await import("@graphql-mesh/merger-stitching").then(handleImport);
const merger = new Merger({
        cache,
        pubsub,
        logger: logger.child({ merger: "stitching" }),
        store: rootStore.child("stitching")
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