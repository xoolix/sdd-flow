// Feature 024 (remove-auto-pr) retired ten symbols from the PR-gate machinery, and
// tests/sweep-retired-symbols.test.js's AC5 walk proves none of them survive on the
// repo's living surface. Five regression tests can only prove a retired command or
// string is truly *gone* by naming it literally: invoking `sdd open-pr` and checking
// it fails, or asserting `.not.toContain("ready-to-pr")` against a prose file. That is
// a proof of removal, not a dangling reference — but it reads as a literal hit to a
// substring scan with no way to tell the difference from inside the scanned line
// itself.
//
// This file exists to hold exactly those five tests, and nothing else. It is excluded
// from the AC5 walk by path (see EXCLUDED_PATHS in tests/sweep-retired-symbols.test.js),
// the same way that file excludes itself. A per-file exclusion is a hole in the sweep
// by construction — anything added here is unscanned — but it is a narrow, visible one:
// one path, one line, and any addition to this file is a diff a reviewer sees. That is
// deliberately simpler than the four-round chain of marker/balance/content/count checks
// this mechanism used to be (see specs/024-remove-auto-pr/decisions.md's JUDGMENT-DAY-HIGH
// (3) entry) — narrowing a hatch to who may use it converges to "guard it forever";
// removing the hatch and watching the one door it used to hide behind does not.
//
// Do not add a test here unless it must name a retired symbol literally to prove its
// absence. Everything else belongs in tests/sdd.test.js, where the AC5 sweep still
// covers it.

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..");
const sddBin = path.join(repoRoot, "bin", "sdd");

function makeTempProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sdd-test-"));
  execFileSync("git", ["init", "-q"], { cwd: dir });
  execFileSync("git", ["config", "user.email", "sdd-test@example.com"], { cwd: dir });
  execFileSync("git", ["config", "user.name", "SDD Test"], { cwd: dir });
  execFileSync("git", ["config", "commit.gpgsign", "false"], { cwd: dir });
  fs.mkdirSync(path.join(dir, "specs", "001-demo"), { recursive: true });
  fs.writeFileSync(path.join(dir, "specs", "001-demo", "spec.md"), "# Spec\n");
  fs.writeFileSync(path.join(dir, "specs", "001-demo", "plan.md"), "# Plan\n");
  fs.writeFileSync(
    path.join(dir, "specs", "001-demo", "tasks.md"),
    "# Tasks\n\n- [ ] First behavior\n- [ ] Second behavior\n",
  );
  return dir;
}

// Runs the sdd CLI expecting a non-zero exit. Returns the caught error (with
// .status and .stderr populated, since execFileSync does not inherit stdio)
// so callers can assert on the graded exit code and stderr message. Throws
// if the command unexpectedly succeeded, so a wrongly-green guardrail test
// fails loudly instead of silently passing.
function sddFail(args, options) {
  try {
    execFileSync(sddBin, args, { encoding: "utf8", ...options });
  } catch (error) {
    return error;
  }
  throw new Error(`expected "sdd ${args.join(" ")}" to fail, but it exited 0`);
}

test("open-pr no longer exists: unknown command in dispatch, and usage() does not list it (024 AC1)", () => {
  const project = makeTempProject();

  const error = sddFail(["open-pr", "001-demo"], { cwd: project });

  expect(error.status).toBe(1);
  expect(error.stderr).toContain("Unknown command");

  const help = execFileSync(sddBin, ["help"], { cwd: project, encoding: "utf8" });
  expect(help).not.toContain("open-pr");
});

