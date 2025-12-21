/**
 * ⚠️ GENERATED FILE - DO NOT EDIT MANUALLY ⚠️
 *
 * Source: mfe-manifest.yaml
 * Generated: 2025-12-15T02:56:59.743Z * Tool: seans-mfe-tool (ADR-063: TypeScript Mesh Configuration v1.0)
 * Command: mfe bff:build
 *
 * This file is tracked in git to enable:
 * - PR reviews of generated code
 * - Debugging and git bisect
 * - CI/CD without pre-build generation
 *
 * To modify: Update mfe-manifest.yaml data: section and regenerate
 */
import type { GetMeshOptions, MeshResolvedSource } from '@graphql-mesh/runtime';
import OpenAPIHandler from '@graphql-mesh/openapi';
import JsonSchemaHandler from '@graphql-mesh/json-schema';
import GraphQLHandler from '@graphql-mesh/graphql';
import RenameTransform from '@graphql-mesh/transform-rename';
import NamingConventionTransform from '@graphql-mesh/transform-naming-convention';
import BareMerger from '@graphql-mesh/merger-bare';
import InMemoryLRUCache from '@graphql-mesh/cache-inmemory-lru';
import { DefaultLogger, PubSub } from '@graphql-mesh/utils';
import { InMemoryStoreStorageAdapter, MeshStore } from '@graphql-mesh/store';

// Initialize infrastructure
const cache = new InMemoryLRUCache();
const pubsub = new PubSub();
const logger = new DefaultLogger('Mesh');
const store = new MeshStore('.mesh', new InMemoryStoreStorageAdapter(), { readonly: false, validate: false });
const baseDir = process.cwd();

// Define sources with handlers (with error recovery)
const sources: MeshResolvedSource[] = [];
// GraphQL Handler: SpaceXAPI
try {
  sources.push({
    name: 'SpaceXAPI',
    handler: new GraphQLHandler({
      name: 'SpaceXAPI',
      config: {
        endpoint: 'https://spacex-production.up.railway.app/',
        operationHeaders: {
                  "Content-Type": "application/json"
        },
      },
      baseDir,
      store,
      pubsub,
      logger,
      importFn: (moduleId: string) => import(moduleId),
    } as any),
  });
} catch (error: unknown) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  logger.warn(`Failed to initialize GraphQL handler for SpaceXAPI: ${errorMessage}`);
}
// JSON Schema Handler: JSONPlaceholder
try {
  sources.push({
    name: 'JSONPlaceholder',
    handler: new JsonSchemaHandler({
      name: 'JSONPlaceholder',
      config: {
        endpoint: 'https://jsonplaceholder.typicode.com',
        operations: [
          {
            field: 'getUsers',
            path: '/users',
            method: 'GET',
            type: 'query',
            responseSchema: {"type":"array","items":{"type":"object","properties":{"id":{"type":"integer"},"name":{"type":"string"},"username":{"type":"string"},"email":{"type":"string"},"phone":{"type":"string"},"website":{"type":"string"}}}},
          },
          {
            field: 'getUser',
            path: '/users/{args.id}',
            method: 'GET',
            type: 'query',
          },
          {
            field: 'getPosts',
            path: '/posts',
            method: 'GET',
            type: 'query',
          },
          {
            field: 'createPost',
            path: '/posts',
            method: 'POST',
            type: 'mutation',
          }
        ],
      },
      baseDir,
      store,
      pubsub,
      logger,
      importFn: (moduleId: string) => import(moduleId),
    } as any),
  });
} catch (error: unknown) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  logger.warn(`Failed to initialize JSON Schema handler for JSONPlaceholder: ${errorMessage}`);
}
// JSON Schema Handler: ReqResAPI
try {
  sources.push({
    name: 'ReqResAPI',
    handler: new JsonSchemaHandler({
      name: 'ReqResAPI',
      config: {
        endpoint: 'https://reqres.in/api',
        operations: [
          {
            field: 'listUsers',
            path: '/users',
            method: 'GET',
            type: 'query',
          },
          {
            field: 'getUser',
            path: '/users/{args.id}',
            method: 'GET',
            type: 'query',
          },
          {
            field: 'createUser',
            path: '/users',
            method: 'POST',
            type: 'mutation',
          }
        ],
      },
      baseDir,
      store,
      pubsub,
      logger,
      importFn: (moduleId: string) => import(moduleId),
    } as any),
  });
} catch (error: unknown) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  logger.warn(`Failed to initialize JSON Schema handler for ReqResAPI: ${errorMessage}`);
}

if (sources.length === 0) {
  throw new Error('No data sources loaded successfully. Check your mfe-manifest.yaml data: section');
}

// Apply transforms to sources
// Transforms for JSONPlaceholder
try {
  const JSONPlaceholderTransforms = [];
  
  // Rename transform
  JSONPlaceholderTransforms.push(
    new RenameTransform({
      apiName: 'JSONPlaceholder',
      config: {
        mode: 'bare',
        renames: [
        {
                "from": {
                        "type": "query_getUsers_items",
                        "field": "email"
                },
                "to": {
                        "type": "query_getUsers_items",
                        "field": "assignedTo"
                }
        },
        {
                "from": {
                        "type": "query_getUsers_items",
                        "field": "username"
                },
                "to": {
                        "type": "query_getUsers_items",
                        "field": "handle"
                }
        }
],
      },
      baseDir,
      cache,
      pubsub,
      logger,
      importFn: (moduleId: string) => import(moduleId),
    } as any)
  );
  
  // Add transforms to source
  if (JSONPlaceholderTransforms.length > 0) {
    sources[1].transforms = JSONPlaceholderTransforms as any;
    logger.info(`✓ Applied ${JSONPlaceholderTransforms.length} transform(s) to JSONPlaceholder`);
  }
} catch (error: unknown) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  logger.warn(`Failed to apply transforms to JSONPlaceholder: ${errorMessage}`);
}

// Mesh configuration for getMesh()
export const meshConfig: GetMeshOptions = {
  sources,
  cache: cache as any,
  merger: new BareMerger({ cache: cache as any, pubsub: pubsub as any, logger: logger as any, store }) as any,
  logger: logger as any,
  pubsub: pubsub as any,
};

export default meshConfig;
