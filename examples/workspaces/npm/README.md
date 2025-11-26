# NPM Workspace Example

This is an example Module Federation monorepo scaffolded with the CLI using **npm** as the package manager.
It is provided for reference only and is not part of the runtime toolkit.

## Structure
```
apps/
  shell/
  remotes/
packages/
  shared/
  ui-components/
docs/
mfe-spec.yaml
package.json
```

## Usage
Use this directory as a template when initializing a new workspace with npm:
```bash
npx seans-mfe-tool init my-workspace --package-manager npm
```

Then customize `mfe-spec.yaml` and generate assets:
```bash
npx seans-mfe-tool generate mfe-spec.yaml
```

## Notes
- No actual application code is included.
- The `package.json` scripts are placeholders.
- For pnpm, the CLI will create a `pnpm-workspace.yaml` instead of `workspaces` array.

## License
MIT
