/**
 * Build the offline registry mirror (ADR-084 §3).
 *
 * The hosted lane is GitHub Packages. This is the other lane: a *static* npm
 * registry that needs no daemon, because npm's install protocol is only two
 * GETs — a packument at `/@scope%2fname` and a tarball at
 * `/@scope/name/-/name-x.y.z.tgz`. `npm pack` gives us the second; this script
 * synthesizes the first.
 *
 * The output is served read-only (it accepts no publishes) from the CLI image,
 * which generated MFE Dockerfiles already mount. That is how ADR-084 §3 keeps
 * the platform installable with no live npm registry — see its References for
 * the developer-model decision that requires it.
 *
 * Why a mirror rather than the `file:` staging it replaces: a `file:` specifier
 * has to be written into the consuming manifest, which is why every generated
 * MFE's Dockerfile rewrote its own package.json twice per build. A registry is
 * selected by `.npmrc` instead, so the manifest states a plain semver range and
 * nothing edits it.
 */
import * as path from 'path';
import * as crypto from 'crypto';
import { execFileSync } from 'child_process';
import * as fs from 'fs-extra';

/** Packages a generated MFE resolves. Order is irrelevant; each is independent. */
const PUBLISHED_PACKAGES = [
  'contracts',
  'runtime',
  'framework-react',
  'framework-angular',
] as const;

const REPO_ROOT = path.resolve(__dirname, '..');
const MIRROR_DIR = path.join(REPO_ROOT, 'dist', 'registry');

interface PackedPackage {
  name: string;
  version: string;
  manifest: Record<string, unknown>;
  tarballPath: string;
  tarballName: string;
}

/**
 * `npm pack` the package and move the tarball into its registry-shaped home.
 *
 * Runs with `--silent` and reads the filename from the package manifest rather
 * than parsing npm's stdout, which carries notice lines on stderr/stdout
 * depending on version and is not a stable interface.
 */
function packPackage(dir: string): PackedPackage {
  const pkgDir = path.join(REPO_ROOT, 'packages', dir);
  const manifest = fs.readJsonSync(path.join(pkgDir, 'package.json')) as Record<string, unknown>;
  const name = manifest.name as string;
  const version = manifest.version as string;

  // npm names the tarball <name-without-scope-separators>-<version>.tgz.
  const tarballName = `${name.replace('@', '').replace('/', '-')}-${version}.tgz`;

  const destDir = path.join(MIRROR_DIR, name, '-');
  fs.ensureDirSync(destDir);

  execFileSync('npm', ['pack', '--silent', '--pack-destination', destDir], {
    cwd: pkgDir,
    stdio: ['ignore', 'ignore', 'inherit'],
  });

  return {
    name,
    version,
    manifest,
    tarballPath: path.join(destDir, tarballName),
    tarballName,
  };
}

/**
 * Write the packument npm reads to resolve a semver range to a version.
 *
 * Only the fields npm actually needs to install: the version map, `dist-tags`
 * so a bare `latest` resolves, and per-version `dist.tarball`/`integrity`.
 * `integrity` is not decoration — it is what makes a tampered tarball fail
 * with EINTEGRITY rather than install silently.
 */
function writePackument(pkg: PackedPackage, registryUrl: string): void {
  const tarball = fs.readFileSync(pkg.tarballPath);
  const integrity = `sha512-${crypto.createHash('sha512').update(tarball).digest('base64')}`;
  const shasum = crypto.createHash('sha1').update(tarball).digest('hex');

  const packument = {
    name: pkg.name,
    'dist-tags': { latest: pkg.version },
    versions: {
      [pkg.version]: {
        ...pkg.manifest,
        dist: {
          tarball: `${registryUrl}/${pkg.name}/-/${pkg.tarballName}`,
          integrity,
          shasum,
        },
      },
    },
  };

  fs.writeJsonSync(path.join(MIRROR_DIR, pkg.name, 'index.json'), packument, { spaces: 2 });
}

export function buildRegistryMirror(registryUrl: string): PackedPackage[] {
  fs.removeSync(MIRROR_DIR);
  fs.ensureDirSync(MIRROR_DIR);

  const packed = PUBLISHED_PACKAGES.map((dir) => {
    const pkg = packPackage(dir);
    writePackument(pkg, registryUrl);
    return pkg;
  });

  return packed;
}

if (require.main === module) {
  // Matches the .npmrc a generated MFE carries in the offline lane. A tarball
  // URL is absolute, so this has to agree with wherever the mirror is served.
  const registryUrl = process.env.SMT_MIRROR_URL ?? 'http://127.0.0.1:4873';
  const packed = buildRegistryMirror(registryUrl);

  for (const p of packed) {
    console.log(`  ✓ ${p.name}@${p.version}`);
  }
  console.log(`\n${packed.length} package(s) mirrored to dist/registry (registry: ${registryUrl})`);
}
