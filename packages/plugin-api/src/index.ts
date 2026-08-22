/**
 * @seans-mfe/plugin-api — OpenAPI -> Express + MongoDB/SQLite backend
 * generation, as an oclif plugin.
 *
 * ADR-063: API-backend generation is a plugin axis, not part of the platform
 * core. The platform's job is domain-capability MFEs; generating a REST
 * backend from a spec is a different product that happens to be useful
 * alongside it.
 */
export * from './types';
