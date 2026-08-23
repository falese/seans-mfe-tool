/**
 * @seans-mfe/plugin-adr — ADR library governance as an oclif plugin.
 *
 * ADR-075 made the decision record itself drift-controlled: frontmatter is the
 * single source of truth, the spec index and PDR map are generated views under
 * a diff gate, and a rule set makes stale cross-references and free-text
 * statuses unrepresentable rather than merely noticeable.
 *
 * None of that is about micro-frontends, which is why it is a plugin: any repo
 * that keeps ADRs can use it, and the platform core does not carry it.
 */
export * from './adr-index';
export { adrValidateCommand } from './commands/adr/validate';
export { adrStatusCommand } from './commands/adr/status';