test("git.md rewrites the never-commit policy to commit-per-slice + auto-commit knob (T013)", () => {
  const gitMd = fs.readFileSync(path.join(repoRoot, ".claude/rules/git.md"), "utf8");

  // Old opt-out-only policy must be gone — this proves a rewrite, not an append.
  expect(gitMd).not.toContain("Never commit or push");
  expect(gitMd).not.toContain("The human handles commits, merges, and PRs.");

  // New policy: branch creation goes through the CLI, cites the ADR.
  expect(gitMd).toContain("sdd branch <feature-id>");
  expect(gitMd).toContain("docs/adr/0002-sdd-git-write-boundary.md");

  // New policy: phases commit their own work per validated slice; nothing pushes.
  // 024 removes the `sdd open-pr` gate command — pushing and opening a PR are
  // manual, human-run steps now (no CLI command left to pin here).
  expect(gitMd).toContain("sdd commit-slice");
  expect(gitMd).toContain("Nothing is pushed during development");
  expect(gitMd).not.toContain("sdd open-pr");

  // Auto-commit knob, mirroring testing.md's tdd: knob shape.
  expect(gitMd).toContain("auto-commit: on|off");
  expect(gitMd).toContain("auto-commit: off");

  // Commit style now documents the conventional-commit format sdd commit-slice produces.
  expect(gitMd).toContain("<type>(<feature-id>): [Tnnn ]<title>");

  // Untouched section stays intact.
  expect(gitMd).toContain("## Base branch resolution");
});

test("sdd-next and sdd-auto drop the ready-to-pr gate and its never-ask exception (024 AC4)", () => {
  const sddNext = fs.readFileSync(path.join(repoRoot, ".claude/skills/sdd-next/SKILL.md"), "utf8");
  const sddAuto = fs.readFileSync(path.join(repoRoot, ".claude/skills/sdd-auto/SKILL.md"), "utf8");

  // The "never ask" rule loses its carve-out in BOTH orchestrators — with the
  // gate gone there is no longer anything left to except from the rule.
  expect(sddNext).toContain("Never ask for user confirmation — launch phases and advance automatically.");
  expect(sddNext).not.toContain("Exception: the post-archive PR gate");
  expect(sddAuto).toContain("**Never ask for user confirmation** — run all phases and advance automatically.");
  expect(sddAuto).not.toContain("Exception: the post-archive PR gate");
  expect(sddNext).not.toContain("outward-facing actions that need a human's explicit go-ahead");
  expect(sddAuto).not.toContain("outward-facing actions that need a human's explicit go-ahead");

  // Phase-detection table keeps the surviving post-archive row — `archived` still
  // can't key off file existence, since the folder already moved under specs/archive/ —
  // but the `ready-to-pr` row it used to sit next to is gone entirely.
  expect(sddNext).toContain("`sdd status <feature-id>` reports `phase: archived`");
  expect(sddNext).not.toContain("phase: ready-to-pr");
  expect(sddNext).toContain("F4 in `decisions.md`");
  expect(sddNext).toContain(
    "Once `/archive-feature` moves the folder, `specs/<feature-id>/` no longer exists",
  );

  // The gate itself is gone: no Step 3a, no sdd open-pr call, no .pr-opened bookkeeping.
  // /archive-feature prints the two follow-up commands by hand instead (see its Step 3.6).
  expect(sddNext).not.toContain("Step 3a");
  expect(sddNext).not.toContain("sdd open-pr");
  expect(sddNext).not.toContain(".pr-opened");

  // sdd-auto no longer has a gate to stop at or delegate to /sdd-next — it exits
  // the loop on `archived` alone, same shape as before minus the ready-to-pr branch.
  expect(sddAuto).not.toContain("phase: ready-to-pr");
  expect(sddAuto).not.toContain("stop; do not confirm the gate yourself");
  expect(sddAuto).not.toContain("sdd open-pr");
});

