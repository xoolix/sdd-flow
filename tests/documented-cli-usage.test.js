// Validates every `sdd <subcommand> ...` invocation documented in agent/skill prose
// against the CLI's real argument requirements (025/T013, review follow-up (d)).
//
// Why this file exists: nothing verified that premise before it. sdd-simplify-code.md
// documented its own commit-slice call without `--title`, which cmd_commit_slice has
// required since T001 -- a run with a real, non-empty SCOPED_FILES would follow that
// prose verbatim, hit exit 2, and block forever. That defect survived review because
// a document asserted executable behavior and nothing checked its premise against the
// CLI -- exactly the class of bug this repo's own CLAUDE.md is built to catch. This
// file is that check, generalized to every documented `sdd` call site, not just the
// one that broke.
//
// Scope: `.claude/agents/*.md` and `.claude/skills/**/SKILL.md` -- the same "living
// surface" an executing agent reads and follows (see tests/sweep-retired-symbols
// .test.js for the sibling convention of walking that surface).
//
// Candidate selection: a backtick-delimited span (fenced ``` block or inline `...`
// code span) counts as a documented INVOCATION only when its first line starts with
// "sdd " and names at least one token beyond the subcommand word -- an argument, a
// flag, or a placeholder. A bare mention like "(`sdd commit-slice` exits non-zero)"
// is prose referring to the command by name, not invocation syntax, and is excluded
// by that rule. `sdd domain-vocab`, the one subcommand that takes zero arguments by
// design, is only ever bare-mentioned in this repo -- excluded the same way, with no
// coverage loss for the defect class this file targets (a missing REQUIRED flag can't
// hide behind a command that has none).
//
// Placeholders ($ARGUMENTS, $FEATURE_ID, <feature-id>, <type>, <slice title>,
// [--task Tnnn], <SCOPED_FILES...>, <paths…>) are substituted with real values
// resolvable in a disposable temp git fixture, then the real bin/sdd binary is
// executed directly (no shell, no mocks) -- see substitute() below for the exact
// table. One line (sdd-archive-feature.md's commit-slice call) documents its
// `--files` value as a description ("<spec files touched by the delta merge>"), not
// a placeholder token -- the same prose says this resolves to nothing, or the flag
// can be omitted entirely, when there are no deltas to merge, so that line is
// resolved by omitting `--files` and relying on `--moved-from` instead, exercising
// the alternative the prose itself documents rather than inventing fake paths. Any
// candidate left with an unresolved placeholder after substitution is SKIPPED
// explicitly, with a printed reason, rather than silently dropped or force-executed.
//
// PASS/FAIL boundary: reading cmd_commit_slice, cmd_state_write, and cmd_branch in
// bin/sdd shows exit code 2 used consistently, and only, for "the arguments this
// invocation supplied are malformed" -- missing/empty required flag, unknown option,
// invalid enum value -- across every subcommand exercised here. Exit 1 is a
// different defect class with the same symptom: bin/sdd's top-level dispatch
// returns 1 for "Unknown command: ..." when the SUBCOMMAND WORD ITSELF is wrong --
// a typo in prose ("sdd branc", "sdd statu") that a bare exit-2 check does not
// see, because the dispatch never reaches a subcommand's own argument parsing to
// raise 2. Verified against every subcommand exercised here (`branch`,
// `commit-slice`, `state-write` all exit 2 with no args; only an unrecognized
// subcommand word exits 1) -- there is no runnable candidate in this file whose
// correct, well-formed invocation returns 1, so failing on it cannot be a false
// positive. Exit 3/4/5 mean something else went wrong (feature not found, wrong
// branch, nothing staged) -- real fixture-precondition gaps this minimal fixture
// may or may not avoid, and never evidence that the DOCUMENTED command line itself
// (subcommand word + arguments) is wrong. Only exit 1 or exit 2 fails a candidate
// test; 3/4/5 are left alone on purpose.

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..");
const sddBin = path.join(repoRoot, "bin", "sdd");

const FEATURE_ID = "999-documented-cli-usage-fixture";
const DIRTY_FILE = "dirty-file.txt";

