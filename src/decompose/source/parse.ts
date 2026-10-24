/**
 * Per-file source facts for `decompose:analyze` (ADR-109 §3, #414).
 *
 * One pass over a file's TypeScript AST records what later stages need and
 * nothing else: imports and re-exports (the import graph), exported names,
 * components, React Router routes, HTTP call sites with their URLs folded to
 * templates, calls between functions (to follow a URL through wrapper
 * functions), and the global-store pattern — which calls load which store
 * fields, and which fields a hook consumer reads.
 *
 * The TypeScript module is passed in rather than imported: it is a
 * development dependency of the CLI, loaded on demand (see `load-ts.ts`).
 */

import type * as TS from 'typescript';

export interface ImportFact {
  spec: string;
  /** `default`, `*` (namespace) or the exported name. */
  names: Array<{ imported: string; local: string }>;
  typeOnly: boolean;
}

export interface ReexportFact {
  spec: string;
  /** `*` for `export * from`. */
  names: Array<{ exported: string; imported: string }> | '*';
}

export interface RouteFact {
  path: string | null;
  /** The identifier of the element's component, or null for `element={null}`. */
  element: string | null;
  /** The landmark (`main`, `aside`, ...) or intrinsic tag around the `<Routes>`, if any. */
  container: string | null;
  line: number;
}

export interface HttpCallFact {
  method: string;
  /** URL template: literal text with `{param}` for a parameter and `{?}` for anything unresolved. */
  url: string;
  line: number;
}

export interface FunctionFact {
  name: string;
  params: string[];
  /** Calls to other functions by name, with arguments folded like URLs (null when not a string). */
  calls: Array<{ callee: string; args: Array<string | null> }>;
  http: HttpCallFact[];
}

export interface FileFacts {
  file: string;
  imports: ImportFact[];
  reexports: ReexportFact[];
  /** Exported name → local name (`default` for the default export). */
  exports: Record<string, string>;
  components: string[];
  routes: RouteFact[];
  /** Top-level functions; module-level code is the function `<module>`. */
  functions: FunctionFact[];
  /** `const [a, b] = await Promise.all([fa(), fb()])` and `const a = await fa()`. */
  storeLoads: Array<{ field: string; callee: string }>;
  /** Exported `use*` functions that return `useContext(...)`. */
  hooks: string[];
  /** `const { a, b } = useX()`. */
  hookReads: Array<{ hook: string; fields: string[] }>;
  /** Module-level code mounts the app (`createRoot`, `hydrateRoot`, `ReactDOM.render`): an entry point. */
  bootstraps: boolean;
}

const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options']);

