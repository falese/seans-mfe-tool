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
import type { UserApiTypes } from './sources/UserAPI/types';
import type { PetStoreApiTypes } from './sources/PetStoreAPI/types';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
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
  ObjMap: { input: any; output: any; }
};

export type Query = {
  /** List all pets */
  listPets?: Maybe<listPets_200_response>;
  /** Get pet by id */
  getPet?: Maybe<Pet>;
  /** Get all phase metrics */
  phase_metrics?: Maybe<Array<Maybe<PhaseMetrics>>>;
  /** Get phase metrics by ID */
  phase_metrics_by_phaseId?: Maybe<PhaseMetrics>;
  /** Get all benefits breakdown data */
  benefits_breakdown?: Maybe<Array<Maybe<BenefitsBreakdown>>>;
  /** Get all cumulative ROI data */
  cumulative_roi?: Maybe<Array<Maybe<CumulativeRoi>>>;
  /** Get all performance gate metrics */
  performance_gate?: Maybe<Array<Maybe<PerformanceGate>>>;
};


export type QuerylistPetsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
};


export type QuerygetPetArgs = {
  petId: Scalars['String']['input'];
};


export type Queryphase_metrics_by_phaseIdArgs = {
  phaseId: Scalars['String']['input'];
};

export type Mutation = {
  /** Create a pet */
  createPet?: Maybe<Pet>;
  /** Create new phase metrics */
  post_phase_metrics?: Maybe<PhaseMetrics>;
  /** Update phase metrics */
  put_phase_metrics_by_phaseId?: Maybe<PhaseMetrics>;
  /** Create new benefits breakdown entry */
  post_benefits_breakdown?: Maybe<BenefitsBreakdown>;
  /** Create new cumulative ROI entry */
  post_cumulative_roi?: Maybe<CumulativeRoi>;
  /** Create new performance gate entry */
  post_performance_gate?: Maybe<PerformanceGate>;
};


export type MutationcreatePetArgs = {
  input?: InputMaybe<NewPet_Input>;
};


export type Mutationpost_phase_metricsArgs = {
  input?: InputMaybe<PhaseMetrics_Input>;
};


export type Mutationput_phase_metrics_by_phaseIdArgs = {
  phaseId: Scalars['String']['input'];
  input?: InputMaybe<PhaseMetrics_Input>;
};


export type Mutationpost_benefits_breakdownArgs = {
  input?: InputMaybe<BenefitsBreakdown_Input>;
};


export type Mutationpost_cumulative_roiArgs = {
  input?: InputMaybe<CumulativeRoi_Input>;
};


export type Mutationpost_performance_gateArgs = {
  input?: InputMaybe<PerformanceGate_Input>;
};

export type listPets_200_response = {
  items?: Maybe<Array<Maybe<Pet>>>;
};

export type Pet = {
  id: Scalars['String']['output'];
  name: Scalars['String']['output'];
  status: Scalars['String']['output'];
  tag?: Maybe<Scalars['String']['output']>;
};

export type NewPet_Input = {
  name: Scalars['String']['input'];
  tag?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<mutationInput_createPet_input_status>;
};

export type mutationInput_createPet_input_status =
  | 'available'
  | 'pending'
  | 'sold';

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

export type PhaseMetrics = {
  phaseId: query_phase_metrics_items_phaseId;
  teamSize: Scalars['Int']['output'];
  newHires: Scalars['Int']['output'];
  personnelCost: Scalars['Float']['output'];
  transitionCost: Scalars['Float']['output'];
  totalCost: Scalars['Float']['output'];
  benefitsRealized: Scalars['Float']['output'];
  quarterBenefits: Scalars['Float']['output'];
  quarterRoi: Scalars['Float']['output'];
};

export type query_phase_metrics_items_phaseId =
  | 'current'
  | 'phase1'
  | 'phase2'
  | 'phase3'
  | 'phase4'
  | 'steady';

export type BenefitsBreakdown = {
  phaseId: query_benefits_breakdown_items_phaseId;
  devTimeSavings: Scalars['Float']['output'];
  supportEfficiency: Scalars['Float']['output'];
  timeToMarket: Scalars['Float']['output'];
  totalBenefits: Scalars['Float']['output'];
};

export type query_benefits_breakdown_items_phaseId =
  | 'current'
  | 'phase1'
  | 'phase2'
  | 'phase3'
  | 'phase4'
  | 'steady';

export type CumulativeRoi = {
  year: Scalars['Int']['output'];
  period: Scalars['String']['output'];
  costs: Scalars['Float']['output'];
  benefits: Scalars['Float']['output'];
  net: Scalars['Float']['output'];
  cumulativeRoi: Scalars['Float']['output'];
};

