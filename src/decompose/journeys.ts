/**
 * Journeys: what `decompose:capture` does to the running app (ADR-109 §5).
 *
 * A journey is a named list of steps run in a fresh browser page. Each step
 * is one interaction, and everything the app does during it (requests,
 * navigations, console output) is recorded against that step. Journey files
 * are YAML or JSON:
 *
 *   journeys:
 *     - name: docking-review
 *       steps:
 *         - goto: /docking
 *         - click: "text=Docking"          # any Playwright selector
 *         - fill: { selector: "#q", value: "VR" }
 *         - press: { selector: "#q", key: Enter }
 *         - wait: 250                      # milliseconds
 */

import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { z } from 'zod';
import { ValidationError } from '@seans-mfe/contracts';

const StepSchema = z.union([
  z.object({ goto: z.string().min(1) }).strict(),
  z.object({ click: z.string().min(1) }).strict(),
  z.object({ fill: z.object({ selector: z.string().min(1), value: z.string() }).strict() }).strict(),
  z.object({ press: z.object({ selector: z.string().min(1), key: z.string().min(1) }).strict() }).strict(),
  z.object({ wait: z.number().int().nonnegative() }).strict(),
]);

export type JourneyStep = z.infer<typeof StepSchema>;

export interface Journey {
  name: string;
  steps: JourneyStep[];
}

const NAME = /^[a-z0-9][a-z0-9._-]*$/i;

export function describeStep(step: JourneyStep): string {
  if ('goto' in step) return `goto ${step.goto}`;
  if ('click' in step) return `click ${step.click}`;
  if ('fill' in step) return `fill ${step.fill.selector}`;
  if ('press' in step) return `press ${step.press.key} on ${step.press.selector}`;
  return `wait ${step.wait}ms`;
}

/** Parse and validate a journey file (YAML or JSON). */
export function parseJourneys(text: string): Journey[] {
  let doc: unknown;
  try {
    doc = yaml.load(text);
  } catch (err) {
    throw new ValidationError(
      `journey file is not valid YAML or JSON: ${err instanceof Error ? err.message.split('\n')[0] : String(err)}`,
      'journeys',
      'yaml'
    );
  }
  const list = (doc as { journeys?: unknown } | null)?.journeys;
  if (!Array.isArray(list) || list.length === 0) {
    throw new ValidationError('journey file needs a non-empty `journeys:` list', 'journeys', 'non-empty');
  }

  const names = new Set<string>();
  return list.map((raw, j): Journey => {
    const entry = raw as { name?: unknown; steps?: unknown };
    const name = typeof entry?.name === 'string' ? entry.name : '';
    if (!NAME.test(name)) {
      throw new ValidationError(
        `journey ${j + 1}: name must be letters, digits, '.', '_' or '-' (it names a file), got "${name}"`,
        'journeys.name',
        'file-name'
      );
    }
    if (names.has(name)) {
      throw new ValidationError(`duplicate journey name "${name}"`, 'journeys.name', 'unique');
    }
    names.add(name);
    if (!Array.isArray(entry.steps) || entry.steps.length === 0) {
      throw new ValidationError(`journey "${name}" has no steps`, 'journeys.steps', 'non-empty');
    }
    const steps = entry.steps.map((s, k): JourneyStep => {
      const parsed = StepSchema.safeParse(s);
      if (!parsed.success) {
        throw new ValidationError(
          `journey "${name}", step ${k + 1}: expected one of goto, click, fill, press, wait — got ${JSON.stringify(s)}`,
          'journeys.steps',
          'step'
        );
      }
      return parsed.data;
    });
    return { name, steps };
  });
}

/** Read and parse `--journeys <file>`; a missing file names the flag, not just an errno. */
export async function readJourneysFile(file: string): Promise<Journey[]> {
  let text: string;
  try {
    text = await fs.promises.readFile(file, 'utf8');
  } catch {
    throw new ValidationError(
      `--journeys ${file}: no such file. Write a journey file there, or drop --journeys and use --explore N to follow the app's links`,
      'journeys',
      'file'
    );
  }
  return parseJourneys(text);
}
