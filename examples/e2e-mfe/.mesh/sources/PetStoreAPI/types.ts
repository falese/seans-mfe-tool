// @ts-nocheck

import { InContextSdkMethod } from '@graphql-mesh/types';
import { MeshContext } from '@graphql-mesh/runtime';

export namespace PetStoreApiTypes {
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
  Float: { input: number; output: number; }
  ObjMap: { input: any; output: any; }
};

export type Query = {
  /** List all pets */
  listPets?: Maybe<listPets_200_response>;
  /** Get pet by id */
  getPet?: Maybe<Pet>;
};


export type QuerylistPetsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
};


export type QuerygetPetArgs = {
  petId: Scalars['String']['input'];
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

export type Mutation = {
  /** Create a pet */
  createPet?: Maybe<Pet>;
};


export type MutationcreatePetArgs = {
  input?: InputMaybe<NewPet_Input>;
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

  export type QuerySdk = {
      /** List all pets **/
  listPets: InContextSdkMethod<Query['listPets'], QuerylistPetsArgs, MeshContext>,
  /** Get pet by id **/
  getPet: InContextSdkMethod<Query['getPet'], QuerygetPetArgs, MeshContext>
  };

  export type MutationSdk = {
      /** Create a pet **/
  createPet: InContextSdkMethod<Mutation['createPet'], MutationcreatePetArgs, MeshContext>
  };

  export type SubscriptionSdk = {
    
  };

  export type Context = {
      ["PetStoreAPI"]: { Query: QuerySdk, Mutation: MutationSdk, Subscription: SubscriptionSdk },
      
    };
}