export type PerformanceGate = {
  phase: Scalars['String']['output'];
  teamSize: Scalars['Int']['output'];
  teamsOnboarded: Scalars['Int']['output'];
  automation: Scalars['Float']['output'];
  supportReduction: Scalars['Float']['output'];
};

export type PhaseMetrics_Input = {
  phaseId: query_phase_metrics_items_phaseId;
  teamSize: Scalars['Int']['input'];
  newHires: Scalars['Int']['input'];
  personnelCost: Scalars['Float']['input'];
  transitionCost: Scalars['Float']['input'];
  totalCost: Scalars['Float']['input'];
  benefitsRealized: Scalars['Float']['input'];
  quarterBenefits: Scalars['Float']['input'];
  quarterRoi: Scalars['Float']['input'];
};

export type BenefitsBreakdown_Input = {
  phaseId: query_benefits_breakdown_items_phaseId;
  devTimeSavings: Scalars['Float']['input'];
  supportEfficiency: Scalars['Float']['input'];
  timeToMarket: Scalars['Float']['input'];
  totalBenefits: Scalars['Float']['input'];
};

export type CumulativeRoi_Input = {
  year: Scalars['Int']['input'];
  period: Scalars['String']['input'];
  costs: Scalars['Float']['input'];
  benefits: Scalars['Float']['input'];
  net: Scalars['Float']['input'];
  cumulativeRoi: Scalars['Float']['input'];
};

export type PerformanceGate_Input = {
  phase: Scalars['String']['input'];
  teamSize: Scalars['Int']['input'];
  teamsOnboarded: Scalars['Int']['input'];
  automation: Scalars['Float']['input'];
  supportReduction: Scalars['Float']['input'];
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
  Mutation: ResolverTypeWrapper<Record<PropertyKey, never>>;
  Int: ResolverTypeWrapper<Scalars['Int']['output']>;
  listPets_200_response: ResolverTypeWrapper<listPets_200_response>;
  Pet: ResolverTypeWrapper<Pet>;
  NewPet_Input: NewPet_Input;
  mutationInput_createPet_input_status: mutationInput_createPet_input_status;
  HTTPMethod: HTTPMethod;
  ObjMap: ResolverTypeWrapper<Scalars['ObjMap']['output']>;
  String: ResolverTypeWrapper<Scalars['String']['output']>;
  Boolean: ResolverTypeWrapper<Scalars['Boolean']['output']>;
  PhaseMetrics: ResolverTypeWrapper<PhaseMetrics>;
  Float: ResolverTypeWrapper<Scalars['Float']['output']>;
  query_phase_metrics_items_phaseId: query_phase_metrics_items_phaseId;
  BenefitsBreakdown: ResolverTypeWrapper<BenefitsBreakdown>;
  query_benefits_breakdown_items_phaseId: query_benefits_breakdown_items_phaseId;
  CumulativeRoi: ResolverTypeWrapper<CumulativeRoi>;
  PerformanceGate: ResolverTypeWrapper<PerformanceGate>;
  PhaseMetrics_Input: PhaseMetrics_Input;
  BenefitsBreakdown_Input: BenefitsBreakdown_Input;
  CumulativeRoi_Input: CumulativeRoi_Input;
  PerformanceGate_Input: PerformanceGate_Input;
}>;

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = ResolversObject<{
  Query: Record<PropertyKey, never>;
  Mutation: Record<PropertyKey, never>;
  Int: Scalars['Int']['output'];
  listPets_200_response: listPets_200_response;
  Pet: Pet;
  NewPet_Input: NewPet_Input;
  ObjMap: Scalars['ObjMap']['output'];
  String: Scalars['String']['output'];
  Boolean: Scalars['Boolean']['output'];
  PhaseMetrics: PhaseMetrics;
  Float: Scalars['Float']['output'];
  BenefitsBreakdown: BenefitsBreakdown;
  CumulativeRoi: CumulativeRoi;
  PerformanceGate: PerformanceGate;
  PhaseMetrics_Input: PhaseMetrics_Input;
  BenefitsBreakdown_Input: BenefitsBreakdown_Input;
  CumulativeRoi_Input: CumulativeRoi_Input;
  PerformanceGate_Input: PerformanceGate_Input;
}>;

export type enumDirectiveArgs = {
  subgraph?: Maybe<Scalars['String']['input']>;
  value?: Maybe<Scalars['String']['input']>;
};

