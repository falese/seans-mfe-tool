/**
 * The agreement artifact for a proposal PR (ADR-110 §3, #416): what a reviewer
 * reads and sees before agreeing to a decomposition.
 *
 * - `PROPOSAL.md`: the domains and why each boundary is where it is, what is
 *   shared, the risks, the test triage, and how to change any of it.
 * - The boundary overlay: the monolith's captured screens with each proposed
 *   domain outlined where it begins, as an HTML page for any reviewer and as a
 *   Figma plugin that builds the same page as layers.
 *
 * Everything is derived from `decomposition.yaml` and the evidence bundle —
 * re-run after an edit and the artifact follows.
 */

import type { Decomposition } from './model';

/** A box on a captured screen, in CSS pixels. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EvidenceStep {
  id: string;
  path: string;
  screenshot: string;
  regions: Array<{ id: string; component: string; file: string | null; parent: string | null; rect: Rect }>;
}

export interface OverlayBox {
  domain: string;
  mfe: string;
  capability: string;
  slot: string;
  label: string;
  color: string;
  rect: Rect;
}

/** Where a domain reads another domain's data, on screen. */
export interface OverlayCoupling {
  file: string;
  label: string;
  rect: Rect;
}

export interface Overlay {
  screens: Array<{
    id: string;
    path: string;
    screenshot: string;
    width: number;
    height: number;
    boxes: OverlayBox[];
    couplings: OverlayCoupling[];
  }>;
  legend: Array<{ domain: string; mfe: string; color: string }>;
}

const SHELL_COLOR = '#8a8f98';
const PALETTE = ['#3b6ff5', '#2e9e6b', '#c77b21', '#8455d6', '#d64570', '#ff6b9d', '#0ea5a4', '#b45309', '#4f46e5', '#65a30d'];

function colors(doc: Decomposition): Map<string, string> {
  const out = new Map<string, string>();
  let i = 0;
  for (const d of doc.domains) out.set(d.id, d.shell ? SHELL_COLOR : PALETTE[i++ % PALETTE.length]);
  return out;
}

const pct = (n: number | null) => (n === null ? '–' : n.toFixed(2));

