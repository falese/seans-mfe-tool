/**
 * Records the decomposition demo (docs/media/decompose-demo.webm), one scene per
 * webm. Terminal scenes replay the real output that run.sh saved in
 * $DEMO_DIR/runs — only the working directory is shortened to /work and the
 * repository to ~/seans-mfe-tool; browser scenes drive the live monolith, the
 * generated overlay and the workspace. See README.md for the order.
 *
 *   DEMO_DIR=/abs/demo node record.js [scene...]      (no scenes: every scene)
 */
/* global window, document -- used only inside page.evaluate(), which runs in the browser */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const REPO = path.resolve(__dirname, '../../..');
if (!process.env.DEMO_DIR) {
  console.error('set DEMO_DIR to the directory run.sh wrote (it holds evidence/ and runs/)');
  process.exit(64);
}
const DEMO = path.resolve(process.env.DEMO_DIR);
const RUNS = path.join(DEMO, 'runs');
const OUT = path.join(DEMO, 'scenes');
const VIEW = { width: 1440, height: 810 };
const SIZE = { width: 1280, height: 720 };
fs.mkdirSync(OUT, { recursive: true });

const clean = (s) =>
  s.split(DEMO).join('/work').split(REPO + '/').join('~/seans-mfe-tool/').replace(/\s+$/, '');
const run = (name) => clean(fs.readFileSync(path.join(RUNS, `${name}.out`), 'utf8')).replace(/^\n+/, '');

const CAPTION_CSS = `
  #demo-cap { position: fixed; left: 50%; bottom: 28px; transform: translateX(-50%); z-index: 2147483647;
    max-width: 1100px; padding: 14px 26px; border-radius: 12px; background: rgba(15,23,42,.88); color: #f8fafc;
    font: 600 22px/1.35 system-ui, -apple-system, 'Segoe UI', sans-serif; box-shadow: 0 8px 30px rgba(0,0,0,.35);
    transition: opacity .35s; text-align: center; }
  #demo-cap small { display: block; font-weight: 400; font-size: 16px; color: #cbd5e1; margin-top: 4px; }
  body.term #demo-cap { top: 22px; bottom: auto; }
  #demo-step { position: fixed; right: 24px; top: 20px; z-index: 2147483647; padding: 6px 14px; border-radius: 999px;
    background: #0f766e; color: #fff; font: 700 15px/1.2 system-ui, sans-serif; letter-spacing: .02em; }`;

async function caption(page, title, sub, step) {
  await page.evaluate(
    ({ css, title, sub, step }) => {
      if (!document.getElementById('demo-cap-style')) {
        const st = document.createElement('style');
        st.id = 'demo-cap-style';
        st.textContent = css;
        document.head.appendChild(st);
      }
      let cap = document.getElementById('demo-cap');
      if (!cap) {
        cap = document.createElement('div');
        cap.id = 'demo-cap';
        document.body.appendChild(cap);
      }
      cap.innerHTML = title ? `${title}${sub ? `<small>${sub}</small>` : ''}` : '';
      cap.style.opacity = title ? '1' : '0';
      let badge = document.getElementById('demo-step');
      if (step) {
        if (!badge) {
          badge = document.createElement('div');
          badge.id = 'demo-step';
          document.body.appendChild(badge);
        }
        badge.textContent = step;
      } else if (badge) badge.remove();
    },
    { css: CAPTION_CSS, title, sub, step }
  );
}

