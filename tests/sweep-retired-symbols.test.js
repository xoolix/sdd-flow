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
//
// `containmentRoot`, when given, is the realpath boundary a followed symlink must
// stay inside -- anything whose resolved target escapes it, or lands under
// EXCLUDED_REAL_ROOTS, is skipped instead of walked (re-review cycle 2, low
// finding #3). It's optional so the JUDGMENT-DAY-HIGH #1 fixture tests below, which
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
    .filter((relPath) => relPath !== SELF_PATH);
}

// JUDGMENT-DAY-HIGH #2 found that narrowing the marker's *location* to
// MARKER_EXEMPT_FILE, plus balance-checking, still let a real dangling
// instruction through as long as it was wrapped in a balanced, correctly-placed
// pair inside that one file -- a comment-only maintenance note reading "once the
// new gate lands, run `sdd open-pr` by hand here" is legal under both of the
// previous rules and is not a proof of removal. The two rules above verified
// *structure* (where the markers may appear, and that they nest correctly);
// neither looked at what a span actually contains. This closes that: a span
// only counts as an exemption if its content is a genuine proof of removal.
//
// The five spans that exist today (grep EXEMPT_START_MARKER in
// tests/sdd.test.js to see them) are written one of two ways: an expect(...)
// call whose own argument names a retired symbol directly, or an expect(...)
// call sitting next to a setup line (fs.writeFileSync, sddFail, a test title)
// that passes a retired symbol as a literal argument -- e.g. the AC6 test that
// writes a stray `.pr-opened` file and then asserts the resulting status is
// unaffected, without ever putting ".pr-opened" inside the expect() itself.
// Both shapes have one thing in common a comment-only note doesn't: actual code
// (not prose) that touches a retired symbol, in a span that also contains a
// real assertion. Requiring both, anywhere in the span -- not necessarily on
// the same line -- accepts all five as written without rewriting any of them,
// and rejects a span that is nothing but commentary.
//
// This is a content check, not a semantic one: it does not (and structurally
// cannot, without a real JS parser) prove the assertion is *about* the
// retired-symbol-bearing line. A contrived `const note = "sdd open-pr ...";`
// sitting next to an unrelated expect() would still slip through. What backs
// that residual gap is the second mechanism below, EXPECTED_EXEMPT_SPAN_COUNT:
// any new span, disguised or not, requires editing a number in this file, so it
// cannot be added silently -- see that constant's comment.

// Strips a trailing `//` line-comment so a retired-symbol match inside prose
// doesn't count as "the code uses this symbol". Deliberately naive (no string-
// literal awareness) to match the rest of this file's substring-based scanning
// -- see the five real spans checked against this in review: the one span
// whose code line contains a literal "//" (a URL inside a fs.writeFileSync
// argument) still keeps its retired-symbol match, because that match sits
// earlier in the line than the URL's "//".
function codePortion(line) {
  const idx = line.indexOf("//");
  return idx === -1 ? line : line.slice(0, idx);
}

// True when spanLines (all lines from :start to :end, inclusive) contain both
// a real assertion and actual code-level use of a retired symbol -- see the
// block comment above for why this shape, specifically, accepts all five real
// spans and rejects a comment-only dangling note.
function isGenuineProofOfRemoval(spanLines) {
  let hasExpectCall = false;
  let referencesRetiredSymbolInCode = false;
  for (const line of spanLines) {
    const code = codePortion(line);
    if (code.includes("expect(")) {
      hasExpectCall = true;
    }
    if (RETIRED_SYMBOLS.some((symbol) => code.includes(symbol))) {
      referencesRetiredSymbolInCode = true;
    }
  }
  return hasExpectCall && referencesRetiredSymbolInCode;
}

