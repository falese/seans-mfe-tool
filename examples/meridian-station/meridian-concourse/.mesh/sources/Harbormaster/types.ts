// @ts-nocheck

import type { InContextSdkMethod } from '@graphql-mesh/types';

export namespace HarbormasterTypes {
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
  /** List berths */
  list_berths?: Maybe<Array<Maybe<berth>>>;
  /** Get one berth */
  get_berth?: Maybe<berth>;
  /** List dockings */
  list_dockings?: Maybe<Array<Maybe<docking>>>;
  /** Get one docking */
  get_docking?: Maybe<docking>;
  /** List cargo manifest lines (customs filing headers) */
  list_manifest_lines?: Maybe<Array<Maybe<manifest_line>>>;
  /** List registered vessels */
  list_vessels?: Maybe<Array<Maybe<vessel>>>;
  /** Get one vessel by registry number */
  get_vessel?: Maybe<vessel>;
};


export type Querylist_berthsArgs = {
  berth_class?: InputMaybe<Scalars['String']['input']>;
  occupied_flag?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
};


export type Queryget_berthArgs = {
  berth_id: Scalars['String']['input'];
};


export type Querylist_dockingsArgs = {
  berth_id?: InputMaybe<Scalars['String']['input']>;
  status_code?: InputMaybe<Scalars['String']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
};


export type Queryget_dockingArgs = {
  docking_id: Scalars['Int']['input'];
};


export type Querylist_manifest_linesArgs = {
  docking_id?: InputMaybe<Scalars['Int']['input']>;
  hazard_class?: InputMaybe<Scalars['String']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
};


export type Querylist_vesselsArgs = {
  operator_name?: InputMaybe<Scalars['String']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
};


export type Queryget_vesselArgs = {
  vessel_registry_no: Scalars['String']['input'];
};

export type berth = {
  berth_id?: Maybe<Scalars['String']['output']>;
  /** light_personnel | medium_freight | heavy_bulk */
  berth_class?: Maybe<Scalars['String']['output']>;
  /** 0 or 1 — booleans were added to the schema language after this system shipped */
  occupied_flag?: Maybe<Scalars['Int']['output']>;
  max_mass_kg?: Maybe<Scalars['Float']['output']>;
  current_docking_id?: Maybe<Scalars['Int']['output']>;
};

export type docking = {
  docking_id?: Maybe<Scalars['Int']['output']>;
  berth_id?: Maybe<Scalars['String']['output']>;
  vessel_registry_no?: Maybe<Scalars['String']['output']>;
  eta_utc?: Maybe<Scalars['DateTime']['output']>;
  departed_utc?: Maybe<Scalars['DateTime']['output']>;
  /** SCHEDULED | APPROACH | DOCKED | DEPARTED | ABORTED */
  status_code?: Maybe<Scalars['String']['output']>;
};

export type manifest_line = {
  line_id?: Maybe<Scalars['Int']['output']>;
  docking_id?: Maybe<Scalars['Int']['output']>;
  sku?: Maybe<Scalars['String']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  qty?: Maybe<Scalars['Int']['output']>;
  declared_mass_kg?: Maybe<Scalars['Float']['output']>;
  /** NONE | CRYO | CORROSIVE | RADIOLOGICAL | BIO */
  hazard_class?: Maybe<Scalars['String']['output']>;
};

export type vessel = {
  vessel_registry_no?: Maybe<Scalars['String']['output']>;
  vessel_name?: Maybe<Scalars['String']['output']>;
  operator_name?: Maybe<Scalars['String']['output']>;
  max_capacity_kg?: Maybe<Scalars['Float']['output']>;
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
      /** List berths **/

  list_berths: InContextSdkMethod<Query['list_berths'], Querylist_berthsArgs, BaseMeshContext>,
  /** Get one berth **/

  get_berth: InContextSdkMethod<Query['get_berth'], Queryget_berthArgs, BaseMeshContext>,
  /** List dockings **/

  list_dockings: InContextSdkMethod<Query['list_dockings'], Querylist_dockingsArgs, BaseMeshContext>,
  /** Get one docking **/

  get_docking: InContextSdkMethod<Query['get_docking'], Queryget_dockingArgs, BaseMeshContext>,
  /** List cargo manifest lines (customs filing headers) **/

  list_manifest_lines: InContextSdkMethod<Query['list_manifest_lines'], Querylist_manifest_linesArgs, BaseMeshContext>,
  /** List registered vessels **/

  list_vessels: InContextSdkMethod<Query['list_vessels'], Querylist_vesselsArgs, BaseMeshContext>,
  /** Get one vessel by registry number **/

  get_vessel: InContextSdkMethod<Query['get_vessel'], Queryget_vesselArgs, BaseMeshContext>
  };

  export type MutationSdk = {
    
  };

  export type SubscriptionSdk = {
    
  };

  export type Context = {
      ["Harbormaster"]: { Query: QuerySdk, Mutation: MutationSdk, Subscription: SubscriptionSdk },
      
    };
}
