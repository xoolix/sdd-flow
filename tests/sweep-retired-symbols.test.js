// Feature 024 (remove-auto-pr) retired ten symbols from the PR-gate machinery. This
// file is the AC5 sweep: it walks the repo's living surface — instructions an agent
// reads and executes, plus code — and fails if any of the ten still appears anywhere
// on it. That is a materially different check than "does the string still exist in
// the repo": it deliberately excludes docs/ and specs/, where naming a deleted symbol
// is the whole job (docs/adr/0004-cli-does-not-open-prs.md explains what was removed
// and why; archived specs under specs/archive/ describe features that used these
// commands while they were still current). A hit inside the walked roots means a
// dangling instruction or call site; a hit inside docs/ or specs/ means a decision
// record or a historical spec doing exactly what it's for. See spec.md's AC5 and
// decisions.md's DISCOVERY-ACCEPTED entries for the reasoning behind that line.
//
// This file's own source has to contain all ten symbols as literal search strings —
// there's no way to write "look for the string X" without writing X. That means a
// walk that included this file would match itself and stay red forever. The fix
// tasks.md settled on is narrow: exclude only this one path (SELF_PATH below) from
// the walk, not tests/** wholesale. Every other file under tests/, including
// sdd.test.js, still gets swept — widening the exclusion to the whole directory
// would silently stop protecting against exactly the incidental prose mentions this
// feature's discovery phase found living there. Don't add more exclusions here to
// make a future failure pass; fix the offending file instead.
//
// A second, narrower case of the same self-reference problem showed up inside
// tests/sdd.test.js itself once T005 actually ran this sweep: several of T002's and
// T004's own regression tests (AC1, AC4, the .pr-opened-sentinel case of AC6) prove a
// retired command/string is truly gone by naming it literally — invoking `sdd open-pr`
// and checking it fails, or asserting `.not.toContain("ready-to-pr")` against a prose
// file. That is a third category, distinct from both a dangling live reference and a
// historical mention: a proof of removal. Deleting or rewording those tests would
// remove real AC coverage; excluding tests/sdd.test.js from the walk would hollow out
// the sweep exactly the way excluding tests/** wholesale would. The fix is the same
// shape as SELF_PATH, just scoped to lines instead of a whole file: a line wrapped
// between a `sdd-sweep-exempt:start` and `sdd-sweep-exempt:end` marker comment is
// skipped by the scan below. Every such block in this repo exists only around a
// proof-of-removal assertion or the test title naming it — grep for the marker to see
// every instance. Do not add one to dodge a real dangling reference.

const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");

// The ten symbols retired by feature 024.
const RETIRED_SYMBOLS = [
  "cmd_open_pr",
  "build_pr_body_file",
  "build_pr_title",
  "append_decisions_capped",
  "write_pr_opened_sentinel",
  "extract_section",
  "PR_BODY_MAX_CHARS",
  ".pr-opened",
  "open-pr",
  "ready-to-pr",
];

// The living surface: code plus the instructions agents read and act on. docs/ and
// specs/ are deliberately not here — see the file-level comment above.
const WALK_ROOTS = ["bin", "src", ".claude", ".specify/templates", "tests"];

// Ordinary generated/VCS directories, excluded for the ordinary reason — not part of
// this repo's authored surface.
const EXCLUDED_DIR_NAMES = new Set(["node_modules", ".git"]);

// The one path excluded from the walk, and the only one — see the file-level comment.
const SELF_PATH = "tests/sweep-retired-symbols.test.js";

// Marker comments that bracket a proof-of-removal block (see the file-level comment's
// third paragraph). Lines between a start and its matching end are not scanned.
const EXEMPT_START_MARKER = "sdd-sweep-exempt:start";
const EXEMPT_END_MARKER = "sdd-sweep-exempt:end";

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDED_DIR_NAMES.has(entry.name)) {
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, out);
    } else if (entry.isFile()) {
      out.push(fullPath);
    }
  }
}

function livingSurfaceFiles() {
  const files = [];
  for (const root of WALK_ROOTS) {
    const absRoot = path.join(repoRoot, root);
    if (fs.existsSync(absRoot)) {
      walk(absRoot, files);
    }
  }
  return files
    .map((absPath) => path.relative(repoRoot, absPath).split(path.sep).join("/"))
    .filter((relPath) => relPath !== SELF_PATH);
}

// Scans one file's content line by line, skipping any span wrapped in the
// sdd-sweep-exempt markers, and returns "path:line: "symbol"" strings for every hit.
function findHits(relPath, content) {
  const hits = [];
  const lines = content.split("\n");
  let exempt = false;

  lines.forEach((line, index) => {
    if (line.includes(EXEMPT_START_MARKER)) {
      exempt = true;
      return;
    }
    if (line.includes(EXEMPT_END_MARKER)) {
      exempt = false;
      return;
    }
    if (exempt) {
      return;
    }
    for (const symbol of RETIRED_SYMBOLS) {
      if (line.includes(symbol)) {
        hits.push(`${relPath}:${index + 1}: "${symbol}"`);
      }
    }
  });

  return hits;
}

describe("sweep: retired 024 symbols do not survive on the living surface (AC5)", () => {
  test("no file under bin/, src/, .claude/**, .specify/templates/**, or tests/** (this file excluded) contains any of the ten retired symbols outside a documented proof-of-removal block", () => {
    const hits = [];

    for (const relPath of livingSurfaceFiles()) {
      const content = fs.readFileSync(path.join(repoRoot, relPath), "utf8");
      hits.push(...findHits(relPath, content));
    }

    expect(hits).toEqual([]);
  });
});
