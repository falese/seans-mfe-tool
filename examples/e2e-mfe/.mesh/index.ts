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
import type { AnalysisApiTypes } from './sources/AnalysisAPI/types';
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
  /** Get all phase metrics */
  phaseMetrics?: Maybe<Array<Maybe<PhaseMetrics>>>;
  /** Get phase metrics by ID */
  phaseMetricsByPhaseId?: Maybe<PhaseMetrics>;
  /** Get all benefits breakdown data */
  benefitsBreakdown?: Maybe<Array<Maybe<BenefitsBreakdown>>>;
  /** Get all cumulative ROI data */
  cumulativeRoi?: Maybe<Array<Maybe<CumulativeRoi>>>;
  /** Get all performance gate metrics */
  performanceGate?: Maybe<Array<Maybe<PerformanceGate>>>;
  /** List all pets */
  listPets?: Maybe<ListPets_200Response>;
  /** Get pet by id */
  getPet?: Maybe<Pet>;
};


export type QueryphaseMetricsByPhaseIdArgs = {
  phaseId: Scalars['String']['input'];
};


export type QuerylistPetsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
};


export type QuerygetPetArgs = {
  petId: Scalars['String']['input'];
};

export type Mutation = {
  /** Create new phase metrics */
  postPhaseMetrics?: Maybe<PhaseMetrics>;
  /** Update phase metrics */
  putPhaseMetricsByPhaseId?: Maybe<PhaseMetrics>;
  /** Create new benefits breakdown entry */
  postBenefitsBreakdown?: Maybe<BenefitsBreakdown>;
  /** Create new cumulative ROI entry */
  postCumulativeRoi?: Maybe<CumulativeRoi>;
  /** Create new performance gate entry */
  postPerformanceGate?: Maybe<PerformanceGate>;
  /** Create a pet */
  createPet?: Maybe<Pet>;
};


export type MutationpostPhaseMetricsArgs = {
  input?: InputMaybe<PhaseMetricsInput>;
};


export type MutationputPhaseMetricsByPhaseIdArgs = {
  phaseId: Scalars['String']['input'];
  input?: InputMaybe<PhaseMetricsInput>;
};


export type MutationpostBenefitsBreakdownArgs = {
  input?: InputMaybe<BenefitsBreakdownInput>;
};


export type MutationpostCumulativeRoiArgs = {
  input?: InputMaybe<CumulativeRoiInput>;
};


export type MutationpostPerformanceGateArgs = {
  input?: InputMaybe<PerformanceGateInput>;
};


export type MutationcreatePetArgs = {
  input?: InputMaybe<NewPetInput>;
};

export type PhaseMetrics = {
  phaseId: QueryPhaseMetricsItemsPhaseId;
  teamSize: Scalars['Int']['output'];
  newHires: Scalars['Int']['output'];
  personnelCost: Scalars['Float']['output'];
  transitionCost: Scalars['Float']['output'];
  totalCost: Scalars['Float']['output'];
  benefitsRealized: Scalars['Float']['output'];
  quarterBenefits: Scalars['Float']['output'];
  quarterRoi: Scalars['Float']['output'];
};

export type QueryPhaseMetricsItemsPhaseId =
  | 'current'
  | 'phase1'
  | 'phase2'
  | 'phase3'
  | 'phase4'
  | 'steady';

export type BenefitsBreakdown = {
  phaseId: QueryBenefitsBreakdownItemsPhaseId;
  devTimeSavings: Scalars['Float']['output'];
  supportEfficiency: Scalars['Float']['output'];
  timeToMarket: Scalars['Float']['output'];
  totalBenefits: Scalars['Float']['output'];
};

export type QueryBenefitsBreakdownItemsPhaseId =
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

