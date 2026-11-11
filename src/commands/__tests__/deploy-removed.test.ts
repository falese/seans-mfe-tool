/**
 * There is no `deploy` command (ADR-122).
 *
 * It was a development convenience that ran a project in a local Docker
 * container. It required files the generator stopped emitting, looked for its
 * templates where the build does not put them, and so could not succeed
 * against any MFE `remote:generate` produces — while a 90% coverage threshold
 * on it stayed green against mocks. Deployment returns as a plugin-resolved
 * target axis, not as this command.
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..');

describe('the deploy command is gone', () => {
  it.each([
    'src/commands/deploy.ts',
    'schemas/deploy.json',
    'src/codegen/templates/docker/dockerfile.remote',
    'src/codegen/templates/docker/dockerfile.shell',
    'src/codegen/templates/docker/dockerfile.nodeAPI',
    'src/codegen/templates/docker/nginx.conf',
  ])('%s does not exist', (rel) => {
    expect(fs.existsSync(path.join(ROOT, rel))).toBe(false);
  });

  it('keeps the nginx block build:docker copies out of the CLI image', () => {
    expect(fs.existsSync(path.join(ROOT, 'src/codegen/templates/docker/nginx.mfe.conf'))).toBe(true);
  });
});
