import { Hook } from '@oclif/core';
import { randomUUID } from 'crypto';

/**
 * oclif init hook — runs before command execution.
 * Sets a correlation ID for the entire CLI invocation (tracing, telemetry).
 */
const hook: Hook<'init'> = async function() {
  process.env.SEANS_MFE_CORRELATION_ID = randomUUID();
  this.debug(`[init] correlation_id=${process.env.SEANS_MFE_CORRELATION_ID}`);
};

export default hook;
