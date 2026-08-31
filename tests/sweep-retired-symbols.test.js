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
// Two paths are excluded from the walk by name, not by any in-file marker — see
// EXCLUDED_PATHS below:
//
//   - tests/sweep-retired-symbols.test.js (this file) — there's no way to write
//     "look for the string X" without writing X, so a walk that included itself
//     would match its own symbol list and stay red forever.
//   - tests/retired-symbol-proofs.test.js — five regression tests prove a retired
//     command or string is truly gone by naming it literally: invoking `sdd open-pr`
//     and checking it fails, or asserting `.not.toContain("ready-to-pr")` against a
//     prose file. That is a proof of removal, not a dangling reference — deleting or
//     rewording those tests would remove real AC coverage.
//
// This file used to carry an in-file marker mechanism (`sdd-sweep-exempt:start`/
// `:end` comments inside tests/sdd.test.js) instead of moving those five tests out.
// Four review rounds each closed one way to defeat it — see
// specs/024-remove-auto-pr/decisions.md's JUDGMENT-DAY-HIGH entries — and the last
// one found a hole in the *content* check that no amount of narrowing the marker's
// rules would close for good. The fix was to remove the mechanism, not add a fifth
// layer: a path exclusion has no rules to defeat. It is a hole in the sweep by
// construction (anything in either excluded file is unscanned), but a narrow and
// visible one — two paths, one line each, and any addition to either file is a diff
// a reviewer sees. Every other file under bin/, src/, .claude/**,
// .specify/templates/**, and tests/** — tests/sdd.test.js included, now that the
// five proof tests moved out of it — is swept with zero exceptions. Don't add a
// third exclusion to make a future failure pass; fix the offending file instead.

const fs = require("fs");
const os = require("os");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const repoRootReal = fs.realpathSync(repoRoot);

// Directories a followed symlink must not resolve into even though they sit
// inside the repo -- docs/ and specs/ are excluded from AC5's walked surface on
// purpose (see the file-level comment), and a symlink shouldn't be able to pull
// their content back in sideways. Re-review cycle 2, low finding #3.
const EXCLUDED_REAL_ROOTS = [path.join(repoRootReal, "docs"), path.join(repoRootReal, "specs")];

// True when `real` is `boundary` itself or somewhere underneath it.
function isWithin(real, boundary) {
  return real === boundary || real.startsWith(boundary + path.sep);
}

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

// The only two paths excluded from the walk — see the file-level comment for why
// each one has to contain the retired symbols as literal strings.
const EXCLUDED_PATHS = new Set(["tests/sweep-retired-symbols.test.js", "tests/retired-symbol-proofs.test.js"]);

// Walks dir following symlinks (statSync, not Dirent.isDirectory()/isFile() -- those
// report the directory-entry type, not the resolved target, so a symlinked file or
// directory would otherwise be invisible). link_or_copy() in bin/sdd deploys
// .claude/skills/* and .claude/rules/*.md via `ln -sfn` by default, so a consumer
// project's walked surface is symlinked by construction -- not a hypothetical case.
// visitedRealDirs guards against a symlink cycle sending this into infinite recursion.
//
// `containmentRoot`, when given, is the realpath boundary a followed symlink must
// stay inside -- anything whose resolved target escapes it, or lands under
// EXCLUDED_REAL_ROOTS, is skipped instead of walked (re-review cycle 2, low
// finding #3). It's optional so the symlink-containment fixture tests below, which
// walk an ad hoc tmp directory unrelated to this repo, keep working unchanged --
// passing no boundary means "don't restrict", the behavior they already depend on.
function walk(dir, out, visitedRealDirs, containmentRoot) {
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
    let real = null;
    if (containmentRoot) {
      real = fs.realpathSync(fullPath);
      const escapesRoot = !isWithin(real, containmentRoot);
      const entersExcluded = EXCLUDED_REAL_ROOTS.some((root) => isWithin(real, root));
      if (escapesRoot || entersExcluded) {
        // Scans less noise, not less coverage: a symlink pointing outside the
        // repo or into docs/specs can only ever add a false positive against
        // legitimate historical prose, never hide a live dangling reference --
        // see the file-level comment and decisions.md's re-review cycle 2 entry.
        continue;
      }
    }
    if (stat.isDirectory()) {
      real = real || fs.realpathSync(fullPath);
      if (visited.has(real)) {
        continue; // cycle guard
      }
      visited.add(real);
      walk(fullPath, out, visited, containmentRoot);
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
      walk(absRoot, files, undefined, repoRootReal);
    }
  }
  return files
    .map((absPath) => path.relative(repoRoot, absPath).split(path.sep).join("/"))
    .filter((relPath) => !EXCLUDED_PATHS.has(relPath));
}

// Scans one file's content line by line and returns "path:line: "symbol"" strings for
// every hit. No exemption mechanism: every file reaching this function is scanned in
// full, with no marker, no exempt zone, and no per-file branching. The two paths that
// legitimately contain these symbols as literal strings never reach this function at
// all -- they're removed from the walk itself by EXCLUDED_PATHS above.
function findHits(relPath, content) {
  const hits = [];
  const lines = content.split("\n");
  lines.forEach((line, index) => {
    for (const symbol of RETIRED_SYMBOLS) {
      if (line.includes(symbol)) {
        hits.push(`${relPath}:${index + 1}: "${symbol}"`);
      }
    }
  });
  return hits;
}

