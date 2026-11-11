/**
 * The source reading `decompose:port` needs (ADR-126), as pure functions over
 * file text. The TypeScript compiler is passed in, as everywhere in
 * `src/decompose/source/`, so this module costs nothing until a port runs.
 *
 * Paths are repository-relative to the monolith (`src/App.tsx`), the same
 * spelling `decomposition.yaml` uses.
 */

import * as path from 'path';
import type * as TS from 'typescript';

export type Ts = typeof TS;
/** A file's text by repository-relative path, or undefined when it does not exist. */
export type Read = (file: string) => string | undefined;

const EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js'];

export interface ImportDecl {
  spec: string;
  /** Local names the declaration binds. */
  names: string[];
  defaultName?: string;
  /** `{ imported: local }` for named bindings. */
  named: Array<{ imported: string; local: string }>;
  start: number;
  end: number;
  text: string;
}

export interface ReExport {
  spec: string;
  /** `exported → imported` (`default` for `export { default as X }`); `*` for `export *`. */
  map: Array<{ exported: string; imported: string }>;
  star: boolean;
}

const parse = (ts: Ts, file: string, text: string): TS.SourceFile =>
  ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);

export function importsOf(ts: Ts, file: string, text: string): ImportDecl[] {
  const sf = parse(ts, file, text);
  const out: ImportDecl[] = [];
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st) || !ts.isStringLiteral(st.moduleSpecifier)) continue;
    const clause = st.importClause;
    const named: ImportDecl['named'] = [];
    let defaultName: string | undefined;
    const names: string[] = [];
    if (clause?.name) {
      defaultName = clause.name.text;
      names.push(defaultName);
    }
    const nb = clause?.namedBindings;
    if (nb && ts.isNamespaceImport(nb)) names.push(nb.name.text);
    if (nb && ts.isNamedImports(nb)) {
      for (const el of nb.elements) {
        named.push({ imported: (el.propertyName ?? el.name).text, local: el.name.text });
        names.push(el.name.text);
      }
    }
    out.push({ spec: st.moduleSpecifier.text, names, defaultName, named, start: st.getStart(sf), end: st.getEnd(), text: st.getText(sf) });
  }
  return out;
}

/** Module specifiers a file re-exports from, and `export { … } from` / `export *` bindings. */
export function reExportsOf(ts: Ts, file: string, text: string): ReExport[] {
  const sf = parse(ts, file, text);
  const out: ReExport[] = [];
  for (const st of sf.statements) {
    if (!ts.isExportDeclaration(st) || !st.moduleSpecifier || !ts.isStringLiteral(st.moduleSpecifier)) continue;
    const clause = st.exportClause;
    out.push({
      spec: st.moduleSpecifier.text,
      star: !clause,
      map: clause && ts.isNamedExports(clause) ? clause.elements.map((e) => ({ exported: e.name.text, imported: (e.propertyName ?? e.name).text })) : [],
    });
  }
  return out;
}

/** Resolve a relative specifier from a file to an existing repository-relative path. */
export function resolveRelative(from: string, spec: string, read: Read): string | undefined {
  if (!spec.startsWith('.')) return undefined;
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(from), spec));
  const candidates = [base, ...EXTENSIONS.map((e) => base + e), ...EXTENSIONS.map((e) => `${base}/index${e}`)];
  return candidates.find((c) => EXTENSIONS.some((e) => c.endsWith(e)) && read(c) !== undefined);
}