// Mechanism 2: makes the exemption auditable rather than merely rule-following.
// isGenuineProofOfRemoval() above closes the specific hole JUDGMENT-DAY-HIGH #2
// found, but per that function's own comment it cannot rule out every possible
// disguise. This constant is a different kind of guard: a sixth span can only
// land by also bumping this number, which is a one-line diff any reviewer will
// see -- it doesn't need to recognize *what's* being added, only that the count
// changed. Every prior fix in this chain added a rule a sufficiently-crafted
// span could still satisfy; this is the first thing that makes silent addition
// impossible rather than merely against the rules. If you're bumping this
// because you added a genuine proof-of-removal span, that friction is the
// point -- let your reviewer see it.
const EXPECTED_EXEMPT_SPAN_COUNT = 5;

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
// file -- the whole point of a mechanism nobody had violated yet. And per
// isGenuineProofOfRemoval() above, a balanced, correctly-placed span whose content
// isn't a real proof of removal (JUDGMENT-DAY-HIGH #2's attack) is reported as its
// own hit instead of silently passing.
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
  let spanLines = [];

  // Validates the just-closed span's content and, if it isn't a genuine proof
  // of removal, reports it as a hit naming the file and the line it opened on.
  function closeSpan(endLineNumber) {
    if (!isGenuineProofOfRemoval(spanLines)) {
      hits.push(
        `${relPath}:${openedAtLine}: sdd-sweep-exempt span (lines ${openedAtLine}-${endLineNumber}) is not a ` +
          `genuine proof of removal -- no expect(...) assertion, or no code-level (non-comment) reference to a ` +
          `retired symbol, found inside it; see isGenuineProofOfRemoval()'s comment in this file`,
      );
    }
    exempt = false;
    openedAtLine = null;
    spanLines = [];
  }

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const hasStart = line.includes(EXEMPT_START_MARKER);
    const hasEnd = line.includes(EXEMPT_END_MARKER);

    if (hasStart && hasEnd) {
      // A single line carrying both markers used to be misparsed: the ":start"
      // branch below matched and returned before this same line's ":end" was
      // ever looked at, leaving the span open -- and the *next* real ":start"
      // in the file would then throw "unbalanced", blaming an unrelated later
      // marker instead of this line. Handling the same-line case first, as its
      // own immediately-opened-and-closed span, fixes both: no misattribution,
      // and an accurate message if its (typically comment-only) content isn't
      // a genuine proof of removal.
      if (exempt) {
        throw new Error(
          `${relPath}:${lineNumber}: unbalanced sdd-sweep-exempt marker -- a new ":start" ` +
            `was found before the ":start" opened at line ${openedAtLine} was closed with ":end"`,
        );
      }
      spanLines = [line];
      openedAtLine = lineNumber;
      closeSpan(lineNumber);
      return;
    }

    if (hasStart) {
      if (exempt) {
        throw new Error(
          `${relPath}:${lineNumber}: unbalanced sdd-sweep-exempt marker -- a new ":start" ` +
            `was found before the ":start" opened at line ${openedAtLine} was closed with ":end"`,
        );
      }
      exempt = true;
      openedAtLine = lineNumber;
      spanLines = [line];
      return;
    }

    if (hasEnd) {
      if (!exempt) {
        throw new Error(`${relPath}:${lineNumber}: unbalanced sdd-sweep-exempt marker -- ":end" found with no open ":start"`);
      }
      spanLines.push(line);
      closeSpan(lineNumber);
      return;
    }

    if (exempt) {
      spanLines.push(line);
      return;
    }

    for (const symbol of RETIRED_SYMBOLS) {
      if (line.includes(symbol)) {
        hits.push(`${relPath}:${lineNumber}: "${symbol}"`);
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

// JUDGMENT-DAY-HIGH #2 (re-review cycle 2): narrowing the marker's location and
// balance-checking it (cycle 1's fix, above) closed the two known attacks but
// never validated what a span's content actually is. Both mechanisms the user
// chose to close that are pinned here: a structural content check
// (isGenuineProofOfRemoval(), exercised via findHits()) and a fixed span count
// (EXPECTED_EXEMPT_SPAN_COUNT) that makes adding a span -- disguised or not --
// show up as a one-line diff instead of slipping in silently.
describe("sweep: sdd-sweep-exempt content validation (JUDGMENT-DAY-HIGH #2, re-review cycle 2)", () => {
  test("a balanced, correctly-placed span containing only a dangling maintenance comment is a hit, not an exemption (2a)", () => {
    // The judge's and reviewer's actual reproduction, verbatim in shape: legal
    // markers, legal file, zero test assertions -- just a TODO a human might
    // act on by hand later.
    const content = [
      'test("existing test", () => {',
      "  // sdd-sweep-exempt:start — leftover maintenance note, not a test assertion.",
      "  // TODO: once the new gate lands, run `sdd open-pr <feature-id>` by hand here",
      "  // to reopen the draft PR for anything queued during the freeze.",
      "  // sdd-sweep-exempt:end",
      "});",
      "",
    ].join("\n");

    const hits = findHits(MARKER_EXEMPT_FILE, content);

    // Comment-only: no expect(...) call and no code-level reference to a
    // retired symbol (the "open-pr" text lives entirely inside `//` comments).
    // Structure alone (balanced, correctly-placed) used to be enough to pass;
    // now the span's content is checked too.
    expect(hits.length).toBe(1);
    expect(hits[0]).toContain(`${MARKER_EXEMPT_FILE}:2:`);
    expect(hits[0]).toContain("not a");
    expect(hits[0]).toContain("genuine proof of removal");
  });

  test("each of the five real spans in tests/sdd.test.js is a genuine proof of removal, so the sweep stays green", () => {
    // Confirms the content check accepts the actual spans as written -- not a
    // reimplementation, the real file.
    const content = fs.readFileSync(path.join(repoRoot, MARKER_EXEMPT_FILE), "utf8");
    expect(findHits(MARKER_EXEMPT_FILE, content)).toEqual([]);
  });

  test("tests/sdd.test.js contains exactly the expected number of sdd-sweep-exempt spans (auditability pin)", () => {
    const content = fs.readFileSync(path.join(repoRoot, MARKER_EXEMPT_FILE), "utf8");
    const starts = (content.match(new RegExp(EXEMPT_START_MARKER, "g")) || []).length;
    const ends = (content.match(new RegExp(EXEMPT_END_MARKER, "g")) || []).length;

    // Not redundant with isGenuineProofOfRemoval(): that check verifies *what*
    // a span contains, this one verifies *how many* spans exist at all. A sixth
    // span -- even one crafted to satisfy the content check -- can only land by
    // also changing this number, which shows up in any review diff.
    expect(starts).toBe(EXPECTED_EXEMPT_SPAN_COUNT);
    expect(ends).toBe(EXPECTED_EXEMPT_SPAN_COUNT);
  });

  test("a same-line sdd-sweep-exempt:start/:end pair is closed on its own line, not left open to swallow the rest of the file (2b)", () => {
    // Reproduces the diagnostic-accuracy bug: a same-line pair used to leave
    // `exempt` stuck open (the ":start" branch returned before seeing the same
    // line's ":end"), so the *next* real ":start" in the file threw
    // "unbalanced", blaming an unrelated later marker instead of this line.
    const content = [
      "// sdd-sweep-exempt:start same-line pair, no proof of removal — sdd-sweep-exempt:end",
      'test("unrelated test", () => {',
      "  // sdd-sweep-exempt:start — genuine proof of removal",
      '  expect(sddFail(["open-pr"], {}).stderr).toContain("open-pr");',
      "  // sdd-sweep-exempt:end",
      "});",
      "",
    ].join("\n");

    let hits;
    expect(() => {
      hits = findHits(MARKER_EXEMPT_FILE, content);
    }).not.toThrow();

    // The later, unrelated, well-formed span must not be blamed for anything.
    expect(hits.every((h) => !/unbalanced/i.test(h))).toBe(true);
    // The same-line pair is comment-only, so it's correctly reported as its
    // own hit, at its own line (1) -- not attributed to line 3's marker.
    expect(hits.length).toBe(1);
    expect(hits[0]).toContain(`${MARKER_EXEMPT_FILE}:1:`);
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
