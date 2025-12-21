import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'js-yaml';
import { remoteInitCommand } from '../remote-init';
import { remoteGenerateCommand } from '../remote-generate';

describe('remote:init and remote:generate E2E', () => {
	let testDir: string;
	let originalCwd: string;

	beforeAll(() => {
		originalCwd = process.cwd();
	});

	beforeEach(async () => {
		testDir = path.join(os.tmpdir(), `mfe-e2e-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		await fs.ensureDir(testDir);
		process.chdir(testDir);
	});

	afterEach(async () => {
		process.chdir(originalCwd);
		if (testDir && await fs.pathExists(testDir)) {
			await fs.remove(testDir);
		}
	});

	it('remote:init should create MFE directory and manifest', async () => {
		const mfeName = 'init-test';
		const mfeDir = path.join(testDir, mfeName);
		await remoteInitCommand(mfeName, { skipInstall: true });
		expect(await fs.pathExists(mfeDir)).toBe(true);
		expect(await fs.pathExists(path.join(mfeDir, 'mfe-manifest.yaml'))).toBe(true);
		// Should NOT create platform files yet
		expect(await fs.pathExists(path.join(mfeDir, 'package.json'))).toBe(false);
		expect(await fs.pathExists(path.join(mfeDir, 'rspack.config.js'))).toBe(false);
		expect(await fs.pathExists(path.join(mfeDir, 'src/App.tsx'))).toBe(false);
	});

	it('remote:generate should scaffold files from manifest', async () => {
		const mfeName = 'generate-test';
		const mfeDir = path.join(testDir, mfeName);
		await remoteInitCommand(mfeName, { skipInstall: true });
		// Add capability to manifest
		const manifestPath = path.join(mfeDir, 'mfe-manifest.yaml');
		const manifestContent = await fs.readFile(manifestPath, 'utf8');
		const manifest = yaml.load(manifestContent) as Record<string, any>;
		manifest.capabilities = [
			{
				UserProfile: {
					type: 'domain',
					description: 'User profile management',
					handler: 'src/features/UserProfile/UserProfile'
				}
			}
		];
		await fs.writeFile(manifestPath, yaml.dump(manifest), 'utf8');
		process.chdir(mfeDir);
		await remoteGenerateCommand({ force: false });
		// Should create platform and feature files
		expect(await fs.pathExists(path.join(mfeDir, 'package.json'))).toBe(true);
		expect(await fs.pathExists(path.join(mfeDir, 'rspack.config.js'))).toBe(true);
		expect(await fs.pathExists(path.join(mfeDir, 'src/App.tsx'))).toBe(true);
		expect(await fs.pathExists(path.join(mfeDir, 'src/features/UserProfile/UserProfile.tsx'))).toBe(true);
		expect(await fs.pathExists(path.join(mfeDir, 'src/features/UserProfile/UserProfile.test.tsx'))).toBe(true);
		expect(await fs.pathExists(path.join(mfeDir, 'src/features/UserProfile/index.ts'))).toBe(true);
	});

		it('remote:generate should skip existing files and create new ones for new domain capability', async () => {
			const mfeName = 'capability-test';
			const mfeDir = path.join(testDir, mfeName);
			await remoteInitCommand(mfeName, { skipInstall: true });
			const manifestPath = path.join(mfeDir, 'mfe-manifest.yaml');
			const manifestContent = await fs.readFile(manifestPath, 'utf8');
			const manifest = yaml.load(manifestContent) as Record<string, any>;
			manifest.capabilities = [
				{
					UserProfile: {
						type: 'domain',
						description: 'User profile management',
						handler: 'src/features/UserProfile/UserProfile'
					}
				}
			];
			await fs.writeFile(manifestPath, yaml.dump(manifest), 'utf8');
			process.chdir(mfeDir);
			await remoteGenerateCommand({ force: false });

			// Add a new domain capability
			const updatedManifest = yaml.load(await fs.readFile(manifestPath, 'utf8')) as Record<string, any>;
			updatedManifest.capabilities.push({
				AccountSettings: {
					type: 'domain',
					description: 'Account settings management',
					handler: 'src/features/AccountSettings/AccountSettings'
				}
			});
			await fs.writeFile(manifestPath, yaml.dump(updatedManifest), 'utf8');

			await remoteGenerateCommand({ force: false });

			// Should skip existing UserProfile files (they should still exist)
			const userProfileDir = path.join(mfeDir, 'src/features/UserProfile');
			const accountSettingsDir = path.join(mfeDir, 'src/features/AccountSettings');
			const userProfileFiles = [
				'UserProfile.tsx',
				'UserProfile.test.tsx',
				'index.ts'
			].map(f => path.join(userProfileDir, f));
			for (const file of userProfileFiles) {
				expect(await fs.pathExists(file)).toBe(true);
			}

			// Should create new AccountSettings files (they should now exist)
			const accountSettingsFiles = [
				'AccountSettings.tsx',
				'AccountSettings.test.tsx',
				'index.ts'
			].map(f => path.join(accountSettingsDir, f));
			for (const file of accountSettingsFiles) {
				expect(await fs.pathExists(file)).toBe(true);
			}
		});
});