export type enumDirectiveResolver<Result, Parent, ContextType = MeshContext, Args = enumDirectiveArgs> = DirectiveResolverFn<Result, Parent, ContextType, Args>;

export type httpOperationDirectiveArgs = {
  subgraph?: Maybe<Scalars['String']['input']>;
  path?: Maybe<Scalars['String']['input']>;
  operationSpecificHeaders?: Maybe<Array<Maybe<Array<Maybe<Scalars['String']['input']>>>>>;
  httpMethod?: Maybe<HTTPMethod>;
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
  listPets?: Resolver<Maybe<ResolversTypes['listPets_200_response']>, ParentType, ContextType, RequireFields<QuerylistPetsArgs, 'limit'>>;
  getPet?: Resolver<Maybe<ResolversTypes['Pet']>, ParentType, ContextType, RequireFields<QuerygetPetArgs, 'petId'>>;
  phase_metrics?: Resolver<Maybe<Array<Maybe<ResolversTypes['PhaseMetrics']>>>, ParentType, ContextType>;
  phase_metrics_by_phaseId?: Resolver<Maybe<ResolversTypes['PhaseMetrics']>, ParentType, ContextType, RequireFields<Queryphase_metrics_by_phaseIdArgs, 'phaseId'>>;
  benefits_breakdown?: Resolver<Maybe<Array<Maybe<ResolversTypes['BenefitsBreakdown']>>>, ParentType, ContextType>;
  cumulative_roi?: Resolver<Maybe<Array<Maybe<ResolversTypes['CumulativeRoi']>>>, ParentType, ContextType>;
  performance_gate?: Resolver<Maybe<Array<Maybe<ResolversTypes['PerformanceGate']>>>, ParentType, ContextType>;
}>;

export type MutationResolvers<ContextType = MeshContext, ParentType extends ResolversParentTypes['Mutation'] = ResolversParentTypes['Mutation']> = ResolversObject<{
  createPet?: Resolver<Maybe<ResolversTypes['Pet']>, ParentType, ContextType, Partial<MutationcreatePetArgs>>;
  post_phase_metrics?: Resolver<Maybe<ResolversTypes['PhaseMetrics']>, ParentType, ContextType, Partial<Mutationpost_phase_metricsArgs>>;
  put_phase_metrics_by_phaseId?: Resolver<Maybe<ResolversTypes['PhaseMetrics']>, ParentType, ContextType, RequireFields<Mutationput_phase_metrics_by_phaseIdArgs, 'phaseId'>>;
  post_benefits_breakdown?: Resolver<Maybe<ResolversTypes['BenefitsBreakdown']>, ParentType, ContextType, Partial<Mutationpost_benefits_breakdownArgs>>;
  post_cumulative_roi?: Resolver<Maybe<ResolversTypes['CumulativeRoi']>, ParentType, ContextType, Partial<Mutationpost_cumulative_roiArgs>>;
  post_performance_gate?: Resolver<Maybe<ResolversTypes['PerformanceGate']>, ParentType, ContextType, Partial<Mutationpost_performance_gateArgs>>;
}>;

export type listPets_200_responseResolvers<ContextType = MeshContext, ParentType extends ResolversParentTypes['listPets_200_response'] = ResolversParentTypes['listPets_200_response']> = ResolversObject<{
  items?: Resolver<Maybe<Array<Maybe<ResolversTypes['Pet']>>>, ParentType, ContextType>;
}>;

export type PetResolvers<ContextType = MeshContext, ParentType extends ResolversParentTypes['Pet'] = ResolversParentTypes['Pet']> = ResolversObject<{
  id?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  status?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  tag?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
}>;

export interface ObjMapScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['ObjMap'], any> {
  name: 'ObjMap';
}

export type PhaseMetricsResolvers<ContextType = MeshContext, ParentType extends ResolversParentTypes['PhaseMetrics'] = ResolversParentTypes['PhaseMetrics']> = ResolversObject<{
  phaseId?: Resolver<ResolversTypes['query_phase_metrics_items_phaseId'], ParentType, ContextType>;
  teamSize?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  newHires?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  personnelCost?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  transitionCost?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  totalCost?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  benefitsRealized?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  quarterBenefits?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  quarterRoi?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
}>;

export type BenefitsBreakdownResolvers<ContextType = MeshContext, ParentType extends ResolversParentTypes['BenefitsBreakdown'] = ResolversParentTypes['BenefitsBreakdown']> = ResolversObject<{
  phaseId?: Resolver<ResolversTypes['query_benefits_breakdown_items_phaseId'], ParentType, ContextType>;
  devTimeSavings?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  supportEfficiency?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  timeToMarket?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  totalBenefits?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
}>;

