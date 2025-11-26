# Yarn Workspace Example

Example Module Federation monorepo scaffold using **yarn**. Reference only; not part of core toolkit runtime.

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
Initialize a new yarn workspace with:
```bash
npx seans-mfe-tool init my-workspace --package-manager yarn
```

Customize `mfe-spec.yaml` then generate projects:
```bash
npx seans-mfe-tool generate mfe-spec.yaml
```

## Notes
- Placeholder scripts in `package.json`.
- Use this to compare npm vs yarn workspace configs.

## License
MIT