export function renderProposalMarkdown(doc: Decomposition): string {
  const lines: string[] = [];
  const verdicts = { keep: 0, rewrite: 0, discard: 0 };
  for (const t of doc.tests) verdicts[t.verdict] += 1;

  lines.push(`# Decomposition proposal — ${doc.app.name}`, '');
  lines.push(
    `${doc.domains.length} domains, ${doc.shared.length} shared files, ${doc.couplings.length} couplings to resolve. ` +
      'Merging this PR is the agreement (ADR-110 §3): nothing is scaffolded before it merges.',
    ''
  );
  lines.push('| Domain | MFE | Files | Capabilities | Backends | Evidence |', '|---|---|---|---|---|---|');
  for (const d of doc.domains) {
    const e = d.evidence;
    lines.push(
      `| ${d.id}${d.shell ? ' (shell)' : ''} | \`${d.mfe}\` | ${d.files.length} | ${d.capabilities.map((c) => c.name).join(', ')} | ${d.backends.join(', ') || '—'} | ` +
        `route ${pct(e.route)} · data ${pct(e.data)} · imports ${pct(e.imports)} · runtime ${pct(e.runtime)} · co-change ${pct(e.cochange)} · owners ${pct(e.ownership)} |`
    );
  }
  lines.push('', 'Evidence is each signal’s agreement with the boundary, 0–1; – means the signal was not available.', '');

  lines.push('## Why each boundary is where it is', '');
  for (const d of doc.domains) {
    lines.push(`### ${d.id}`, '');
    for (const r of d.reasons) lines.push(`- ${r}`);
    const placed = [
      ...doc.routes.flatMap((r) => r.place.filter((p) => p.domain === d.id).map((p) => `\`${p.capability}\` → ${p.slot} on \`${r.stateKey}\``)),
      ...doc.repeated.filter((p) => p.domain === d.id).map((p) => `\`${p.capability}\` → ${p.slot}, one per item (rendered by \`${p.renderedBy}\`)`),
    ];
    if (placed.length > 0) lines.push(`- placements: ${placed.join('; ')}`);
    lines.push(`- files: ${d.files.map((f) => `\`${f}\``).join(', ')}`, '');
  }

  lines.push('## Shared files', '');
  if (doc.shared.length === 0) lines.push('None.', '');
  else {
    lines.push('| File | Used by | Suggestion |', '|---|---|---|');
    for (const s of doc.shared) lines.push(`| \`${s.file}\` | ${s.usedBy.join(', ') || '—'} | ${s.suggestion} |`);
    lines.push('');
  }

  lines.push('## Risks', '');
  const risksAt = lines.length;
  for (const c of doc.couplings) lines.push(`- \`${c.file}\` (${c.domain}) reads ${c.owner}’s \`${c.field}\` (${c.endpoint}): ${c.note}`);
  for (const f of doc.unassigned) lines.push(`- \`${f}\` is reached from no entry or route: dead code, or an entry the analysis missed`);
  if (doc.uncovered.length > 0) {
    lines.push(`- ${doc.uncovered.length} capabilities have no kept test: ${doc.uncovered.map((u) => `${u.capability} (${u.domain})`).join(', ')}`);
  }
  if (doc.repeated.length > 0) lines.push('- repeated placements bind their `{id}` keys when composed; the composition here leaves them out');
  if (lines.length === risksAt) lines.push('None found.');
  lines.push('');

  lines.push('## Test triage', '', `**${verdicts.keep} keep, ${verdicts.rewrite} rewrite, ${verdicts.discard} discard**.`, '');
  if (doc.tests.length > 0) {
    lines.push('| Test | Domain | Verdict | Why |', '|---|---|---|---|');
    for (const t of doc.tests) lines.push(`| \`${t.file}\` | ${t.domain ?? '—'} | ${t.verdict} | ${t.reasons.join('; ')} |`);
    lines.push('');
  }

  lines.push('## Composition', '', '| Route | State key | Placements |', '|---|---|---|');
  for (const r of doc.routes) lines.push(`| \`${r.path}\` | \`${r.stateKey}\` | ${r.place.map((p) => `${p.capability} → ${p.slot}`).join(', ')} |`);
  lines.push('');

  lines.push('## How to change this', '');
  lines.push('Request changes on this PR. Edits go to `decomposition.yaml` as named operations, and everything else is re-derived:', '');
  lines.push('```bash');
  lines.push('seans-mfe-tool decompose:edit decomposition.yaml --merge docking,cargo=harbor');
  lines.push('seans-mfe-tool decompose:edit decomposition.yaml --rename-domain shell=console --move src/utils/constants.ts=console');
  lines.push('seans-mfe-tool decompose:present . --evidence <bundle>    # refresh this page and the overlay');
  lines.push('```', '');
  return lines.join('\n');
}

function clip(r: Rect, w: number, h: number): Rect | null {
  const x = Math.max(0, r.x);
  const y = Math.max(0, r.y);
  const right = Math.min(w, r.x + r.width);
  const bottom = Math.min(h, r.y + r.height);
  if (right - x < 1 || bottom - y < 1) return null;
  return { x, y, width: right - x, height: bottom - y };
}