describe("sweep: retired 024 symbols do not survive on the living surface (AC5)", () => {
  test("no file under bin/, src/, .claude/**, .specify/templates/**, or tests/** (excluding this file and tests/retired-symbol-proofs.test.js) contains any of the ten retired symbols", () => {
    const hits = [];

    for (const relPath of livingSurfaceFiles()) {
      const content = fs.readFileSync(path.join(repoRoot, relPath), "utf8");
      hits.push(...findHits(relPath, content));
    }

    expect(hits).toEqual([]);
  });
});

// Re-review cycle 2, low finding #3: the walk followed a symlink wherever it
// resolved, with no containment to the repo or exclusion of docs/specs. The
// judge and reviewer characterized this as blast radius (more false positives
// against legitimate historical prose), not a way to hide a dangling
// reference -- these tests pin the fix, not a new security boundary.
describe("sweep: walk() symlink containment (re-review cycle 2, low finding #3)", () => {
  function makeFixtureDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), "sweep-containment-fixture-"));
  }

  test("walk() does not follow a symlink that resolves outside the given containment root", () => {
    const fixtureDir = makeFixtureDir();
    const outsideDir = makeFixtureDir();
    try {
      fs.writeFileSync(path.join(outsideDir, "external.js"), "sdd open-pr should not be seen from here\n");
      fs.symlinkSync(outsideDir, path.join(fixtureDir, "escape-link"), "dir");

      const files = [];
      walk(fixtureDir, files, undefined, fs.realpathSync(fixtureDir));

      expect(files.some((f) => f.includes("external.js"))).toBe(false);
    } finally {
      fs.rmSync(fixtureDir, { recursive: true, force: true });
      fs.rmSync(outsideDir, { recursive: true, force: true });
    }
  });

  test("walk() does not follow a symlink that resolves into docs/ or specs/", () => {
    const fixtureDir = makeFixtureDir();
    try {
      fs.symlinkSync(path.join(repoRoot, "docs"), path.join(fixtureDir, "docs-link"), "dir");

      const files = [];
      walk(fixtureDir, files, undefined, repoRootReal);

      expect(files.some((f) => f.startsWith(path.join(fixtureDir, "docs-link")))).toBe(false);
    } finally {
      fs.rmSync(fixtureDir, { recursive: true, force: true });
    }
  });

  test("livingSurfaceFiles() still finds real files through a same-repo symlink (containment isn't over-broad)", () => {
    // Guards against a too-strict fix: a symlink that stays inside the repo and
    // outside docs/specs must still be walked normally.
    const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "sweep-containment-fixture-"));
    try {
      fs.symlinkSync(path.join(repoRoot, "package.json"), path.join(fixtureDir, "package-link.json"), "file");

      const files = [];
      walk(fixtureDir, files, undefined, repoRootReal);

      expect(files.some((f) => f.endsWith("package-link.json"))).toBe(true);
    } finally {
      fs.rmSync(fixtureDir, { recursive: true, force: true });
    }
  });
});

// Judge medium, re-review cycle 3 (accepted, taken before archiving — see
// decisions.md): EXCLUDED_PATHS and the two files it names had no automated pin.
// A silent third exclusion, or unrelated content landing inside the excluded
// proof file, depended entirely on a reviewer noticing the diff -- the same
// "trust the reviewer" exposure this feature's history shows reviewers already
// missed twice. Unlike the four content-validating rules that failed across
// three review rounds (marker balance, span content, span count), this pin has
// no content logic for a crafted construction to satisfy sideways: it is a set
// equality and a title/count comparison, nothing else. Do not turn it into a
// parser -- if a test is ever added, removed, or renamed here on purpose, this
// pin is what's supposed to change, not survive unnoticed.
describe("sweep: the two-file exclusion hatch is pinned (re-review cycle 3, medium)", () => {
  test("EXCLUDED_PATHS names exactly these two files and no others", () => {
    expect(EXCLUDED_PATHS).toEqual(
      new Set(["tests/sweep-retired-symbols.test.js", "tests/retired-symbol-proofs.test.js"]),
    );
  });

  test("tests/retired-symbol-proofs.test.js contains exactly these five tests, pinned by title", () => {
    const proofsPath = path.join(repoRoot, "tests", "retired-symbol-proofs.test.js");
    const content = fs.readFileSync(proofsPath, "utf8");

    // The file's entire content-by-design promise (see its own header comment):
    // exactly these five named proofs of removal, nothing else.
    const expectedTitles = [
      "open-pr no longer exists: unknown command in dispatch, and usage() does not list it (024 AC1)",
      "git.md rewrites the never-commit policy to commit-per-slice + auto-commit knob (T013)",
      "sdd-next and sdd-auto drop the ready-to-pr gate and its never-ask exception (024 AC4)",
      "CLAUDE.md master docs retire the PR gate — human-input list, pipeline diagram, detection table, workflow diagram, archive format, commands (024 AC4)",
      "reports archived for an archived feature whether or not a stray .pr-opened sentinel exists",
    ];

    for (const title of expectedTitles) {
      // Renaming a title breaks this line, independent of the count check below.
      expect(content).toContain(`test("${title}"`);
    }

    // Adding a sixth test (or deleting one without updating this list) breaks
    // the count, independent of which titles still match above.
    const testCallCount = (content.match(/\btest\(/g) || []).length;
    expect(testCallCount).toBe(expectedTitles.length);
  });
});
