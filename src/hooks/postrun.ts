import { Hook } from '@oclif/core';

/**
 * oclif postrun hook — computes command duration for telemetry.
 * Stub: C4 replaces this with daemon graphql-ws emission.
 */
const hook: Hook<'postrun'> = async function(opts) {
  const start = parseInt(process.env.SEANS_MFE_CMD_START ?? '0', 10);
  const duration = Date.now() - start;
  this.debug(`[postrun] ${opts.Command.id ?? '(unknown)'} completed in ${duration}ms`);
  // Stub: C4 will emit { event: 'command.complete', id, duration, correlationId } to daemon WS
};

export default hook;