export function parseFile(ts: typeof TS, file: string, text: string): FileFacts {
  const kind = /\.tsx$/.test(file) ? ts.ScriptKind.TSX : /\.jsx$/.test(file) ? ts.ScriptKind.JSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);
  const lineOf = (node: TS.Node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;

  const facts: FileFacts = {
    file,
    imports: [],
    reexports: [],
    exports: {},
    components: [],
    routes: [],
    functions: [],
    storeLoads: [],
    hooks: [],
    hookReads: [],
    bootstraps: false,
  };

  // Module-level consts, for folding `BASE.harbormaster` and friends.
  const consts = new Map<string, TS.Expression>();
  const httpClients = new Set<string>();
  let axiosName: string | null = null;

  const hasExport = (node: TS.Node) =>
    ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
  const hasDefault = (node: TS.Node) =>
    ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.DefaultKeyword);

  // ---- pass 1: module structure -------------------------------------------
  for (const stmt of sf.statements) {
    if (ts.isImportDeclaration(stmt) && ts.isStringLiteral(stmt.moduleSpecifier)) {
      const spec = stmt.moduleSpecifier.text;
      const clause = stmt.importClause;
      const names: ImportFact['names'] = [];
      if (clause?.name) names.push({ imported: 'default', local: clause.name.text });
      const bindings = clause?.namedBindings;
      if (bindings && ts.isNamespaceImport(bindings)) names.push({ imported: '*', local: bindings.name.text });
      if (bindings && ts.isNamedImports(bindings)) {
        for (const el of bindings.elements) {
          names.push({ imported: (el.propertyName ?? el.name).text, local: el.name.text });
        }
      }
      facts.imports.push({ spec, names, typeOnly: !!clause?.isTypeOnly });
      if (spec === 'axios' && clause?.name) axiosName = clause.name.text;
    } else if (ts.isExportDeclaration(stmt)) {
      if (stmt.moduleSpecifier && ts.isStringLiteral(stmt.moduleSpecifier)) {
        const spec = stmt.moduleSpecifier.text;
        if (!stmt.exportClause) facts.reexports.push({ spec, names: '*' });
        else if (ts.isNamedExports(stmt.exportClause)) {
          facts.reexports.push({
            spec,
            names: stmt.exportClause.elements.map((el) => ({
              exported: el.name.text,
              imported: (el.propertyName ?? el.name).text,
            })),
          });
        }
      } else if (stmt.exportClause && ts.isNamedExports(stmt.exportClause)) {
        for (const el of stmt.exportClause.elements) facts.exports[el.name.text] = (el.propertyName ?? el.name).text;
      }
    } else if (ts.isExportAssignment(stmt) && !stmt.isExportEquals) {
      facts.exports.default = ts.isIdentifier(stmt.expression) ? stmt.expression.text : '<expression>';
    } else if (ts.isFunctionDeclaration(stmt) && stmt.name) {
      if (hasExport(stmt)) facts.exports[hasDefault(stmt) ? 'default' : stmt.name.text] = stmt.name.text;
    } else if (ts.isClassDeclaration(stmt) && stmt.name && hasExport(stmt)) {
      facts.exports[hasDefault(stmt) ? 'default' : stmt.name.text] = stmt.name.text;
    } else if (ts.isVariableStatement(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name)) continue;
        if (hasExport(stmt)) facts.exports[decl.name.text] = decl.name.text;
        if (decl.initializer) consts.set(decl.name.text, decl.initializer);
      }
    }
  }
  for (const [name, init] of consts) {
    // `const http = axios.create(...)`: an axios instance.
    if (
      ts.isCallExpression(init) &&
      ts.isPropertyAccessExpression(init.expression) &&
      ts.isIdentifier(init.expression.expression) &&
      init.expression.expression.text === axiosName &&
      init.expression.name.text === 'create'
    ) {
      httpClients.add(name);
    }
  }

  // ---- folding ---------------------------------------------------------------
  const fold = (expr: TS.Node | undefined, params: Set<string>, depth = 0): string | null => {
    if (!expr || depth > 8) return null;
    if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) return expr.text;
    if (ts.isParenthesizedExpression(expr) || ts.isAsExpression(expr)) return fold(expr.expression, params, depth + 1);
    if (ts.isTemplateExpression(expr)) {
      let out = expr.head.text;
      for (const span of expr.templateSpans) out += (fold(span.expression, params, depth + 1) ?? '{?}') + span.literal.text;
      return out;
    }
    if (ts.isBinaryExpression(expr) && expr.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      const l = fold(expr.left, params, depth + 1);
      const r = fold(expr.right, params, depth + 1);
      return l === null && r === null ? null : (l ?? '{?}') + (r ?? '{?}');
    }
    if (ts.isIdentifier(expr)) {
      if (params.has(expr.text)) return `{${expr.text}}`;
      const init = consts.get(expr.text);
      return init ? fold(init, new Set(), depth + 1) : null;
    }
    if (ts.isPropertyAccessExpression(expr) && ts.isIdentifier(expr.expression)) {
      const init = consts.get(expr.expression.text);
      const obj = init && (ts.isAsExpression(init) ? init.expression : init);
      if (obj && ts.isObjectLiteralExpression(obj)) {
        for (const prop of obj.properties) {
          if (ts.isPropertyAssignment(prop) && prop.name.getText(sf) === expr.name.text) {
            return fold(prop.initializer, new Set(), depth + 1);
          }
        }
      }
    }
    return null;
  };

  const httpCallOf = (call: TS.CallExpression, params: Set<string>): HttpCallFact | null => {
    const callee = call.expression;
    if (ts.isIdentifier(callee) && callee.text === 'fetch') {
      let method = 'GET';
      const init = call.arguments[1];
      if (init && ts.isObjectLiteralExpression(init)) {
        for (const prop of init.properties) {
          if (ts.isPropertyAssignment(prop) && prop.name.getText(sf) === 'method') {
            method = (fold(prop.initializer, params) ?? 'GET').toUpperCase();
          }
        }
      }
      return { method, url: fold(call.arguments[0], params) ?? '{?}', line: lineOf(call) };
    }
    if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression)) {
      const target = callee.expression.text;
      const verb = callee.name.text;
      if ((target === axiosName || httpClients.has(target)) && HTTP_METHODS.has(verb)) {
        return { method: verb.toUpperCase(), url: fold(call.arguments[0], params) ?? '{?}', line: lineOf(call) };
      }
    }
    return null;
  };

  // ---- pass 2: function bodies ----------------------------------------------
  const returnsJsx = (node: TS.Node): boolean => {
    let found = false;
    const visit = (n: TS.Node): void => {
      if (found) return;
      if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n) || ts.isJsxFragment(n)) found = true;
      else ts.forEachChild(n, visit);
    };
    visit(node);
    return found;
  };

  const units: Array<{ name: string; params: string[]; body: TS.Node }> = [];
  const moduleLevel: TS.Node[] = [];
  for (const stmt of sf.statements) {
    if (ts.isFunctionDeclaration(stmt) && stmt.name && stmt.body) {
      units.push({ name: stmt.name.text, params: stmt.parameters.map((p) => p.name.getText(sf)), body: stmt.body });
    } else if (ts.isClassDeclaration(stmt) && stmt.name) {
      for (const member of stmt.members) {
        if ((ts.isMethodDeclaration(member) || ts.isConstructorDeclaration(member)) && member.body) {
          const method = ts.isConstructorDeclaration(member) ? 'constructor' : member.name.getText(sf);
          units.push({
            name: `${stmt.name.text}.${method}`,
            params: member.parameters.map((p) => p.name.getText(sf)),
            body: member.body,
          });
        }
      }
    } else if (ts.isVariableStatement(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        const init = decl.initializer;
        if (ts.isIdentifier(decl.name) && init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) {
          units.push({ name: decl.name.text, params: init.parameters.map((p) => p.name.getText(sf)), body: init.body });
        } else {
          moduleLevel.push(stmt);
        }
      }
    } else if (!ts.isImportDeclaration(stmt)) {
      moduleLevel.push(stmt);
    }
  }

  for (const unit of units) {
    if (/^[A-Z]/.test(unit.name) && returnsJsx(unit.body)) facts.components.push(unit.name);
  }

  const scan = (name: string, params: Set<string>, nodes: TS.Node[]): FunctionFact => {
    const fn: FunctionFact = { name, params: [...params], calls: [], http: [] };
    const visit = (n: TS.Node): void => {
      if (ts.isCallExpression(n)) {
        const http = httpCallOf(n, params);
        if (http) fn.http.push(http);
        else if (ts.isIdentifier(n.expression)) {
          fn.calls.push({ callee: n.expression.text, args: n.arguments.map((a) => fold(a, params)) });
        }
      }
      // const [a, b] = await Promise.all([fa(), fb()]) / const a = await fa()
      if (ts.isVariableDeclaration(n) && n.initializer) {
        const init = ts.isAwaitExpression(n.initializer) ? n.initializer.expression : null;
        if (init && ts.isCallExpression(init)) {
          const all =
            ts.isPropertyAccessExpression(init.expression) &&
            init.expression.getText(sf) === 'Promise.all' &&
            init.arguments[0] &&
            ts.isArrayLiteralExpression(init.arguments[0]);
          if (all && ts.isArrayBindingPattern(n.name)) {
            const calls = (init.arguments[0] as TS.ArrayLiteralExpression).elements;
            n.name.elements.forEach((el, k) => {
              const call = calls[k];
              if (ts.isBindingElement(el) && ts.isIdentifier(el.name) && call && ts.isCallExpression(call) && ts.isIdentifier(call.expression)) {
                facts.storeLoads.push({ field: el.name.text, callee: call.expression.text });
              }
            });
          } else if (ts.isIdentifier(n.name) && ts.isIdentifier(init.expression)) {
            facts.storeLoads.push({ field: n.name.text, callee: init.expression.text });
          }
        }
        // const { a, b } = useX()
        if (
          ts.isObjectBindingPattern(n.name) &&
          ts.isCallExpression(n.initializer) &&
          ts.isIdentifier(n.initializer.expression) &&
          /^use[A-Z]/.test(n.initializer.expression.text)
        ) {
          const fields = n.name.elements
            .map((el) => (el.propertyName ?? el.name).getText(sf))
            .filter((f) => !f.startsWith('...'));
          facts.hookReads.push({ hook: n.initializer.expression.text, fields });
        }
      }
      ts.forEachChild(n, visit);
    };
    nodes.forEach(visit);
    return fn;
  };

  for (const unit of units) {
    const fn = scan(unit.name, new Set(unit.params), [unit.body]);
    facts.functions.push(fn);
    if (/^use[A-Z]/.test(unit.name) && facts.exports[unit.name] && fn.calls.some((c) => c.callee === 'useContext')) {
      facts.hooks.push(unit.name);
    }
  }
  const mod = scan('<module>', new Set(), moduleLevel);
  // Mounting React: createRoot/hydrateRoot, or the legacy ReactDOM.render/hydrate — in top-level
  // statements only, so a render loop inside a class or function is not mistaken for an entry.
  const BOOT = /^(?:(?:ReactDOM\.)?(?:createRoot|hydrateRoot)|ReactDOM\.(?:render|hydrate)|render|hydrate)$/;
  const findBoot = (n: TS.Node): boolean =>
    (ts.isCallExpression(n) && BOOT.test(n.expression.getText(sf))) ||
    (!ts.isFunctionLike(n) && !ts.isClassLike(n) && (ts.forEachChild(n, findBoot) ?? false));
  facts.bootstraps = sf.statements.some((stmt) => (ts.isExpressionStatement(stmt) || ts.isVariableStatement(stmt)) && findBoot(stmt));
  if (mod.calls.length > 0 || mod.http.length > 0) facts.functions.push(mod);

  // ---- routes -----------------------------------------------------------------
  const tagName = (n: TS.JsxOpeningLikeElement) => n.tagName.getText(sf);
  const containerOf = (node: TS.Node): string | null => {
    for (let p: TS.Node | undefined = node.parent; p; p = p.parent) {
      if (ts.isJsxElement(p) && tagName(p.openingElement) !== 'Routes' && tagName(p.openingElement) !== 'Route') {
        const tag = tagName(p.openingElement);
        if (/^[a-z]/.test(tag)) return tag;
      }
    }
    return null;
  };
  const componentOfJsx = (expr: TS.Expression | undefined): string | null => {
    if (!expr) return null;
    if (ts.isJsxSelfClosingElement(expr)) return tagName(expr);
    if (ts.isJsxElement(expr)) return tagName(expr.openingElement);
    if (ts.isParenthesizedExpression(expr)) return componentOfJsx(expr.expression);
    return null;
  };
  const visitRoutes = (n: TS.Node): void => {
    const opening = ts.isJsxSelfClosingElement(n) ? n : ts.isJsxElement(n) ? n.openingElement : null;
    if (opening && tagName(opening) === 'Route') {
      let routePath: string | null = null;
      let element: string | null = null;
      for (const attr of opening.attributes.properties) {
        if (!ts.isJsxAttribute(attr)) continue;
        const name = attr.name.getText(sf);
        const init = attr.initializer;
        if (name === 'path' && init && ts.isStringLiteral(init)) routePath = init.text;
        if (name === 'index') routePath = routePath ?? '';
        if ((name === 'element' || name === 'component' || name === 'Component') && init && ts.isJsxExpression(init)) {
          const e = init.expression;
          element = e && ts.isIdentifier(e) ? e.text : componentOfJsx(e);
        }
      }
      facts.routes.push({ path: routePath, element, container: containerOf(n), line: lineOf(n) });
    }
    // Object configs: { path: '/x', element: <X/> } inside createBrowserRouter / useRoutes.
    if (ts.isObjectLiteralExpression(n)) {
      let routePath: string | null = null;
      let element: string | null | undefined;
      for (const prop of n.properties) {
        if (!ts.isPropertyAssignment(prop)) continue;
        const key = prop.name.getText(sf);
        if (key === 'path' && ts.isStringLiteral(prop.initializer)) routePath = prop.initializer.text;
        if (key === 'element') element = componentOfJsx(prop.initializer);
        if (key === 'Component' && ts.isIdentifier(prop.initializer)) element = prop.initializer.text;
      }
      if (routePath !== null && element !== undefined) {
        facts.routes.push({ path: routePath, element, container: null, line: lineOf(n) });
      }
    }
    ts.forEachChild(n, visitRoutes);
  };
  visitRoutes(sf);

  return facts;
}
