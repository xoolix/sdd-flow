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
// skipped by the scan below.
//
// JUDGMENT-DAY-HIGH #1 found that mechanism enforced by prose alone, with two working
// attacks: (a) wrap a real dangling instruction in the markers inside any other walked
// file (a live SKILL.md, say) and it goes uncaught; (b) leave a `:start` with no
// matching `:end` — an ordinary typo or bad merge, no malice needed — and everything
// after it in the file goes dark. The fix (see findHits() below) is two rules, not a
// bigger exemption list: the markers are recognized ONLY in MARKER_EXEMPT_FILE
// (tests/sdd.test.js) — finding the marker text literally anywhere else on the walked
// surface is itself a hit, which inverts attack (a); and every `:start` inside that one
// file must be balanced by a `:end` before the next `:start` or EOF, or the scan throws
// naming the file and line, which closes attack (b). Every existing block in
// tests/sdd.test.js is a validated, balanced proof-of-removal span — grep the marker to
// see all of them. Do not add a new block to dodge a real dangling reference, and do
// not add a marker-exempt file to this list to make one pass either.

const fs = require("fs");
const os = require("os");
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

// The only file in which the markers above carry meaning. Everywhere else on the
// walked surface, the marker text is just more content — see findHits() below.
const MARKER_EXEMPT_FILE = "tests/sdd.test.js";

