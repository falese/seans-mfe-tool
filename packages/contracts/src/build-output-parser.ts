/**
 * Turns bundler and compiler output into `BuildError[]`.
 *
 * `BuildError` and the `build:prod` plumbing have existed since ADR-036 — the
 * command already surfaces `file:line — message` and forwards the array into
 * `envelope.error.details`. What never existed was anything that produced a
 * populated one. Both framework plugins did:
 *
 *     const stderr = (err as { stderr?: string }).stderr ?? '';
 *     return { errors: [{ message: stderr, category: 'unknown' }] };
 *
 * and that is worse than it looks, because **rspack and tsc both write
 * diagnostics to stdout**. `err.stderr` is the empty string. Every failing
 * build reported one error whose message was `''`.
 *
 * Written against real captured output (see `__tests__/fixtures/`), not
 * against the documented formats, because the formats have details you only
 * discover by breaking a project: rspack's positions live on the `ERROR in`
 * header rather than beside the message, and a parse error has no header
 * position at all — the only line number is in the gutter of the excerpt.
 *
 * Zero dependencies, so it can live in contracts alongside `error-classifier`
 * and be used by every framework plugin.
 *
 * Refs #139 · #148 · ADR-036 · ADR-077
 */

import type { BuildError } from './framework-plugin';

/** TS diagnostics whose actionable cause is a missing module, not a type mistake. */
const MODULE_RESOLUTION_TS_CODES = new Set(['TS2307', 'TS2305', 'TS2306']);

/** tsc, non-pretty: `src/a.ts(3,15): error TS2339: message` */
const TSC_DIAGNOSTIC = /^(.+?)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.*)$/;

/** ng/tsc pretty: `Error: src/a.ts:12:3 - error TS2554: message` */
const NG_DIAGNOSTIC = /^(?:Error:\s*)?(.+?):(\d+):(\d+)\s+-\s+error\s+(TS\d+):\s+(.*)$/;

/**
 * webpack module-resolution line, as emitted by `ng build`:
 * `./src/x.ts:2:0-67 - Error: Module not found: Error: Can't resolve 'y' in 'z'`
 * Shares no shape with rspack's `ERROR in` header despite the same underlying
 * bundler family.
 */
const WEBPACK_MODULE_ERROR = /^(\S+):(\d+):(\d+)(?:-\d+)?\s+-\s+Error:\s+(.*)$/;

/** rspack/webpack block header: `ERROR in ./src/index.js 1:1-41` */
const RSPACK_HEADER = /^ERROR in (\S+)(?:\s+(\d+):(\d+)(?:-\d+)?)?\s*$/;

/**
 * SGR escape sequences. `ng` colours its diagnostics even when stdout is a
 * pipe, which puts escapes between the file, line, column and code — every
 * pattern above fails on raw ng output without this.
 */