test("CLAUDE.md master docs retire the PR gate — human-input list, pipeline diagram, detection table, workflow diagram, archive format, commands (024 AC4)", () => {
  const claudeMd = fs.readFileSync(path.join(repoRoot, ".claude/CLAUDE.md"), "utf8");

  // 1. "When Human Input Is Needed" loses the routine ready-to-ship-gate bullet —
  // there is no more pipeline pause for a human to take here.
  expect(claudeMd).not.toContain("**PR gate**:");
  expect(claudeMd).not.toContain("phase: ready-to-pr");

  // 2. "Phase Pipeline" diagram loses the gate stage; /archive-feature is the last
  // box, and it says what it prints instead of what a human confirms.
  expect(claudeMd).toContain(
    "/sdd-next → archive                  (archive-feature)\n                 └─ prints `git push -u origin HEAD` and `gh pr create --draft --base <base>` for the human to run by hand",
  );
  expect(claudeMd).not.toContain("/sdd-next → PR gate");
  expect(claudeMd).not.toContain(".pr-opened` written");

  // 3. "Phase Detection Logic" table drops the ready-to-pr row and its blockquote —
  // `/archive-feature` is the last "next phase" a fresh detection pass can name.
  expect(claudeMd).not.toContain("Human PR gate — confirm, then `sdd open-pr");
  expect(claudeMd).not.toContain("The `ready-to-pr` row keys off");
  expect(claudeMd).toContain("| after review passes | full or fast | — | — | `/archive-feature` |");

  // 4. "Workflow" diagram ends at archive-feature — no gate step after it.
  expect(claudeMd).not.toContain("PR gate (human confirm)");
  expect(claudeMd).toMatch(/\/archive-feature\n```/);

  // 5. "Archive folder format" drops the .pr-opened bullet entirely — there is no
  // sidecar left to contrast against .simplified.
  expect(claudeMd).not.toContain(".pr-opened");
  expect(claudeMd).toContain("`.simplified` is intentionally deleted by `/archive-feature`");

  // 6. "SDD Commands" table descriptions no longer mention a gate the pipeline
  // stops at — both commands run straight through to the end of the pipeline.
  expect(claudeMd).not.toContain("including the post-archive PR gate");
  expect(claudeMd).not.toContain("stopping at the PR gate for human confirmation");
  expect(claudeMd).toContain("| `/sdd-next [feature-id]` | Detect current phase and run the next one |");
  expect(claudeMd).toContain(
    "| `/sdd-auto [feature-id]` | Fast-forward: chain all remaining phases automatically |",
  );
  // bin/sdd subcommands are not user-invocable skills — they stay out of this table.
  expect(claudeMd).not.toContain("`sdd commit-slice");
  expect(claudeMd).not.toContain("`sdd open-pr`");

  // 7. Result envelope keeps the Commit field 020 added — untouched by this feature.
  expect(claudeMd).toContain("Status | Summary | Artifacts | Next | Risks | Commit");
});

describe("sdd status — archived is unconditional (024 AC6)", () => {
  // Moves 001-demo into specs/archive/YYYY-MM-DD-<id>, exercising the real
  // find-based resolve_feature_dir fallback rather than a shortcut path.
  function archiveFeature(project) {
    fs.rmSync(path.join(project, "specs", "001-demo"), { recursive: true, force: true });
    const archiveDir = path.join(project, "specs", "archive", "2026-08-14-001-demo");
    fs.mkdirSync(archiveDir, { recursive: true });
    fs.writeFileSync(path.join(archiveDir, "spec.md"), "# Spec\n");
    fs.writeFileSync(path.join(archiveDir, "decisions.md"), "# Decisions\n");
    return archiveDir;
  }

  // 024 removes `ready-to-pr` and its .pr-opened check: is_archived derives
  // from folder location alone, never the sidecar (plan.md, "Current state").
  // One test now covers what used to be two — with and without a stray
  // sentinel — because both must land on the same phase.
  test("reports archived for an archived feature whether or not a stray .pr-opened sentinel exists", () => {
    const project = makeTempProject();
    const archiveDir = archiveFeature(project);

    const withoutSentinel = execFileSync(sddBin, ["status", "001-demo"], {
      cwd: project,
      encoding: "utf8",
    });
    expect(JSON.parse(withoutSentinel)).toMatchObject({
      feature_id: "001-demo",
      phase: "archived",
      next_command: "(none — feature archived)",
    });

    // A leftover .pr-opened (e.g. from a pre-024 archive, per spec.md's Edge
    // Cases) must not change the outcome.
    fs.writeFileSync(path.join(archiveDir, ".pr-opened"), "url: https://example.com/pr/1\n");

    const withSentinel = execFileSync(sddBin, ["status", "001-demo"], {
      cwd: project,
      encoding: "utf8",
    });
    expect(JSON.parse(withSentinel)).toMatchObject({
      feature_id: "001-demo",
      phase: "archived",
      next_command: "(none — feature archived)",
    });
  });
});