/** The bare package a specifier names (`@scope/pkg/sub` → `@scope/pkg`). */
export function packageOf(spec: string): string | undefined {
  if (spec.startsWith('.') || spec.startsWith('/')) return undefined;
  const parts = spec.split('/');
  return spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

/** Every file reachable from `entries` over relative imports and re-exports, and the packages they use. */
export function closure(ts: Ts, entries: string[], read: Read): { files: string[]; packages: string[] } {
  const seen = new Set<string>();
  const packages = new Set<string>();
  const queue = [...entries];
  while (queue.length > 0) {
    const file = queue.shift() as string;
    if (seen.has(file)) continue;
    const text = read(file);
    if (text === undefined) continue;
    seen.add(file);
    const specs = [...importsOf(ts, file, text).map((i) => i.spec), ...reExportsOf(ts, file, text).map((r) => r.spec)];
    for (const spec of specs) {
      const pkg = packageOf(spec);
      if (pkg) packages.add(pkg);
      const target = resolveRelative(file, spec, read);
      if (target && !seen.has(target)) queue.push(target);
    }
  }
  return { files: [...seen].sort(), packages: [...packages].sort() };
}

/**
 * The file that finally declares `exported` of `file`, following re-exports and
 * `export default <imported identifier>` a few hops. Undefined when it leaves
 * the app (a package) or cannot be followed.
 */
export function declaringFile(ts: Ts, file: string, exported: string, read: Read, depth = 0): string | undefined {
  const text = read(file);
  if (text === undefined || depth > 5) return undefined;
  for (const r of reExportsOf(ts, file, text)) {
    const hit = r.map.find((m) => m.exported === exported);
    const target = resolveRelative(file, r.spec, read);
    if (hit && target) return declaringFile(ts, target, hit.imported, read, depth + 1);
  }
  const sf = parse(ts, file, text);
  for (const st of sf.statements) {
    // `export default Ident` where Ident is imported: follow it.
    if (exported === 'default' && ts.isExportAssignment(st) && !st.isExportEquals && ts.isIdentifier(st.expression)) {
      const local = st.expression.text;
      const imp = importsOf(ts, file, text).find((i) => i.names.includes(local));
      const target = imp && resolveRelative(file, imp.spec, read);
      if (imp && target) {
        const imported = imp.defaultName === local ? 'default' : imp.named.find((n) => n.local === local)?.imported;
        if (imported) return declaringFile(ts, target, imported, read, depth + 1);
      }
    }
  }
  return file;
}

/** Whether a file exports `name` by name (otherwise a component is reached through its default export). */
export function exportsByName(ts: Ts, file: string, text: string, name: string): boolean {
  const sf = parse(ts, file, text);
  const has = (mods: readonly TS.ModifierLike[] | undefined, kind: TS.SyntaxKind) => mods?.some((m) => m.kind === kind) ?? false;
  for (const st of sf.statements) {
    const mods = ts.canHaveModifiers(st) ? ts.getModifiers(st) : undefined;
    const exported = has(mods, ts.SyntaxKind.ExportKeyword) && !has(mods, ts.SyntaxKind.DefaultKeyword);
    if (exported && (ts.isFunctionDeclaration(st) || ts.isClassDeclaration(st)) && st.name?.text === name) return true;
    if (exported && ts.isVariableStatement(st) && st.declarationList.declarations.some((d) => ts.isIdentifier(d.name) && d.name.text === name)) return true;
    if (ts.isExportDeclaration(st) && !st.moduleSpecifier && st.exportClause && ts.isNamedExports(st.exportClause)) {
      if (st.exportClause.elements.some((e) => e.name.text === name)) return true;
    }
  }
  return false;
}

export interface ProviderTree {
  /** The JSX the entry renders, with the root element replaced by `__CHILD__`. */
  jsx: string;
  /** Import declarations the JSX needs, as written in the entry. */
  imports: ImportDecl[];
}

/**
 * What the monolith's entry renders around its root (ADR-126 §2): the
 * argument of its `.render(...)` call, with the element for `rootName` cut out.
 */
export function providerTree(ts: Ts, entry: string, text: string, rootName: string): ProviderTree | undefined {
  const sf = parse(ts, entry, text);
  let found: ProviderTree | undefined;
  const visit = (node: TS.Node): void => {
    if (found) return;
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'render' && node.arguments.length > 0) {
      const arg = node.arguments[0];
      let root: TS.Node | undefined;
      const tags = new Set<string>();
      const walk = (n: TS.Node): void => {
        if (ts.isJsxSelfClosingElement(n) || ts.isJsxOpeningElement(n)) {
          const tag = n.tagName.getText(sf);
          if (tag === rootName && ts.isJsxSelfClosingElement(n)) root = n;
          else tags.add(tag.split('.')[0]);
        }
        ts.forEachChild(n, walk);
      };
      walk(arg);
      if (root) {
        const argText = arg.getText(sf);
        const offset = arg.getStart(sf);
        const jsx = argText.slice(0, root.getStart(sf) - offset) + '__CHILD__' + argText.slice(root.getEnd() - offset);
        const imports = importsOf(ts, entry, text).filter((i) => i.names.some((n) => tags.has(n)));
        found = { jsx, imports };
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

/** A `<Routes>` block, its routes' paths and the component each renders. */
export interface RoutesBlock {
  start: number;
  end: number;
  routes: Array<{ path: string | null; element: string | null }>;
}

export function routesBlocks(ts: Ts, file: string, text: string): RoutesBlock[] {
  const sf = parse(ts, file, text);
  const blocks: RoutesBlock[] = [];
  const attr = (el: TS.JsxOpeningLikeElement, name: string): TS.JsxAttribute | undefined =>
    el.attributes.properties.find((p): p is TS.JsxAttribute => ts.isJsxAttribute(p) && p.name.getText(sf) === name);
  const visit = (node: TS.Node): void => {
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(sf) === 'Routes') {
      const routes: RoutesBlock['routes'] = [];
      for (const child of node.children) {
        const el = ts.isJsxSelfClosingElement(child) ? child : ts.isJsxElement(child) ? child.openingElement : undefined;
        if (!el || el.tagName.getText(sf) !== 'Route') continue;
        const p = attr(el, 'path')?.initializer;
        const e = attr(el, 'element')?.initializer;
        let element: string | null = null;
        if (e && ts.isJsxExpression(e) && e.expression && (ts.isJsxSelfClosingElement(e.expression) || ts.isJsxElement(e.expression))) {
          const opening = ts.isJsxElement(e.expression) ? e.expression.openingElement : e.expression;
          element = opening.tagName.getText(sf);
        }
        routes.push({ path: p && ts.isStringLiteral(p) ? p.text : null, element });
      }
      blocks.push({ start: node.getStart(sf), end: node.getEnd(), routes });
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return blocks;
}

/** Drop import declarations none of whose bindings the rest of the file still uses. */
export function pruneUnusedImports(ts: Ts, file: string, text: string): string {
  const decls = importsOf(ts, file, text).filter((d) => d.names.length > 0);
  let out = text;
  for (const d of [...decls].reverse()) {
    const rest = out.slice(0, d.start) + out.slice(d.end);
    const used = d.names.some((n) => n === 'React' || new RegExp(`\\b${n}\\b`).test(rest));
    if (!used) out = out.slice(0, d.start) + out.slice(d.end).replace(/^\r?\n/, '');
  }
  return out;
}
