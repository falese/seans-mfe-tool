# The decomposition demo video

`docs/media/decompose-demo.webm` is a real run of the decomposition tools against
`examples/meridian-monolith`. Re-record it when the commands or the workspace change.
The terminal scenes replay what `run.sh` saved, and the browser scenes drive the live app,
the generated overlay and the workspace. Nothing on screen is mocked.

## Before you start

- **Backends and monolith running:** the meridian backends on :5101–5103, and the monolith
  on :5090. See `examples/meridian-monolith/README.md#run-it`.
- **The CLI built:** `npm run build`. Then `npm run build:workspace`.
- **`ffmpeg` with libx264 and libvpx-vp9.**
- **A browser for capture and recording.** Playwright's Chromium works; set `CHROMIUM_PATH`
  if the CLI's Playwright cannot find it.

## Steps

```bash
export DEMO_DIR=/abs/path/to/an/empty/dir
scripts/demo/decompose-demo/run.sh before
cp -r "$DEMO_DIR/evidence/proposal" "$DEMO_DIR/proposal.bak"   # the workspace scene changes it; keep a copy for retakes

seans-mfe-tool decompose:workspace "$DEMO_DIR/evidence/proposal" --no-commit --who Sean &   # leave running
node scripts/demo/decompose-demo/record.js 01-title 02-monolith 03-terminal-discover \
  04-terminal-propose 05-overlay 06-workspace

scripts/demo/decompose-demo/run.sh after
node scripts/demo/decompose-demo/record.js 07-terminal-status 08-end
scripts/demo/decompose-demo/compose.sh
cp "$DEMO_DIR/decompose-demo.webm" docs/media/decompose-demo.webm
cp "$DEMO_DIR/poster.png" docs/media/decompose-demo-poster.png
```

The workspace scene renames `shell` to `console` and approves the plan. That is why the
`after` run finds the review package out of date. To retake that scene, restore
`proposal.bak` first.