// Walks dir following symlinks (statSync, not Dirent.isDirectory()/isFile() -- those
// report the directory-entry type, not the resolved target, so a symlinked file or
// directory would otherwise be invisible). link_or_copy() in bin/sdd deploys
// .claude/skills/* and .claude/rules/*.md via `ln -sfn` by default, so a consumer
// project's walked surface is symlinked by construction -- not a hypothetical case.
// visitedRealDirs guards against a symlink cycle sending this into infinite recursion.
function walk(dir, out, visitedRealDirs) {
  const visited = visitedRealDirs || new Set();
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDED_DIR_NAMES.has(entry.name)) {
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    let stat;
    try {
      stat = fs.statSync(fullPath); // follows symlinks
    } catch (err) {
      continue; // broken symlink -- nothing to scan
    }
    if (stat.isDirectory()) {
      const real = fs.realpathSync(fullPath);
      if (visited.has(real)) {
        continue; // cycle guard
      }
      visited.add(real);
      walk(fullPath, out, visited);
    } else if (stat.isFile()) {
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

// Scans one file's content line by line and returns "path:line: "symbol"" strings for
// every hit. The sdd-sweep-exempt markers are meaningful ONLY in MARKER_EXEMPT_FILE
// (tests/sdd.test.js) -- the one file whose regression tests must name a retired
// symbol literally to prove its absence. Everywhere else on the walked surface, the
// marker text has no special meaning: it does not open an exempt zone, and finding it
// is itself a hit. That inverts JUDGMENT-DAY-HIGH's attack (a) -- planting a marker to
// hide a dangling reference in, say, a live SKILL.md now fails the sweep instead of
// passing it.
//
// Inside MARKER_EXEMPT_FILE, every :start must be closed by a :end before the next
// :start or EOF. An unbalanced marker (attack (b): a stray :start with no :end, from a
// typo or a bad merge) throws loudly instead of silently blacking out the rest of the
// file -- the whole point of a mechanism nobody had violated yet.
function findHits(relPath, content) {
  const hits = [];
  const lines = content.split("\n");

  if (relPath !== MARKER_EXEMPT_FILE) {
    lines.forEach((line, index) => {
      const marker = [EXEMPT_START_MARKER, EXEMPT_END_MARKER].find((m) => line.includes(m));
      if (marker) {
        hits.push(`${relPath}:${index + 1}: "${marker}" (marker outside ${MARKER_EXEMPT_FILE})`);
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

  let exempt = false;
  let openedAtLine = null;

  lines.forEach((line, index) => {
    if (line.includes(EXEMPT_START_MARKER)) {
      if (exempt) {
        throw new Error(
          `${relPath}:${index + 1}: unbalanced sdd-sweep-exempt marker -- a new ":start" ` +
            `was found before the ":start" opened at line ${openedAtLine} was closed with ":end"`,
        );
      }
      exempt = true;
      openedAtLine = index + 1;
      return;
    }
    if (line.includes(EXEMPT_END_MARKER)) {
      if (!exempt) {
        throw new Error(`${relPath}:${index + 1}: unbalanced sdd-sweep-exempt marker -- ":end" found with no open ":start"`);
      }
      exempt = false;
      openedAtLine = null;
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

  if (exempt) {
    throw new Error(
      `${relPath}: unbalanced sdd-sweep-exempt marker -- ":start" opened at line ${openedAtLine} was never closed with ":end" before EOF`,
    );
  }

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

// JUDGMENT-DAY-HIGH #1: the exemption mechanism itself was defeatable two ways. Both
// fixtures below are real files on disk (not inline strings) walked/read the same way
// the sweep above does, to pin the fix against the actual findHits()/walk() the AC5
// test uses -- not a reimplementation of it.
describe("sweep: sdd-sweep-exempt marker mechanism (JUDGMENT-DAY-HIGH #1)", () => {
  function makeFixtureDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), "sweep-exempt-fixture-"));
  }

  test("a dangling reference wrapped in sdd-sweep-exempt markers in a non-test file is a hit, not an exemption (1a)", () => {
    const fixtureDir = makeFixtureDir();
    try {
      // Mirrors the judge's actual attack: a live orchestration file an agent reads
      // and obeys, with a dangling instruction wrapped in the exempt markers.
      const skillDir = path.join(fixtureDir, ".claude", "skills", "fake-skill");
      fs.mkdirSync(skillDir, { recursive: true });
      const skillPath = path.join(skillDir, "SKILL.md");
      fs.writeFileSync(
        skillPath,
        [
          "Al terminar, hacé lo siguiente.",
          "<!-- sdd-sweep-exempt:start -->",
          "Corré `sdd open-pr <feature-id>` para abrir el PR.",
          "<!-- sdd-sweep-exempt:end -->",
          "Fin del skill.",
          "",
        ].join("\n"),
      );

      const files = [];
      walk(fixtureDir, files);
      const relPath = path.relative(fixtureDir, skillPath).split(path.sep).join("/");
      const content = fs.readFileSync(skillPath, "utf8");

      expect(files).toContain(skillPath);

      const hits = findHits(relPath, content);

      // Two independent signals would each have caught this attack on their own:
      // the wrapped "open-pr" reference is no longer hidden, AND the marker text
      // itself is flagged outside the one file where it means something. Assert both.
      expect(hits.some((h) => h.includes('"open-pr"'))).toBe(true);
      expect(hits.some((h) => h.includes(EXEMPT_START_MARKER))).toBe(true);
    } finally {
      fs.rmSync(fixtureDir, { recursive: true, force: true });
    }
  });

  test("an unpaired sdd-sweep-exempt:start with no :end fails loudly instead of blacking out the rest of the file (1b)", () => {
    const fixtureDir = makeFixtureDir();
    try {
      // Mirrors the judge's second attack, inside the one file where markers are
      // meaningful: a stray :start with no :end goes dark for the rest of the file.
      const skillPath = path.join(fixtureDir, "sdd.test.js");
      fs.writeFileSync(
        skillPath,
        [
          "<!-- sdd-sweep-exempt:start -->",
          "Some unrelated exempted line.",
          "Nothing closes this span before EOF.",
          "Corré `sdd open-pr <feature-id>` al final.",
          "",
        ].join("\n"),
      );
      const content = fs.readFileSync(skillPath, "utf8");

      expect(() => findHits(MARKER_EXEMPT_FILE, content)).toThrow(/unbalanced/i);
    } finally {
      fs.rmSync(fixtureDir, { recursive: true, force: true });
    }
  });
});