async function scene(name, fn) {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
  const dir = path.join(OUT, `.${name}`);
  fs.rmSync(dir, { recursive: true, force: true });
  const ctx = await browser.newContext({ viewport: VIEW, recordVideo: { dir, size: SIZE } });
  const page = await ctx.newPage();
  const t0 = Date.now();
  // A scene calls ready() once its first real frame is on screen; compose trims the lead before it.
  let lead = null;
  page.ready = () => { if (lead === null) lead = (Date.now() - t0) / 1000; };
  await fn(page);
  if (lead === null) lead = 0.4;
  const leads = fs.existsSync(path.join(OUT, 'leads.json')) ? JSON.parse(fs.readFileSync(path.join(OUT, 'leads.json'), 'utf8')) : {};
  leads[name] = lead;
  fs.writeFileSync(path.join(OUT, 'leads.json'), JSON.stringify(leads, null, 2));
  const video = page.video();
  await ctx.close();
  await browser.close();
  fs.renameSync(await video.path(), path.join(OUT, `${name}.webm`));
  fs.rmSync(dir, { recursive: true, force: true });
  console.log('recorded', name);
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- cards

function card(title, lines, foot) {
  return `<!doctype html><html><body style="margin:0;height:100vh;display:flex;align-items:center;justify-content:center;
    background:radial-gradient(circle at 30% 20%,#134e4a,#0f172a 70%);color:#f8fafc;font-family:system-ui,-apple-system,'Segoe UI',sans-serif">
    <div style="max-width:1100px;padding:40px">
      <div style="font-size:20px;letter-spacing:.18em;text-transform:uppercase;color:#5eead4;font-weight:700">seans-mfe-tool</div>
      <h1 style="font-size:64px;line-height:1.08;margin:18px 0 28px">${title}</h1>
      ${lines.map((l) => `<p style="font-size:28px;line-height:1.45;margin:8px 0;color:#cbd5e1">${l}</p>`).join('')}
      ${foot ? `<p style="font-size:20px;margin-top:40px;color:#94a3b8">${foot}</p>` : ''}
    </div></body></html>`;
}

// ---------------------------------------------------------------- terminal

const TERM = `<!doctype html><html><head><style>
  body { margin:0; height:100vh; background:#0b1220; display:flex; align-items:flex-start; justify-content:center; }
  .win { margin-top:118px; width:1400px; height:672px; background:#0f172a; border-radius:12px; box-shadow:0 20px 60px rgba(0,0,0,.5); overflow:hidden; border:1px solid #1e293b; }
  .bar { height:34px; background:#1e293b; display:flex; align-items:center; padding:0 14px; gap:8px; }
  .dot { width:12px; height:12px; border-radius:50%; } .t { color:#94a3b8; font:13px system-ui; margin-left:12px; }
  pre { margin:0; padding:16px 22px; height:606px; overflow:hidden; color:#e2e8f0; font:19px/1.36 'DejaVu Sans Mono','Menlo',monospace; white-space:pre-wrap; }
  .p { color:#5eead4; } .c { color:#f8fafc; font-weight:700; } .ok { color:#4ade80; } .st { color:#facc15; }
  .nx { color:#22d3ee; } .no { color:#f87171; } .dim { color:#64748b; } .wn { color:#fbbf24; }
  .cur { display:inline-block; width:10px; background:#5eead4; animation:b 1s steps(1) infinite; } @keyframes b { 50% { opacity:0 } }
</style></head><body class="term"><div class="win"><div class="bar"><span class="dot" style="background:#f87171"></span><span class="dot" style="background:#facc15"></span><span class="dot" style="background:#4ade80"></span><span class="t">~/work — seans-mfe-tool</span></div><pre id="o"></pre></div>
<script>
  const o = document.getElementById('o');
  const esc = (s) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;');
  function cls(line) {
    const t = line.trimStart();
    if (/^✓/.test(t)) return 'ok'; if (/^↻/.test(t)) return 'st'; if (/^→/.test(t) || /^next:/.test(t)) return 'nx';
    if (/^✗/.test(t)) return 'no'; if (/^·|^○/.test(t)) return 'dim'; if (/^coupling|^shared:/.test(t)) return 'wn';
    return '';
  }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  window.play = async (beats) => {
    for (const b of beats) {
      if (b.clear) { o.innerHTML = ''; continue; }
      if (b.cmd) {
        const line = document.createElement('span'); o.appendChild(line);
        line.innerHTML = '<span class="p">~/work $ </span>';
        const c = document.createElement('span'); c.className = 'c'; line.appendChild(c);
        const cur = document.createElement('span'); cur.className = 'cur'; cur.innerHTML = '&nbsp;'; line.appendChild(cur);
        for (const ch of b.cmd) { c.textContent += ch; await sleep(28); }
        await sleep(350); cur.remove(); o.appendChild(document.createTextNode('\\n'));
        if (b.work) { const w = document.createElement('span'); w.className = 'dim'; o.appendChild(w);
          for (let i = 0; i < b.work; i += 250) { w.textContent = '  working' + '.'.repeat((i / 250) % 4); await sleep(250); } w.remove(); }
        continue;
      }
      if (b.out) {
        for (const l of b.out.split('\\n')) {
          const s = document.createElement('span'); const k = cls(l); if (k) s.className = k;
          s.innerHTML = esc(l) + '\\n'; o.appendChild(s); o.scrollTop = o.scrollHeight; await sleep(b.lineMs ?? 70);
        }
        o.appendChild(document.createTextNode('\\n'));
        continue;
      }
      if (b.pause) await sleep(b.pause);
    }
  };
</script></body></html>`;

async function terminal(page, beats) {
  await page.setContent(TERM);
  await wait(200);
  page.ready();
  // Captions are driven from here, between beats, so they line up with the commands.
  for (const b of beats) {
    if (b.caption !== undefined) {
      await caption(page, b.caption, b.sub, b.step);
      continue;
    }
    await page.evaluate((x) => window.play([x]), b);
  }
}

// ---------------------------------------------------------------- scenes

const SCENES = {
  async '01-title'(page) {
    await page.setContent(card('Breaking up a monolith', ['A real run against <b>meridian-monolith</b>: one React app, three backends.', 'Watch it, read it, propose the pieces, shape and approve them.'], 'Every number on screen is from this run.'));
    await wait(200);
    page.ready();
    await wait(5200);
  },

  async '02-monolith'(page) {
    await page.goto('http://localhost:5090/docking');
    await page.getByText('Docking Board').first().waitFor({ timeout: 60000 });
    await wait(300);
    page.ready();
    await wait(1200);
    await caption(page, 'The starting point: one React app', 'meridian-monolith — seven areas sharing one store and one API client', 'BEFORE');
    await wait(3000);
    for (const route of ['/cargo', '/crew', '/life-support', '/concourse']) {
      const link = page.locator(`a[href="${route}"]`).first();
      if (await link.count()) await link.click();
      else await page.goto(`http://localhost:5090${route}`);
      await wait(1900);
    }
  },

  async '03-terminal-discover'(page) {
    await terminal(page, [
      { caption: 'Ask where you are', sub: 'flow:status reads the folder and names the next command', step: 'START' },
      { cmd: 'seans-mfe-tool flow:status ./evidence' },
      { out: run('01-status-empty'), lineMs: 90 },
      { pause: 2400 },
      { clear: true },
      { caption: 'Step 1 — watch the app', sub: 'drives it in a browser; maps every region on screen to the file that drew it', step: 'STEP 1' },
      { cmd: 'seans-mfe-tool decompose:capture http://localhost:5090 --out ./evidence --explore 20', work: 2200 },
      { out: run('02-capture'), lineMs: 160 },
      { pause: 2600 },
      { caption: 'Step 2 — read the code', sub: 'routes, imports, API calls — joined to what the app was seen to do', step: 'STEP 2' },
      { cmd: 'seans-mfe-tool decompose:analyze ~/seans-mfe-tool/examples/meridian-monolith --evidence ./evidence', work: 1500 },
      { out: run('04-analyze'), lineMs: 160 },
      { pause: 3200 },
    ]);
  },

  async '04-terminal-propose'(page) {
    await terminal(page, [
      { caption: 'Step 3 — propose the pieces', sub: 'a deterministic draft: domains, their data, couplings, specs per backend, test triage', step: 'STEP 3' },
      { cmd: 'seans-mfe-tool decompose:propose ./evidence', work: 800 },
      { out: run('05-propose'), lineMs: 110 },
      { pause: 5200 },
      { caption: 'Write the review package', sub: 'PROPOSAL.md, and every piece outlined on the real screens — HTML and Figma', step: 'STEP 4' },
      { clear: true },
      { cmd: 'seans-mfe-tool decompose:present ./evidence/proposal', work: 600 },
      { out: run('07-present'), lineMs: 160 },
      { pause: 2000 },
    ]);
  },

  async '05-overlay'(page) {
    await page.goto('file://' + path.join(DEMO, 'evidence/proposal/overlay/index.html'));
    await wait(800);
    page.ready();
    await caption(page, 'The proposal, drawn over the app', 'each colour is a proposed piece; dashed red marks a coupling to resolve', 'STEP 4');
    await wait(2600);
    for (const route of ['/docking', '/cargo', '/life-support']) {
      await page.evaluate((r) => {
        const el = [...document.querySelectorAll('h2, h3, p, div')].find((n) => n.childElementCount === 0 && n.textContent.trim() === r);
        if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 8, behavior: 'instant' });
      }, route);
      await wait(2300);
    }
  },

  async '06-workspace'(page) {
    await page.goto('http://127.0.0.1:4611/');
    await page.getByText('Decomposition workspace').waitFor({ timeout: 30000 });
    await page.locator('img, svg').first().waitFor({ timeout: 30000 });
    await wait(1200);
    page.ready();
    await wait(400);
    await caption(page, 'The workspace — for product owners', 'decompose:workspace: the same plan, shaped with clicks instead of a terminal', 'SHAPE');
    await wait(3000);
    for (const id of ['cargo', 'docking']) {
      const chip = page.getByRole('button', { name: id, exact: true }).first();
      if (await chip.count()) {
        await chip.click();
        await wait(1700);
      }
    }
    await caption(page, 'Rename a piece', 'every change is a named edit — checked, then saved to the plan', 'SHAPE');
    await page.getByRole('tab', { name: 'Shape' }).click();
    const group = page.getByRole('group', { name: 'Rename a domain' });
    await group.scrollIntoViewIfNeeded();
    await wait(900);
    await group.getByLabel('Domain').selectOption('shell');
    await wait(700);
    await group.getByLabel('New name').pressSequentially('console', { delay: 90 });
    await wait(600);
    await group.getByRole('button', { name: 'Rename' }).click();
    await wait(2200);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await wait(1800);
    await caption(page, 'Approve', 'records who, when, and exactly which version of the plan', 'APPROVE');
    await page.getByRole('tab', { name: 'Approve' }).click();
    await wait(1800);
    await page.getByRole('button', { name: 'Approve this proposal' }).click();
    await wait(3600);
  },

  async '07-terminal-status'(page) {
    await terminal(page, [
      { caption: 'Back in the terminal: where are we now?', sub: 'the rename changed the plan, so the review package is out of date', step: 'CHECK' },
      { cmd: 'seans-mfe-tool flow:status ./evidence' },
      { out: run('08-status-after-ui'), lineMs: 90 },
      { pause: 3400 },
      { clear: true },
      { caption: 'Run what it names', sub: 'freshness is by content, so a branch switch cannot fake it', step: 'CHECK' },
      { cmd: run('08-status-after-ui').match(/next: (.*)/)[1].replace('/work/', './') , work: 600 },
      { out: run('09-present-again'), lineMs: 140 },
      { cmd: 'seans-mfe-tool flow:status ./evidence' },
      { out: run('10-status-final'), lineMs: 90 },
      { pause: 4200 },
    ]);
  },

  async '08-end'(page) {
    await page.setContent(card('Built today', ['Watch → read → propose → shape → approve, and the parity check that proves nothing changed.', 'Next: generating the pieces from the approved plan (#410).'], 'docs/decompose-runbook.md · seans-mfe-tool flow:status'));
    await wait(200);
    page.ready();
    await wait(5600);
  },
};

(async () => {
  const names = process.argv.slice(2);
  for (const [name, fn] of Object.entries(SCENES)) {
    if (names.length === 0 || names.includes(name)) await scene(name, fn);
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