// ---- 1. Collect the files that make up the "living surface" this file checks ----

function agentFiles() {
  return fs
    .readdirSync(path.join(repoRoot, ".claude", "agents"))
    .filter((f) => f.endsWith(".md"))
    .map((f) => path.join(".claude", "agents", f));
}

function skillFiles() {
  const out = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name === "SKILL.md") {
        out.push(path.relative(repoRoot, full));
      }
    }
  }
  walk(path.join(repoRoot, ".claude", "skills"));
  return out;
}

// ---- 2. Extract candidate command lines -----------------------------------------

// Matches a fenced ``` block (group 1) or an inline `...` span (group 2).
const SPAN_RE = /```([\s\S]*?)```|`([^`\n]+)`/g;

function extractCandidates(relPath, content) {
  const out = [];
  let m;
  SPAN_RE.lastIndex = 0;
  while ((m = SPAN_RE.exec(content))) {
    const block = (m[1] || m[2] || "").trim();
    if (!block) continue;
    // A fenced block occasionally carries the command plus trailing prose on
    // later lines -- only the first line is ever the invocation itself.
    const firstLine = block.split("\n")[0].trim();
    if (!/^sdd\s+\S/.test(firstLine)) continue;
    if (firstLine.split(/\s+/).length < 3) continue; // "sdd <subcommand>" alone -- a name-mention, not a call site
    out.push({ file: relPath, raw: firstLine });
  }
  return out;
}

function collectCandidates() {
  const byRaw = new Map(); // raw command text -> { raw, files: Set }
  for (const relPath of [...agentFiles(), ...skillFiles()]) {
    const content = fs.readFileSync(path.join(repoRoot, relPath), "utf8");
    for (const candidate of extractCandidates(relPath, content)) {
      if (!byRaw.has(candidate.raw)) {
        byRaw.set(candidate.raw, { raw: candidate.raw, files: new Set() });
      }
      byRaw.get(candidate.raw).files.add(candidate.file);
    }
  }
  return [...byRaw.values()].map((c) => ({ raw: c.raw, files: [...c.files].sort() }));
}

// ---- 3. Substitute placeholders into a real, tokenized argv ---------------------

// Whole-substring replacements applied before tokenizing. Each resolves a
// placeholder that is prose describing a value, not a single bracketed token
// bin/sdd would ever see standing alone -- see the file-level comment.
const LINE_REPLACEMENTS = [["--files <spec files touched by the delta merge>", ""]];

// Splits on whitespace, treating a "..." span as one token (so a quoted
// --title value survives as a single argv entry, matching how a real caller
// would invoke bin/sdd -- never via a shell, so no shell-quoting concerns).
function tokenize(cmd) {
  const tokens = [];
  const re = /"([^"]*)"|(\S+)/g;
  let m;
  while ((m = re.exec(cmd))) {
    tokens.push(m[1] !== undefined ? m[1] : m[2]);
  }
  return tokens;
}

function substitute(raw) {
  let line = raw;
  for (const [from, to] of LINE_REPLACEMENTS) {
    line = line.split(from).join(to);
  }
  line = line.replace(/\[--task [^\]]*\]/g, ""); // optional flag, dropped whole -- required flags are what this file checks
  line = line
    .replace(/\$ARGUMENTS/g, FEATURE_ID)
    .replace(/\$FEATURE_ID/g, FEATURE_ID)
    .replace(/<feature-id>/g, FEATURE_ID)
    .replace(/<type>/g, "chore")
    .replace(/<slice title>/g, "Test slice")
    .replace(/<SCOPED_FILES\.\.\.>/g, DIRTY_FILE)
    .replace(/<paths…>/g, DIRTY_FILE);
  return tokenize(line.trim()).filter((t) => t.length > 0);
}

// A resolved token still containing one of these characters means some
// placeholder wasn't substituted -- printed and skipped rather than executed,
// per the file-level comment's "explicitly and visibly" rule.
function findUnresolvedToken(tokens) {
  return tokens.find((t) => /[<>[\]$]/.test(t));
}

// ---- 4. Fixture: a disposable temp git project ----------------------------------

function makeFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sdd-doc-cli-"));
  execFileSync("git", ["init", "-q"], { cwd: dir });
  execFileSync("git", ["config", "user.email", "sdd-test@example.com"], { cwd: dir });
  execFileSync("git", ["config", "user.name", "SDD Test"], { cwd: dir });
  execFileSync("git", ["config", "commit.gpgsign", "false"], { cwd: dir });
  fs.mkdirSync(path.join(dir, "specs", FEATURE_ID), { recursive: true });
  fs.writeFileSync(path.join(dir, "specs", FEATURE_ID, "spec.md"), "# Spec\n");
  fs.writeFileSync(path.join(dir, "specs", FEATURE_ID, "plan.md"), "# Plan\n");
  fs.writeFileSync(path.join(dir, "specs", FEATURE_ID, "tasks.md"), "# Tasks\n\n- [x] done\n");
  fs.writeFileSync(path.join(dir, DIRTY_FILE), "v1\n");
  execFileSync("git", ["add", "-A"], { cwd: dir });
  execFileSync("git", ["commit", "-q", "-m", "seed"], { cwd: dir });
  execFileSync("git", ["checkout", "-q", "-b", `feature/${FEATURE_ID}`], { cwd: dir });
  return dir;
}

// Dirties DIRTY_FILE -- only called for candidates whose resolved argv actually
// references it, so a candidate that doesn't use it never sees an unrelated
// dirty path trip its own undeclared-file check.
function dirtyTheFile(dir) {
  fs.writeFileSync(path.join(dir, DIRTY_FILE), "v1\nmodified\n");
}

function runSdd(args, cwd) {
  try {
    const stdout = execFileSync(sddBin, args, { cwd, encoding: "utf8" });
    return { status: 0, stdout, stderr: "" };
  } catch (error) {
    return { status: error.status, stdout: error.stdout || "", stderr: error.stderr || "" };
  }
}

// ---- 5. Build the test list at collection time ----------------------------------

const candidates = collectCandidates();
const runnable = [];
const skipped = [];

for (const candidate of candidates) {
  const tokens = substitute(candidate.raw);
  const unresolved = findUnresolvedToken(tokens);
  if (unresolved) {
    skipped.push({ ...candidate, reason: `unresolved placeholder token: "${unresolved}"` });
  } else {
    runnable.push({ ...candidate, tokens });
  }
}

if (skipped.length > 0) {
  // Visible even on a green run -- narrowing coverage silently is exactly what
  // this file exists to prevent doing to *other* documents.
  // eslint-disable-next-line no-console
  console.log(
    "documented-cli-usage: skipped (unresolved placeholder, not executed):\n" +
      skipped.map((s) => `  - [${s.files.join(", ")}] \`${s.raw}\` -- ${s.reason}`).join("\n"),
  );
}

describe("documented sdd CLI invocations match the real CLI's usage (025/T013)", () => {
  test("the scan found at least one documented invocation to check", () => {
    expect(candidates.length).toBeGreaterThan(0);
  });

  test("every documented invocation was either executed or explicitly skipped", () => {
    expect(runnable.length + skipped.length).toBe(candidates.length);
  });

  for (const candidate of runnable) {
    test(`[${candidate.files.join(", ")}] \`${candidate.raw}\``, () => {
      const dir = makeFixture();
      try {
        if (candidate.tokens.includes(DIRTY_FILE)) {
          dirtyTheFile(dir);
        }
        const result = runSdd(candidate.tokens.slice(1), dir); // drop the leading "sdd" token
        if (result.status === 2 || result.status === 1) {
          const reason =
            result.status === 2
              ? "exits 2 (usage error) -- the CLI rejects it as written"
              : "exits 1 (unknown command) -- the subcommand word itself is wrong, likely a typo";
          throw new Error(
            `documented invocation ${reason}\n` +
              `  raw:      ${candidate.raw}\n` +
              `  resolved: ${candidate.tokens.join(" ")}\n` +
              `  stderr:   ${result.stderr.trim()}`,
          );
        }
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });
  }
});