export type CumulativeRoiResolvers<ContextType = MeshContext, ParentType extends ResolversParentTypes['CumulativeRoi'] = ResolversParentTypes['CumulativeRoi']> = ResolversObject<{
  year?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  period?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  costs?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  benefits?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  net?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  cumulativeRoi?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
}>;

export type PerformanceGateResolvers<ContextType = MeshContext, ParentType extends ResolversParentTypes['PerformanceGate'] = ResolversParentTypes['PerformanceGate']> = ResolversObject<{
  phase?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  teamSize?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  teamsOnboarded?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  automation?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  supportReduction?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
}>;

export type Resolvers<ContextType = MeshContext> = ResolversObject<{
  Query?: QueryResolvers<ContextType>;
  Mutation?: MutationResolvers<ContextType>;
  listPets_200_response?: listPets_200_responseResolvers<ContextType>;
  Pet?: PetResolvers<ContextType>;
  ObjMap?: GraphQLScalarType;
  PhaseMetrics?: PhaseMetricsResolvers<ContextType>;
  BenefitsBreakdown?: BenefitsBreakdownResolvers<ContextType>;
  CumulativeRoi?: CumulativeRoiResolvers<ContextType>;
  PerformanceGate?: PerformanceGateResolvers<ContextType>;
}>;

export type DirectiveResolvers<ContextType = MeshContext> = ResolversObject<{
  enum?: enumDirectiveResolver<any, any, ContextType>;
  httpOperation?: httpOperationDirectiveResolver<any, any, ContextType>;
  transport?: transportDirectiveResolver<any, any, ContextType>;
}>;

export type MeshContext = PetStoreApiTypes.Context & UserApiTypes.Context & BaseMeshContext;


const baseDir = pathModule.join(typeof __dirname === 'string' ? __dirname : '/', '..');

const importFn: ImportFn = <T>(moduleId: string) => {
  const relativeModuleId = (pathModule.isAbsolute(moduleId) ? pathModule.relative(baseDir, moduleId) : moduleId).split('\\').join('/').replace(baseDir + '/', '');
  switch(relativeModuleId) {
    case ".mesh/sources/PetStoreAPI/schemaWithAnnotations":
      return import("./sources/PetStoreAPI/schemaWithAnnotations") as T;
    
    case ".mesh/sources/UserAPI/schemaWithAnnotations":
      return import("./sources/UserAPI/schemaWithAnnotations") as T;
    
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

export const rawServeConfig: YamlConfig.Config['serve'] = undefined as any
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
const petStoreApiTransforms = [];
const userApiTransforms = [];
const additionalTypeDefs = [] as any[];
const PetStoreApiHandler = await import("@graphql-mesh/openapi").then(handleImport);
const petStoreApiHandler = new PetStoreApiHandler({
              name: "PetStoreAPI",
              config: {"source":"./pet-store-api.yaml","operationHeaders":{"Authorization":"Bearer {context.jwt}","X-Request-ID":"{context.requestId}","X-User-ID":"{context.userId}"}},
              baseDir,
              cache,
              pubsub,
              store: sourcesStore.child("PetStoreAPI"),
              logger: logger.child({ source: "PetStoreAPI" }),
              importFn,
            });
const UserApiHandler = await import("@graphql-mesh/openapi").then(handleImport);
const userApiHandler = new UserApiHandler({
              name: "UserAPI",
              config: {"source":"./benefit-model.yaml","operationHeaders":{"Authorization":"Bearer {context.jwt}"}},
              baseDir,
              cache,
              pubsub,
              store: sourcesStore.child("UserAPI"),
              logger: logger.child({ source: "UserAPI" }),
              importFn,
            });
sources[0] = {
          name: 'PetStoreAPI',
          handler: petStoreApiHandler,
          transforms: petStoreApiTransforms
        }
sources[1] = {
          name: 'UserAPI',
          handler: userApiHandler,
          transforms: userApiTransforms
        }
const additionalResolvers = [] as any[]
const Merger = await import("@graphql-mesh/merger-stitching").then(handleImport);
const merger = new Merger({
        cache,
        pubsub,
        logger: logger.child({ merger: "stitching" }),
        store: rootStore.child("stitching")
      })

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
    rawServeConfig: undefined,
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
    });
  }
  return meshInstance$;
}

export const execute: ExecuteMeshFn = (...args) => getBuiltMesh().then(({ execute }) => execute(...args));

export const subscribe: SubscribeMeshFn = (...args) => getBuiltMesh().then(({ subscribe }) => subscribe(...args));