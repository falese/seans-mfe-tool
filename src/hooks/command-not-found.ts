import { Hook } from '@oclif/core';

/**
 * oclif command_not_found hook.
 * Under --json: emits a JSON error envelope and exits 2.
 * Otherwise: falls through to oclif's default "command not found" display.
 *
 * Pre-B1 stub: the envelope shape is inlined here. B2 will import from
 * @seans-mfe/contracts and use the typed CommandResult classifier.
 */
const hook: Hook<'command_not_found'> = async function(opts) {
  const isJson = process.argv.includes('--json');

  if (isJson) {
    // Minimal envelope matching the CommandResult<never> shape B1 will formalize
    const envelope = {
      success: false,
      error: {
        type: 'validation',
        message: `command ${opts.id} not found`,
        suggestions: opts.argv ?? [],
      },
    };
    process.stdout.write(JSON.stringify(envelope) + '\n');
    process.exit(2);
  }
  // No --json: oclif renders its default error and suggestion text
};

export default hook;