// eslint-disable-next-line no-control-regex
const ANSI = /\[[0-9;]*m/g;

function stripAnsi(text: string): string {
  return text.replace(ANSI, '');
}

/** The `× message` rows inside an rspack block. */
const RSPACK_MESSAGE = /^\s*(?:╰─▶\s*)?×\s*(.+?)\s*$/;

/** Source-excerpt gutter inside an rspack block: ` 1 │ export const ...` */
const RSPACK_GUTTER = /^\s*(\d+)\s*│/;

export function parseBuildOutput(raw: string): BuildError[] {
  if (!raw.trim()) return [];
  const output = stripAnsi(raw);

  const errors = [
    ...parseDiagnostics(output),
    ...parseWebpackModuleErrors(output),
    ...parseRspackBlocks(output),
  ];

  if (errors.length > 0) return errors;
  if (looksSuccessful(output) || warningsOnly(output)) return [];

  // Nothing recognised. Hand over the raw text rather than reporting nothing —
  // an unparsed wall of output is still actionable; silence is not.
  return [{ message: output.trim(), category: 'unknown' }];
}

// ---------------------------------------------------------------------------
// tsc / ng diagnostics
// ---------------------------------------------------------------------------

function parseDiagnostics(output: string): BuildError[] {
  const errors: BuildError[] = [];

  for (const line of output.split('\n')) {
    const match = TSC_DIAGNOSTIC.exec(line) ?? NG_DIAGNOSTIC.exec(line);
    if (!match) continue;

    const [, file, lineNo, column, code, message] = match;
    errors.push({
      file: file.trim(),
      line: Number(lineNo),
      column: Number(column),
      message: message.trim(),
      code,
      category: MODULE_RESOLUTION_TS_CODES.has(code) ? 'dependency' : 'type',
      ...suggestionFor(message, MODULE_RESOLUTION_TS_CODES.has(code)),
    });
  }

  return errors;
}

// ---------------------------------------------------------------------------
// webpack single-line module errors (the `ng build` form)
// ---------------------------------------------------------------------------

function parseWebpackModuleErrors(output: string): BuildError[] {
  const errors: BuildError[] = [];

  for (const line of output.split('\n')) {
    const match = WEBPACK_MODULE_ERROR.exec(line.trim());
    if (!match) continue;

    const [, file, lineNo, column, rest] = match;
    // ng doubles the prefix: "Module not found: Error: Can't resolve ...".
    const message = rest.replace(/^Module not found:\s*Error:\s*/, 'Module not found: ').trim();
    const isMissingModule = /Module not found|Can't resolve/i.test(message);

    errors.push({
      file,
      line: Number(lineNo),
      column: Number(column),
      message,
      category: isMissingModule ? 'dependency' : categorizeRspack(message),
      ...suggestionFor(message, isMissingModule),
    });
  }

  return errors;
}

// ---------------------------------------------------------------------------
// rspack / webpack blocks
// ---------------------------------------------------------------------------

function parseRspackBlocks(output: string): BuildError[] {
  const lines = output.split('\n');
  const errors: BuildError[] = [];

  for (let i = 0; i < lines.length; i++) {
    const header = RSPACK_HEADER.exec(lines[i]);
    if (!header) continue;

    const [, file, lineNo, column] = header;
    const block = collectBlock(lines, i + 1);

    const message = innermostMessage(block);
    if (!message) continue;

    // A parse-error header carries no position; the excerpt gutter is the only
    // line number available. The caret row encodes a column too, but only
    // relative to a gutter width that varies with the line number's digits —
    // omitted rather than guessed.
    const gutterLine = block
      .map((l) => RSPACK_GUTTER.exec(l))
      .find((m): m is RegExpExecArray => m !== null);

    const resolvedLine = lineNo ? Number(lineNo) : gutterLine ? Number(gutterLine[1]) : undefined;
    const isMissingModule = /Module not found|Can't resolve/i.test(message);

    errors.push({
      file,
      ...(resolvedLine !== undefined && { line: resolvedLine }),
      ...(column !== undefined && { column: Number(column) }),
      message,
      category: isMissingModule ? 'dependency' : categorizeRspack(message),
      ...suggestionFor(message, isMissingModule),
    });
  }

  return errors;
}

/** Lines belonging to one `ERROR in ...` block — up to the next blank-ish boundary. */
function collectBlock(lines: string[], start: number): string[] {
  const block: string[] = [];
  for (let i = start; i < lines.length; i++) {
    const line = lines[i];
    if (RSPACK_HEADER.test(line) || /^(WARNING|ERROR) in /.test(line)) break;
    if (/^Rspack compiled|^webpack compiled/.test(line)) break;
    block.push(line);
  }
  return block;
}

/**
 * rspack nests causes: `× Module parse failed:` then `╰─▶ × JavaScript parse
 * error: ...`. The innermost one names the actual problem; the outer is a
 * category label.
 */
function innermostMessage(block: string[]): string | undefined {
  const messages = block
    .map((line) => RSPACK_MESSAGE.exec(line))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => m[1].trim())
    .filter((m) => m.length > 0);

  if (messages.length === 0) return undefined;
  const last = messages[messages.length - 1];
  // A trailing ':' means it was only introducing the nested cause.
  return last.endsWith(':') && messages.length > 1 ? messages[messages.length - 2] : last;
}

function categorizeRspack(message: string): BuildError['category'] {
  if (/parse error|Unexpected token|Expression expected/i.test(message)) return 'syntax';
  if (/configuration|Invalid options|config/i.test(message)) return 'config';
  return 'unknown';
}

// ---------------------------------------------------------------------------
// Suggestions
// ---------------------------------------------------------------------------

function suggestionFor(message: string, isMissingModule: boolean): { suggestion?: string } {
  if (!isMissingModule) return {};

  // Anchored on the keyword, not on the first quote: the message itself
  // contains an apostrophe ("Can't resolve"), so a bare quote match picks up
  // "t resolve " instead of the specifier.
  const specifier = /(?:resolve|find module)\s+['"]([^'"]+)['"]/.exec(message)?.[1];
  if (!specifier) return {};

  // A relative specifier is a path mistake; a bare one is a missing install.
  // They are different fixes, and telling them apart is most of the value.
  return specifier.startsWith('.')
    ? { suggestion: `Check the path — no module at '${specifier}' relative to the importing file.` }
    : { suggestion: `Install the package: npm install ${specifier}` };
}

function looksSuccessful(output: string): boolean {
  return /compiled successfully|Compiled successfully|built successfully/i.test(output);
}

/**
 * A build that emitted warnings and nothing else did not fail. Without this the
 * unknown-output fallback would promote every warning block to a build error.
 */
function warningsOnly(output: string): boolean {
  return /^WARNING in /m.test(output) && !/^ERROR in /m.test(output);
}