export type PhaseMetricsInput = {
  phaseId: QueryPhaseMetricsItemsPhaseId;
  teamSize: Scalars['Int']['input'];
  newHires: Scalars['Int']['input'];
  personnelCost: Scalars['Float']['input'];
  transitionCost: Scalars['Float']['input'];
  totalCost: Scalars['Float']['input'];
  benefitsRealized: Scalars['Float']['input'];
  quarterBenefits: Scalars['Float']['input'];
  quarterRoi: Scalars['Float']['input'];
};

export type BenefitsBreakdownInput = {
  phaseId: QueryBenefitsBreakdownItemsPhaseId;
  devTimeSavings: Scalars['Float']['input'];
  supportEfficiency: Scalars['Float']['input'];
  timeToMarket: Scalars['Float']['input'];
  totalBenefits: Scalars['Float']['input'];
};

export type CumulativeRoiInput = {
  year: Scalars['Int']['input'];
  period: Scalars['String']['input'];
  costs: Scalars['Float']['input'];
  benefits: Scalars['Float']['input'];
  net: Scalars['Float']['input'];
  cumulativeRoi: Scalars['Float']['input'];
};

export type PerformanceGateInput = {
  phase: Scalars['String']['input'];
  teamSize: Scalars['Int']['input'];
  teamsOnboarded: Scalars['Int']['input'];
  automation: Scalars['Float']['input'];
  supportReduction: Scalars['Float']['input'];
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

export type ListPets_200Response = {
  items?: Maybe<Array<Maybe<Pet>>>;
};

export type Pet = {
  id: Scalars['String']['output'];
  name: Scalars['String']['output'];
  status: Scalars['String']['output'];
  tag?: Maybe<Scalars['String']['output']>;
};

export type NewPetInput = {
  name: Scalars['String']['input'];
  tag?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<MutationInputCreatePetInputStatus>;
};

export type MutationInputCreatePetInputStatus =
  | 'available'
  | 'pending'
  | 'sold';

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
  Mutation: ResolverTypeWrapper<Record<PropertyKey, never>>;
  PhaseMetrics: ResolverTypeWrapper<PhaseMetrics>;
  Float: ResolverTypeWrapper<Scalars['Float']['output']>;
  QueryPhaseMetricsItemsPhaseId: QueryPhaseMetricsItemsPhaseId;
  BenefitsBreakdown: ResolverTypeWrapper<BenefitsBreakdown>;
  QueryBenefitsBreakdownItemsPhaseId: QueryBenefitsBreakdownItemsPhaseId;
  CumulativeRoi: ResolverTypeWrapper<CumulativeRoi>;
  PerformanceGate: ResolverTypeWrapper<PerformanceGate>;
  PhaseMetricsInput: PhaseMetricsInput;
  BenefitsBreakdownInput: BenefitsBreakdownInput;
  CumulativeRoiInput: CumulativeRoiInput;
  PerformanceGateInput: PerformanceGateInput;
  HttpMethod: HttpMethod;
  ObjMap: ResolverTypeWrapper<Scalars['ObjMap']['output']>;
  ListPets_200Response: ResolverTypeWrapper<ListPets_200Response>;
  Pet: ResolverTypeWrapper<Pet>;
  NewPetInput: NewPetInput;
  MutationInputCreatePetInputStatus: MutationInputCreatePetInputStatus;
  String: ResolverTypeWrapper<Scalars['String']['output']>;
  Boolean: ResolverTypeWrapper<Scalars['Boolean']['output']>;
}>;

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = ResolversObject<{
  Query: Record<PropertyKey, never>;
  Int: Scalars['Int']['output'];
  Mutation: Record<PropertyKey, never>;
  PhaseMetrics: PhaseMetrics;
  Float: Scalars['Float']['output'];
  BenefitsBreakdown: BenefitsBreakdown;
  CumulativeRoi: CumulativeRoi;
  PerformanceGate: PerformanceGate;
  PhaseMetricsInput: PhaseMetricsInput;
  BenefitsBreakdownInput: BenefitsBreakdownInput;
  CumulativeRoiInput: CumulativeRoiInput;
  PerformanceGateInput: PerformanceGateInput;
  ObjMap: Scalars['ObjMap']['output'];
  ListPets_200Response: ListPets_200Response;
  Pet: Pet;
  NewPetInput: NewPetInput;
  String: Scalars['String']['output'];
  Boolean: Scalars['Boolean']['output'];
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
  phaseMetrics?: Resolver<Maybe<Array<Maybe<ResolversTypes['PhaseMetrics']>>>, ParentType, ContextType>;
  phaseMetricsByPhaseId?: Resolver<Maybe<ResolversTypes['PhaseMetrics']>, ParentType, ContextType, RequireFields<QueryphaseMetricsByPhaseIdArgs, 'phaseId'>>;
  benefitsBreakdown?: Resolver<Maybe<Array<Maybe<ResolversTypes['BenefitsBreakdown']>>>, ParentType, ContextType>;
  cumulativeRoi?: Resolver<Maybe<Array<Maybe<ResolversTypes['CumulativeRoi']>>>, ParentType, ContextType>;
  performanceGate?: Resolver<Maybe<Array<Maybe<ResolversTypes['PerformanceGate']>>>, ParentType, ContextType>;
  listPets?: Resolver<Maybe<ResolversTypes['ListPets_200Response']>, ParentType, ContextType, RequireFields<QuerylistPetsArgs, 'limit'>>;
  getPet?: Resolver<Maybe<ResolversTypes['Pet']>, ParentType, ContextType, RequireFields<QuerygetPetArgs, 'petId'>>;
}>;

