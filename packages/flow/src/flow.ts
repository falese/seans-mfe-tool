/**
 * What a flow is (ADR-119 §1): a YAML description of steps, the commands they
 * run, what they follow, what they write, and which are a person's decision.
 */

import * as yaml from 'js-yaml';
import { z } from 'zod';
import { ValidationError } from '@seans-mfe/contracts';

const InputSchema = z.object({
  /** The artifact, relative to the flow's root, that records the value. */
  from: z.string().min(1),
  /** The top-level field of that JSON artifact. */
  field: z.string().min(1),
  /** Shown in place of the value until a step has recorded it. */
  otherwise: z.string().min(1),
});

const StepSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/, 'step ids are lower-case kebab-case'),
  title: z.string().min(1),
  /** `command` runs a command; `gate` waits on a person; `optional` never blocks a later step. */
  kind: z.enum(['command', 'gate', 'optional']).default('command'),
  after: z.array(z.string()).default([]),
  /** Paths relative to the root; the first is the step's own output, compared for freshness. */
  produces: z.array(z.string().min(1)).default([]),
  /**
   * What the step's first output is built from, relative to the root. When set,
   * freshness compares the digests the step recorded (`<output>.from.json`)
   * with the inputs' content now; without it, modification times decide.
   */
  from: z.array(z.string().min(1)).default([]),
  /** A template over `{root}` and the flow's inputs. */
  command: z.string().min(1).optional(),
  /** A check the host registers, deciding the step instead of, or as well as, its files. */
  check: z.string().min(1).optional(),
  /** False for a step that is planned and not built. */
  available: z.boolean().default(true),
  /** Where the work to build an unavailable step is tracked. */
  issue: z.string().optional(),
});

export const FlowSchema = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9-]*$/),
    title: z.string().min(1),
    /** What the directory a flow is asked about is, in words. */
    root: z.string().min(1),
    description: z.string().optional(),
    inputs: z.record(z.string(), InputSchema).default({}),
    steps: z.array(StepSchema).min(1),
  })
  .superRefine((flow, ctx) => {
    const seen = new Set<string>();
    flow.steps.forEach((step, i) => {
      if (seen.has(step.id)) ctx.addIssue({ code: 'custom', path: ['steps', i, 'id'], message: `step "${step.id}" is defined twice` });
      for (const a of step.after) {
        if (!seen.has(a)) ctx.addIssue({ code: 'custom', path: ['steps', i, 'after'], message: `"${step.id}" follows "${a}", which is not an earlier step` });
      }
      if (step.available && step.kind !== 'gate' && !step.command && !step.check) {
        ctx.addIssue({ code: 'custom', path: ['steps', i], message: `"${step.id}" has neither a command nor a check` });
      }
      if (step.kind !== 'optional' && step.available && step.produces.length === 0 && !step.check) {
        ctx.addIssue({ code: 'custom', path: ['steps', i], message: `"${step.id}" produces nothing and has no check, so it can never be done` });
      }
      seen.add(step.id);
    });
  });

export type Flow = z.infer<typeof FlowSchema>;
export type FlowStep = Flow['steps'][number];

/** Parse a flow document; a malformed one fails naming the field. */
export function loadFlow(text: string): Flow {
  let doc: unknown;
  try {
    doc = yaml.load(text);
  } catch (err) {
    throw new ValidationError(`the flow is not valid YAML: ${err instanceof Error ? err.message.split('\n')[0] : String(err)}`, 'flow', 'yaml');
  }
  const parsed = FlowSchema.safeParse(doc);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new ValidationError(`flow ${first.path.join('.') || '(document)'}: ${first.message}`, 'flow', 'schema');
  }
  return parsed.data;
}
