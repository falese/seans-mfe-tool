import { Hook } from '@oclif/core';

/**
 * oclif prerun hook — records command start timestamp for telemetry.
 */
const hook: Hook<'prerun'> = async function(opts) {
  process.env.SEANS_MFE_CMD_START = String(Date.now());
  this.debug(`[prerun] ${opts.Command.id ?? '(unknown)'} started at ${process.env.SEANS_MFE_CMD_START}`);
};

export default hook;