export type MutationResolvers<ContextType = MeshContext, ParentType extends ResolversParentTypes['Mutation'] = ResolversParentTypes['Mutation']> = ResolversObject<{
  postPhaseMetrics?: Resolver<Maybe<ResolversTypes['PhaseMetrics']>, ParentType, ContextType, Partial<MutationpostPhaseMetricsArgs>>;
  putPhaseMetricsByPhaseId?: Resolver<Maybe<ResolversTypes['PhaseMetrics']>, ParentType, ContextType, RequireFields<MutationputPhaseMetricsByPhaseIdArgs, 'phaseId'>>;
  postBenefitsBreakdown?: Resolver<Maybe<ResolversTypes['BenefitsBreakdown']>, ParentType, ContextType, Partial<MutationpostBenefitsBreakdownArgs>>;
  postCumulativeRoi?: Resolver<Maybe<ResolversTypes['CumulativeRoi']>, ParentType, ContextType, Partial<MutationpostCumulativeRoiArgs>>;
  postPerformanceGate?: Resolver<Maybe<ResolversTypes['PerformanceGate']>, ParentType, ContextType, Partial<MutationpostPerformanceGateArgs>>;
  createPet?: Resolver<Maybe<ResolversTypes['Pet']>, ParentType, ContextType, Partial<MutationcreatePetArgs>>;
}>;

