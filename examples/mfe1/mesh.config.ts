/**
 * ⚠️ GENERATED FILE - DO NOT EDIT MANUALLY ⚠️
 *
 * Source: mfe-manifest.yaml
 * Generated: 2025-12-23T01:01:57.915Z
 * Tool: seans-mfe-tool (ADR-063: TypeScript Mesh Configuration)
 * Command: seans-mfe-tool remote:generate
 *
 * This file is tracked in git to enable:
 * - PR reviews of generated code
 * - Debugging and git bisect
 * - CI/CD without pre-build generation
 *
 * To modify: Update mfe-manifest.yaml data: section and regenerate
 */
import { getMesh, MeshResolvedSource } from '@graphql-mesh/runtime';
import GraphQLHandler from '@graphql-mesh/graphql';
import OpenapiHandler from '@graphql-mesh/openapi';
import JsonSchemaHandler from '@graphql-mesh/json-schema';
import { DefaultLogger, createLruCache } from '@graphql-mesh/utils';
import StitchingMerger from '@graphql-mesh/merger-stitching';
import { MeshStore, InMemoryStoreStorageAdapter } from '@graphql-mesh/store';
import type { MeshInstance } from '@graphql-mesh/runtime';

// Create logger with child method
const logger = new DefaultLogger('mfe1');

// Create store and cache
const store = new MeshStore('.mesh', new InMemoryStoreStorageAdapter(), {
  readonly: false,
  validate: false,
});

const cache = createLruCache();

// Wrap cache to add missing method - must preserve all methods
const wrappedCache: any = {
  get: cache.get.bind(cache),
  set: cache.set.bind(cache),
  delete: cache.delete.bind(cache),
  getKeysByPrefix: async (prefix: string) => [] as string[],
};

// Define sources
const sources: MeshResolvedSource[] = [
  {
    name: 'SpaceXAPI',
    handler: new GraphQLHandler({
      name: 'SpaceXAPI',
      config: {
        endpoint: 'https://spacex-production.up.railway.app/',
        operationHeaders: {
          "Content-Type": "application/json"
        },
      },
      baseDir: __dirname,
      cache: wrappedCache,
      pubsub: undefined as any,
      store,
      logger: new DefaultLogger('SpaceXAPI'),
      importFn: undefined as any,
    }),
  },
  {
    name: 'JSONPlaceholder',
    handler: new JsonSchemaHandler({
      name: 'JSONPlaceholder',
      config: {
        endpoint: 'https://jsonplaceholder.typicode.com',
        operations: [
          {
            "field": "getUsers",
            "path": "/users",
            "method": "GET",
            "type": "Query",
            "responseSchema": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "id": {
                    "type": "integer"
                  },
                  "name": {
                    "type": "string"
                  },
                  "username": {
                    "type": "string"
                  },
                  "email": {
                    "type": "string"
                  },
                  "phone": {
                    "type": "string"
                  },
                  "website": {
                    "type": "string"
                  }
                }
              }
            }
          },
          {
            "field": "getUser",
            "path": "/users/{args.id}",
            "method": "GET",
            "type": "Query"
          },
          {
            "field": "getPosts",
            "path": "/posts",
            "method": "GET",
            "type": "Query"
          },
          {
            "field": "createPost",
            "path": "/posts",
            "method": "POST",
            "type": "Mutation"
          }
        ],
      },
      baseDir: __dirname,
      cache: wrappedCache,
      pubsub: undefined as any,
      store,
      logger: new DefaultLogger('JSONPlaceholder'),
      importFn: undefined as any,
    }),
    // TODO: Transforms need to be instantiated as transform classes, not plain objects
    // transforms: [...],
  },
  {
    name: 'ReqResAPI',
    handler: new JsonSchemaHandler({
      name: 'ReqResAPI',
      config: {
        endpoint: 'https://reqres.in/api',
        operations: [
          {
            "field": "listUsers",
            "path": "/users",
            "method": "GET",
            "type": "Query"
          },
          {
            "field": "getUser",
            "path": "/users/{args.id}",
            "method": "GET",
            "type": "Query"
          },
          {
            "field": "createUser",
            "path": "/users",
            "method": "POST",
            "type": "Mutation"
          }
        ],
      },
      baseDir: __dirname,
      cache: wrappedCache,
      pubsub: undefined as any,
      store,
      logger: new DefaultLogger('ReqResAPI'),
      importFn: undefined as any,
    }),
  }
];

// Export getMeshOptions for server initialization
export async function getMeshOptions() {
  return {
    sources,
    merger: new StitchingMerger({
      store,
      logger,
      cache: wrappedCache,
      pubsub: undefined as any,
    }),
    cache: wrappedCache,
    logger,
  };
}

// Also export sources for direct use if needed
export { sources };
