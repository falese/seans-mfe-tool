// @ts-nocheck

import { InContextSdkMethod } from '@graphql-mesh/types';
import { MeshContext } from '@graphql-mesh/runtime';

export namespace UserApiTypes {
  export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
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


export type Queryphase_metrics_by_phaseIdArgs = {
  phaseId: Scalars['String']['input'];
};

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

export type Mutation = {
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
      /** Get all phase metrics **/
  phase_metrics: InContextSdkMethod<Query['phase_metrics'], {}, MeshContext>,
  /** Get phase metrics by ID **/
  phase_metrics_by_phaseId: InContextSdkMethod<Query['phase_metrics_by_phaseId'], Queryphase_metrics_by_phaseIdArgs, MeshContext>,
  /** Get all benefits breakdown data **/
  benefits_breakdown: InContextSdkMethod<Query['benefits_breakdown'], {}, MeshContext>,
  /** Get all cumulative ROI data **/
  cumulative_roi: InContextSdkMethod<Query['cumulative_roi'], {}, MeshContext>,
  /** Get all performance gate metrics **/
  performance_gate: InContextSdkMethod<Query['performance_gate'], {}, MeshContext>
  };

  export type MutationSdk = {
      /** Create new phase metrics **/
  post_phase_metrics: InContextSdkMethod<Mutation['post_phase_metrics'], Mutationpost_phase_metricsArgs, MeshContext>,
  /** Update phase metrics **/
  put_phase_metrics_by_phaseId: InContextSdkMethod<Mutation['put_phase_metrics_by_phaseId'], Mutationput_phase_metrics_by_phaseIdArgs, MeshContext>,
  /** Create new benefits breakdown entry **/
  post_benefits_breakdown: InContextSdkMethod<Mutation['post_benefits_breakdown'], Mutationpost_benefits_breakdownArgs, MeshContext>,
  /** Create new cumulative ROI entry **/
  post_cumulative_roi: InContextSdkMethod<Mutation['post_cumulative_roi'], Mutationpost_cumulative_roiArgs, MeshContext>,
  /** Create new performance gate entry **/
  post_performance_gate: InContextSdkMethod<Mutation['post_performance_gate'], Mutationpost_performance_gateArgs, MeshContext>
  };

  export type SubscriptionSdk = {
    
  };

  export type Context = {
      ["UserAPI"]: { Query: QuerySdk, Mutation: MutationSdk, Subscription: SubscriptionSdk },
      
    };
}
