#!/usr/bin/env node
/**
 * Docs link-hygiene check (Tier-1: path existence).
 *
 * Walks every Markdown file under docs/, extracts relative Markdown links, and
 * verifies each target resolves on disk. Implements the Tier-3 (CI) automation
 * called for by the Cross-Reference Standards
 * (docs/platform-design-review/cross-reference-standards.md).
 *
 * Scope — what is checked:
 *   - Inline links `[text](target)` and reference definitions `[id]: target`
 *   - Only *relative* targets (repo-internal cross-references)
 *
 * Scope — what is intentionally skipped (out of Tier-1):
 *   - External links (http:, https:, mailto:, tel:)
 *   - Pure in-page anchors (`#section`)
 *   - Absolute filesystem paths (`/Users/...`, `/home/...`) — not repo-relative
 *   - Links inside fenced (```) or inline (`) code spans
 *
 * A link target's `#anchor` / `?query` suffix is stripped before the path check;
 * anchor *validity* is a Tier-2 concern and not enforced here.
 *
 * Exit code: 0 when every relative link resolves, 1 otherwise (with a report).
 *
 * Refs #231 (R5), #222 (link hygiene), CA / gap G15.
 */
'use strict'

const fs = require('fs')
const path = require('path')

const REPO_ROOT = path.resolve(__dirname, '..')
const DOCS_ROOT = path.join(REPO_ROOT, 'docs')

/** Recursively collect *.md files under a directory. */
function collectMarkdown(dir) {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...collectMarkdown(full))
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      out.push(full)
    }
  }
  return out
}

/** Strip fenced code blocks and inline code so we don't lint example links. */
function stripCode(md) {
  return md
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/`[^`\n]*`/g, (m) => m.replace(/[^\n]/g, ' '))
}

const INLINE_LINK = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g
const REF_DEF = /^\s*\[[^\]]+\]:\s+(\S+)/gm

function isCheckable(target) {
  if (!target) return false
  if (/^[a-z][a-z0-9+.-]*:/i.test(target)) return false // scheme (http:, mailto:)
  if (target.startsWith('#')) return false // in-page anchor
  if (target.startsWith('/')) return false // absolute fs path — out of Tier-1
  return true
}

function extractTargets(md) {
  const body = stripCode(md)
  const targets = new Set()
  let m
  while ((m = INLINE_LINK.exec(body)) !== null) targets.add(m[1])
  while ((m = REF_DEF.exec(body)) !== null) targets.add(m[1])
  return [...targets].filter(isCheckable)
}

function resolveTarget(fromFile, target) {
  const clean = target.split('#')[0].split('?')[0]
  if (clean === '') return true // pure anchor after strip
  return fs.existsSync(path.resolve(path.dirname(fromFile), clean))
}

function main() {
  if (!fs.existsSync(DOCS_ROOT)) {
    console.error(`docs/ not found at ${DOCS_ROOT}`)
    process.exit(1)
  }

  const files = collectMarkdown(DOCS_ROOT)
  const broken = []
  let checked = 0

  for (const file of files) {
    const md = fs.readFileSync(file, 'utf8')
    for (const target of extractTargets(md)) {
      checked++
      if (!resolveTarget(file, target)) {
        broken.push({ file: path.relative(REPO_ROOT, file), target })
      }
    }
  }

  console.log(
    `Doc link check: ${files.length} files, ${checked} relative links checked, ` +
      `${broken.length} broken.`,
  )

  if (broken.length > 0) {
    console.log('\nBroken relative links:')
    for (const b of broken) console.log(`  ${b.file} -> ${b.target}`)
    process.exit(1)
  }

  console.log('All relative doc links resolve.')
}

main()
