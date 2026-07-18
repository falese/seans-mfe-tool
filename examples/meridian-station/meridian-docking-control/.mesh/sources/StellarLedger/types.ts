// @ts-nocheck

import type { InContextSdkMethod } from '@graphql-mesh/types';

export namespace StellarLedgerTypes {
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
  Float: { input: number; output: number; }
  /** Represents date values */
  Date: { input: string; output: string; }
  ObjMap: { input: unknown; output: unknown; }
};

export type Query = {
  /** List accounts */
  listAccounts?: Maybe<listAccounts_200_response>;
  /** Get one account */
  getAccount?: Maybe<account>;
  /** List tariff charges */
  listCharges?: Maybe<listCharges_200_response>;
  /** List cargo line valuations */
  listValuations?: Maybe<listValuations_200_response>;
  /** List merchant settlements */
  listSettlements?: Maybe<listSettlements_200_response>;
  /** List crew payroll records */
  listPayroll?: Maybe<listPayroll_200_response>;
  charges?: Maybe<Array<Maybe<charge>>>;
  valuations?: Maybe<Array<Maybe<valuation>>>;
  accounts?: Maybe<Array<Maybe<account>>>;
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

export type listAccounts_200_response = {
  meta?: Maybe<query_listAccounts_meta>;
};

export type account = {
  accountId?: Maybe<Scalars['String']['output']>;
  displayName?: Maybe<Scalars['String']['output']>;
  /** OPERATOR | MERCHANT | CREW */
  accountType?: Maybe<Scalars['String']['output']>;
  /** GOOD | DELINQUENT | FROZEN */
  standing?: Maybe<Scalars['String']['output']>;
  balanceCents?: Maybe<Scalars['Int']['output']>;
  currency?: Maybe<Scalars['String']['output']>;
};

export type query_listAccounts_meta = {
  cursor?: Maybe<Scalars['String']['output']>;
  hasMore?: Maybe<Scalars['Boolean']['output']>;
};

export type listCharges_200_response = {
  meta?: Maybe<query_listCharges_meta>;
};

export type charge = {
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

export type query_listCharges_meta = {
  cursor?: Maybe<Scalars['String']['output']>;
  hasMore?: Maybe<Scalars['Boolean']['output']>;
};

export type listValuations_200_response = {
  meta?: Maybe<query_listValuations_meta>;
};

export type valuation = {
  valuationId?: Maybe<Scalars['String']['output']>;
  manifestLineRef?: Maybe<Scalars['String']['output']>;
  declaredValueCents?: Maybe<Scalars['Int']['output']>;
  currency?: Maybe<Scalars['String']['output']>;
  /** STANDARD | SPECIALIZED | UNINSURABLE */
  insuranceClass?: Maybe<Scalars['String']['output']>;
};

export type query_listValuations_meta = {
  cursor?: Maybe<Scalars['String']['output']>;
  hasMore?: Maybe<Scalars['Boolean']['output']>;
};

export type listSettlements_200_response = {
  result?: Maybe<Array<Maybe<settlement>>>;
  meta?: Maybe<query_listSettlements_meta>;
};

export type settlement = {
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

export type query_listSettlements_meta = {
  cursor?: Maybe<Scalars['String']['output']>;
  hasMore?: Maybe<Scalars['Boolean']['output']>;
};

export type listPayroll_200_response = {
  result?: Maybe<Array<Maybe<payroll>>>;
  meta?: Maybe<query_listPayroll_meta>;
};

export type payroll = {
  payrollId?: Maybe<Scalars['String']['output']>;
  crewRef?: Maybe<Scalars['String']['output']>;
  periodEnd?: Maybe<Scalars['Date']['output']>;
  grossCents?: Maybe<Scalars['Int']['output']>;
  /** SCHEDULED | PAID | HELD */
  status?: Maybe<Scalars['String']['output']>;
};

export type query_listPayroll_meta = {
  cursor?: Maybe<Scalars['String']['output']>;
  hasMore?: Maybe<Scalars['Boolean']['output']>;
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
      /** List accounts **/

  listAccounts: InContextSdkMethod<Query['listAccounts'], QuerylistAccountsArgs, BaseMeshContext>,
  /** Get one account **/

  getAccount: InContextSdkMethod<Query['getAccount'], QuerygetAccountArgs, BaseMeshContext>,
  /** List tariff charges **/

  listCharges: InContextSdkMethod<Query['listCharges'], QuerylistChargesArgs, BaseMeshContext>,
  /** List cargo line valuations **/

  listValuations: InContextSdkMethod<Query['listValuations'], QuerylistValuationsArgs, BaseMeshContext>,
  /** List merchant settlements **/

  listSettlements: InContextSdkMethod<Query['listSettlements'], QuerylistSettlementsArgs, BaseMeshContext>,
  /** List crew payroll records **/

  listPayroll: InContextSdkMethod<Query['listPayroll'], QuerylistPayrollArgs, BaseMeshContext>,
  
  charges: InContextSdkMethod<Query['charges'], QuerychargesArgs, BaseMeshContext>,
  
  valuations: InContextSdkMethod<Query['valuations'], QueryvaluationsArgs, BaseMeshContext>,
  
  accounts: InContextSdkMethod<Query['accounts'], QueryaccountsArgs, BaseMeshContext>
  };

  export type MutationSdk = {
    
  };

  export type SubscriptionSdk = {
    
  };

  export type Context = {
      ["StellarLedger"]: { Query: QuerySdk, Mutation: MutationSdk, Subscription: SubscriptionSdk },
      
    };
}
