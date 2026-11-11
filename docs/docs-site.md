# The documentation site — how it is published

The [`Publish docs site`](../.github/workflows/pages.yml) workflow is the repository's
**single** GitHub Pages publisher. On a push to `main` that touches the site sources it
assembles a `_site/` directory, verifies it, and deploys:

```
/                                    docs/index.html         — landing page
/404.html                            docs/index.html         — fallback for a bad URL
/system-map.html                     docs/system-map.html    — the system map
/slides/platform-architecture.html   built from docs/slides/ — the architecture deck
/slides/platform-architecture.pdf
```

Four things this deliberately does *not* do:

- **No build step for the map.** `docs/system-map.html` is copied verbatim. It is
  self-contained by design, so there is no bundler, no base-path rewriting, and nothing
  to keep in sync.
- **The map never waits on the deck.** The deck needs Marp and a headless browser — the
  most failure-prone steps in the pipeline — so both are non-fatal. If the deck cannot be
  built, [`scripts/assemble-site.js`](../scripts/assemble-site.js) removes its card from
  the landing page and the site publishes without it, with a workflow warning. A failed
  deck build costs you the deck, never the system map, and never leaves a link to a page
  that was not published. (The card is delimited in `docs/index.html` by
  `<!-- deck-card:start -->` / `<!-- deck-card:end -->`; the script errors out if those
  markers go missing rather than publishing a dangling link.)
- **No root-relative paths.** The site is served from `/seans-mfe-tool/`, not `/`, so
  every in-site link is relative. [`scripts/check-site.js`](../scripts/check-site.js) runs
  in the workflow and fails the build on any root-relative link, unresolvable in-site
  link, or externally-loaded asset.
- **No second Pages publisher.** [`slides.yml`](../.github/workflows/slides.yml) builds
  the deck and keeps it as a workflow artifact for PR review, but does not deploy — two
  workflows uploading a Pages artifact would each overwrite the other's whole site.

To reproduce either outcome locally:

```bash
# deck present
mkdir -p _site/slides && echo '<html><title>deck</title></html>' > _site/slides/platform-architecture.html
node scripts/assemble-site.js _site && node scripts/check-site.js _site

# deck build failed
rm -rf _site && node scripts/assemble-site.js _site && node scripts/check-site.js _site
```

Pull requests touching the site build and verify it, and upload a `docs-site-preview`
artifact instead of deploying.

> **One-time repository setting:** GitHub Pages must be set to build from **GitHub
> Actions** — *Settings → Pages → Build and deployment → Source: GitHub Actions*. This
> cannot be set from a workflow.