/** One screen per captured path, with a box wherever a proposed domain begins. */
export function buildOverlay(doc: Decomposition, steps: EvidenceStep[], viewport: { width: number; height: number }): Overlay {
  const palette = colors(doc);
  const fileDomain = new Map<string, string>();
  for (const d of doc.domains) for (const f of d.files) fileDomain.set(f, d.id);
  const byId = new Map(doc.domains.map((d) => [d.id, d]));

  const seen = new Set<string>();
  const screens: Overlay['screens'] = [];
  for (const step of steps) {
    if (seen.has(step.path)) continue;
    seen.add(step.path);
    const regionDomain = new Map(step.regions.map((r) => [r.id, r.file ? (fileDomain.get(r.file) ?? null) : null]));
    const boxes: OverlayBox[] = [];
    for (const region of step.regions) {
      const id = regionDomain.get(region.id) ?? null;
      if (!id) continue;
      if (region.parent && regionDomain.get(region.parent) === id) continue;
      const rect = clip(region.rect, viewport.width, viewport.height);
      if (!rect) continue;
      const d = byId.get(id);
      if (!d) continue;
      const capability = d.capabilities.find((c) => c.file === region.file)?.name ?? region.component;
      const slot = d.shell
        ? 'root'
        : (doc.routes.find((r) => r.path === step.path)?.place.find((p) => p.capability === capability)?.slot ??
          doc.repeated.find((p) => p.capability === capability)?.slot ??
          '');
      boxes.push({
        domain: id,
        mfe: d.mfe,
        capability,
        slot,
        label: [id, d.mfe, slot, d.backends.join(', ')].filter(Boolean).join(' · '),
        color: palette.get(id) as string,
        rect,
      });
    }
    // Couplings, at the first region of each coupled file on this screen.
    const couplings: OverlayCoupling[] = [];
    const regionFile = new Map(step.regions.map((r) => [r.id, r.file]));
    for (const region of step.regions) {
      if (!region.file || couplings.some((c) => c.file === region.file)) continue;
      if (region.parent && regionFile.get(region.parent) === region.file) continue;
      const found = doc.couplings.filter((c) => c.file === region.file);
      if (found.length === 0) continue;
      const rect = clip(region.rect, viewport.width, viewport.height);
      if (!rect) continue;
      const reads = [...new Set(found.map((c) => `${c.owner}’s ${c.field}`))].join(', ');
      couplings.push({ file: region.file, label: `coupling: ${found[0].domain} reads ${reads}`, rect });
    }
    screens.push({ id: step.id, path: step.path, screenshot: step.screenshot, width: viewport.width, height: viewport.height, boxes, couplings });
  }
  return { screens, legend: doc.domains.map((d) => ({ domain: d.id, mfe: d.mfe, color: palette.get(d.id) as string })) };
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function renderOverlayHtml(overlay: Overlay, appName: string): string {
  const legend = overlay.legend
    .map((l) => `<span class="key"><i style="background:${l.color}"></i>${esc(l.domain)} <code>${esc(l.mfe)}</code></span>`)
    .join('');
  const screens = overlay.screens
    .map((s) => {
      const boxes = [
        ...s.boxes.map(
          (b) =>
            `<div class="box" title="${esc(b.label)}" style="left:${b.rect.x}px;top:${b.rect.y}px;width:${b.rect.width}px;height:${b.rect.height}px;border-color:${b.color};background:${b.color}1f">` +
            `<span class="label" style="background:${b.color}">${esc(b.label)}</span></div>`
        ),
        ...s.couplings.map(
          (c) =>
            `<div class="box coupling" title="${esc(c.label)}" style="left:${c.rect.x}px;top:${c.rect.y}px;width:${c.rect.width}px;height:${c.rect.height}px">` +
            `<span class="label">${esc(c.label)}</span></div>`
        ),
      ].join('\n');
      return `<section><h2>${esc(s.path)}</h2><div class="screen" style="width:${s.width}px;height:${s.height}px">` +
        `<img src="${esc(s.screenshot)}" width="${s.width}" height="${s.height}" alt="${esc(s.path)}">\n${boxes}\n</div></section>`;
    })
    .join('\n');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Decomposition overlay — ${esc(appName)}</title>
<style>
  body { margin: 0; padding: 24px; background: #f6f7f9; color: #111827; font: 14px/1.4 system-ui, -apple-system, sans-serif; }
  h1 { font-size: 20px; margin: 0 0 8px; } h2 { font-size: 15px; margin: 32px 0 8px; font-family: ui-monospace, monospace; }
  .legend { display: flex; flex-wrap: wrap; gap: 8px 16px; margin-bottom: 8px; }
  .key i { display: inline-block; width: 12px; height: 12px; border-radius: 3px; margin-right: 6px; vertical-align: -1px; }
  .screen { position: relative; box-shadow: 0 1px 4px rgba(0,0,0,.2); overflow: hidden; }
  .screen img { display: block; }
  .box { position: absolute; box-sizing: border-box; border: 3px solid; border-radius: 4px; }
  .label { position: absolute; left: 0; top: 0; max-width: calc(100% - 12px); overflow: hidden; text-overflow: ellipsis; color: #fff; font-size: 12px; padding: 2px 6px; border-bottom-right-radius: 4px; white-space: nowrap; }
  .coupling { border: 3px dashed #e11d48; background: #e11d4814; }
  .coupling .label { background: #e11d48; top: auto; bottom: 0; border-radius: 0 4px 0 0; }
</style>
</head>
<body>
<h1>Decomposition overlay — ${esc(appName)}</h1>
<p>Each captured screen with the proposed domains outlined where they begin: domain · MFE · slot · backends. Dashed red: a coupling to resolve. Hover a box for its full label.</p>
<div class="legend">${legend}</div>
${screens}
</body>
</html>
`;
}

/** A Figma plugin that builds the overlay as a page: a frame per screen, the screenshot, a labelled box per domain region. */
export function renderOverlayPlugin(overlay: Overlay, pngs: Record<string, Buffer>, appName: string): Record<string, string> {
  const images = Object.fromEntries(
    overlay.screens.filter((s) => pngs[s.screenshot]).map((s) => [s.screenshot, pngs[s.screenshot].toString('base64')])
  );
  const data = overlay.screens.map((s) => ({
    path: s.path,
    width: s.width,
    height: s.height,
    png: s.screenshot,
    boxes: [
      ...s.boxes.map((b) => ({ ...b.rect, color: b.color, label: b.label, dashed: false })),
      ...s.couplings.map((c) => ({ ...c.rect, color: '#e11d48', label: c.label, dashed: true })),
    ],
  }));
  const manifest = {
    name: `seans-mfe-tool decomposition overlay — ${appName}`,
    api: '1.0.0',
    main: 'code.js',
    editorType: ['figma'],
    documentAccess: 'dynamic-page',
    networkAccess: { allowedDomains: ['none'] },
  };
  const code = `// Generated by seans-mfe-tool decompose:present. Builds the decomposition overlay as a Figma page.
const NAME = ${JSON.stringify(appName)};
const SCREENS = ${JSON.stringify(data)};
const PNG = ${JSON.stringify(images)};

function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

const done = (async () => {
  const page = figma.createPage();
  page.name = 'Decomposition — ' + NAME;
  await figma.setCurrentPageAsync(page);
  const font = { family: 'Inter', style: 'Regular' };
  await figma.loadFontAsync(font);
  const frames = [];
  let y = 0;
  for (const s of SCREENS) {
    const frame = figma.createFrame();
    frame.name = s.path;
    frame.resize(s.width, s.height);
    frame.y = y;
    y += s.height + 200;
    page.appendChild(frame);
    const shot = figma.createRectangle();
    shot.name = 'screenshot';
    shot.resize(s.width, s.height);
    if (PNG[s.png]) {
      const image = figma.createImage(figma.base64Decode(PNG[s.png]));
      shot.fills = [{ type: 'IMAGE', imageHash: image.hash, scaleMode: 'FILL' }];
    }
    frame.appendChild(shot);
    for (const b of s.boxes) {
      const color = rgb(b.color);
      const box = figma.createRectangle();
      box.name = b.label;
      box.x = b.x;
      box.y = b.y;
      box.resize(Math.max(b.width, 1), Math.max(b.height, 1));
      box.fills = [{ type: 'SOLID', color, opacity: 0.12 }];
      box.strokes = [{ type: 'SOLID', color }];
      box.strokeWeight = 3;
      if (b.dashed) box.dashPattern = [8, 6];
      frame.appendChild(box);
      const label = figma.createText();
      label.fontName = font;
      label.characters = b.label;
      label.fontSize = 12;
      label.x = b.x + 4;
      label.y = b.y + 4;
      label.fills = [{ type: 'SOLID', color }];
      frame.appendChild(label);
    }
    frames.push(frame);
  }
  figma.viewport.scrollAndZoomIntoView(frames);
  figma.closePlugin('Placed ' + SCREENS.length + ' screen(s) on "' + page.name + '"');
})().catch((e) => figma.closePlugin('Overlay failed: ' + e.message));
`;
  return { 'manifest.json': `${JSON.stringify(manifest, null, 2)}\n`, 'code.js': code };
}
