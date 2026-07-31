/**
 * React entry point — the framework-specialized abstract (ADR-056 layer 5).
 *
 * `RemoteMFE` produces a React native handle and therefore imports React, which
 * ADR-056 has always permitted for this layer. What it does not permit is that
 * import reaching consumers who did not ask for it, and re-exporting the class
 * from the main barrel did exactly that: any *value* import from
 * '@falese/smt-runtime' pulled React into the bundle, including in Angular
 * MFEs that have no React installed.
 *
 * The symmetry with `./angular` is the point. Each framework abstract sits
 * behind its own subpath; the barrel stays polyglot and carries only the
 * neutral core. A consumer opts into a framework by importing its entry point,
 * never by accident.
 *
 * Mirrors `angular.ts` exactly — if you add something here, ask whether the
 * Angular entry needs the counterpart.
 */

export { RemoteMFE } from './remote-mfe';
export type { ModuleFederationContainer } from './remote-mfe';