export type PhaseMetricsResolvers<ContextType = MeshContext, ParentType extends ResolversParentTypes['PhaseMetrics'] = ResolversParentTypes['PhaseMetrics']> = ResolversObject<{
  phaseId?: Resolver<ResolversTypes['QueryPhaseMetricsItemsPhaseId'], ParentType, ContextType>;
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
  phaseId?: Resolver<ResolversTypes['QueryBenefitsBreakdownItemsPhaseId'], ParentType, ContextType>;
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

export interface ObjMapScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['ObjMap'], any> {
  name: 'ObjMap';
}

export type ListPets_200ResponseResolvers<ContextType = MeshContext, ParentType extends ResolversParentTypes['ListPets_200Response'] = ResolversParentTypes['ListPets_200Response']> = ResolversObject<{
  items?: Resolver<Maybe<Array<Maybe<ResolversTypes['Pet']>>>, ParentType, ContextType>;
}>;

export type PetResolvers<ContextType = MeshContext, ParentType extends ResolversParentTypes['Pet'] = ResolversParentTypes['Pet']> = ResolversObject<{
  id?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  status?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  tag?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
}>;

export type Resolvers<ContextType = MeshContext> = ResolversObject<{
  Query?: QueryResolvers<ContextType>;
  Mutation?: MutationResolvers<ContextType>;
  PhaseMetrics?: PhaseMetricsResolvers<ContextType>;
  BenefitsBreakdown?: BenefitsBreakdownResolvers<ContextType>;
  CumulativeRoi?: CumulativeRoiResolvers<ContextType>;
  PerformanceGate?: PerformanceGateResolvers<ContextType>;
  ObjMap?: GraphQLScalarType;
  ListPets_200Response?: ListPets_200ResponseResolvers<ContextType>;
  Pet?: PetResolvers<ContextType>;
}>;

export type DirectiveResolvers<ContextType = MeshContext> = ResolversObject<{
  enum?: enumDirectiveResolver<any, any, ContextType>;
  httpOperation?: httpOperationDirectiveResolver<any, any, ContextType>;
  transport?: transportDirectiveResolver<any, any, ContextType>;
}>;

export type MeshContext = AnalysisApiTypes.Context & PetStoreApiTypes.Context & BaseMeshContext;


const baseDir = pathModule.join(typeof __dirname === 'string' ? __dirname : '/', '..');

const importFn: ImportFn = <T>(moduleId: string) => {
  const relativeModuleId = (pathModule.isAbsolute(moduleId) ? pathModule.relative(baseDir, moduleId) : moduleId).split('\\').join('/').replace(baseDir + '/', '');
  switch(relativeModuleId) {
    case ".mesh/sources/AnalysisAPI/schemaWithAnnotations":
      return import("./sources/AnalysisAPI/schemaWithAnnotations") as T;
    
    case ".mesh/sources/PetStoreAPI/schemaWithAnnotations":
      return import("./sources/PetStoreAPI/schemaWithAnnotations") as T;
    
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
const analysisApiTransforms = [];
const petStoreApiTransforms = [];
const additionalTypeDefs = [] as any[];
const AnalysisApiHandler = await import("@graphql-mesh/openapi").then(handleImport);
const analysisApiHandler = new AnalysisApiHandler({
              name: "AnalysisAPI",
              config: {"source":"./cost-benefit-api.yaml","operationHeaders":{"Authorization":"Bearer {context.jwt}","X-Request-ID":"{context.requestId}","X-User-ID":"{context.userId}"}},
              baseDir,
              cache,
              pubsub,
              store: sourcesStore.child("AnalysisAPI"),
              logger: logger.child({ source: "AnalysisAPI" }),
              importFn,
            });
const PetStoreApiHandler = await import("@graphql-mesh/openapi").then(handleImport);
const petStoreApiHandler = new PetStoreApiHandler({
              name: "PetStoreAPI",
              config: {"source":"./pet-store-api.yaml","operationHeaders":{"Authorization":"Bearer {context.jwt}"}},
              baseDir,
              cache,
              pubsub,
              store: sourcesStore.child("PetStoreAPI"),
              logger: logger.child({ source: "PetStoreAPI" }),
              importFn,
            });
sources[0] = {
          name: 'AnalysisAPI',
          handler: analysisApiHandler,
          transforms: analysisApiTransforms
        }
sources[1] = {
          name: 'PetStoreAPI',
          handler: petStoreApiHandler,
          transforms: petStoreApiTransforms
        }
const RootTransform_0 = await import("@graphql-mesh/transform-naming-convention").then(handleImport);
transforms[0] = new RootTransform_0({
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
  "ttl": 300000
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
    });
  }
  return meshInstance$;
}

export const execute: ExecuteMeshFn = (...args) => getBuiltMesh().then(({ execute }) => execute(...args));

export const subscribe: SubscribeMeshFn = (...args) => getBuiltMesh().then(({ subscribe }) => subscribe(...args));