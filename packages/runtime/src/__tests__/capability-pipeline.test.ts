/**
 * The capability middleware pipeline (extracted from base-mfe.ts).
 *
 * `runPipeline` is the onion every capability call runs through, so its
 * ordering and its one guard are load-bearing for ADR-002's execution model.
 * The double-next() guard had no test while it sat inside a 988-line file; in
 * a 90-line module the gap was visible, which is most of the argument for the
 * extraction.
 */

import { runPipeline } from '../capability-pipeline';
import type { Middleware } from '../capability-pipeline';
import { SystemError } from '@seans-mfe/contracts';
import type { Context } from '../context';

const ctx = {} as Context;

describe('runPipeline', () => {
  it('runs stages in order, inner-most last', async () => {
    const seen: string[] = [];
    const stage = (name: string): Middleware => async (_c, next) => {
      seen.push(`${name}:in`);
      await next();
      seen.push(`${name}:out`);
    };
    await runPipeline([stage('a'), stage('b')], ctx);
    // The onion: a wraps b, and unwinds in reverse.
    expect(seen).toEqual(['a:in', 'b:in', 'b:out', 'a:out']);
  });

  it('throws SystemError when one stage calls next() twice', async () => {
    const doubleNext: Middleware = async (_c, next) => {
      await next();
      await next();
    };
    await expect(runPipeline([doubleNext, async () => {}], ctx)).rejects.toThrow(SystemError);
  });

  it('stops cleanly when a stage does not call next()', async () => {
    const inner = jest.fn();
    const halt: Middleware = async () => {};
    await runPipeline([halt, inner as unknown as Middleware], ctx);
    expect(inner).not.toHaveBeenCalled();
  });

  it('propagates a stage failure to the caller', async () => {
    const boom: Middleware = async () => {
      throw new Error('stage failed');
    };
    await expect(runPipeline([boom], ctx)).rejects.toThrow('stage failed');
  });

  it('is a no-op for an empty chain', async () => {
    await expect(runPipeline([], ctx)).resolves.toBeUndefined();
  });
});
