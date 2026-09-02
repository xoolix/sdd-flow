const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");

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

// Commits everything currently in the working tree as a baseline "seed" commit,
// so later commit-slice tests start from a clean tree with a real HEAD to diff against.
function seedCommit(project) {
  execFileSync("git", ["add", "-A"], { cwd: project });
  execFileSync("git", ["commit", "-q", "-m", "seed"], { cwd: project });
}

// Lists the paths touched by a given commit (relative to repo root).
function filesInCommit(project, sha) {
  const output = execFileSync("git", ["show", "--name-only", "--format=", sha], {
    cwd: project,
    encoding: "utf8",
  });
  return output.split("\n").filter(Boolean);
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

// Filters the current PATH down to directories that do NOT contain a `node`
// executable, so a test can prove bin/sdd behaves correctly with Node off
// PATH without depending on this machine's real toolchain layout. 024
// removed bin/sdd's only Node dependency; this helper is what the resulting
// "the full suite passes with Node off PATH" test drives.
function pathWithoutNode() {
  const dirs = (process.env.PATH || "").split(path.delimiter);
  return dirs
    .filter((dir) => {
      try {
        fs.accessSync(path.join(dir, "node"), fs.constants.X_OK);
        return false;
      } catch {
        return true;
      }
    })
    .join(path.delimiter);
}

// Resolves a feature's spec directory the same way bin/sdd's resolve_feature_dir
// does: specs/<feature-id> while the feature is active, else the archived
// specs/archive/<date>-<feature-id> match once /archive-feature has moved it.
// Tests that assert on a feature's artifacts must go through this, or they
// break with ENOENT the moment that feature is archived.
function featureDir(featureId) {
  const active = path.join(repoRoot, "specs", featureId);
  if (fs.existsSync(active)) {
    return active;
  }

  const archiveRoot = path.join(repoRoot, "specs", "archive");
  if (fs.existsSync(archiveRoot)) {
    const match = fs
      .readdirSync(archiveRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.endsWith(`-${featureId}`))
      .map((entry) => entry.name)
      .sort()[0];
    if (match) {
      return path.join(archiveRoot, match);
    }
  }

  throw new Error(
    `feature "${featureId}" not found: no specs/${featureId} and no specs/archive/*-${featureId}`,
  );
}

// Parses a single shell-like command line into argv tokens, respecting
// double-quoted segments (e.g. --title "Archive 001-demo" stays one token).
// Used to run the *literal* text an agent .md template embeds -- not a
// hand-written argv array that only resembles it (review fix cycle 5).
function parseTemplateLine(line) {
  const tokens = line.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
  return tokens.map((tok) => (tok.startsWith('"') && tok.endsWith('"') ? tok.slice(1, -1) : tok));
}

// Extracts the single fenced command line from sdd-archive-feature.md's
// Step 3.5, the same block T007's test parses.
function archiveStep35Line() {
  const archiveFeature = fs.readFileSync(
    path.join(repoRoot, ".claude/agents/sdd-archive-feature.md"),
    "utf8",
  );
  const fencedBlock = archiveFeature.match(/### 3\.5\. Commit the slice[\s\S]*?```\n([\s\S]*?)\n```/);
  if (!fencedBlock) {
    throw new Error("could not find Step 3.5's fenced commit-slice call in sdd-archive-feature.md");
  }
  return fencedBlock[1].trim();
}

describe("sdd CLI smoke tests", () => {
  test("prints version", () => {
    const output = execFileSync(sddBin, ["version"], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    expect(output.trim()).toMatch(/^sdd v\d+\.\d+\.\d+$/);
  });

  // The AC1 regression test proving the retired PR-creation command is unknown to
  // bin/sdd's dispatch moved to tests/retired-symbol-proofs.test.js — it must name
  // that command literally to prove bin/sdd truly rejects it, which is a proof of
  // removal, not a dangling reference. See that file's header comment and
  // tests/sweep-retired-symbols.test.js's EXCLUDED_PATHS.

  test("reports planned status for a feature with unchecked tasks", () => {
    const project = makeTempProject();
    const output = execFileSync(sddBin, ["status", "001-demo"], {
      cwd: project,
      encoding: "utf8",
    });

    const status = JSON.parse(output);
    expect(status).toMatchObject({
      feature_id: "001-demo",
      phase: "planned",
      tasks_total: 2,
      tasks_remaining: 2,
      next_command: "/implement-task 001-demo",
    });
  });

  test("reports planned status for a fast-lane quick-spec", () => {
    const project = fs.mkdtempSync(path.join(os.tmpdir(), "sdd-test-"));
    execFileSync("git", ["init", "-q"], { cwd: project });
    fs.mkdirSync(path.join(project, "specs", "002-fast"), { recursive: true });
    fs.writeFileSync(
      path.join(project, "specs", "002-fast", "quick-spec.md"),
      "# Quick Spec\n\n## Tasks\n- [ ] Fast-lane behavior\n",
    );

    const output = execFileSync(sddBin, ["status", "002-fast"], {
      cwd: project,
      encoding: "utf8",
    });

    const status = JSON.parse(output);
    expect(status).toMatchObject({
      feature_id: "002-fast",
      phase: "planned",
      tasks_total: 1,
      tasks_remaining: 1,
      next_command: "/implement-task 002-fast",
    });
  });

  test("counts vertical-slice task metadata without treating metadata as tasks", () => {
    const project = fs.mkdtempSync(path.join(os.tmpdir(), "sdd-test-"));
    execFileSync("git", ["init", "-q"], { cwd: project });
    fs.mkdirSync(path.join(project, "specs", "003-slices"), { recursive: true });
    fs.writeFileSync(path.join(project, "specs", "003-slices", "spec.md"), "# Spec\n");
    fs.writeFileSync(path.join(project, "specs", "003-slices", "plan.md"), "# Plan\n");
    fs.writeFileSync(
      path.join(project, "specs", "003-slices", "tasks.md"),
      [
        "# Tasks",
        "",
        "- [x] **T001 [AFK] Foundation**: first vertical slice",
        "  - blocked_by: none",
        "  - verifies: AC1",
        "  - touches: api, tests",
        "- [ ] **T002 [AFK] UI path**: second vertical slice",
        "  - blocked_by: T001",
        "  - verifies: AC2",
        "  - touches: ui, tests",
        "",
      ].join("\n"),
    );

    const output = execFileSync(sddBin, ["status", "003-slices"], {
      cwd: project,
      encoding: "utf8",
    });

    const status = JSON.parse(output);
    expect(status).toMatchObject({
      feature_id: "003-slices",
      phase: "implementing",
      tasks_total: 2,
      tasks_remaining: 1,
      next_command: "/implement-task 003-slices",
    });
  });

  test("update restores missing base project directories", () => {
    const project = makeTempProject();
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "sdd-home-"));
    fs.mkdirSync(path.join(home, ".claude", "skills"), { recursive: true });
    fs.mkdirSync(path.join(project, ".claude"), { recursive: true });
    fs.rmSync(path.join(project, "research"), { force: true, recursive: true });
    fs.rmSync(path.join(project, "docs"), { force: true, recursive: true });

    execFileSync(sddBin, ["update"], {
      cwd: project,
      encoding: "utf8",
      env: {
        ...process.env,
        HOME: home,
      },
    });

    expect(fs.existsSync(path.join(project, "research"))).toBe(true);
    expect(fs.existsSync(path.join(project, "docs", "adr"))).toBe(true);
    expect(fs.existsSync(path.join(project, "docs", "architecture"))).toBe(true);
  });

  test("review agents use reviewer plus judge plus cross-reviewer topology", () => {
    expect(fs.existsSync(path.join(repoRoot, ".claude/agents/sdd-reviewer.md"))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, ".claude/agents/sdd-judge.md"))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, ".claude/agents/sdd-cross-reviewer.md"))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, ".claude/agents/sdd-reviewer-voter.md"))).toBe(false);
    expect(fs.existsSync(path.join(repoRoot, ".claude/agents/sdd-adversarial-reviewer.md"))).toBe(false);
  });

  test("conversational fast-lane intakes run inline, not as native agents", () => {
    const agentFiles = fs.readdirSync(path.join(repoRoot, ".claude/agents")).filter((file) => /^sdd-.*\.md$/.test(file));

    expect(agentFiles).toHaveLength(11);
    expect(fs.existsSync(path.join(repoRoot, ".claude/agents/sdd-new-fix.md"))).toBe(false);
    expect(fs.existsSync(path.join(repoRoot, ".claude/agents/sdd-new-quick-feature.md"))).toBe(false);

    const newFix = fs.readFileSync(path.join(repoRoot, ".claude/skills/new-fix/SKILL.md"), "utf8");
    const newQuick = fs.readFileSync(path.join(repoRoot, ".claude/skills/new-quick-feature/SKILL.md"), "utf8");
    const sddNew = fs.readFileSync(path.join(repoRoot, ".claude/skills/sdd-new/SKILL.md"), "utf8");

    expect(newFix).toContain("Main Claude executes this skill body inline");
    expect(newQuick).toContain("Main Claude executes this skill body inline");
    expect(newFix).not.toContain("Launch the native agent");
    expect(newQuick).not.toContain("Launch the native agent");
    expect(sddNew).toContain("invoke the `new-fix` skill via the Skill tool");
    expect(sddNew).toContain("invoke the `new-quick-feature` skill via the Skill tool");
    expect(newFix).not.toContain("disable-model-invocation");
    expect(newQuick).not.toContain("disable-model-invocation");
  });

  test("flow prompts include lane risk gate, calibrated judge, prototype gate, and Engram policy", () => {
    const sddNew = fs.readFileSync(path.join(repoRoot, ".claude/skills/sdd-new/SKILL.md"), "utf8");
    const judge = fs.readFileSync(path.join(repoRoot, ".claude/agents/sdd-judge.md"), "utf8");
    const newFeature = fs.readFileSync(path.join(repoRoot, ".claude/skills/new-feature/SKILL.md"), "utf8");
    const engram = fs.readFileSync(path.join(repoRoot, ".claude/skills/_shared/engram-protocol.md"), "utf8");

    expect(sddNew).toContain("fast-lane confidence gate");
    expect(sddNew).toContain("Escalation triggers");
    expect(judge).toContain("High severity requires **all three**");
    expect(newFeature).toContain("PROTOTYPE-REQUIRED");
    expect(engram).toContain("Engram is supporting context, not source of truth");
    expect(engram).toContain("Secrets, credentials, tokens");
  });

  test("task planner and implementer use vertical slices with dependencies", () => {
    const taskPlanner = fs.readFileSync(path.join(repoRoot, ".claude/agents/sdd-task-planner.md"), "utf8");
    const implementTask = fs.readFileSync(path.join(repoRoot, ".claude/agents/sdd-implement-task.md"), "utf8");
    const tasksTemplate = fs.readFileSync(path.join(repoRoot, ".specify/templates/tasks-template.md"), "utf8");
    const planFeature = fs.readFileSync(path.join(repoRoot, ".claude/skills/plan-feature/SKILL.md"), "utf8");
    const sddNext = fs.readFileSync(path.join(repoRoot, ".claude/skills/sdd-next/SKILL.md"), "utf8");
    const sddAuto = fs.readFileSync(path.join(repoRoot, ".claude/skills/sdd-auto/SKILL.md"), "utf8");
    const sddHitl = fs.readFileSync(path.join(repoRoot, ".claude/skills/sdd-hitl/SKILL.md"), "utf8");
    const sddCli = fs.readFileSync(path.join(repoRoot, "bin/sdd"), "utf8");

    expect(taskPlanner).toContain("Ordered vertical slices");
    expect(taskPlanner).toContain("blocked_by");
    expect(taskPlanner).toContain("Do not create standalone horizontal test/docs tasks");
    expect(tasksTemplate).toContain("**T001 [AFK]");
    expect(tasksTemplate).not.toContain("**T003 [AFK]");
    expect(tasksTemplate).toContain("do not create standalone horizontal validation tasks");
    expect(planFeature).toContain("do not create standalone horizontal validation tasks");
    expect(implementTask).toContain("one unlocked AFK vertical slice");
    expect(implementTask).toContain("`[HITL]` tasks are human checkpoints");
    expect(implementTask).toContain("/sdd-hitl");
    expect(implementTask).toContain("FORCE_TASK_ID=Tnnn");
    expect(implementTask).toContain("Do NOT mark the task complete yet");
    expect(implementTask).toContain("Only after all validations pass");
    expect(implementTask).toContain("Task attempted");
    expect(sddNext).toContain("FORCE_TASK_ID=Tnnn");
    expect(sddNext).toContain("Task attempted");
    expect(sddAuto).toContain("last_attempted_task_id");
    expect(sddAuto).toContain("FORCE_TASK_ID=<last_attempted_task_id>");
    expect(sddHitl).toContain("Record human decisions before marking HITL complete");
    expect(sddCli).toContain("sdd-hitl");
    expect(implementTask).toContain("implemented-by:");
  });

  test("shared envelope documents the Commit field and task format documents the type key (T005)", () => {
    const phaseCommon = fs.readFileSync(
      path.join(repoRoot, ".claude/skills/_shared/sdd-phase-common.md"),
      "utf8",
    );
    const tasksTemplate = fs.readFileSync(path.join(repoRoot, ".specify/templates/tasks-template.md"), "utf8");
    const taskPlanner = fs.readFileSync(path.join(repoRoot, ".claude/agents/sdd-task-planner.md"), "utf8");

    // Envelope: new optional Commit field in the template block itself.
    expect(phaseCommon).toContain("**Commit** _(optional)_");
    // Rules bullet explaining when it's a SHA vs "none", and that failures
    // are reported via Status: blocked rather than through this field.
    expect(phaseCommon).toContain("`Commit` is optional");
    expect(phaseCommon).toContain("never through this field");

    // Task template: `type:` key on the AFK task blocks, after `touches:`.
    expect(tasksTemplate).toContain("  - touches: <modules/files/domains>\n  - type: feat");
    // Notes footer documents the five accepted values.
    expect(tasksTemplate).toContain("`feat`, `fix`, `refactor`, `chore`, `docs`");

    // Task planner: canonical AFK example gains `- type: feat`, plus a rule
    // explaining how to choose it (mirroring blocked_by/verifies rules).
    expect(taskPlanner).toContain("  - touches: api, ui, tests\n  - type: feat");
    expect(taskPlanner).toContain("`type` must be one of `feat`, `fix`, `refactor`, `chore`, `docs`");
  });

  test("implement-task wires sdd branch and a Step 7.5 commit-with-revert (T006)", () => {
    const implementTask = fs.readFileSync(path.join(repoRoot, ".claude/agents/sdd-implement-task.md"), "utf8");

    // Pre-flight: branch creation goes through the CLI, never a raw git checkout.
    expect(implementTask).toContain("sdd branch $ARGUMENTS");
    expect(implementTask).toContain("ADR 0002");

    expect(implementTask).toContain("Commit: none");

    // Step 7.5: the commit-slice call, after checkbox+marker+delta.
    expect(implementTask).toContain("7.5. **Commit the slice**");
    expect(implementTask).toContain("sdd commit-slice $ARGUMENTS");

    // type: fallback rule, captured alongside blocked_by in Step 3.
    expect(implementTask).toContain("Step 2b auto-generated review-fix task ⇒ `fix`; missing anywhere else ⇒ `chore`");

    // Commit failure reverts the checkbox and reports the graded exit code.
    expect(implementTask).toContain("flip the task bullet back from `- [x]` to `- [ ]`");
    expect(implementTask).toContain("`4`=git failure, `5`=nothing staged");
    expect(implementTask).toContain("task complete ⟹ commit exists");

    // Envelope gains the Commit field.
    expect(implementTask).toContain("- **Commit**:");

    // Task graph format (consumer side) documents the type: key.
    expect(implementTask).toContain("  - touches: api, ui, tests\n  - type: feat");

    // Step 2b auto-generated review-fix template also documents type: fix.
    expect(implementTask).toContain(
      "- touches: affected files from the feedback, or unknown\n       - type: fix",
    );
  });

  // The T013 test proving git.md's rewritten policy no longer mentions the retired
  // PR-creation gate command moved to tests/retired-symbol-proofs.test.js — it must
  // name that command literally to prove removal.

  test("git.md forbids AI attribution in commits and PR bodies (T014)", () => {
    const gitMd = fs.readFileSync(path.join(repoRoot, ".claude/rules/git.md"), "utf8");

    // Explicit trailer/footer forms are named, not just alluded to.
    expect(gitMd).toContain("Co-Authored-By: Claude <noreply@anthropic.com>");
    expect(gitMd).toContain("no AI-generated footer");

    // Scope: sdd commit-slice and direct agent commits are all covered.
    expect(gitMd).toContain("any commit an agent makes directly");

    // Strong enough to override a harness default that appends attribution by default.
    expect(gitMd).toContain("takes precedence over that default");

    // Rationale: git history and PR bodies are the humans' authorship record.
    expect(gitMd).toContain("belongs to the humans on the project");
  });

  test("bin/sdd never emits AI attribution in commits or PR bodies (T014)", () => {
    const sddCli = fs.readFileSync(path.join(repoRoot, "bin/sdd"), "utf8");

    // Exclude comment lines so this checks emitted output, not prose that merely
    // names the forbidden strings (same approach as the git-add-A guard above).
    const codeOnly = sddCli
      .split("\n")
      .filter((line) => !line.trim().startsWith("#"))
      .join("\n");

    expect(codeOnly).not.toContain("Co-Authored-By");
    expect(codeOnly).not.toContain("noreply@anthropic.com");
    expect(codeOnly).not.toContain("Generated with");
    expect(codeOnly).not.toContain("🤖");
  });

  test("simplify-code commits before writing the sentinel and gitignores .sdd-state (T007, sentinel updated by 025/T005)", () => {
    const simplifyCode = fs.readFileSync(path.join(repoRoot, ".claude/agents/sdd-simplify-code.md"), "utf8");
    const gitignore = fs.readFileSync(path.join(repoRoot, ".gitignore"), "utf8");

    // New step: commit-slice call between post-validation and sentinel write, refactor type, no task id.
    expect(simplifyCode).toContain("5.5. Commit the slice");
    expect(simplifyCode).toContain(
      'sdd commit-slice $ARGUMENTS --type refactor --title "<slice title>" --files <SCOPED_FILES...>',
    );
    expect(simplifyCode).toContain("No `--task` flag — a simplify pass has no task ID.");

    expect(simplifyCode).toContain("Commit: none");

    // Ordering is explicitly documented as load-bearing: commit first, sentinel second,
    // and the self-invalidation consequence of reversing it is spelled out so nobody "fixes" it later.
    expect(simplifyCode).toContain("commit FIRST");
    expect(simplifyCode).toContain("sentinel SECOND");
    expect(simplifyCode).toContain("loop `/simplify-code` forever");

    // Empty-diff path still writes the sentinel and reports no commit — nothing to commit.
    expect(simplifyCode).toContain("skip straight to step 6 and report `Commit: none`");

    // Commit failure blocks before the sentinel is written — same invariant as implement-task's revert.
    // 025/T005: the sentinel is now written by `sdd state-write`, not hand-written as `.simplified`.
    expect(simplifyCode).toContain("do NOT run `sdd state-write`");

    // Envelope gains the Commit field.
    expect(simplifyCode).toContain("- **Commit**:");

    // .sdd-state is gitignored — same sentinel-commit hazard the ordering rule above guards against.
    // .simplified stays gitignored too (025/T005: clean break in the writer, not a rename of the
    // gitignore entry — four archived features under specs/archive/ still carry a real .simplified
    // file, and un-ignoring it would surface those as untracked `??` entries).
    expect(gitignore).toContain("specs/**/.sdd-state");
    expect(gitignore).toContain("specs/**/.simplified");
  });

  test("simplify-code's SDD-artifacts filter drops agent docs and ADRs, not manual judgment (T004)", () => {
    const simplifyCode = fs.readFileSync(path.join(repoRoot, ".claude/agents/sdd-simplify-code.md"), "utf8");

    // AC6 requires these paths excluded *by the filter list*, not by an agent
    // re-judging them by hand on each pass -- decisions.md records five consecutive
    // simplify passes doing exactly that for .claude/agents/**/*.md and docs/adr/**/*.md.
    // Anchor on the SDD-artifacts bullet itself, not just anywhere in the file, so this
    // can't pass on a mention placed elsewhere (e.g. the NEVER list) that isn't actually
    // part of the filter -- that would satisfy the substring but not the criterion.
    const sddArtifactsBullet = simplifyCode.split("\n").find((line) => line.includes("**SDD artifacts**:"));

    expect(sddArtifactsBullet).toBeDefined();
    expect(sddArtifactsBullet).toContain(".claude/agents/**/*.md");
    expect(sddArtifactsBullet).toContain("docs/adr/**/*.md");

    // Step 2b's IGNORED_DIRTY notice points at this same list by reference --
    // "Apply the same exclusion filters as `SCOPED_FILES`" -- rather than duplicating
    // it, so fixing the bullet above also fixes that call site. Wiring regression only:
    // this cannot verify the orchestrator's scope computation actually obeys the text,
    // only that the list it points to now includes both globs (ADR 0003's caveat).
    expect(simplifyCode).toContain("Apply the same exclusion filters as `SCOPED_FILES`");
  });

  test("archive-feature commits the archived folder as a single haiku-safe call, no branching (T008)", () => {
    const archiveFeature = fs.readFileSync(path.join(repoRoot, ".claude/agents/sdd-archive-feature.md"), "utf8");

    // Step 3.5: exactly one commit-slice call, type chore, no --task flag (archive has no task id).
    expect(archiveFeature).toContain("### 3.5. Commit the slice");
    expect(archiveFeature).toContain("sdd commit-slice $ARGUMENTS --type chore");
    expect(archiveFeature).toContain("no `--task` flag (an archive pass has no task ID)");

    // Derived-directory reasoning (F2): the folder already moved before this runs.
    expect(archiveFeature).toContain("sdd commit-slice derives the feature directory");
    expect(archiveFeature).toContain("F2 in `decisions.md`");

    // On failure: blocked, stderr, no recovery logic invented on this tier.
    expect(archiveFeature).toContain("Do not attempt recovery logic");

    // The haiku / no-branching constraint must be spelled out so a future editor
    // doesn't "improve" this into a decision tree.
    expect(archiveFeature).toContain("model: haiku");
    expect(archiveFeature).toContain("cheapest tier in the pipeline");
    expect(archiveFeature).toContain("no conditional branching");
    expect(archiveFeature).toContain("that branching lives in `bin/sdd`");

    // Envelope gains the Commit field.
    expect(archiveFeature).toContain("- **Commit**:");
  });

  test("archive-feature's commit-slice call stages --moved-from so both halves of the move land, still one plain call (T007)", () => {
    const archiveFeature = fs.readFileSync(path.join(repoRoot, ".claude/agents/sdd-archive-feature.md"), "utf8");

    // The single call gains --moved-from specs/$ARGUMENTS — the old path the Step 3 `mv` already moved away from.
    expect(archiveFeature).toContain(
      "sdd commit-slice $ARGUMENTS --type chore --title \"Archive $ARGUMENTS\" --moved-from specs/$ARGUMENTS --files <spec files touched by the delta merge>",
    );

    // Step 3.5 is still exactly one `sdd commit-slice` invocation — this is a wiring regression
    // guard, not proof the agent obeys it: it asserts the instruction text stays a single plain
    // call with no branching added around it, per the haiku-tier constraint spelled out below.
    const step35Match = archiveFeature.match(
      /### 3\.5\. Commit the slice([\s\S]*?)\n4\. \*\*Present summary\*\*/,
    );
    expect(step35Match).not.toBeNull();
    const step35Body = step35Match[1];

    // Exactly one fenced code block — one invocation, not one-plus-a-fallback-branch.
    // (Prose around it legitimately says "sdd commit-slice" more than once — e.g. explaining
    // *why* the plain call works — so the invocation count is the fenced blocks, not the mentions.)
    const fenceDelimiters = step35Body.match(/```/g) || [];
    expect(fenceDelimiters.length).toBe(2);

    // The fenced call itself is a single line — no if/case/conditional inserted into the call.
    const fencedBlock = step35Body.match(/```\n([\s\S]*?)\n```/);
    expect(fencedBlock).not.toBeNull();
    const fencedLines = fencedBlock[1].split("\n");
    expect(fencedLines.length).toBe(1);
    expect(fencedLines[0]).toBe(
      "sdd commit-slice $ARGUMENTS --type chore --title \"Archive $ARGUMENTS\" --moved-from specs/$ARGUMENTS --files <spec files touched by the delta merge>",
    );

    // No branching keywords added to Step 3.5 beyond the existing on/off knob check and the
    // success/failure prose bullets (both pre-existing, documentation, not shell branching).
    expect(step35Body).not.toMatch(/\bif\s+\[/);
    expect(step35Body).not.toMatch(/\bcase\b/);
    expect(step35Body).not.toMatch(/\belif\b/);
  });

  test("archive-feature's Step 3.6 resolves the base branch and prints the two PR-gate follow-up commands by hand (024 AC4)", () => {
    const archiveFeature = fs.readFileSync(path.join(repoRoot, ".claude/agents/sdd-archive-feature.md"), "utf8");

    // Step 3.6 exists, comes after 3.5, and resolves the base branch via the same
    // CLI helper used elsewhere in the pipeline -- no ad hoc base-branch logic here.
    expect(archiveFeature).toContain("### 3.6. Print the PR gate commands");
    expect(archiveFeature).toContain("sdd base-branch $ARGUMENTS");

    // The two literal commands the human is meant to copy-paste, verbatim --
    // and in this relative order. Independent toContain() checks (the previous
    // shape of this test) don't pin order: swapping the prose so `gh pr create`
    // reads before `git push` would still pass both, even though it's
    // operationally backwards -- you cannot open a PR for a branch that was
    // never pushed (re-review cycle 2, low finding).
    expect(archiveFeature).toContain("`git push -u origin HEAD`");
    expect(archiveFeature).toContain("`gh pr create --draft --base <base>`");
    expect(archiveFeature.indexOf("`git push -u origin HEAD`")).toBeLessThan(
      archiveFeature.indexOf("`gh pr create --draft --base <base>`"),
    );

    // Success substitutes the resolved base; failure still prints both commands with
    // <base> left unresolved -- a copyable command with a hole beats printing nothing.
    expect(archiveFeature).toContain("substitute the resolved value for `<base>`");
    expect(archiveFeature).toContain("print the same two lines with `<base>` left **unresolved**");

    // The agent only prints; it never runs either command itself.
    expect(archiveFeature).toContain("Do not run either command yourself");

    // Step 3.6 must not disturb Step 3.5's fenced commit-slice block: archiveStep35Line()
    // (used elsewhere in this file) is anchored on the *first* fenced block after "###
    // 3.5. Commit the slice", and it must still resolve to the single-line commit-slice
    // call, not bleed into anything Step 3.6 adds.
    expect(archiveStep35Line()).toBe(
      'sdd commit-slice $ARGUMENTS --type chore --title "Archive $ARGUMENTS" --moved-from specs/$ARGUMENTS --files <spec files touched by the delta merge>',
    );

    // And the T007 fence count (exactly one fenced block between 3.5's header and
    // "4. **Present summary**") must stay at 2 delimiters -- Step 3.6's two commands
    // are inline code spans, not a second fenced block.
    const step35Match = archiveFeature.match(/### 3\.5\. Commit the slice([\s\S]*?)\n4\. \*\*Present summary\*\*/);
    expect(step35Match).not.toBeNull();
    const fenceDelimiters = step35Match[1].match(/```/g) || [];
    expect(fenceDelimiters.length).toBe(2);
  });

  test("archive-feature's Step 3.5 self-checks verify-archive before deleting the receipt, blocking on a nonzero exit (026 T006/AC6)", () => {
    const archiveFeature = fs.readFileSync(path.join(repoRoot, ".claude/agents/sdd-archive-feature.md"), "utf8");

    // The self-check invocation itself, as inline code (never a fence -- a
    // second fenced block would push the Step 3.5 fence count above 2).
    expect(archiveFeature).toContain("`sdd verify-archive $ARGUMENTS`");

    // Ordering pin, same indexOf pattern the T007 receipt-deletion-ordering test
    // above already uses: the self-check must run before the receipt is touched
    // at all, so its call site sits before the literal `rm -f` line.
    const verifyArchiveIndex = archiveFeature.indexOf("`sdd verify-archive $ARGUMENTS`");
    const rmReceiptIndex = archiveFeature.indexOf(
      "run `rm -f specs/archive/YYYY-MM-DD-$ARGUMENTS/.sdd-state`",
    );
    expect(verifyArchiveIndex).toBeGreaterThan(-1);
    expect(rmReceiptIndex).toBeGreaterThan(-1);
    expect(verifyArchiveIndex).toBeLessThan(rmReceiptIndex);

    // A nonzero exit blocks the phase with the CLI's stderr pasted verbatim and
    // explicitly does not delete the receipt -- a second, independent assertion
    // from the ordering pin above (this exercises the nonzero-exit branch's
    // wording, not just where the call sits).
    expect(archiveFeature).toContain("nonzero");
    expect(archiveFeature).toContain("`sdd verify-archive`'s stderr pasted verbatim");
    expect(archiveFeature).toContain("do not delete `.sdd-state`");

    // Still no shell branching syntax introduced by the self-check prose --
    // the existing T007/T008 pins already cover this range, this is a direct
    // regression guard on the exact text this task adds.
    const step35Match = archiveFeature.match(/### 3\.5\. Commit the slice([\s\S]*?)\n4\. \*\*Present summary\*\*/);
    expect(step35Match).not.toBeNull();
    expect(step35Match[1]).not.toMatch(/\bif\s+\[/);
    expect(step35Match[1]).not.toMatch(/\bcase\b/);
    expect(step35Match[1]).not.toMatch(/\belif\b/);
  });

  test("archive-feature's Step 3.6 points the human writing the PR body at branch-pr/chained-pr (026 T006/AC6)", () => {
    const archiveFeature = fs.readFileSync(path.join(repoRoot, ".claude/agents/sdd-archive-feature.md"), "utf8");

    const step36Match = archiveFeature.match(/### 3\.6\. Print the PR gate commands([\s\S]*?)\n4\. \*\*Present summary\*\*/);
    expect(step36Match).not.toBeNull();
    const step36Body = step36Match[1];

    expect(step36Body).toContain("`branch-pr`");
    expect(step36Body).toContain("`chained-pr`");

    // No repeat of the retired PR-creation literal here -- already guarded
    // repo-wide, this file included, by sweep-retired-symbols.test.js's AC5 walk.
  });

  // The two AC4 regression tests proving sdd-next/sdd-auto and CLAUDE.md no longer
  // mention the retired gate's phase label, command, or sentinel file moved to
  // tests/retired-symbol-proofs.test.js — each must name those literal strings to
  // prove the prose no longer contains them.

  test("review-feature pipeline wires in the cross-reviewer as an advisory third agent", () => {
    const reviewFeature = fs.readFileSync(path.join(repoRoot, ".claude/skills/review-feature/SKILL.md"), "utf8");

    expect(reviewFeature).toContain("CROSS_REVIEW_AVAILABLE");
    expect(reviewFeature).toContain("sdd-cross-reviewer");
    expect(reviewFeature).toContain("implemented-by");
    expect(reviewFeature).toContain("## CROSS-REVIEW");
    expect(reviewFeature).toContain("**Cross-Review**");
    expect(reviewFeature).toContain("cross-review reported FAIL (advisory)");
  });

  test("cross-reviewer unwraps the companion result envelope and bounds runtime", () => {
    const crossReviewer = fs.readFileSync(path.join(repoRoot, ".claude/agents/sdd-cross-reviewer.md"), "utf8");

    expect(crossReviewer).toContain(".result");
    expect(crossReviewer).toContain("parseError");
    expect(crossReviewer).toContain("600000");
    expect(crossReviewer).toContain("skipped — runtime error: timeout");
  });

  test("cross-reviewer and review-feature harden invocation, plugin detection, and fail-open (T007)", () => {
    const crossReviewer = fs.readFileSync(path.join(repoRoot, ".claude/agents/sdd-cross-reviewer.md"), "utf8");
    const reviewFeature = fs.readFileSync(path.join(repoRoot, ".claude/skills/review-feature/SKILL.md"), "utf8");

    // Fix 1: focus text goes through a scratch file + command substitution, never literal interpolation
    expect(crossReviewer).toContain(".cross-focus.txt");
    expect(crossReviewer).toContain("$(cat ");

    // Fix 2: kill-switch checked against the real installed_plugins.json + settings.json shape
    expect(crossReviewer).toContain("installed_plugins.json");
    expect(crossReviewer).toContain("enabledPlugins");
    expect(reviewFeature).toContain("installed_plugins.json");
    expect(reviewFeature).toContain("enabledPlugins");

    // Fix 3: orchestration fail-open for cross-agent launch/crash/timeout/malformed-output
    expect(reviewFeature).toContain("cross-agent failure");

    // Fix 4: schema read from the resolved version directory, not hardcoded prose
    expect(crossReviewer).toContain("review-output.schema.json");
    expect(crossReviewer).toContain("resolved version directory");
  });

  test("cross-reviewer and review-feature fix schema path, gitignore, settings readability, and installPath fallback (T008)", () => {
    const crossReviewer = fs.readFileSync(path.join(repoRoot, ".claude/agents/sdd-cross-reviewer.md"), "utf8");
    const reviewFeature = fs.readFileSync(path.join(repoRoot, ".claude/skills/review-feature/SKILL.md"), "utf8");
    const gitignore = fs.readFileSync(path.join(repoRoot, ".gitignore"), "utf8");

    // Fix 1: real v1.0.6 schema layout is schemas/review-output.schema.json, with an explicit fallback
    expect(crossReviewer).toContain("schemas/review-output.schema.json");
    expect(crossReviewer).toContain("prose field summary");

    // Fix 2: .cross-focus.txt scratch file is gitignored, mirroring .parent-branch
    expect(gitignore).toContain("specs/**/.cross-focus.txt");

    // Fix 3: unreadable/absent settings.json is treated identically to enabledPlugins missing
    expect(crossReviewer).toContain("unreadable or absent");

    // Fix 4: registry entry with a missing/invalid installPath is an audited skip, never a cache fallback
    expect(crossReviewer).toContain("no valid installPath");
    expect(reviewFeature).toContain("no valid installPath");
  });

  describe("sdd branch", () => {
    function currentBranch(project) {
      return execFileSync("git", ["branch", "--show-current"], {
        cwd: project,
        encoding: "utf8",
      }).trim();
    }

    test("creates and checks out a new feature branch when none exists", () => {
      const project = makeTempProject();

      const output = execFileSync(sddBin, ["branch", "001-demo"], {
        cwd: project,
        encoding: "utf8",
      });

      expect(output.trim()).toBe("feature/001-demo");
      expect(currentBranch(project)).toBe("feature/001-demo");
    });

    test("is idempotent when already on the feature branch", () => {
      const project = makeTempProject();
      execFileSync(sddBin, ["branch", "001-demo"], { cwd: project, encoding: "utf8" });

      const output = execFileSync(sddBin, ["branch", "001-demo"], {
        cwd: project,
        encoding: "utf8",
      });

      expect(output.trim()).toBe("feature/001-demo");
      expect(currentBranch(project)).toBe("feature/001-demo");
    });

    test("checks out an existing feature branch without recreating it", () => {
      const project = makeTempProject();
      execFileSync(sddBin, ["branch", "001-demo"], { cwd: project, encoding: "utf8" });
      execFileSync("git", ["commit", "--allow-empty", "-m", "seed"], {
        cwd: project,
        encoding: "utf8",
      });
      execFileSync("git", ["checkout", "-b", "other"], { cwd: project, encoding: "utf8" });
      expect(currentBranch(project)).toBe("other");

      const output = execFileSync(sddBin, ["branch", "001-demo"], {
        cwd: project,
        encoding: "utf8",
      });

      expect(output.trim()).toBe("feature/001-demo");
      expect(currentBranch(project)).toBe("feature/001-demo");
    });

    test("exits non-zero and creates no branch when feature-id is missing", () => {
      const project = makeTempProject();
      const before = currentBranch(project);

      let error;
      try {
        execFileSync(sddBin, ["branch"], { cwd: project, encoding: "utf8" });
      } catch (e) {
        error = e;
      }

      expect(error).toBeDefined();
      expect(error.status).not.toBe(0);
      expect(currentBranch(project)).toBe(before);
    });
  });

  // V3 (research/hallazgos-verificados.md): standing on feature/AAA, `sdd
  // branch BBB` created feature/BBB FROM AAA and wrote no sidecar, so
  // `sdd base-branch BBB` fell through to Layer 3 autodetect and picked the
  // wrong base -- this is what handed 024's simplify a ~85-file scope from
  // an unrelated feature. These are AC3's two independent behaviours: (a)
  // always record the resolved parent, (b) warn -- never refuse -- when
  // that parent is itself a feature/* branch.
  describe("sdd branch records the parent and warns on stacking (T003)", () => {
    function parentBranchPath(project, featureId) {
      return path.join(project, "specs", featureId, ".parent-branch");
    }

    test("standing on feature/AAA, branching BBB records AAA as parent and warns on stderr", () => {
      const project = makeTempProject();
      seedCommit(project);
      execFileSync(sddBin, ["branch", "AAA"], { cwd: project, encoding: "utf8" });
      execFileSync("git", ["commit", "--allow-empty", "-m", "AAA work"], { cwd: project });

      const errPath = path.join(os.tmpdir(), `${path.basename(project)}-branch-stderr-capture`);
      const errFd = fs.openSync(errPath, "w");
      let stdout;
      try {
        stdout = execFileSync(sddBin, ["branch", "BBB"], {
          cwd: project,
          encoding: "utf8",
          stdio: ["ignore", "pipe", errFd],
        });
      } finally {
        fs.closeSync(errFd);
      }
      const stderrOutput = fs.readFileSync(errPath, "utf8");

      expect(stdout.trim()).toBe("feature/BBB");
      expect(stderrOutput).toContain("feature/BBB");
      expect(stderrOutput).toContain("feature/AAA");

      const sidecarPath = parentBranchPath(project, "BBB");
      const parentRef = fs.readFileSync(sidecarPath, "utf8").trim();
      expect(parentRef).toBe("feature/AAA");
      // Must resolve, per cmd_base_branch Layer 1's contract.
      execFileSync("git", ["rev-parse", "--verify", parentRef], { cwd: project, encoding: "utf8" });
    });

    test("sdd base-branch then reads that sidecar instead of falling back to autodetect", () => {
      const project = makeTempProject();
      seedCommit(project);
      execFileSync("git", ["branch", "-M", "main"], { cwd: project });
      execFileSync(sddBin, ["branch", "AAA"], { cwd: project, encoding: "utf8" });
      execFileSync("git", ["commit", "--allow-empty", "-m", "AAA work"], { cwd: project });
      execFileSync(sddBin, ["branch", "BBB"], { cwd: project, encoding: "utf8" });

      const output = execFileSync(sddBin, ["base-branch", "BBB"], { cwd: project, encoding: "utf8" });

      // Layer 3 autodetect would return "main" here -- this proves Layer 1
      // (the sidecar T003 just wrote) wins instead.
      expect(output.trim()).toBe("feature/AAA");
    });

    test("branching from a non-feature branch records it and emits no stacking warning", () => {
      const project = makeTempProject();
      seedCommit(project);
      execFileSync("git", ["branch", "-M", "main"], { cwd: project });

      const errPath = path.join(os.tmpdir(), `${path.basename(project)}-branch-stderr-capture-2`);
      const errFd = fs.openSync(errPath, "w");
      try {
        execFileSync(sddBin, ["branch", "001-demo"], {
          cwd: project,
          encoding: "utf8",
          stdio: ["ignore", "pipe", errFd],
        });
      } finally {
        fs.closeSync(errFd);
      }
      const stderrOutput = fs.readFileSync(errPath, "utf8");

      expect(stderrOutput).not.toMatch(/warning:/);
      expect(fs.readFileSync(parentBranchPath(project, "001-demo"), "utf8").trim()).toBe("main");
    });

    test("re-running sdd branch on an existing feature branch does not clobber an existing sidecar", () => {
      const project = makeTempProject();
      seedCommit(project);
      execFileSync("git", ["branch", "-M", "main"], { cwd: project });
      execFileSync(sddBin, ["branch", "001-demo"], { cwd: project, encoding: "utf8" });
      execFileSync("git", ["commit", "--allow-empty", "-m", "demo work"], { cwd: project });

      const sidecarPath = parentBranchPath(project, "001-demo");
      // Hand-write a sidecar naming a different parent than the branch we're
      // about to switch back from, so a clobber would be observable.
      execFileSync("git", ["branch", "hand-written-parent"], { cwd: project });
      fs.writeFileSync(sidecarPath, "hand-written-parent\n");

      execFileSync("git", ["checkout", "main"], { cwd: project });
      execFileSync(sddBin, ["branch", "001-demo"], { cwd: project, encoding: "utf8" });

      expect(fs.readFileSync(sidecarPath, "utf8").trim()).toBe("hand-written-parent");
    });

    test("already being on the target branch is still a no-op and leaves the sidecar untouched", () => {
      const project = makeTempProject();
      seedCommit(project);
      execFileSync("git", ["branch", "-M", "main"], { cwd: project });
      execFileSync(sddBin, ["branch", "001-demo"], { cwd: project, encoding: "utf8" });

      const sidecarPath = parentBranchPath(project, "001-demo");
      expect(fs.readFileSync(sidecarPath, "utf8").trim()).toBe("main");

      const output = execFileSync(sddBin, ["branch", "001-demo"], { cwd: project, encoding: "utf8" });

      expect(output.trim()).toBe("feature/001-demo");
      expect(fs.readFileSync(sidecarPath, "utf8").trim()).toBe("main");
    });
  });

  // cmd_base_branch had zero tests before this suite despite implementing three
  // resolution layers (F7). These are also AC8's "resolution" axis: every value,
  // including the ones that never failed, not just a regression test per bug.
  describe("sdd base-branch", () => {
    function writeGitMd(project, ref) {
      fs.mkdirSync(path.join(project, ".claude", "rules"), { recursive: true });
      fs.writeFileSync(path.join(project, ".claude", "rules", "git.md"), `base-branch: ${ref}\n`);
    }

    test("active feature: resolves via the specs/<id>/.parent-branch sidecar", () => {
      const project = makeTempProject();
      seedCommit(project);
      execFileSync("git", ["branch", "release-parent"], { cwd: project });
      fs.writeFileSync(path.join(project, "specs", "001-demo", ".parent-branch"), "release-parent\n");

      const output = execFileSync(sddBin, ["base-branch", "001-demo"], {
        cwd: project,
        encoding: "utf8",
      });

      expect(output.trim()).toBe("release-parent");
    });

    test("dated-archive feature: resolves via specs/archive/<date>-<id>/.parent-branch", () => {
      const project = makeTempProject();
      seedCommit(project);
      execFileSync("git", ["branch", "release-parent"], { cwd: project });
      fs.rmSync(path.join(project, "specs", "001-demo"), { recursive: true, force: true });
      const archiveDir = path.join(project, "specs", "archive", "2026-08-01-001-demo");
      fs.mkdirSync(archiveDir, { recursive: true });
      fs.writeFileSync(path.join(archiveDir, ".parent-branch"), "release-parent\n");

      const output = execFileSync(sddBin, ["base-branch", "001-demo"], {
        cwd: project,
        encoding: "utf8",
      });

      expect(output.trim()).toBe("release-parent");
    });

    test("legacy archive prefix (dir name === id, no date) does not match the glob and falls through instead of using it", () => {
      const project = makeTempProject();
      seedCommit(project);
      execFileSync("git", ["branch", "-M", "main"], { cwd: project });
      fs.rmSync(path.join(project, "specs", "001-demo"), { recursive: true, force: true });
      // Legacy naming predating the YYYY-MM-DD- prefix: the archived dir name IS
      // the feature-id verbatim (this repo's own specs/archive/003-plan-discovery-checkpoint
      // and 004-adversarial-review-agent are real examples). resolve_feature_dir's
      // "*-<id>" glob requires a "-" immediately before the id, which this never has.
      const legacyDir = path.join(project, "specs", "archive", "001-demo");
      fs.mkdirSync(legacyDir, { recursive: true });
      fs.writeFileSync(path.join(legacyDir, ".parent-branch"), "wrong-branch-must-be-ignored\n");
      writeGitMd(project, "main");

      const output = execFileSync(sddBin, ["base-branch", "001-demo"], {
        cwd: project,
        encoding: "utf8",
      });

      expect(output.trim()).toBe("main");
    });

    test("unresolvable id, no specs/archive dir anywhere: falls through instead of aborting under pipefail", () => {
      const project = makeTempProject();
      seedCommit(project);
      execFileSync("git", ["branch", "-M", "main"], { cwd: project });
      // No specs/archive directory exists in this project at all -- resolve_feature_dir's
      // internal archive lookup errors on the missing path, and under set -euo pipefail
      // an unguarded caller aborts the whole process here instead of falling through.
      writeGitMd(project, "main");

      const output = execFileSync(sddBin, ["base-branch", "999-totally-unresolvable"], {
        cwd: project,
        encoding: "utf8",
      });

      expect(output.trim()).toBe("main");
    });

    test("empty/whitespace sidecar falls through to Layer 2", () => {
      const project = makeTempProject();
      seedCommit(project);
      execFileSync("git", ["branch", "-M", "main"], { cwd: project });
      fs.writeFileSync(path.join(project, "specs", "001-demo", ".parent-branch"), "   \n");
      writeGitMd(project, "main");

      const output = execFileSync(sddBin, ["base-branch", "001-demo"], {
        cwd: project,
        encoding: "utf8",
      });

      expect(output.trim()).toBe("main");
    });

    test("sidecar naming a branch that does not exist locally exits 2 without falling through (Unchanged)", () => {
      const project = makeTempProject();
      seedCommit(project);
      execFileSync("git", ["branch", "-M", "main"], { cwd: project });
      fs.writeFileSync(path.join(project, "specs", "001-demo", ".parent-branch"), "does-not-exist-branch\n");
      writeGitMd(project, "main");

      const error = sddFail(["base-branch", "001-demo"], { cwd: project });

      expect(error.status).toBe(2);
      expect(error.stderr).toContain("does-not-exist-branch");
    });

    test("nothing resolvable anywhere exits 3 (Unchanged)", () => {
      const project = makeTempProject();
      // No sidecar content, no .claude/rules/git.md, and no commits yet, so
      // Layer 3 has no develop/main/master ref to fall back on either.
      const error = sddFail(["base-branch", "001-demo"], { cwd: project });

      expect(error.status).toBe(3);
    });
  });

  describe("sdd commit-slice", () => {
    test("commits the named files with the <type>(<id>): <title> message format", () => {
      const project = makeTempProject();
      seedCommit(project);
      execFileSync(sddBin, ["branch", "001-demo"], { cwd: project, encoding: "utf8" });
      fs.writeFileSync(path.join(project, "app.js"), "console.log('hi');\n");

      const output = execFileSync(
        sddBin,
        ["commit-slice", "001-demo", "--type", "feat", "--title", "Add hello log", "--files", "app.js"],
        { cwd: project, encoding: "utf8" },
      );

      const sha = output.trim();
      expect(sha).toMatch(/^[0-9a-f]{40}$/);

      const message = execFileSync("git", ["log", "-1", "--format=%s", sha], {
        cwd: project,
        encoding: "utf8",
      }).trim();
      expect(message).toBe("feat(001-demo): Add hello log");
    });

    test("prefixes the message with Tnnn when --task is passed", () => {
      const project = makeTempProject();
      seedCommit(project);
      execFileSync(sddBin, ["branch", "001-demo"], { cwd: project, encoding: "utf8" });
      fs.writeFileSync(path.join(project, "app.js"), "console.log('hi');\n");

      const output = execFileSync(
        sddBin,
        [
          "commit-slice",
          "001-demo",
          "--type",
          "feat",
          "--task",
          "T001",
          "--title",
          "Add hello log",
          "--files",
          "app.js",
        ],
        { cwd: project, encoding: "utf8" },
      );

      const sha = output.trim();
      const message = execFileSync("git", ["log", "-1", "--format=%s", sha], {
        cwd: project,
        encoding: "utf8",
      }).trim();
      expect(message).toBe("feat(001-demo): T001 Add hello log");
    });

    test("stages only --files plus the derived feature dir, leaving a pre-staged unrelated file untouched", () => {
      const project = makeTempProject();
      seedCommit(project);
      execFileSync(sddBin, ["branch", "001-demo"], { cwd: project, encoding: "utf8" });
      fs.writeFileSync(path.join(project, "app.js"), "console.log('hi');\n");
      fs.writeFileSync(path.join(project, "unrelated.js"), "console.log('bye');\n");
      // Pre-staged by someone else before commit-slice runs: T001's
      // undeclared-file check (AC1) hard-fails on a stray file nobody
      // staged, so "unrelated but untouched" now requires pre_staged's
      // exclusion rather than merely being dirty.
      execFileSync("git", ["add", "--", "unrelated.js"], { cwd: project });
      fs.writeFileSync(path.join(project, "specs", "001-demo", "spec.md"), "# Spec\n\nUpdated.\n");

      const output = execFileSync(
        sddBin,
        ["commit-slice", "001-demo", "--type", "feat", "--title", "Add hello log", "--files", "app.js"],
        { cwd: project, encoding: "utf8" },
      );

      const sha = output.trim();
      const files = filesInCommit(project, sha);

      expect(files).toContain("app.js");
      expect(files).toContain("specs/001-demo/spec.md");
      expect(files).not.toContain("unrelated.js");

      const status = execFileSync("git", ["status", "--porcelain"], {
        cwd: project,
        encoding: "utf8",
      });
      expect(status).toContain("unrelated.js");
    });

    test("refuses without --files and creates no commit, even when specs/<id> itself is dirty", () => {
      const project = makeTempProject();
      seedCommit(project);
      execFileSync(sddBin, ["branch", "001-demo"], { cwd: project, encoding: "utf8" });
      const before = execFileSync("git", ["rev-parse", "HEAD"], { cwd: project, encoding: "utf8" }).trim();
      // specs/001-demo has a real change on disk — without the guardrail, staging
      // just the derived feature dir would be enough to produce a "successful" commit.
      fs.writeFileSync(path.join(project, "specs", "001-demo", "spec.md"), "# Spec\n\nUpdated.\n");

      const error = sddFail(
        ["commit-slice", "001-demo", "--type", "feat", "--title", "No files"],
        { cwd: project },
      );

      expect(error.status).toBe(2);
      expect(error.stderr).toContain("--files");

      const after = execFileSync("git", ["rev-parse", "HEAD"], { cwd: project, encoding: "utf8" }).trim();
      expect(after).toBe(before);
    });

    test("resolves the derived feature dir from specs/archive/*-<id> when specs/<id> is absent", () => {
      const project = makeTempProject();
      seedCommit(project);
      execFileSync(sddBin, ["branch", "001-demo"], { cwd: project, encoding: "utf8" });
      fs.rmSync(path.join(project, "specs", "001-demo"), { recursive: true, force: true });
      const archiveDir = path.join(project, "specs", "archive", "2026-08-01-001-demo");
      fs.mkdirSync(archiveDir, { recursive: true });
      fs.writeFileSync(path.join(archiveDir, "spec.md"), "# Spec\n");
      execFileSync("git", ["add", "-A"], { cwd: project });
      execFileSync("git", ["commit", "-q", "-m", "move to archive"], { cwd: project });

      fs.writeFileSync(path.join(project, "app.js"), "console.log('hi');\n");
      fs.writeFileSync(path.join(archiveDir, "decisions.md"), "# Decisions\n");

      const output = execFileSync(
        sddBin,
        ["commit-slice", "001-demo", "--type", "chore", "--title", "Archive note", "--files", "app.js"],
        { cwd: project, encoding: "utf8" },
      );

      const sha = output.trim();
      const files = filesInCommit(project, sha);
      expect(files).toContain("app.js");
      expect(files).toContain("specs/archive/2026-08-01-001-demo/decisions.md");
    });

    test("exits 3 and creates no commit when the feature dir cannot be resolved", () => {
      const project = makeTempProject();
      seedCommit(project);
      execFileSync(sddBin, ["branch", "001-demo"], { cwd: project, encoding: "utf8" });
      const before = execFileSync("git", ["rev-parse", "HEAD"], { cwd: project, encoding: "utf8" }).trim();
      fs.writeFileSync(path.join(project, "app.js"), "console.log('hi');\n");

      const error = sddFail(
        ["commit-slice", "999-missing", "--type", "feat", "--title", "No feature", "--files", "app.js"],
        { cwd: project },
      );

      expect(error.status).toBe(3);
      expect(error.stderr).toContain("feature not found");

      const after = execFileSync("git", ["rev-parse", "HEAD"], { cwd: project, encoding: "utf8" }).trim();
      expect(after).toBe(before);
    });

    test("exits 4 and passes git's stderr through when a --files path does not exist", () => {
      const project = makeTempProject();
      seedCommit(project);
      execFileSync(sddBin, ["branch", "001-demo"], { cwd: project, encoding: "utf8" });
      const before = execFileSync("git", ["rev-parse", "HEAD"], { cwd: project, encoding: "utf8" }).trim();

      const error = sddFail(
        ["commit-slice", "001-demo", "--type", "feat", "--title", "Missing path", "--files", "does-not-exist.js"],
        { cwd: project },
      );

      expect(error.status).toBe(4);
      expect(error.stderr).toMatch(/pathspec|did not match/);

      const after = execFileSync("git", ["rev-parse", "HEAD"], { cwd: project, encoding: "utf8" }).trim();
      expect(after).toBe(before);
    });

    test("exits 5 and creates no commit when nothing changed to stage", () => {
      const project = makeTempProject();
      seedCommit(project);
      execFileSync(sddBin, ["branch", "001-demo"], { cwd: project, encoding: "utf8" });
      fs.writeFileSync(path.join(project, "app.js"), "console.log('hi');\n");
      execFileSync("git", ["add", "-A"], { cwd: project });
      execFileSync("git", ["commit", "-q", "-m", "add app.js"], { cwd: project });
      const before = execFileSync("git", ["rev-parse", "HEAD"], { cwd: project, encoding: "utf8" }).trim();

      const error = sddFail(
        ["commit-slice", "001-demo", "--type", "feat", "--title", "No changes", "--files", "app.js"],
        { cwd: project },
      );

      expect(error.status).toBe(5);
      expect(error.stderr).toContain("nothing staged");

      const after = execFileSync("git", ["rev-parse", "HEAD"], { cwd: project, encoding: "utf8" }).trim();
      expect(after).toBe(before);
    });

    test("never stages with git add -A or --all", () => {
      const sddCli = fs.readFileSync(path.join(repoRoot, "bin/sdd"), "utf8");
      const match = sddCli.match(/cmd_commit_slice\(\) \{[\s\S]*?\n\}\n/);

      expect(match).not.toBeNull();

      // Exclude comment lines (e.g. "Never 'git add -A'") so the assertion
      // checks executable code, not prose that mentions the forbidden form.
      const codeOnly = match[0]
        .split("\n")
        .filter((line) => !line.trim().startsWith("#"))
        .join("\n");
      expect(codeOnly).not.toMatch(/git add (-A|--all)\b/);
    });

    test("--moved-from stages the deletion of a tracked path that moved away", () => {
      const project = makeTempProject();
      seedCommit(project);
      execFileSync(sddBin, ["branch", "001-demo"], { cwd: project, encoding: "utf8" });
      const oldDir = path.join(project, "specs", "001-demo");
      const archiveDir = path.join(project, "specs", "archive", "2026-08-26-001-demo");
      fs.mkdirSync(path.dirname(archiveDir), { recursive: true });
      fs.renameSync(oldDir, archiveDir);
      fs.writeFileSync(path.join(project, "app.js"), "console.log('hi');\n");

      const output = execFileSync(
        sddBin,
        [
          "commit-slice",
          "001-demo",
          "--type",
          "chore",
          "--title",
          "Archive note",
          "--moved-from",
          "specs/001-demo",
          "--files",
          "app.js",
        ],
        { cwd: project, encoding: "utf8" },
      );

      const sha = output.trim();
      // git's default rename detection folds a tracked-and-deleted path plus
      // a same-content addition into an "R100 old new" record rather than a
      // separate D line — so assert on the resulting tree (AC6's "a clean
      // checkout holds only the archive location"), not on --name-status.
      const tree = execFileSync("git", ["ls-tree", "-r", "--name-only", sha], {
        cwd: project,
        encoding: "utf8",
      });
      expect(tree).not.toContain("specs/001-demo/spec.md");
      expect(tree).toContain("specs/archive/2026-08-26-001-demo/spec.md");

      const files = filesInCommit(project, sha);
      expect(files).toContain("app.js");
      expect(files).toContain("specs/archive/2026-08-26-001-demo/spec.md");
    });

    // Regression for the 7th defect: a bare `git commit` after scoped `git add`s
    // still commits the WHOLE index, so anything pre-staged by someone else
    // (not dirty — already staged) rides along silently. Both halves of the
    // assertion matter: the unrelated file must be absent from the commit AND
    // still staged afterward — dropping it from the commit but also unstaging
    // it would be a different bug.
    test("commits only the named paths, leaving a file staged by someone else untouched and still staged", () => {
      const project = makeTempProject();
      seedCommit(project);
      execFileSync(sddBin, ["branch", "001-demo"], { cwd: project, encoding: "utf8" });
      fs.writeFileSync(path.join(project, "app.js"), "console.log('hi');\n");
      fs.writeFileSync(path.join(project, "ajeno.txt"), "someone else's staged work\n");
      // Pre-staged by "someone else" — never named in --files below.
      execFileSync("git", ["add", "--", "ajeno.txt"], { cwd: project });

      const output = execFileSync(
        sddBin,
        ["commit-slice", "001-demo", "--type", "feat", "--title", "Add hello log", "--files", "app.js"],
        { cwd: project, encoding: "utf8" },
      );

      const sha = output.trim();
      const files = filesInCommit(project, sha);
      expect(files).toContain("app.js");
      expect(files).not.toContain("ajeno.txt");

      const status = execFileSync("git", ["status", "--porcelain"], {
        cwd: project,
        encoding: "utf8",
      });
      // Still staged (index "A"), neither committed nor bumped back to dirty/untracked.
      expect(status).toMatch(/^A\s+ajeno\.txt$/m);
    });

    // V1/AC1: the old post-commit "warning: tracked files still dirty after
    // commit" check ran AFTER `git commit`, filtering out untracked ('^??')
    // lines — which is exactly what let a brand-new undeclared file survive
    // silently (repro: create app.js + helper.js, declare only app.js ->
    // commits app.js, leaves helper.js as `??`, exit 0, no mention of it in
    // the warning). Fixed by moving the check BEFORE the commit (so there is
    // nothing to roll back) and dropping the '^??' filter so untracked files
    // count too. Two things must still be excluded from "undeclared", or the
    // check would trip on every normal call: (1) pre_staged -- someone
    // else's legitimately pre-existing staged work (unchanged mechanism);
    // (2) this invocation's own declared paths (--files, the feature dir,
    // --moved-from), which are staged -- not committed yet -- by the time
    // this check runs.
    test("rejects an undeclared new file created alongside a declared one: exits non-zero, names it, creates no commit (V1/AC1)", () => {
      const project = makeTempProject();
      seedCommit(project);
      execFileSync(sddBin, ["branch", "001-demo"], { cwd: project, encoding: "utf8" });
      const before = execFileSync("git", ["rev-parse", "HEAD"], { cwd: project, encoding: "utf8" }).trim();
      fs.writeFileSync(path.join(project, "app.js"), "console.log('hi');\n");
      fs.writeFileSync(path.join(project, "helper.js"), "console.log('undeclared');\n");

      const error = sddFail(
        ["commit-slice", "001-demo", "--type", "feat", "--title", "Add hello log", "--files", "app.js"],
        { cwd: project },
      );

      expect(error.status).not.toBe(0);
      expect(error.stderr).toContain("helper.js");

      const after = execFileSync("git", ["rev-parse", "HEAD"], { cwd: project, encoding: "utf8" }).trim();
      expect(after).toBe(before);

      const status = execFileSync("git", ["status", "--porcelain"], { cwd: project, encoding: "utf8" });
      expect(status).toContain("?? helper.js");
    });

    test("still succeeds when an unrelated file was pre-staged before commit-slice ran (pre-existing staged work is not blamed)", () => {
      const project = makeTempProject();
      seedCommit(project);
      execFileSync(sddBin, ["branch", "001-demo"], { cwd: project, encoding: "utf8" });
      fs.writeFileSync(path.join(project, "app.js"), "console.log('hi');\n");
      fs.writeFileSync(path.join(project, "ajeno.txt"), "someone else's staged work\n");
      // Pre-staged before commit-slice runs -- must not be mistaken for an
      // undeclared file this invocation is responsible for.
      execFileSync("git", ["add", "--", "ajeno.txt"], { cwd: project });

      // Outside the project's git working tree on purpose (T001): the
      // undeclared-file check now inspects the WHOLE tree with no '^??'
      // filter, so a capture file left sitting inside `project` would be
      // flagged as an undeclared stray file and make commit-slice itself
      // fail before the scenario under test ever ran.
      const errPath = path.join(os.tmpdir(), `${path.basename(project)}-stderr-capture`);
      const errFd = fs.openSync(errPath, "w");
      let stdout;
      try {
        stdout = execFileSync(
          sddBin,
          ["commit-slice", "001-demo", "--type", "feat", "--title", "Add hello log", "--files", "app.js"],
          { cwd: project, encoding: "utf8", stdio: ["ignore", "pipe", errFd] },
        );
      } finally {
        fs.closeSync(errFd);
      }
      const stderrOutput = fs.readFileSync(errPath, "utf8");

      expect(stdout.trim()).toMatch(/^[0-9a-f]{40}$/);
      expect(stderrOutput).toBe("");
    });

    // Cross #1 (reproved after the pre-commit move): the omission still
    // gets caught even when a genuinely unrelated rename is pre-staged
    // alongside it -- except now it is a hard failure with no commit,
    // not a post-commit warning.
    test("rejects a genuinely omitted tracked file even with an unrelated rename pre-staged (cross #1)", () => {
      const project = makeTempProject();
      fs.mkdirSync(path.join(project, "specs", "999-other"), { recursive: true });
      fs.writeFileSync(path.join(project, "specs", "999-other", "f.md"), "old\n");
      fs.writeFileSync(path.join(project, "omitted.js"), "console.log('do not forget me');\n");
      seedCommit(project);
      execFileSync(sddBin, ["branch", "001-demo"], { cwd: project, encoding: "utf8" });
      const before = execFileSync("git", ["rev-parse", "HEAD"], { cwd: project, encoding: "utf8" }).trim();

      // Someone else's legitimate, unrelated in-flight rename — pre-staged
      // before commit-slice runs, the same shape as this repo's own 13
      // pre-staged May-cleanup renames.
      fs.mkdirSync(path.join(project, "specs", "archive"), { recursive: true });
      execFileSync("git", ["mv", "specs/999-other", "specs/archive/999-other"], { cwd: project });

      // The agent edits a tracked file but forgets to list it in --files.
      fs.appendFileSync(path.join(project, "omitted.js"), "// forgot to stage this\n");
      fs.writeFileSync(path.join(project, "app.js"), "console.log('hi');\n");

      const error = sddFail(
        ["commit-slice", "001-demo", "--type", "feat", "--title", "Add hello log", "--files", "app.js"],
        { cwd: project },
      );

      expect(error.status).not.toBe(0);
      expect(error.stderr).toContain("omitted.js");
      expect(error.stderr).not.toContain("999-other");

      const after = execFileSync("git", ["rev-parse", "HEAD"], { cwd: project, encoding: "utf8" }).trim();
      expect(after).toBe(before);

      const status = execFileSync("git", ["status", "--porcelain"], {
        cwd: project,
        encoding: "utf8",
      });
      expect(status).toMatch(/M\s+omitted\.js/);
      expect(status).toMatch(/specs\/archive\/999-other/);
    });

    // T003 (AC5, AC8 index-state axis): a file inside the feature dir can be
    // sitting in the index BEFORE commit-slice ever runs -- a HITL decision
    // staged on purpose, or a stray edit riding along by accident. There is
    // no reliable way to tell those apart, so the fix only warns; the
    // feature dir keeps getting swept into the commit exactly as before
    // (F8: feature_dir is absolute, pre_staged entries are repo-root-relative
    // -- a naive prefix match never fires without normalizing first). Four
    // tests below walk the full index-state axis: clean, staged outside,
    // staged inside, and both at once -- not just the "inside" case the task
    // is named after (022's T002 lesson: a test suite that only covers the
    // shape named in the task text misses the corners the criterion implies).
    test("clean index before commit-slice: no warning at all (index-state axis, T003)", () => {
      const project = makeTempProject();
      seedCommit(project);
      execFileSync(sddBin, ["branch", "001-demo"], { cwd: project, encoding: "utf8" });
      fs.writeFileSync(path.join(project, "app.js"), "console.log('hi');\n");

      // Outside the project's git working tree on purpose (T001): the
      // undeclared-file check now inspects the WHOLE tree with no '^??'
      // filter, so a capture file left sitting inside `project` would be
      // flagged as an undeclared stray file and make commit-slice itself
      // fail before the scenario under test ever ran.
      const errPath = path.join(os.tmpdir(), `${path.basename(project)}-stderr-capture`);
      const errFd = fs.openSync(errPath, "w");
      let stdout;
      try {
        stdout = execFileSync(
          sddBin,
          ["commit-slice", "001-demo", "--type", "feat", "--title", "Add hello log", "--files", "app.js"],
          { cwd: project, encoding: "utf8", stdio: ["ignore", "pipe", errFd] },
        );
      } finally {
        fs.closeSync(errFd);
      }
      const stderrOutput = fs.readFileSync(errPath, "utf8");

      expect(stdout.trim()).toMatch(/^[0-9a-f]{40}$/);
      expect(stderrOutput).toBe("");
    });

    test("staged outside the feature dir before commit-slice: no new warning, file stays staged and out of the commit (index-state axis, T003, AC9 regression guard)", () => {
      const project = makeTempProject();
      seedCommit(project);
      execFileSync(sddBin, ["branch", "001-demo"], { cwd: project, encoding: "utf8" });
      fs.writeFileSync(path.join(project, "app.js"), "console.log('hi');\n");
      fs.writeFileSync(path.join(project, "ajeno.txt"), "someone else's staged work\n");
      execFileSync("git", ["add", "--", "ajeno.txt"], { cwd: project });

      // Outside the project's git working tree on purpose (T001): the
      // undeclared-file check now inspects the WHOLE tree with no '^??'
      // filter, so a capture file left sitting inside `project` would be
      // flagged as an undeclared stray file and make commit-slice itself
      // fail before the scenario under test ever ran.
      const errPath = path.join(os.tmpdir(), `${path.basename(project)}-stderr-capture`);
      const errFd = fs.openSync(errPath, "w");
      let stdout;
      try {
        stdout = execFileSync(
          sddBin,
          ["commit-slice", "001-demo", "--type", "feat", "--title", "Add hello log", "--files", "app.js"],
          { cwd: project, encoding: "utf8", stdio: ["ignore", "pipe", errFd] },
        );
      } finally {
        fs.closeSync(errFd);
      }
      const stderrOutput = fs.readFileSync(errPath, "utf8");

      const sha = stdout.trim();
      expect(sha).toMatch(/^[0-9a-f]{40}$/);
      expect(stderrOutput).toBe("");

      const files = filesInCommit(project, sha);
      expect(files).not.toContain("ajeno.txt");

      const status = execFileSync("git", ["status", "--porcelain"], {
        cwd: project,
        encoding: "utf8",
      });
      expect(status).toMatch(/^A\s+ajeno\.txt$/m);
    });

    test("staged inside the feature dir before commit-slice: new warning fires naming the file, commit content unchanged (index-state axis, T003)", () => {
      const project = makeTempProject();
      seedCommit(project);
      execFileSync(sddBin, ["branch", "001-demo"], { cwd: project, encoding: "utf8" });
      fs.writeFileSync(path.join(project, "app.js"), "console.log('hi');\n");
      // A HITL decision (or a stray edit) already staged inside the feature
      // dir before commit-slice runs -- exactly the shape AC5 warns about.
      fs.writeFileSync(
        path.join(project, "specs", "001-demo", "tasks.md"),
        "# Tasks\n\n- [x] First behavior\n- [ ] Second behavior\n",
      );
      execFileSync("git", ["add", "--", "specs/001-demo/tasks.md"], { cwd: project });

      // Outside the project's git working tree on purpose (T001): the
      // undeclared-file check now inspects the WHOLE tree with no '^??'
      // filter, so a capture file left sitting inside `project` would be
      // flagged as an undeclared stray file and make commit-slice itself
      // fail before the scenario under test ever ran.
      const errPath = path.join(os.tmpdir(), `${path.basename(project)}-stderr-capture`);
      const errFd = fs.openSync(errPath, "w");
      let stdout;
      try {
        stdout = execFileSync(
          sddBin,
          ["commit-slice", "001-demo", "--type", "feat", "--title", "Add hello log", "--files", "app.js"],
          { cwd: project, encoding: "utf8", stdio: ["ignore", "pipe", errFd] },
        );
      } finally {
        fs.closeSync(errFd);
      }
      const stderrOutput = fs.readFileSync(errPath, "utf8");

      const sha = stdout.trim();
      expect(sha).toMatch(/^[0-9a-f]{40}$/);
      expect(stderrOutput).toContain("warning: feature dir file(s) already staged before commit-slice ran");
      expect(stderrOutput).toContain("specs/001-demo/tasks.md");
      // The opposite-polarity post-commit safety net must not also fire --
      // tasks.md was committed clean, nothing is dirty afterward.
      expect(stderrOutput).not.toContain("tracked files still dirty after commit");

      // Content is unchanged: the feature dir is swept in exactly as it
      // always was, pre-staged or not.
      const files = filesInCommit(project, sha);
      expect(files).toContain("app.js");
      expect(files).toContain("specs/001-demo/tasks.md");

      // tasks.md landed in the commit clean -- no leftover staged/dirty
      // residue for it.
      const status = execFileSync("git", ["status", "--porcelain"], {
        cwd: project,
        encoding: "utf8",
      });
      expect(status).not.toMatch(/tasks\.md/);
    });

    test("a pre-staged feature-dir file and a genuinely undeclared file at once: the AC5 warning still fires even though the run then hard-fails (proves the two checks did not merge)", () => {
      const project = makeTempProject();
      seedCommit(project);
      execFileSync(sddBin, ["branch", "001-demo"], { cwd: project, encoding: "utf8" });
      const before = execFileSync("git", ["rev-parse", "HEAD"], { cwd: project, encoding: "utf8" }).trim();
      fs.writeFileSync(path.join(project, "app.js"), "console.log('hi');\n");
      fs.writeFileSync(
        path.join(project, "specs", "001-demo", "tasks.md"),
        "# Tasks\n\n- [x] First behavior\n- [ ] Second behavior\n",
      );
      execFileSync("git", ["add", "--", "specs/001-demo/tasks.md"], { cwd: project });
      // Genuinely undeclared -- unlike tasks.md above (pre-staged, AC5's
      // concern), this one was never staged by anyone, which is V1/AC1's
      // concern. The AC5 warning runs before any 'git add' in this
      // invocation, so it must still print even though this second file
      // makes the whole call fail before a commit ever happens.
      fs.writeFileSync(path.join(project, "helper.js"), "console.log('undeclared');\n");

      const error = sddFail(
        ["commit-slice", "001-demo", "--type", "feat", "--title", "Add hello log", "--files", "app.js"],
        { cwd: project },
      );

      expect(error.status).not.toBe(0);

      // AC5 warning (inclusion set, feature dir only): tasks.md was staged
      // before this invocation ran.
      expect(error.stderr).toContain("warning: feature dir file(s) already staged before commit-slice ran");
      expect(error.stderr).toContain("specs/001-demo/tasks.md");

      // V1/AC1 hard failure (exclusion set, whole index): helper.js was
      // never declared and never staged by anyone.
      expect(error.stderr).toContain("helper.js");

      const after = execFileSync("git", ["rev-parse", "HEAD"], { cwd: project, encoding: "utf8" }).trim();
      expect(after).toBe(before);
    });

    test("--moved-from deletion still lands in a scoped commit, even with an unrelated file pre-staged", () => {
      const project = makeTempProject();
      seedCommit(project);
      execFileSync(sddBin, ["branch", "001-demo"], { cwd: project, encoding: "utf8" });
      const oldDir = path.join(project, "specs", "001-demo");
      const archiveDir = path.join(project, "specs", "archive", "2026-08-26-001-demo");
      fs.mkdirSync(path.dirname(archiveDir), { recursive: true });
      fs.renameSync(oldDir, archiveDir);
      fs.writeFileSync(path.join(project, "app.js"), "console.log('hi');\n");
      fs.writeFileSync(path.join(project, "ajeno.txt"), "someone else's staged work\n");
      execFileSync("git", ["add", "--", "ajeno.txt"], { cwd: project });

      const output = execFileSync(
        sddBin,
        [
          "commit-slice",
          "001-demo",
          "--type",
          "chore",
          "--title",
          "Archive note",
          "--moved-from",
          "specs/001-demo",
          "--files",
          "app.js",
        ],
        { cwd: project, encoding: "utf8" },
      );

      const sha = output.trim();
      const tree = execFileSync("git", ["ls-tree", "-r", "--name-only", sha], {
        cwd: project,
        encoding: "utf8",
      });
      expect(tree).not.toContain("specs/001-demo/spec.md");
      expect(tree).toContain("specs/archive/2026-08-26-001-demo/spec.md");
      expect(tree).not.toContain("ajeno.txt");

      const files = filesInCommit(project, sha);
      expect(files).toContain("app.js");
      expect(files).toContain("specs/archive/2026-08-26-001-demo/spec.md");
      expect(files).not.toContain("ajeno.txt");

      const status = execFileSync("git", ["status", "--porcelain"], {
        cwd: project,
        encoding: "utf8",
      });
      expect(status).toMatch(/^A\s+ajeno\.txt$/m);
    });

    // Review fix cycle 2 (cross #2): the guard used to read only the INDEX
    // ('git ls-files --error-unmatch'), which 'git mv' already clears for the
    // old path even though it is still tracked in HEAD and its deletion is
    // correctly staged. Reproduced live: 'git mv specs/001-demo
    // specs/archive/...' then '--moved-from specs/001-demo' errored
    // "was never tracked" — the natural shape an agent produces when it
    // moves a folder with 'git mv' instead of a plain filesystem rename (the
    // other --moved-from tests above use fs.renameSync, which never
    // exercises this path since the old entry stays in the index).
    test("--moved-from succeeds on a path already moved away by 'git mv' (cross #2)", () => {
      const project = makeTempProject();
      seedCommit(project);
      execFileSync(sddBin, ["branch", "001-demo"], { cwd: project, encoding: "utf8" });
      // 'git mv' does not create missing parent directories on its own.
      fs.mkdirSync(path.join(project, "specs", "archive"), { recursive: true });
      execFileSync(
        "git",
        ["mv", "specs/001-demo", "specs/archive/2026-08-26-001-demo"],
        { cwd: project },
      );
      fs.writeFileSync(path.join(project, "app.js"), "console.log('hi');\n");

      const output = execFileSync(
        sddBin,
        [
          "commit-slice",
          "001-demo",
          "--type",
          "chore",
          "--title",
          "Archive note",
          "--moved-from",
          "specs/001-demo",
          "--files",
          "app.js",
        ],
        { cwd: project, encoding: "utf8" },
      );

      const sha = output.trim();
      expect(sha).toMatch(/^[0-9a-f]{40}$/);

      const tree = execFileSync("git", ["ls-tree", "-r", "--name-only", sha], {
        cwd: project,
        encoding: "utf8",
      });
      expect(tree).not.toContain("specs/001-demo/spec.md");
      expect(tree).toContain("specs/archive/2026-08-26-001-demo/spec.md");

      const status = execFileSync("git", ["status", "--porcelain"], {
        cwd: project,
        encoding: "utf8",
      });
      expect(status.trim()).toBe("");
    });

    test("--moved-from exits non-zero and names the path when it was never tracked, even if it still exists on disk", () => {
      const project = makeTempProject();
      seedCommit(project);
      execFileSync(sddBin, ["branch", "001-demo"], { cwd: project, encoding: "utf8" });
      const before = execFileSync("git", ["rev-parse", "HEAD"], { cwd: project, encoding: "utf8" }).trim();
      fs.writeFileSync(path.join(project, "never-tracked.js"), "console.log('surprise');\n");
      fs.writeFileSync(path.join(project, "app.js"), "console.log('hi');\n");

      const error = sddFail(
        [
          "commit-slice",
          "001-demo",
          "--type",
          "feat",
          "--title",
          "Bad moved-from",
          "--moved-from",
          "never-tracked.js",
          "--files",
          "app.js",
        ],
        { cwd: project },
      );

      expect(error.status).not.toBe(0);
      expect(error.stderr).toContain("never-tracked.js");

      const after = execFileSync("git", ["rev-parse", "HEAD"], { cwd: project, encoding: "utf8" }).trim();
      expect(after).toBe(before);

      // Not staged as a new addition — still shown as untracked, not "A ".
      const statusPorcelain = execFileSync("git", ["status", "--porcelain"], {
        cwd: project,
        encoding: "utf8",
      });
      expect(statusPorcelain).toContain("?? never-tracked.js");
    });

    test("exits 2 when --moved-from is passed without a value", () => {
      const project = makeTempProject();
      seedCommit(project);
      execFileSync(sddBin, ["branch", "001-demo"], { cwd: project, encoding: "utf8" });

      const error = sddFail(
        ["commit-slice", "001-demo", "--type", "feat", "--title", "No value", "--moved-from"],
        { cwd: project },
      );

      expect(error.status).toBe(2);
      expect(error.stderr).toContain("--moved-from");
    });

    // Review fix cycle 5 (cross #1): the agent's own Step 3.5 template omitted
    // --title (a hard requirement) and, in the no-delta case, called --files
    // with nothing after it. Both shapes below run the *literal* template
    // text parsed out of sdd-archive-feature.md -- not a hand-built argv
    // array that only resembles it -- against a real project and a real
    // commit, the same way the archive agent actually invokes the CLI.
    test("runs the literal Step 3.5 template with a delta file and commits both halves of the move (cross #1)", () => {
      const project = makeTempProject();
      seedCommit(project);
      execFileSync(sddBin, ["branch", "001-demo"], { cwd: project, encoding: "utf8" });

      // Step 3 (plain filesystem mv, no git awareness) already ran by the
      // time Step 3.5 fires.
      const archiveDir = path.join(project, "specs", "archive", "2026-08-26-001-demo");
      fs.mkdirSync(path.dirname(archiveDir), { recursive: true });
      fs.renameSync(path.join(project, "specs", "001-demo"), archiveDir);
      // Step 2 (delta merge) touched the archived spec.md.
      fs.writeFileSync(path.join(archiveDir, "spec.md"), "# Spec\n\nMerged delta.\n");

      const line = archiveStep35Line()
        .replace(/\$ARGUMENTS/g, "001-demo")
        .replace("<spec files touched by the delta merge>", "specs/archive/2026-08-26-001-demo/spec.md");
      const args = parseTemplateLine(line).slice(1); // drop the leading "sdd"

      const output = execFileSync(sddBin, args, { cwd: project, encoding: "utf8" });
      const sha = output.trim();
      expect(sha).toMatch(/^[0-9a-f]{40}$/);

      const files = filesInCommit(project, sha);
      expect(files).toContain("specs/archive/2026-08-26-001-demo/spec.md");
      expect(files).toContain("specs/001-demo/spec.md"); // deletion side of the move

      const message = execFileSync("git", ["log", "-1", "--format=%s", sha], {
        cwd: project,
        encoding: "utf8",
      }).trim();
      expect(message).toBe('chore(001-demo): Archive 001-demo');
    });

    test("runs the literal Step 3.5 template with no deltas -- empty --files -- and still commits the move (cross #1)", () => {
      const project = makeTempProject();
      seedCommit(project);
      execFileSync(sddBin, ["branch", "001-demo"], { cwd: project, encoding: "utf8" });

      const archiveDir = path.join(project, "specs", "archive", "2026-08-26-001-demo");
      fs.mkdirSync(path.dirname(archiveDir), { recursive: true });
      fs.renameSync(path.join(project, "specs", "001-demo"), archiveDir);
      // No delta merge this time: Step 2 was a no-op, so the placeholder
      // resolves to nothing and --files is the last token with no path after it.

      const line = archiveStep35Line()
        .replace(/\$ARGUMENTS/g, "001-demo")
        .replace("<spec files touched by the delta merge>", "")
        .replace(/\s+$/, "");
      const args = parseTemplateLine(line).slice(1);
      expect(args[args.length - 1]).toBe("--files");

      const output = execFileSync(sddBin, args, { cwd: project, encoding: "utf8" });
      const sha = output.trim();
      expect(sha).toMatch(/^[0-9a-f]{40}$/);

      // Same-content move: git's rename detection folds old+new into one
      // R100 record rather than a separate D line (see the --moved-from
      // test above) -- assert on the resulting tree, not --name-only output.
      const tree = execFileSync("git", ["ls-tree", "-r", "--name-only", sha], {
        cwd: project,
        encoding: "utf8",
      });
      expect(tree).not.toContain("specs/001-demo/spec.md");
      expect(tree).toContain("specs/archive/2026-08-26-001-demo/spec.md");
    });

    test("still refuses empty --files with no --moved-from and nothing staged -- does not open a hole", () => {
      const project = makeTempProject();
      seedCommit(project);
      execFileSync(sddBin, ["branch", "001-demo"], { cwd: project, encoding: "utf8" });

      const error = sddFail(
        ["commit-slice", "001-demo", "--type", "chore", "--title", "Archive 001-demo"],
        { cwd: project },
      );

      expect(error.status).toBe(2);
      expect(error.stderr).toContain("--files");
    });
  });

  // T004 (025-pipeline-state-integrity, AC4/V4): commit-slice used to have
  // ZERO branch awareness -- a total absence, not broken logic. Repro:
  // standing on feature/AAA, `commit-slice BBB --files bbb.txt` committed
  // BBB's work ONTO AAA, exit 0, no complaint. Fixed by requiring the
  // current branch to equal feature/<feature-id> exactly (the naming
  // convention cmd_branch itself uses), checked right after the feature is
  // confirmed to exist and before anything touches the index.
  describe("commit-slice verifies the current branch (T004/AC4)", () => {
    test("on feature/AAA, commit-slice BBB exits 4 and creates no commit on either branch, file stays dirty (V4 repro)", () => {
      const project = makeTempProject();
      fs.mkdirSync(path.join(project, "specs", "BBB"), { recursive: true });
      fs.writeFileSync(path.join(project, "specs", "BBB", "spec.md"), "# Spec\n");
      // Real projects gitignore the .parent-branch sidecar (repo root
      // .gitignore); this fixture branches into TWO different feature dirs
      // (BBB then AAA) before committing BBB, so AAA's sidecar sits outside
      // BBB's feature_dir and would otherwise trip T001's undeclared-file
      // check for an unrelated reason before this test ever reaches AC4.
      fs.writeFileSync(path.join(project, ".gitignore"), "specs/**/.parent-branch\n");
      seedCommit(project);

      execFileSync(sddBin, ["branch", "BBB"], { cwd: project, encoding: "utf8" });
      const headBBB = execFileSync("git", ["rev-parse", "HEAD"], { cwd: project, encoding: "utf8" }).trim();

      execFileSync(sddBin, ["branch", "AAA"], { cwd: project, encoding: "utf8" });
      const headAAA = execFileSync("git", ["rev-parse", "HEAD"], { cwd: project, encoding: "utf8" }).trim();

      fs.writeFileSync(path.join(project, "bbb.txt"), "BBB's work\n");

      const error = sddFail(
        ["commit-slice", "BBB", "--type", "feat", "--title", "BBB work", "--files", "bbb.txt"],
        { cwd: project },
      );

      expect(error.status).toBe(4);
      expect(error.stderr).toContain("feature/BBB");

      const currentBranch = execFileSync("git", ["branch", "--show-current"], {
        cwd: project,
        encoding: "utf8",
      }).trim();
      expect(currentBranch).toBe("feature/AAA");

      // Neither branch moved -- AAA never got BBB's commit (the repro), and
      // BBB itself was never touched either.
      const afterAAA = execFileSync("git", ["rev-parse", "HEAD"], { cwd: project, encoding: "utf8" }).trim();
      expect(afterAAA).toBe(headAAA);
      const afterBBB = execFileSync("git", ["rev-parse", "feature/BBB"], {
        cwd: project,
        encoding: "utf8",
      }).trim();
      expect(afterBBB).toBe(headBBB);

      const status = execFileSync("git", ["status", "--porcelain"], { cwd: project, encoding: "utf8" });
      expect(status).toContain("?? bbb.txt");
    });

    test("on feature/BBB, commit-slice BBB still succeeds (AC4 happy path)", () => {
      const project = makeTempProject();
      fs.mkdirSync(path.join(project, "specs", "BBB"), { recursive: true });
      fs.writeFileSync(path.join(project, "specs", "BBB", "spec.md"), "# Spec\n");
      seedCommit(project);
      execFileSync(sddBin, ["branch", "BBB"], { cwd: project, encoding: "utf8" });
      fs.writeFileSync(path.join(project, "bbb.txt"), "BBB's work\n");

      const output = execFileSync(
        sddBin,
        ["commit-slice", "BBB", "--type", "feat", "--title", "BBB work", "--files", "bbb.txt"],
        { cwd: project, encoding: "utf8" },
      );

      const sha = output.trim();
      expect(sha).toMatch(/^[0-9a-f]{40}$/);
      const files = filesInCommit(project, sha);
      expect(files).toContain("bbb.txt");
    });

    // Decision (see decisions.md): only "feature/<feature-id>" is accepted,
    // not "fix/<feature-id>". cmd_branch hard-codes the "feature/" prefix and
    // has never produced anything else; .claude/rules/git.md's "## Branch
    // naming" section is an unfilled template placeholder
    // (`<!-- e.g. feature/NNN-description, fix/NNN-description -->`), not an
    // adopted convention -- confirmed against this repo's own branch
    // history, where every branch ever created is "feature/*".
    test("a fix/<feature-id> branch is not accepted -- only feature/ (AC4 fix-lane decision)", () => {
      const project = makeTempProject();
      seedCommit(project);
      execFileSync("git", ["checkout", "-q", "-b", "fix/001-demo"], { cwd: project });
      fs.writeFileSync(path.join(project, "app.js"), "console.log('hi');\n");

      const error = sddFail(
        ["commit-slice", "001-demo", "--type", "fix", "--title", "Bug fix", "--files", "app.js"],
        { cwd: project },
      );

      expect(error.status).toBe(4);
      expect(error.stderr).toContain('expected "feature/001-demo"');

      const status = execFileSync("git", ["status", "--porcelain"], { cwd: project, encoding: "utf8" });
      expect(status).toContain("?? app.js");
    });

    // Decision (see decisions.md): detached HEAD fails closed. 'git branch
    // --show-current' prints empty there, which can never equal
    // "feature/<feature-id>" -- so this falls out of the same equality
    // check rather than needing a special case, and the error text names it
    // explicitly instead of printing a blank branch name.
    test("detached HEAD fails closed with exit 4, not a false pass (AC4 detached-HEAD decision)", () => {
      const project = makeTempProject();
      seedCommit(project);
      const sha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: project, encoding: "utf8" }).trim();
      execFileSync("git", ["checkout", "-q", sha], { cwd: project });
      fs.writeFileSync(path.join(project, "app.js"), "console.log('hi');\n");

      const error = sddFail(
        ["commit-slice", "001-demo", "--type", "feat", "--title", "Add hello log", "--files", "app.js"],
        { cwd: project },
      );

      expect(error.status).toBe(4);
      expect(error.stderr).toContain("<detached HEAD>");

      const after = execFileSync("git", ["rev-parse", "HEAD"], { cwd: project, encoding: "utf8" }).trim();
      expect(after).toBe(sha);
    });
  });

  // T002 (025-pipeline-state-integrity): resolve_feature_dir used to do a
  // bare `[ -d "$specs_dir/$feature_id" ]` with no validation. With
  // feature_id="..", "$specs_dir/.." resolves to the repo root, so every one
  // of its three callers (cmd_base_branch, cmd_commit_slice, cmd_status)
  // would treat the whole repo as if it were a feature directory.
  // validate_feature_id(), called once inside resolve_feature_dir, closes
  // that hole for all three at once; commit-slice additionally validates up
  // front so it can report its own precise exit code (2) instead of falling
  // into the generic "3: feature not found" path.
  describe("resolve_feature_dir rejects '..' / '/' in feature-id (T002)", () => {
    test("commit-slice: rejects '..' before touching the index -- exit 2, no commit, unrelated dirty files stay dirty", () => {
      const project = makeTempProject();
      seedCommit(project);
      const before = execFileSync("git", ["rev-parse", "HEAD"], { cwd: project, encoding: "utf8" }).trim();
      // Same shape as the live repro that found this bug: with the old
      // unvalidated resolve_feature_dir, "specs/.." resolves to the repo
      // root and the unconditional `git add -- "$feature_dir"` sweeps both
      // of these unrelated files into the commit alongside the declared one.
      fs.writeFileSync(path.join(project, "objetivo.txt"), "declared\n");
      fs.writeFileSync(path.join(project, "basura1.txt"), "must stay untouched\n");

      const error = sddFail(
        ["commit-slice", "..", "--type", "chore", "--title", "probe", "--files", "objetivo.txt"],
        { cwd: project },
      );

      expect(error.status).toBe(2);
      expect(error.stderr).toContain("invalid feature-id");

      const after = execFileSync("git", ["rev-parse", "HEAD"], { cwd: project, encoding: "utf8" }).trim();
      expect(after).toBe(before);

      const status = execFileSync("git", ["status", "--porcelain"], { cwd: project, encoding: "utf8" });
      expect(status).toContain("objetivo.txt");
      expect(status).toContain("basura1.txt");
    });

    test("commit-slice: rejects a feature-id containing '/'", () => {
      const project = makeTempProject();
      seedCommit(project);
      const before = execFileSync("git", ["rev-parse", "HEAD"], { cwd: project, encoding: "utf8" }).trim();
      fs.writeFileSync(path.join(project, "app.js"), "console.log('hi');\n");

      const error = sddFail(
        ["commit-slice", "sub/dir", "--type", "chore", "--title", "probe", "--files", "app.js"],
        { cwd: project },
      );

      expect(error.status).toBe(2);
      expect(error.stderr).toContain("invalid feature-id");

      const after = execFileSync("git", ["rev-parse", "HEAD"], { cwd: project, encoding: "utf8" }).trim();
      expect(after).toBe(before);
    });

    test("base-branch: rejects '..' instead of resolving it to the repo root and reading a spoofed .parent-branch there", () => {
      const project = makeTempProject();
      seedCommit(project);
      execFileSync("git", ["branch", "-M", "main"], { cwd: project });
      // With the old unvalidated resolve_feature_dir, "specs/.." resolves to
      // the repo root, and cmd_base_branch's Layer 1 reads THIS file as if
      // it were the feature's own sidecar (verified against the pre-fix
      // binary: it returned "wrong-branch-must-be-ignored" here).
      execFileSync("git", ["branch", "wrong-branch-must-be-ignored"], { cwd: project });
      fs.writeFileSync(path.join(project, ".parent-branch"), "wrong-branch-must-be-ignored\n");
      fs.mkdirSync(path.join(project, ".claude", "rules"), { recursive: true });
      fs.writeFileSync(path.join(project, ".claude", "rules", "git.md"), "base-branch: main\n");

      const output = execFileSync(sddBin, ["base-branch", ".."], { cwd: project, encoding: "utf8" });

      expect(output.trim()).toBe("main");
    });

    test("status: rejects '..' instead of reporting a bogus exit-0 'missing' status for the repo root", () => {
      const project = makeTempProject();
      seedCommit(project);

      const error = sddFail(["status", ".."], { cwd: project });

      expect(error.status).not.toBe(0);
      expect(error.stderr).toContain("feature not found");
    });

    test("a normal, valid feature-id still resolves, including an archived one with the YYYY-MM-DD- prefix", () => {
      const project = makeTempProject();
      seedCommit(project);
      fs.rmSync(path.join(project, "specs", "001-demo"), { recursive: true, force: true });
      const archiveDir = path.join(project, "specs", "archive", "2026-08-01-001-demo");
      fs.mkdirSync(archiveDir, { recursive: true });
      fs.writeFileSync(path.join(archiveDir, "spec.md"), "# Spec\n");
      fs.writeFileSync(path.join(archiveDir, "decisions.md"), "# Decisions\n");
      execFileSync("git", ["add", "-A"], { cwd: project });
      execFileSync("git", ["commit", "-q", "-m", "move to archive"], { cwd: project });

      const output = execFileSync(sddBin, ["status", "001-demo"], { cwd: project, encoding: "utf8" });

      expect(JSON.parse(output).feature_id).toBe("001-demo");
    });
  });

  // The AC6 regression test proving a stray leftover PR-creation sentinel file
  // doesn't change an archived feature's status moved to
  // tests/retired-symbol-proofs.test.js — it must name that sentinel's literal
  // filename to prove the effect, not just the reference, was removed.

  describe("sdd status — no-arg lists specs/ (T003)", () => {
    test("lists every active specs/ folder with its phase, excluding archive/", () => {
      const project = fs.mkdtempSync(path.join(os.tmpdir(), "sdd-test-"));
      execFileSync("git", ["init", "-q"], { cwd: project });

      fs.mkdirSync(path.join(project, "specs", "001-demo"), { recursive: true });
      fs.writeFileSync(path.join(project, "specs", "001-demo", "spec.md"), "# Spec\n");
      fs.writeFileSync(path.join(project, "specs", "001-demo", "plan.md"), "# Plan\n");
      fs.writeFileSync(
        path.join(project, "specs", "001-demo", "tasks.md"),
        "# Tasks\n\n- [ ] First behavior\n- [ ] Second behavior\n",
      );

      fs.mkdirSync(path.join(project, "specs", "003-slices"), { recursive: true });
      fs.writeFileSync(path.join(project, "specs", "003-slices", "spec.md"), "# Spec\n");
      fs.writeFileSync(path.join(project, "specs", "003-slices", "plan.md"), "# Plan\n");
      fs.writeFileSync(
        path.join(project, "specs", "003-slices", "tasks.md"),
        [
          "# Tasks",
          "",
          "- [x] **T001 [AFK] Foundation**: first vertical slice",
          "- [ ] **T002 [AFK] UI path**: second vertical slice",
          "",
        ].join("\n"),
      );

      // A finished-and-archived feature sitting alongside the active ones —
      // this is exactly the folder AC8 says must NOT show up in the listing.
      const archiveDir = path.join(project, "specs", "archive", "2026-05-17-999-finished");
      fs.mkdirSync(archiveDir, { recursive: true });
      fs.writeFileSync(path.join(archiveDir, "spec.md"), "# Spec\n");
      fs.writeFileSync(path.join(archiveDir, "decisions.md"), "# Decisions\n");

      const output = execFileSync(sddBin, ["status"], {
        cwd: project,
        encoding: "utf8",
      });

      const entries = JSON.parse(output);
      expect(Array.isArray(entries)).toBe(true);
      expect(entries).toHaveLength(2);

      const byId = Object.fromEntries(entries.map((entry) => [entry.feature_id, entry]));
      expect(byId["001-demo"]).toMatchObject({
        feature_id: "001-demo",
        phase: "planned",
        next_command: "/implement-task 001-demo",
      });
      expect(byId["003-slices"]).toMatchObject({
        feature_id: "003-slices",
        phase: "implementing",
        next_command: "/implement-task 003-slices",
      });
      expect(entries.some((entry) => entry.feature_id.includes("finished"))).toBe(false);
    });

    test("returns an empty array, exit 0, when specs/ holds only archive/", () => {
      const project = fs.mkdtempSync(path.join(os.tmpdir(), "sdd-test-"));
      execFileSync("git", ["init", "-q"], { cwd: project });

      const archiveDir = path.join(project, "specs", "archive", "2026-05-17-999-finished");
      fs.mkdirSync(archiveDir, { recursive: true });
      fs.writeFileSync(path.join(archiveDir, "spec.md"), "# Spec\n");

      const output = execFileSync(sddBin, ["status"], {
        cwd: project,
        encoding: "utf8",
      });

      expect(JSON.parse(output)).toEqual([]);
    });

    // Review fix cycle 2 (cross #3): cmd_status used to derive a feature-id
    // from the branch name FIRST, so a bare `sdd status` on `feature/<id>`
    // returned the single-feature JSON instead of listing — the exact
    // scenario the AC exists for, since a developer running the bare
    // command is almost always on a feature branch. AC8 names no branch
    // condition: an omitted feature-id must always list.
    test("still lists when the bare command runs on a matching feature branch (AC8, cross #3)", () => {
      const project = fs.mkdtempSync(path.join(os.tmpdir(), "sdd-test-"));
      execFileSync("git", ["init", "-q"], { cwd: project });
      execFileSync("git", ["checkout", "-q", "-b", "feature/001-demo"], { cwd: project });

      fs.mkdirSync(path.join(project, "specs", "001-demo"), { recursive: true });
      fs.writeFileSync(path.join(project, "specs", "001-demo", "spec.md"), "# Spec\n");
      fs.writeFileSync(path.join(project, "specs", "001-demo", "plan.md"), "# Plan\n");
      fs.writeFileSync(
        path.join(project, "specs", "001-demo", "tasks.md"),
        "# Tasks\n\n- [ ] First behavior\n- [ ] Second behavior\n",
      );

      const output = execFileSync(sddBin, ["status"], {
        cwd: project,
        encoding: "utf8",
      });

      const entries = JSON.parse(output);
      expect(Array.isArray(entries)).toBe(true);
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        feature_id: "001-demo",
        phase: "planned",
        next_command: "/implement-task 001-demo",
      });
    });
  });

  describe("sdd status detects a broken archive (026/T003/AC5)", () => {
    // The exact shape a bypassed archive leaves behind (021, 294ccfc):
    // specs/<id>/ and specs/archive/<date>-<id>/ both present at once.
    // resolve_feature_dir stays untouched (plan.md) and still matches
    // specs/<id>/ first -- this pre-check re-probes the filesystem itself,
    // independent of that helper, so it can't inherit its blind spot.
    function makeDuplicatedProject() {
      const project = makeTempProject();
      const archiveDir = path.join(project, "specs", "archive", "2099-01-01-001-demo");
      fs.mkdirSync(archiveDir, { recursive: true });
      fs.writeFileSync(path.join(archiveDir, "spec.md"), "# Spec\n");
      seedCommit(project);
      return project;
    }

    test("single-feature mode reports archive-integrity-broken and a blockers entry naming both paths (AC5)", () => {
      const project = makeDuplicatedProject();

      const status = JSON.parse(
        execFileSync(sddBin, ["status", "001-demo"], { cwd: project, encoding: "utf8" }),
      );

      expect(status.phase).toBe("archive-integrity-broken");
      expect(Array.isArray(status.blockers)).toBe(true);
      expect(status.blockers.length).toBeGreaterThan(0);
      expect(status.blockers[0].message).toContain("specs/001-demo");
      expect(status.blockers[0].message).toContain("specs/archive/2099-01-01-001-demo");
    });

    test("exit code stays 0 even when integrity is broken -- status reports, gates decide (AC5)", () => {
      const project = makeDuplicatedProject();

      const result = spawnSync(sddBin, ["status", "001-demo"], { cwd: project, encoding: "utf8" });
      expect(result.status).toBe(0);
    });

    test("list mode reports the same phase literal, keeping its narrower JSON shape (AC5)", () => {
      const project = makeDuplicatedProject();

      const entries = JSON.parse(
        execFileSync(sddBin, ["status"], { cwd: project, encoding: "utf8" }),
      );

      const entry = entries.find((item) => item.feature_id === "001-demo");
      expect(entry).toBeDefined();
      expect(entry.phase).toBe("archive-integrity-broken");
      expect(Object.keys(entry).sort()).toEqual(["feature_id", "next_command", "phase"]);
    });

    test("a normal, non-duplicated feature is unaffected (no false positive)", () => {
      const project = makeTempProject();
      seedCommit(project);

      const status = JSON.parse(
        execFileSync(sddBin, ["status", "001-demo"], { cwd: project, encoding: "utf8" }),
      );

      expect(status.phase).not.toBe("archive-integrity-broken");
      expect(status.blockers).toEqual([]);
    });
  });

  describe("sdd status / verify-archive detect a pure-deletion bypass (026/T009, judge finding #1)", () => {
    // Worse than the duplicate-tracked bypass above: an agent runs `git rm -r
    // specs/<id>/` (or an interrupted move) and commits with no
    // specs/archive/*-<id>/ ever created. specs/001-demo/ is fully tracked by
    // the seed commit, then deleted by a SECOND commit -- so git history
    // proves the feature was tracked, but neither location holds it anymore.
    function makeVanishedProject() {
      const project = makeTempProject();
      seedCommit(project);
      execFileSync("git", ["rm", "-r", "-q", "specs/001-demo"], { cwd: project });
      execFileSync("git", ["commit", "-q", "-m", "bypass: delete specs/001-demo, never archived"], {
        cwd: project,
      });
      return project;
    }

    test("sdd status reports archive-integrity-broken (not feature-not-found) for a vanished-but-historied id", () => {
      const project = makeVanishedProject();

      const status = JSON.parse(
        execFileSync(sddBin, ["status", "001-demo"], { cwd: project, encoding: "utf8" }),
      );

      expect(status.phase).toBe("archive-integrity-broken");
      expect(Array.isArray(status.blockers)).toBe(true);
      expect(status.blockers.length).toBeGreaterThan(0);
      expect(status.blockers[0].message).toContain("specs/001-demo");
    });

    test("sdd status exit code stays 0 for the vanished-but-historied shape too -- status reports, gates decide", () => {
      const project = makeVanishedProject();

      const result = spawnSync(sddBin, ["status", "001-demo"], { cwd: project, encoding: "utf8" });
      expect(result.status).toBe(0);
    });

    test("sdd verify-archive exits 3 for the vanished-but-historied id, stderr saying 'tracked' and 'gone' (not the plain no-archive message)", () => {
      const project = makeVanishedProject();

      const error = sddFail(["verify-archive", "001-demo"], { cwd: project });

      expect(error.status).toBe(3);
      const stderr = error.stderr.toLowerCase();
      expect(stderr).toContain("tracked");
      expect(stderr).toContain("gone");
    });

    test("an id with zero git history stays plain not-found (status) and 'never started' (verify-archive) -- no false positive", () => {
      const project = makeTempProject();
      seedCommit(project); // only specs/001-demo/ ever existed in this repo

      const statusError = sddFail(["status", "999-never-existed"], { cwd: project });
      expect(statusError.status).not.toBe(0);
      expect(statusError.stderr).toContain("feature not found");

      const verifyError = sddFail(["verify-archive", "999-never-existed"], { cwd: project });
      expect(verifyError.status).toBe(3);
      expect(verifyError.stderr.toLowerCase()).toContain("never started");
    });

    test("a feature not yet archived (specs/<id>/ still present, no archive dir) keeps today's plain verify-archive message", () => {
      const project = makeTempProject();
      seedCommit(project);

      const error = sddFail(["verify-archive", "001-demo"], { cwd: project });

      expect(error.status).toBe(3);
      expect(error.stderr).not.toContain("was tracked");
      expect(error.stderr.toLowerCase()).not.toContain("never started");
    });
  });

  describe("sdd state-write (T005/AC6)", () => {
    // A project whose single task list is fully checked, on its own feature
    // branch, with a real HEAD to diff against -- the shape detect_feature_phase
    // needs before sentinel freshness (ready-to-review vs ready-to-simplify)
    // even comes into play. Without all tasks done, phase would read
    // "implementing" regardless of what the sentinel says.
    function makeReadyProject() {
      const project = makeTempProject();
      // Gitignore .sdd-state BEFORE it ever gets written, same as the real
      // repo's own .gitignore. Skip this and the state file self-invalidates
      // the instant it is written: tree_digest() sees an untracked .sdd-state
      // that was absent from the tree at write time, so every read after the
      // write computes a different digest than the one just stored.
      fs.writeFileSync(path.join(project, ".gitignore"), "specs/**/.sdd-state\n");
      fs.writeFileSync(
        path.join(project, "specs", "001-demo", "tasks.md"),
        "# Tasks\n\n- [x] First behavior\n- [x] Second behavior\n",
      );
      // A tracked file OUTSIDE specs/ -- tree_digest() excludes specs/**
      // (post-T012 digest-scope fix: specs/ is pipeline bookkeeping, not
      // code), so freshness tests that need a real code-tree change must
      // dirty this instead of a spec file.
      fs.writeFileSync(path.join(project, "code.txt"), "tracked code file\n");
      seedCommit(project);
      execFileSync(sddBin, ["branch", "001-demo"], { cwd: project });
      return project;
    }

    test("writes .sdd-state so sdd status reports ready-to-review, and an uncommitted edit invalidates it (AC6)", () => {
      const project = makeReadyProject();

      execFileSync(sddBin, ["state-write", "001-demo", "--phase", "ready-to-review"], { cwd: project });

      const fresh = JSON.parse(
        execFileSync(sddBin, ["status", "001-demo"], { cwd: project, encoding: "utf8" }),
      );
      expect(fresh.phase).toBe("ready-to-review");
      expect(fresh.sentinel_fresh).toBe(true);

      // Edit a tracked file OUTSIDE specs/ WITHOUT committing. This is the
      // branch with zero coverage before this task (grep
      // 'sentinel_fresh|git-head' in the old suite returned nothing): a
      // digest-based freshness check must catch a dirty tree that a
      // git-head-only check would miss entirely. Must be outside specs/ --
      // tree_digest() excludes specs/** (post-T012 digest-scope fix), so a
      // spec.md edit here would no longer prove anything.
      fs.appendFileSync(path.join(project, "code.txt"), "\nUncommitted edit.\n");

      const stale = JSON.parse(
        execFileSync(sddBin, ["status", "001-demo"], { cwd: project, encoding: "utf8" }),
      );
      expect(stale.phase).not.toBe("ready-to-review");
      expect(stale.sentinel_fresh).toBe(false);
    });

    test("appending to a file under specs/ does not change the tree-digest (post-T012 digest-scope fix)", () => {
      const project = makeReadyProject();
      execFileSync(sddBin, ["state-write", "001-demo", "--phase", "ready-to-review"], { cwd: project });
      const before = fs
        .readFileSync(path.join(project, "specs", "001-demo", ".sdd-state"), "utf8")
        .match(/^tree-digest: (.+)$/m)[1];

      // Pipeline bookkeeping, not code -- simplify/review append run notes to
      // decisions.md in the same run that seals .sdd-state. This is the exact
      // shape that deadlocked the pipeline before this fix: a new file
      // appearing under specs/ must not move the digest.
      fs.writeFileSync(path.join(project, "specs", "001-demo", "decisions.md"), "simplify notes\n");
      execFileSync(sddBin, ["state-write", "001-demo", "--phase", "ready-to-review"], { cwd: project });
      const after = fs
        .readFileSync(path.join(project, "specs", "001-demo", ".sdd-state"), "utf8")
        .match(/^tree-digest: (.+)$/m)[1];

      expect(after).toBe(before);
    });

    test("appending to a tracked file outside specs/ still changes the tree-digest", () => {
      const project = makeReadyProject();
      execFileSync(sddBin, ["state-write", "001-demo", "--phase", "ready-to-review"], { cwd: project });
      const before = fs
        .readFileSync(path.join(project, "specs", "001-demo", ".sdd-state"), "utf8")
        .match(/^tree-digest: (.+)$/m)[1];

      fs.appendFileSync(path.join(project, "code.txt"), "a real code change\n");
      execFileSync(sddBin, ["state-write", "001-demo", "--phase", "ready-to-review"], { cwd: project });
      const after = fs
        .readFileSync(path.join(project, "specs", "001-demo", ".sdd-state"), "utf8")
        .match(/^tree-digest: (.+)$/m)[1];

      expect(after).not.toBe(before);
    });

    test("a new untracked file outside specs/ still changes the tree-digest", () => {
      const project = makeReadyProject();
      execFileSync(sddBin, ["state-write", "001-demo", "--phase", "ready-to-review"], { cwd: project });
      const before = fs
        .readFileSync(path.join(project, "specs", "001-demo", ".sdd-state"), "utf8")
        .match(/^tree-digest: (.+)$/m)[1];

      fs.writeFileSync(path.join(project, "new-code.txt"), "brand new tracked-candidate file\n");
      execFileSync(sddBin, ["state-write", "001-demo", "--phase", "ready-to-review"], { cwd: project });
      const after = fs
        .readFileSync(path.join(project, "specs", "001-demo", ".sdd-state"), "utf8")
        .match(/^tree-digest: (.+)$/m)[1];

      expect(after).not.toBe(before);
    });

    test("tree-digest is stable across two state-write calls on the same unchanged dirty tree", () => {
      const project = makeReadyProject();
      fs.writeFileSync(path.join(project, "scratch.txt"), "uncommitted\n");

      execFileSync(sddBin, ["state-write", "001-demo", "--phase", "ready-to-review"], { cwd: project });
      const firstDigest = fs
        .readFileSync(path.join(project, "specs", "001-demo", ".sdd-state"), "utf8")
        .match(/^tree-digest: (.+)$/m)[1];

      execFileSync(sddBin, ["state-write", "001-demo", "--phase", "ready-to-review"], { cwd: project });
      const secondDigest = fs
        .readFileSync(path.join(project, "specs", "001-demo", ".sdd-state"), "utf8")
        .match(/^tree-digest: (.+)$/m)[1];

      expect(firstDigest).toMatch(/^[0-9a-f]{40}$/);
      expect(secondDigest).toBe(firstDigest);
    });

    test("does not dirty the real index or worktree, and leaves no temp index file behind", () => {
      const project = makeReadyProject();
      fs.writeFileSync(path.join(project, "scratch.txt"), "uncommitted\n");

      const beforeStatus = execFileSync("git", ["status", "--porcelain"], { cwd: project, encoding: "utf8" });
      const tmpBefore = fs.readdirSync(os.tmpdir());

      execFileSync(sddBin, ["state-write", "001-demo", "--phase", "ready-to-review"], { cwd: project });

      const tmpAfter = fs.readdirSync(os.tmpdir());
      const afterStatus = execFileSync("git", ["status", "--porcelain"], { cwd: project, encoding: "utf8" });

      // .sdd-state is gitignored (makeReadyProject's fixture .gitignore), so
      // writing it must not surface as a new entry at all -- `git status
      // --porcelain` is expected byte-for-byte identical before and after.
      expect(afterStatus).toBe(beforeStatus);

      // No leftover scratch index: tree_digest's temp file is removed on
      // every path, so the tmpdir listing is unchanged.
      expect(tmpAfter.length).toBe(tmpBefore.length);
    });

    test("committing after state-write (HEAD changes) also invalidates the sentinel", () => {
      const project = makeReadyProject();
      execFileSync(sddBin, ["state-write", "001-demo", "--phase", "ready-to-review"], { cwd: project });

      fs.appendFileSync(path.join(project, "specs", "001-demo", "spec.md"), "\nCommitted edit.\n");
      execFileSync("git", ["add", "-A"], { cwd: project });
      execFileSync("git", ["commit", "-q", "-m", "advance head past the sentinel"], { cwd: project });

      const status = JSON.parse(
        execFileSync(sddBin, ["status", "001-demo"], { cwd: project, encoding: "utf8" }),
      );
      expect(status.phase).not.toBe("ready-to-review");
      expect(status.sentinel_fresh).toBe(false);
    });

    test("rejects a malformed feature-id before writing anything (T002 validator)", () => {
      const project = makeReadyProject();

      const error = sddFail(["state-write", "../escape", "--phase", "ready-to-review"], { cwd: project });

      expect(error.status).toBe(2);
      expect(error.stderr).toContain("invalid feature-id");
      expect(fs.existsSync(path.join(project, "specs", "..escape"))).toBe(false);
    });
  });

  describe("review-feature seals the verdict; bin/sdd gains the reviewed phase (T006/AC7)", () => {
    // Same shape as makeReadyProject() in the T005 describe block above (all
    // tasks checked, on the feature branch, real HEAD) -- duplicated locally
    // rather than hoisted, matching this file's existing per-describe-block
    // convention.
    function makeReadyProject() {
      const project = makeTempProject();
      fs.writeFileSync(path.join(project, ".gitignore"), "specs/**/.sdd-state\n");
      fs.writeFileSync(
        path.join(project, "specs", "001-demo", "tasks.md"),
        "# Tasks\n\n- [x] First behavior\n- [x] Second behavior\n",
      );
      // A tracked file OUTSIDE specs/ -- tree_digest() excludes specs/**
      // (post-T012 digest-scope fix); see the T005/AC6 describe block above.
      fs.writeFileSync(path.join(project, "code.txt"), "tracked code file\n");
      seedCommit(project);
      execFileSync(sddBin, ["branch", "001-demo"], { cwd: project });
      return project;
    }

    test("state-write --phase reviewed --verdict PASS makes sdd status report reviewed, with next command archive (AC7)", () => {
      const project = makeReadyProject();

      execFileSync(
        sddBin,
        ["state-write", "001-demo", "--phase", "reviewed", "--verdict", "PASS"],
        { cwd: project },
      );

      const status = JSON.parse(
        execFileSync(sddBin, ["status", "001-demo"], { cwd: project, encoding: "utf8" }),
      );
      expect(status.phase).toBe("reviewed");
      expect(status.sentinel_fresh).toBe(true);
      expect(status.next_command).toBe("/archive-feature 001-demo");
    });

    test("a reviewed state invalidated by an uncommitted edit falls back, same freshness rule as ready-to-review (T005 rule extends to reviewed)", () => {
      const project = makeReadyProject();
      execFileSync(
        sddBin,
        ["state-write", "001-demo", "--phase", "reviewed", "--verdict", "PASS"],
        { cwd: project },
      );

      const fresh = JSON.parse(
        execFileSync(sddBin, ["status", "001-demo"], { cwd: project, encoding: "utf8" }),
      );
      expect(fresh.phase).toBe("reviewed");

      // Outside specs/ -- tree_digest() excludes specs/** (post-T012
      // digest-scope fix), so a spec.md edit here would no longer invalidate.
      fs.appendFileSync(path.join(project, "code.txt"), "\nUncommitted edit.\n");

      const stale = JSON.parse(
        execFileSync(sddBin, ["status", "001-demo"], { cwd: project, encoding: "utf8" }),
      );
      expect(stale.phase).not.toBe("reviewed");
      expect(stale.phase).toBe("ready-to-simplify");
      expect(stale.sentinel_fresh).toBe(false);
    });

    test("a judgment-day block (state-write --phase reviewed --verdict FAIL) stays durably visible to a fresh sdd status", () => {
      const project = makeReadyProject();

      execFileSync(
        sddBin,
        ["state-write", "001-demo", "--phase", "reviewed", "--verdict", "FAIL"],
        { cwd: project },
      );

      const status = JSON.parse(
        execFileSync(sddBin, ["status", "001-demo"], { cwd: project, encoding: "utf8" }),
      );
      // This is the "a fresh /sdd-next after a judge block must still see
      // what happened" requirement: bin/sdd tracks the coarse phase/verdict
      // only -- the archive-time gate on a passing verdict is
      // sdd-archive-feature.md's own pre-flight (T007), not this CLI.
      expect(status.phase).toBe("reviewed");
    });

    test("a reviewer conformance FAIL clears .sdd-state instead of writing it, falling back to ready-to-simplify (025/T006 FAIL decision)", () => {
      const project = makeReadyProject();
      execFileSync(sddBin, ["state-write", "001-demo", "--phase", "ready-to-review"], { cwd: project });

      // This is what review-feature/SKILL.md Step 5 does on a reviewer FAIL:
      // clear the sentinel rather than write a "reviewed" record, so
      // `phase: reviewed, verdict: FAIL` stays reserved for the judge-block
      // case (previous test) and is never produced by a plain code
      // conformance failure.
      fs.unlinkSync(path.join(project, "specs", "001-demo", ".sdd-state"));

      const status = JSON.parse(
        execFileSync(sddBin, ["status", "001-demo"], { cwd: project, encoding: "utf8" }),
      );
      expect(status.phase).toBe("ready-to-simplify");
      expect(status.phase).not.toBe("reviewed");
      expect(status.sentinel_fresh).toBe(false);
    });

    test("the fix loop still routes through simplify even after Review-Feedback reopens and re-completes a task (evaluator-optimizer invariant)", () => {
      const project = makeReadyProject();
      execFileSync(sddBin, ["state-write", "001-demo", "--phase", "ready-to-review"], { cwd: project });
      fs.unlinkSync(path.join(project, "specs", "001-demo", ".sdd-state")); // review FAILed

      // implement-task reopens the flagged task bullet per Review-Feedback...
      fs.writeFileSync(
        path.join(project, "specs", "001-demo", "tasks.md"),
        "# Tasks\n\n- [ ] First behavior\n- [x] Second behavior\n",
      );
      let status = JSON.parse(
        execFileSync(sddBin, ["status", "001-demo"], { cwd: project, encoding: "utf8" }),
      );
      expect(status.phase).toBe("implementing");

      // ...fixes it and re-checks it. No new .sdd-state has been written --
      // the sentinel is still the one cleared by the FAIL above.
      fs.writeFileSync(
        path.join(project, "specs", "001-demo", "tasks.md"),
        "# Tasks\n\n- [x] First behavior\n- [x] Second behavior\n",
      );
      status = JSON.parse(
        execFileSync(sddBin, ["status", "001-demo"], { cwd: project, encoding: "utf8" }),
      );
      expect(status.phase).toBe("ready-to-simplify");
      expect(status.next_command).toBe("/simplify-code 001-demo");
    });

    test("sdd-auto/SKILL.md has zero remaining .simplified references and documents .sdd-state + the reviewed phase (T006 prose wiring)", () => {
      const sddAuto = fs.readFileSync(
        path.join(repoRoot, ".claude/skills/sdd-auto/SKILL.md"),
        "utf8",
      );

      // 025/T005 was a clean break; T006 retires the 2 stale mentions this
      // file had left pointing at a file that no longer exists. This is a
      // wiring guard on prose, not behavioural coverage -- it never executes
      // the skill.
      expect(sddAuto).not.toContain(".simplified");
      expect(sddAuto).toContain(".sdd-state");
      expect(sddAuto).toContain("`phase: reviewed`");
    });

    test("sdd-next/SKILL.md's one remaining .simplified mention is a deliberate historical footnote, not current behavior (T006 prose wiring)", () => {
      const sddNext = fs.readFileSync(
        path.join(repoRoot, ".claude/skills/sdd-next/SKILL.md"),
        "utf8",
      );

      // T006 retires 4 stale mentions. One footnote survives on purpose --
      // "replaces `.simplified`" inside the description of its successor --
      // to explain the migration, not to claim the old file is still read
      // or written anywhere. Assert the count precisely so a re-introduced
      // stale reference (a fifth mention) still fails this guard.
      const simplifiedMentions = (sddNext.match(/\.simplified/g) || []).length;
      expect(simplifiedMentions).toBe(1);
      expect(sddNext).toContain("replaces `.simplified`");
      expect(sddNext).toContain(".sdd-state");
      expect(sddNext).toContain("`phase: reviewed`");
    });
  });

  describe("archive-feature verifies the .sdd-state receipt before archiving (025/T007/AC11)", () => {
    // Same shape as the T006 describe block's local helper -- duplicated
    // rather than hoisted, matching this file's existing per-describe-block
    // convention.
    function makeReadyProject() {
      const project = makeTempProject();
      // Both lines from the real repo's .gitignore (T003, T005) -- the
      // archive move-and-commit test below needs .parent-branch ignored too,
      // or its addition at the new path shows up as a real diff line.
      fs.writeFileSync(
        path.join(project, ".gitignore"),
        "specs/**/.parent-branch\nspecs/**/.sdd-state\n",
      );
      fs.writeFileSync(
        path.join(project, "specs", "001-demo", "tasks.md"),
        "# Tasks\n\n- [x] First behavior\n- [x] Second behavior\n",
      );
      seedCommit(project);
      execFileSync(sddBin, ["branch", "001-demo"], { cwd: project });
      return project;
    }

    // Reads one field directly out of .sdd-state, the same way the
    // archive-feature.md pre-flight's second bullet does (`grep -m1
    // '^verdict: ' ...`) -- sdd status never surfaces verdict, so the gate's
    // own text has to read the receipt file itself.
    function readStateField(project, featureId, field) {
      const raw = fs.readFileSync(
        path.join(project, "specs", featureId, ".sdd-state"),
        "utf8",
      );
      const line = raw.split("\n").find((l) => l.startsWith(`${field}: `));
      return line ? line.slice(`${field}: `.length) : undefined;
    }

    test("no .sdd-state at all does not read as reviewed (AC11: absent receipt)", () => {
      const project = makeReadyProject();

      const status = JSON.parse(
        execFileSync(sddBin, ["status", "001-demo"], { cwd: project, encoding: "utf8" }),
      );
      expect(status.phase).not.toBe("reviewed");
    });

    test("phase: ready-to-review (simplify ran, review never sealed) does not read as reviewed (AC11: simplify-only receipt)", () => {
      const project = makeReadyProject();
      execFileSync(sddBin, ["state-write", "001-demo", "--phase", "ready-to-review"], { cwd: project });

      const status = JSON.parse(
        execFileSync(sddBin, ["status", "001-demo"], { cwd: project, encoding: "utf8" }),
      );
      expect(status.phase).toBe("ready-to-review");
      expect(status.phase).not.toBe("reviewed");
    });

    test("phase: reviewed with verdict: FAIL reads identically to a passing review via sdd status alone -- the gate must read .sdd-state's verdict directly (AC11: judge-block receipt)", () => {
      const project = makeReadyProject();
      execFileSync(
        sddBin,
        ["state-write", "001-demo", "--phase", "reviewed", "--verdict", "FAIL"],
        { cwd: project },
      );

      const status = JSON.parse(
        execFileSync(sddBin, ["status", "001-demo"], { cwd: project, encoding: "utf8" }),
      );
      // sdd status's phase field alone cannot distinguish a judge block from
      // a passing review -- both read "reviewed". This is exactly why the
      // pre-flight's second bullet reads verdict out of the file directly
      // rather than trusting `sdd status` for it.
      expect(status.phase).toBe("reviewed");
      expect(readStateField(project, "001-demo", "verdict")).toBe("FAIL");
    });

    test("phase: reviewed with verdict: PASS-WITH-WARNINGS is a valid receipt (AC11: passing verdict, warnings case)", () => {
      const project = makeReadyProject();
      execFileSync(
        sddBin,
        ["state-write", "001-demo", "--phase", "reviewed", "--verdict", "PASS-WITH-WARNINGS"],
        { cwd: project },
      );

      const status = JSON.parse(
        execFileSync(sddBin, ["status", "001-demo"], { cwd: project, encoding: "utf8" }),
      );
      expect(status.phase).toBe("reviewed");
      expect(readStateField(project, "001-demo", "verdict")).toBe("PASS-WITH-WARNINGS");
      // Piece 3: PASS-WITH-WARNINGS must route to archive same as PASS.
      expect(status.next_command).toBe("/archive-feature 001-demo");
    });

    test("a stale receipt -- HEAD moved by a new commit after review sealed it -- falls back and does not read as reviewed (AC11: staleness via HEAD, not just tree-digest)", () => {
      const project = makeReadyProject();
      execFileSync(
        sddBin,
        ["state-write", "001-demo", "--phase", "reviewed", "--verdict", "PASS"],
        { cwd: project },
      );

      const fresh = JSON.parse(
        execFileSync(sddBin, ["status", "001-demo"], { cwd: project, encoding: "utf8" }),
      );
      expect(fresh.phase).toBe("reviewed");

      // A new commit moves HEAD without touching the working tree at all --
      // the uncommitted-edit case (tree-digest drift) is already covered by
      // the T006 describe block above; this covers the other half of "HEAD
      // OR tree-digest moved" that AC11 names explicitly.
      fs.writeFileSync(path.join(project, "unrelated.txt"), "unrelated change\n");
      execFileSync("git", ["add", "-A"], { cwd: project });
      execFileSync("git", ["commit", "-q", "-m", "unrelated commit after review sealed"], { cwd: project });

      const stale = JSON.parse(
        execFileSync(sddBin, ["status", "001-demo"], { cwd: project, encoding: "utf8" }),
      );
      expect(stale.phase).not.toBe("reviewed");
      expect(stale.sentinel_fresh).toBe(false);
    });

    test("piece 3: next_command for phase reviewed + verdict FAIL never points at /archive-feature -- sdd status must not contradict the archive gate", () => {
      const project = makeReadyProject();
      execFileSync(
        sddBin,
        ["state-write", "001-demo", "--phase", "reviewed", "--verdict", "FAIL"],
        { cwd: project },
      );

      const status = JSON.parse(
        execFileSync(sddBin, ["status", "001-demo"], { cwd: project, encoding: "utf8" }),
      );
      expect(status.phase).toBe("reviewed");
      expect(status.next_command).not.toBe("/archive-feature 001-demo");
      expect(status.next_command).not.toContain("/archive-feature");
      expect(status.next_command).toContain("FAIL");
    });

    test("piece 3: next_command for phase reviewed with no verdict recorded (misuse of state-write) also does not point at /archive-feature", () => {
      const project = makeReadyProject();
      // Misuse: state-write --phase reviewed with no --verdict defaults to "none".
      execFileSync(sddBin, ["state-write", "001-demo", "--phase", "reviewed"], { cwd: project });

      const status = JSON.parse(
        execFileSync(sddBin, ["status", "001-demo"], { cwd: project, encoding: "utf8" }),
      );
      expect(status.phase).toBe("reviewed");
      expect(status.next_command).not.toContain("/archive-feature");
    });

    test("archiving moves the folder, commits both halves of the move, and the receipt survives the commit untouched -- deletion is a separate step after success (AC11 + T007 ordering)", () => {
      const project = makeReadyProject();
      execFileSync(
        sddBin,
        ["state-write", "001-demo", "--phase", "reviewed", "--verdict", "PASS"],
        { cwd: project },
      );

      const oldDir = path.join(project, "specs", "001-demo");
      const newDir = path.join(project, "specs", "archive", "2099-01-01-001-demo");
      const archivedStatePath = path.join(newDir, ".sdd-state");

      // This is exactly sdd-archive-feature.md's Step 3: a plain filesystem
      // move, no git awareness, no deletion of the receipt.
      fs.mkdirSync(path.join(project, "specs", "archive"), { recursive: true });
      fs.renameSync(oldDir, newDir);
      expect(fs.existsSync(archivedStatePath)).toBe(true);

      // Step 3.5's exact call shape (no --files: no delta merge happened).
      const sha = execFileSync(
        sddBin,
        [
          "commit-slice",
          "001-demo",
          "--type",
          "chore",
          "--title",
          "Archive 001-demo",
          "--moved-from",
          "specs/001-demo",
        ],
        { cwd: project, encoding: "utf8" },
      ).trim();
      expect(sha).toMatch(/^[0-9a-f]{40}$/);

      // `--no-renames`: by default `git show` collapses a same-content
      // delete+add into a single "R" (rename) line naming only the new
      // path -- that would hide the very thing this test is proving, that
      // BOTH halves (the old-path deletions and the new-path additions)
      // actually landed in the one commit, not just the visually tidier
      // rename summary.
      const nameStatus = execFileSync(
        "git",
        ["show", "--no-renames", "--name-status", "--format=", sha],
        { cwd: project, encoding: "utf8" },
      )
        .split("\n")
        .filter(Boolean)
        .map((line) => line.split("\t"));
      const deletedFiles = nameStatus.filter(([status]) => status === "D").map(([, p]) => p);
      const addedFiles = nameStatus.filter(([status]) => status === "A").map(([, p]) => p);

      expect(deletedFiles).toEqual(
        expect.arrayContaining([
          "specs/001-demo/spec.md",
          "specs/001-demo/plan.md",
          "specs/001-demo/tasks.md",
        ]),
      );
      expect(addedFiles).toEqual(
        expect.arrayContaining([
          "specs/archive/2099-01-01-001-demo/spec.md",
          "specs/archive/2099-01-01-001-demo/plan.md",
          "specs/archive/2099-01-01-001-demo/tasks.md",
        ]),
      );
      // .sdd-state is gitignored: `git add` on the moved directory must not
      // pick it up, on either half of the move.
      expect([...deletedFiles, ...addedFiles]).not.toEqual(
        expect.arrayContaining([expect.stringContaining(".sdd-state")]),
      );

      // The receipt is untouched by the commit itself -- proving deletion
      // is a distinct, later step, not something commit-slice does for us.
      expect(fs.existsSync(archivedStatePath)).toBe(true);

      // Step 3.5's "On success" instruction, run only now: `rm -f` the
      // receipt. Gitignored, so this needs no git operation of its own.
      fs.rmSync(archivedStatePath, { force: true });
      expect(fs.existsSync(archivedStatePath)).toBe(false);

      const statusAfter = execFileSync("git", ["status", "--porcelain"], {
        cwd: project,
        encoding: "utf8",
      });
      expect(statusAfter.trim()).toBe("");
    });

    // Prose-wiring guard, not behavioural coverage: this proves the gate's
    // instruction text exists and names the right fields/values -- it can
    // never prove the haiku-tier agent actually obeys it at runtime, since
    // sdd-archive-feature.md is instructions for an LLM, not executable code.
    test("pre-flight requires a fresh .sdd-state receipt with phase: reviewed and a passing verdict, not agent memory (T007 prose wiring)", () => {
      const archiveFeature = fs.readFileSync(
        path.join(repoRoot, ".claude/agents/sdd-archive-feature.md"),
        "utf8",
      );

      // The old check trusted the agent's own memory of what ran, with no
      // file to verify against -- gone entirely.
      expect(archiveFeature).not.toContain("has been run with verdict");

      expect(archiveFeature).toContain("sdd status $ARGUMENTS");
      expect(archiveFeature).toContain("phase` must read exactly `reviewed`");
      expect(archiveFeature).toContain("git-head` equals `git rev-parse HEAD`");
      expect(archiveFeature).toContain("tree-digest` equals the current working tree's digest");
      expect(archiveFeature).toContain("grep -m1 '^verdict: ' specs/$ARGUMENTS/.sdd-state");
      expect(archiveFeature).toContain("`PASS` or `PASS-WITH-WARNINGS`");
      expect(archiveFeature).toContain("BLOCKED-JUDGMENT-DAY-HIGH");
    });

    test("the receipt deletion moved out of Step 3 into Step 3.5's on-success branch, after the commit-slice call (T007 prose wiring, ordering)", () => {
      const archiveFeature = fs.readFileSync(
        path.join(repoRoot, ".claude/agents/sdd-archive-feature.md"),
        "utf8",
      );

      expect(archiveFeature).not.toContain(".simplified");

      const step3Match = archiveFeature.match(
        /3\. \*\*Archive the feature\*\*([\s\S]*?)\n### 3\.5\. Commit the slice/,
      );
      expect(step3Match).not.toBeNull();
      const step3Body = step3Match[1];

      // The move happens here; the deletion must not.
      expect(step3Body).toContain("Move `specs/$ARGUMENTS/`");
      expect(step3Body).not.toContain("rm -f");
      expect(step3Body).toContain("Do **not** delete `.sdd-state` here");

      const onSuccessIndex = archiveFeature.indexOf(
        "run `rm -f specs/archive/YYYY-MM-DD-$ARGUMENTS/.sdd-state`",
      );
      const commitSliceCallIndex = archiveFeature.indexOf(
        "sdd commit-slice $ARGUMENTS --type chore --title \"Archive $ARGUMENTS\"",
      );
      expect(onSuccessIndex).toBeGreaterThan(-1);
      expect(commitSliceCallIndex).toBeGreaterThan(-1);
      // Deletion instruction must sit after the commit-slice call it depends on.
      expect(onSuccessIndex).toBeGreaterThan(commitSliceCallIndex);

      // On-failure path must explicitly say not to delete.
      const onFailureMatch = archiveFeature.match(/On failure\*\* \(`sdd commit-slice`[^\n]*\n/);
      expect(onFailureMatch).not.toBeNull();
      expect(archiveFeature).toContain("Do **not** delete `.sdd-state`");
      expect(archiveFeature).toContain("the folder is mid-archive with no commit behind it");
    });
  });

  describe("sdd verify-archive (T002/AC4)", () => {
    // Same fixture shape as the two describe blocks above: both sidecars
    // gitignored, all tasks checked, seeded, on the feature branch.
    function makeReadyProject() {
      const project = makeTempProject();
      fs.writeFileSync(
        path.join(project, ".gitignore"),
        "specs/**/.parent-branch\nspecs/**/.sdd-state\n",
      );
      fs.writeFileSync(
        path.join(project, "specs", "001-demo", "tasks.md"),
        "# Tasks\n\n- [x] First behavior\n- [x] Second behavior\n",
      );
      seedCommit(project);
      execFileSync(sddBin, ["branch", "001-demo"], { cwd: project });
      return project;
    }

    // The real move-and-commit sdd-archive-feature.md's Step 3 / 3.5 do: a
    // filesystem rename, then `commit-slice --moved-from` stages both halves
    // in one commit. Returns the archive dir's absolute path.
    function legitArchive(project, dateStr) {
      const oldDir = path.join(project, "specs", "001-demo");
      const newDir = path.join(project, "specs", "archive", `${dateStr}-001-demo`);
      fs.mkdirSync(path.join(project, "specs", "archive"), { recursive: true });
      fs.renameSync(oldDir, newDir);
      execFileSync(
        sddBin,
        [
          "commit-slice",
          "001-demo",
          "--type",
          "chore",
          "--title",
          "Archive 001-demo",
          "--moved-from",
          "specs/001-demo",
        ],
        { cwd: project },
      );
      return newDir;
    }

    test("a legit --moved-from archive verifies clean: exit 0 (AC4)", () => {
      const project = makeReadyProject();
      legitArchive(project, "2099-01-01");

      const output = execFileSync(sddBin, ["verify-archive", "001-demo"], {
        cwd: project,
        encoding: "utf8",
      });
      expect(output).toContain("001-demo");
    });

    test("a bypass commit (plain copy, additions only, no --moved-from) fails naming the missing deletions (the 294ccfc shape, AC4)", () => {
      const project = makeReadyProject();

      // The bypass reproduced twice in the wild: a plain filesystem copy
      // (not a rename) committed directly with `git commit`, never through
      // commit-slice --moved-from. specs/001-demo/ is never touched by this
      // commit -- it was already committed in the seed -- so the new commit
      // carries only "A" lines under the archive dir, zero "D" lines, and
      // specs/001-demo/ is still fully tracked at HEAD afterwards.
      const oldDir = path.join(project, "specs", "001-demo");
      const newDir = path.join(project, "specs", "archive", "2099-01-01-001-demo");
      fs.mkdirSync(newDir, { recursive: true });
      for (const name of fs.readdirSync(oldDir)) {
        fs.copyFileSync(path.join(oldDir, name), path.join(newDir, name));
      }
      execFileSync("git", ["add", "-A"], { cwd: project });
      execFileSync("git", ["commit", "-q", "-m", "bypass: archive 001-demo (altas only)"], {
        cwd: project,
      });

      const error = sddFail(["verify-archive", "001-demo"], { cwd: project });
      expect(error.status).toBe(1);
      expect(error.stderr).toContain("specs/001-demo");
      expect(error.stderr.toLowerCase()).toContain("delet");
    });

    test("two archive dirs for the same feature-id resolve to the most recent, with a stderr note (AC4)", () => {
      const project = makeReadyProject();

      // A stale leftover archive dir under an older date, committed as if it
      // were historical baggage never touched again. Seeded directly rather
      // than through legitArchive/commit-slice: with two "*-001-demo" dirs
      // on disk, commit-slice's own resolve_feature_dir (a plain
      // find | head -1, deliberately untouched by this task -- verify-archive
      // gets its own local resolution instead) would pick one of the two
      // ambiguously, which is exactly the multi-date problem this test is
      // isolating on verify-archive's side, not commit-slice's.
      const staleDir = path.join(project, "specs", "archive", "2098-01-01-001-demo");
      fs.mkdirSync(staleDir, { recursive: true });
      fs.writeFileSync(path.join(staleDir, "spec.md"), "# Old spec\n");
      execFileSync("git", ["add", "-A"], { cwd: project });
      execFileSync("git", ["commit", "-q", "-m", "seed a stale archive dir"], { cwd: project });

      // The real, legit archive lands under a later date, via a plain `git
      // mv` + commit -- `git show --no-renames` still reports this as a
      // separate D + A pair regardless of how the move was staged.
      execFileSync(
        "git",
        ["mv", "specs/001-demo", "specs/archive/2099-01-01-001-demo"],
        { cwd: project },
      );
      execFileSync("git", ["commit", "-q", "-m", "archive 001-demo (legit move)"], { cwd: project });

      const result = spawnSync(sddBin, ["verify-archive", "001-demo"], {
        cwd: project,
        encoding: "utf8",
      });
      expect(result.status).toBe(0);
      expect(result.stderr).toContain("2099-01-01-001-demo");
      expect(result.stderr).not.toContain("2098-01-01-001-demo");
    });

    test("no archive directory at all: exit 3, not 1 or 2 (keeps documented-cli-usage's no-archive fixture green)", () => {
      const project = makeReadyProject();

      const error = sddFail(["verify-archive", "001-demo"], { cwd: project });
      expect(error.status).toBe(3);
      expect(error.stderr).toContain("archive");
    });
  });

  describe("the commit-policy knob is deleted entirely (025/T008/AC5)", () => {
    // AC5 is a literal, repo-wide grep (see spec.md): 0 hits across bin/,
    // .claude/, .specify/, tests/. Five of the thirteen sites this task
    // touched (the ADR-0003 illustration mentions in sdd-designer.md,
    // sdd-research-spike.md, plan-feature/SKILL.md, new-feature/SKILL.md,
    // and .claude/rules/domains.md) had no other test coverage at all --
    // forgetting one of them would leave every other test in this file green
    // while AC5 still failed. This single repo-wide grep is what actually
    // protects all thirteen sites, not per-site assertions.
    //
    // The needle is assembled at runtime, never written as a literal
    // "auto" + "-" + "commit" string, so this test cannot trip its own grep.
    const KNOB_NEEDLE = ["auto", "commit"].join("-");

    test("grep -rn '<knob>' across bin/, .claude/, .specify/, tests/ returns nothing", () => {
      let stdout = "";
      let status = 0;
      try {
        stdout = execFileSync(
          "grep",
          ["-rn", KNOB_NEEDLE, "bin/", ".claude/", ".specify/", "tests/"],
          { cwd: repoRoot, encoding: "utf8" },
        );
      } catch (error) {
        // grep exits 1 for "no matches" -- the passing case here. Capture
        // stdout/status either way so a real match (exit 0, non-empty
        // stdout) fails loudly instead of being swallowed by the catch.
        stdout = error.stdout || "";
        status = error.status;
      }

      expect(stdout).toBe("");
      expect(status).toBe(1);
    });

    test("the tdd knob replaces the deleted knob as ADR-0003's illustration (docs/adr/0003)", () => {
      const adr0003 = fs.readFileSync(
        path.join(repoRoot, "docs/adr/0003-cli-resolves-content-agents-read-knobs.md"),
        "utf8",
      );

      // The Operational bullet used to claim both knobs "stay exactly as
      // they are" -- now false for the deleted one. One-line correction,
      // no new ADR (per decisions.md).
      expect(adr0003).toContain("was deleted entirely in 025");
      expect(adr0003).not.toContain("stay exactly as they are");
    });
  });

  describe("plan-feature discovery gate blocks on empty ## User decisions (025/T009/AC8)", () => {
    // AC8 (spec.md): discovery.md with an empty `## User decisions` must keep the
    // phase blocked. Before this task, the "Discovery resume check" section gated
    // on file *existence* only -- a re-run after a high-impact block with zero
    // decisions recorded would resume as if reviewed. plan-feature/SKILL.md is
    // prose an LLM follows, not executable code -- every assertion below is a
    // wiring guard proving the instruction text exists and says the right thing,
    // never proof an agent actually obeys it at runtime (same limit T006/T007
    // already declared for this class of file, and spec.md's own edge cases).
    const planFeaturePath = path.join(repoRoot, ".claude/skills/plan-feature/SKILL.md");

    test("the resume check inspects `## User decisions` content, not just file existence", () => {
      const planFeature = fs.readFileSync(planFeaturePath, "utf8");

      // Old wording treated existence as proof of review -- gone.
      expect(planFeature).not.toContain("The user has already reviewed the discovery findings. Skip Step 4");
      expect(planFeature).toContain("Existence alone does not mean reviewed");
      expect(planFeature).toContain("at least one `DISCOVERY-ACCEPTED` or `DISCOVERY-DISCARDED` entry");
    });

    test("an empty or placeholder-only `## User decisions` blocks instead of resuming", () => {
      const planFeature = fs.readFileSync(planFeaturePath, "utf8");

      expect(planFeature).toContain("(leave blank — user fills in DISCOVERY-ACCEPTED or DISCOVERY-DISCARDED entries)");
      expect(planFeature).toContain("Do NOT treat the file as reviewed, do NOT proceed to Step 5");
      expect(planFeature).toContain("do NOT fall back to re-running Step 4/4.5 as if `discovery.md` were absent");
      expect(planFeature).toContain("Return `Status: blocked`");
    });

    test("a discovery.md with at least one recorded decision still resumes through Step 5 (existing behavior preserved)", () => {
      const planFeature = fs.readFileSync(planFeaturePath, "utf8");

      expect(planFeature).toContain("Skip Step 4 (Explore agents) and Step 4.5 (Discovery Checkpoint) entirely");
      expect(planFeature).toContain("inject its content as additional context into the Design + Task agents in Step 5");
      expect(planFeature).toContain(
        "Record the `DISCOVERY-ACCEPTED` / `DISCOVERY-DISCARDED` user decisions from `discovery.md` into `specs/$ARGUMENTS/decisions.md`",
      );
    });

    test("the no-discovery.md-at-all path is untouched", () => {
      const planFeature = fs.readFileSync(planFeaturePath, "utf8");

      expect(planFeature).toContain("**If `discovery.md` does not exist**: Proceed normally through all steps.");
    });

    test("the gate's ceiling is documented explicitly: 'at least one decision', never 'one per finding'", () => {
      const planFeature = fs.readFileSync(planFeaturePath, "utf8");

      // Findings carry no IDs anywhere -- decisions.md's DISCOVERY-ACCEPTED entry
      // for finding G and spec.md's edge cases already record this as a known,
      // accepted limit, not something this gate is meant to close.
      expect(planFeature).toContain("carry no finding IDs anywhere");
      expect(planFeature).toContain("not mechanically checkable here");
      expect(planFeature).not.toMatch(/exig(e|ir).{0,20}una por hallazgo/);
    });

    test("the Blocked path section in the Result envelope covers both blocking cases", () => {
      const planFeature = fs.readFileSync(planFeaturePath, "utf8");

      expect(planFeature).toContain("returned in two cases");
      expect(planFeature).toContain(
        "the Discovery resume check finding an existing `discovery.md` with no recorded decisions",
      );
    });

    test("this feature's own discovery.md has recorded decisions and would satisfy the new gate (dogfooding)", () => {
      // Not a test of the SKILL.md gate logic itself -- that's prose an LLM
      // executes, and no test here can call it. A real-data sanity check that
      // this feature's own discovery.md (decisions.md records 4
      // DISCOVERY-ACCEPTED entries under `## User decisions`) still has content
      // that would satisfy the "at least one" gate rather than tripping it.
      const ownDiscovery = fs.readFileSync(
        path.join(repoRoot, "specs/archive/2026-09-01-025-pipeline-state-integrity/discovery.md"),
        "utf8",
      );
      // Match the heading only at line-start -- finding G's own prose mentions
      // the literal string "## User decisions" inline (as text, not a heading),
      // which trips a plain string split into grabbing the wrong section.
      const headingMatches = [...ownDiscovery.matchAll(/^## User decisions$/gm)];
      const lastHeadingIndex = headingMatches.length
        ? headingMatches[headingMatches.length - 1].index
        : ownDiscovery.length;
      const userDecisionsSection = ownDiscovery.slice(lastHeadingIndex);
      const decisionCount = (userDecisionsSection.match(/DISCOVERY-ACCEPTED|DISCOVERY-DISCARDED/g) || []).length;

      expect(decisionCount).toBeGreaterThan(0);
    });
  });

  describe("simplify blocks on a dirty scoped file instead of committing or discarding it (025/T010/AC9)", () => {
    // sdd-simplify-code.md is prose an LLM follows, not executable code -- every
    // assertion below is a wiring guard proving the instruction text exists and
    // says the right thing, never proof an agent actually obeys it at runtime
    // (same limit already declared for this class of file by T006/T007/T009).
    const simplifyCodePath = path.join(repoRoot, ".claude/agents/sdd-simplify-code.md");

    test("a scoped path with uncommitted edits hard-blocks before any edit, commit, or checkout", () => {
      const simplifyCode = fs.readFileSync(simplifyCodePath, "utf8");

      expect(simplifyCode).toContain("4b. **Block if a scoped path is already dirty**");
      expect(simplifyCode).toContain("STOP here — before step 4 (Simplify) reads or writes a single file");
      expect(simplifyCode).toContain("Make no commit, run no `git checkout --`, make no edit");
      expect(simplifyCode).toContain(
        "Return `Status: blocked` with `Summary: scoped file(s) already have uncommitted edits — resolve or commit them before running /simplify-code`",
      );
    });

    test("dirty paths outside scope stay notice-only via IGNORED_DIRTY -- this block never fires on them", () => {
      const simplifyCode = fs.readFileSync(simplifyCodePath, "utf8");

      // Pre-existing notice behavior for out-of-scope dirty paths must survive untouched.
      expect(simplifyCode).toContain("Ignored uncommitted paths outside <base>..HEAD: <list>");
      expect(simplifyCode).toContain("This is a notice only — the run continues normally. No block is raised.");
      // The new gate documents itself as the exception to that notice-only rule, not a replacement of it.
      expect(simplifyCode).toContain(
        "unlike `IGNORED_DIRTY` above, which only reports paths *outside* scope and never blocks",
      );
    });

    test("the block intersects the final post-filter SCOPED_FILES, never the pre-filter committed-diff candidate list", () => {
      const simplifyCode = fs.readFileSync(simplifyCodePath, "utf8");

      // Anchoring against the pre-filter list (step 2's raw `git diff --name-only`) would
      // false-positive on a dirty path the exclusion filters (tests/lockfiles/migrations/
      // configs/SDD artifacts) would have dropped anyway -- exactly the false-positive
      // risk called out in the task brief.
      expect(simplifyCode).toContain(
        "intersect `SCOPED_FILES` (the final, post-exclusion-filter list from step 4 above) with `DIRTY_PATHS`",
      );
      expect(simplifyCode).toContain(
        "never against the pre-filter committed-diff list from step 2 — a path the exclusion filters already dropped is out of scope and must not trip this block",
      );
    });

    test("IGNORED_DIRTY and the new block share one git-status collection instead of two independent computations", () => {
      const simplifyCode = fs.readFileSync(simplifyCodePath, "utf8");

      expect(simplifyCode).toContain("Compute `DIRTY_PATHS` from `git status --short`");
      expect(simplifyCode).toContain("do not recompute it a second time for sub-step 4b");
      expect(simplifyCode).toContain(
        "`IGNORED_DIRTY` = the paths in `DIRTY_PATHS` that are **not** already in the committed diff list",
      );
    });

    test("Step 2's baseline guarantee is no longer stated unconditionally", () => {
      const simplifyCode = fs.readFileSync(simplifyCodePath, "utf8");

      // Old wording asserted an unconditional guarantee that was false whenever a
      // scoped file was already dirty at baseline time -- the exact bug this task fixes.
      expect(simplifyCode).not.toContain(
        "This guarantees that any post-edit failure later is attributable to simplify-code, not a pre-existing regression.",
      );
      expect(simplifyCode).toContain("only when no scoped file was already dirty at this point");
      expect(simplifyCode).toContain("sub-step 4b below");
    });
  });

  describe("review-feature parses --minimal before resolving the feature path (025/T011/AC10)", () => {
    // review-feature/SKILL.md is prose an LLM follows, not executable code --
    // every assertion below is a wiring guard proving the instruction text
    // exists and says the right thing, never proof an agent actually obeys it
    // at runtime (same limit already declared for this class of file by
    // T006/T007/T009/T010). sdd-next/SKILL.md and sdd-auto/SKILL.md already
    // extract `--minimal` correctly, before resolving a feature-id, in their
    // own pre-loop -- this block covers only review-feature, the callee that
    // used to interpolate the raw combined string into paths.
    const reviewFeaturePath = path.join(repoRoot, ".claude/skills/review-feature/SKILL.md");

    test("flags are stripped in a dedicated section before the Pre-flight heading", () => {
      const reviewFeature = fs.readFileSync(reviewFeaturePath, "utf8");

      const argParsingIndex = reviewFeature.indexOf("## Argument parsing");
      const preflightIndex = reviewFeature.indexOf("## Pre-flight checks");
      expect(argParsingIndex).toBeGreaterThan(-1);
      expect(preflightIndex).toBeGreaterThan(-1);
      expect(argParsingIndex).toBeLessThan(preflightIndex);
      expect(reviewFeature).toContain(
        "before Pre-flight, before any path or sub-agent prompt is built from `$ARGUMENTS`",
      );
    });

    test("exact-token semantics match the callers: --minimal matches, --minimal-foo does not", () => {
      const reviewFeature = fs.readFileSync(reviewFeaturePath, "utf8");

      expect(reviewFeature).toContain("the exact token `--minimal`");
      expect(reviewFeature).toContain("NOT substring match — `--minimal-foo` must NOT match");
    });

    test("no path under specs/ is ever built from raw $ARGUMENTS again", () => {
      const reviewFeature = fs.readFileSync(reviewFeaturePath, "utf8");

      expect(reviewFeature).not.toMatch(/specs\/\$ARGUMENTS\//);
      // The call sites named in the task brief, now resolved on the clean id.
      expect(reviewFeature).toContain("specs/$FEATURE_ID/tasks.md");
      expect(reviewFeature).toContain("specs/$FEATURE_ID/quick-spec.md");
      expect(reviewFeature).toContain("specs/$FEATURE_ID/spec.md");
      expect(reviewFeature).toContain("specs/$FEATURE_ID/decisions.md");
      expect(reviewFeature).toContain("specs/$FEATURE_ID/.sdd-state");
    });

    test("sdd CLI invocations and Engram topic keys built after Step 2 also use the clean id", () => {
      const reviewFeature = fs.readFileSync(reviewFeaturePath, "utf8");

      expect(reviewFeature).not.toContain("state-write $ARGUMENTS");
      expect(reviewFeature).toContain("state-write $FEATURE_ID");
      expect(reviewFeature).not.toContain("sdd/$ARGUMENTS");
      expect(reviewFeature).toContain("sdd/$FEATURE_ID");
      expect(reviewFeature).not.toContain("— $ARGUMENTS");
      expect(reviewFeature).toContain("— $FEATURE_ID");
    });

    test("Step 2 (Resolve review mode) consumes the pre-parsed flag instead of re-splitting $ARGUMENTS", () => {
      const reviewFeature = fs.readFileSync(reviewFeaturePath, "utf8");

      const step2Match = reviewFeature.match(/### 2\. Resolve review mode([\s\S]*?)### 2\.5\./);
      expect(step2Match).not.toBeNull();
      const step2Body = step2Match[1];

      expect(step2Body).not.toContain("Split `$ARGUMENTS` on whitespace");
      expect(step2Body).toContain("has_minimal_flag");
      expect(step2Body).toContain("does not re-parse `$ARGUMENTS`");
    });

    test("the shared fast-lane resolver (§I) stays untouched -- it keeps assuming an already-clean id", () => {
      const sharedCommon = fs.readFileSync(
        path.join(repoRoot, ".claude/skills/_shared/sdd-phase-common.md"),
        "utf8",
      );
      // D-001/D-003 constraint: this task must not modify the shared file --
      // §I is used by three other skills that never receive flags.
      expect(sharedCommon).not.toContain("FEATURE_ID");
      expect(sharedCommon).not.toContain("has_minimal_flag");
    });
  });

  test("build-registry ignores every core skill", () => {
    const sddCli = fs.readFileSync(path.join(repoRoot, "bin/sdd"), "utf8");
    const buildRegistry = fs.readFileSync(path.join(repoRoot, ".claude/skills/build-registry/SKILL.md"), "utf8");
    const coreSkillsMatch = sddCli.match(/^CORE_SKILLS="([^"]+)"/m);

    expect(coreSkillsMatch).not.toBeNull();

    const coreSkills = coreSkillsMatch[1].split(/\s+/);
    for (const skill of coreSkills) {
      expect(buildRegistry).toContain(`\`${skill}\``);
    }

    expect(buildRegistry).toContain("default to `implement-task, review-feature`");
    expect(buildRegistry).toContain("5-15 lines");
  });

  test("init-project asks for functional domains and fills domains.md instead of TODO (T001, repointed 024)", () => {
    const initProject = fs.readFileSync(path.join(repoRoot, ".claude/skills/init-project/SKILL.md"), "utf8");

    // Step 1's Explore prompt gains an 11th ask for functional domains (business areas, not directories)
    expect(initProject).toContain("11. Functional domains");
    expect(initProject).toContain("business/functional areas");

    // Domain rules moved out of Step 3 (conventions.md) into its own Step 3a, targeting
    // domains.md, not left as a TODO (024: conventions.md no longer owns this vocabulary).
    expect(initProject).not.toContain("**Domain rules**: Fill with the functional domains detected in Step 1");
    expect(initProject).toContain("### 3a. Pre-fill domain rules");
    expect(initProject).toContain("Update `.claude/rules/domains.md` with the functional domains detected in Step 1");
    expect(initProject).toContain("shared domain vocabulary");
    expect(initProject).not.toContain("Leave as TODO for the user to fill");

    // Each file's own overwrite guard is reused verbatim.
    expect(initProject).toContain("If `conventions.md` already has non-template content, ask the user before overwriting.");
    expect(initProject).toContain("If `domains.md` already has non-template content, ask the user before overwriting.");

    // Summary block and closing checklist point at domains.md too.
    expect(initProject).toContain("Domains:      .claude/rules/domains.md ✔");
    expect(initProject).toContain("- [ ] Review and adjust domains.md");
  });

  test("sdd-designer uses the domain vocabulary plan-feature/SKILL.md Step 2.5 already resolved, falling back to spec.md — never exploration findings (023 T005, refines T006)", () => {
    const designer = fs.readFileSync(path.join(repoRoot, ".claude/agents/sdd-designer.md"), "utf8");

    // Wiring regression guard, not behavioral coverage — asserts the prose instruction
    // exists, not that an agent follows it (ADR 0003's own caveat).

    // The designer must not re-resolve vocabulary itself anymore: the orchestrator
    // (plan-feature/SKILL.md Step 2.5) already ran `sdd domain-vocab` once, before
    // this agent is even launched, and hands the result over. Re-running the
    // command here is exactly the regression this slice removes. (Note: matching
    // on "run `sdd domain-vocab`" alone would be fooled by "re-run `sdd
    // domain-vocab`" in the fix's own wording — "re-run" contains "run" as a
    // substring — so this pins the specific old instruction sentence instead.)
    expect(designer).not.toContain(
      "Before filling any domain/module section (Domain analysis summary, Touched areas), run `sdd domain-vocab`",
    );
    expect(designer).toContain("do not re-run `sdd domain-vocab` yourself");
    expect(designer).toContain("Step 2.5");
    expect(designer).toContain("already resolved");

    // Fallback target changed from exploration findings — which don't exist on the
    // discovery-resume path, since Step 4 (Explore agents) is skipped there (021
    // took exactly this path) — to `spec.md`, matching plan-feature/SKILL.md's own
    // fallback. Both assertions matter: the positive one fails if the spec.md
    // fallback is dropped or reworded away; the negative one fails the instant the
    // old exploration-findings fallback text is reintroduced verbatim.
    expect(designer).toContain("derive names from `spec.md`");
    expect(designer).not.toContain("derive names from the exploration findings provided");

    expect(designer).not.toContain("grep `.claude/rules/conventions.md` for `## Domain rules`");

    // The now-false "CLI never does" claim is gone, replaced by ADR 0003's wording —
    // same voice as plan-feature/SKILL.md's copy of this idea.
    expect(designer).not.toContain("the agent reads the rules file directly, the CLI never does");
    expect(designer).toContain("Per ADR 0003 (`docs/adr/0003-cli-resolves-content-agents-read-knobs.md`)");

    // F6: stale "step 2" cross-reference fixed — domain analysis is Step 3 in plan-feature/SKILL.md.
    expect(designer).toContain("from the orchestrator's step 3 analysis");
    expect(designer).not.toContain("from the orchestrator's step 2 analysis");
  });

  test("new-feature maps Domains via `sdd domain-vocab`, not grep, before Block 2/Step 0 fallback (T006)", () => {
    const newFeature = fs.readFileSync(path.join(repoRoot, ".claude/skills/new-feature/SKILL.md"), "utf8");

    // Wiring regression guard — Spanish body, per this file's convention.
    expect(newFeature).toContain("`## Domains` ← primero corré `sdd domain-vocab`");
    // Fallback target is unchanged: Block 2 (archivos/módulos tocados) + el scan de Step 0.
    expect(newFeature).toContain("derivá de Block 2 (archivos/módulos tocados) + el scan de Step 0");
    expect(newFeature).not.toContain("primero grep `.claude/rules/conventions.md` para `## Domain rules`");

    // The now-false closing line is gone, replaced by the Spanish ADR 0003 wording.
    expect(newFeature).not.toContain("el agente lee el archivo de reglas directamente, la CLI nunca lo hace");
    expect(newFeature).toContain("Por ADR 0003 (`docs/adr/0003-cli-resolves-content-agents-read-knobs.md`)");
  });

  test("sdd-research-spike resolves domain vocabulary via `sdd domain-vocab`, not grep, before filling Evaluation criteria (T006)", () => {
    const researchSpike = fs.readFileSync(path.join(repoRoot, ".claude/agents/sdd-research-spike.md"), "utf8");

    // Sourcing mechanism changed to the CLI subcommand.
    expect(researchSpike).toContain("run `sdd domain-vocab`");
    expect(researchSpike).not.toContain("grep `.claude/rules/conventions.md` for `## Domain rules`");

    // Substance preserved: § Domain rules names domains, not evaluation axes. The
    // criteria themselves always come from what's actually being evaluated, not the domain list.
    expect(researchSpike).toContain("that section names domains, not evaluation axes");
    expect(researchSpike).toContain(
      "derive the criteria themselves from what Options and Questions above are actually evaluating either way"
    );

    // The now-false "CLI never does" claim is gone, replaced by ADR 0003's wording.
    expect(researchSpike).not.toContain("the agent reads the rules file directly, the CLI never does");
    expect(researchSpike).toContain("Per ADR 0003 (`docs/adr/0003-cli-resolves-content-agents-read-knobs.md`)");
  });

  describe("spec-template.md Domains section (T005)", () => {
    const specTemplatePath = path.join(repoRoot, ".specify/templates/spec-template.md");

    test("replaces the fixed 8-item Domains checklist with a derived-module instruction, not an addition", () => {
      const template = fs.readFileSync(specTemplatePath, "utf8");

      // Proves this was a replacement, not an addition alongside the old checklist.
      expect(template).not.toContain("Database / storage");
      expect(template).not.toContain("Notifications / messaging");
      expect(template).not.toContain("- [ ] Other:");

      // The section keeps its name — new-feature/SKILL.md:172 maps to it — and now
      // instructs real-module derivation sourced from domains.md (024: repointed off
      // conventions.md § Domain rules, which no longer exists).
      expect(template).toContain("## Domains");
      expect(template).toContain("Name the real modules touched");
      expect(template).toContain("`.claude/rules/domains.md`");
      expect(template).not.toContain("conventions.md` § Domain rules");
    });

    test("spec-template.md's Summary/Acceptance Criteria/Rollback Plan placeholders stay independently fillable after the Domains rewrite (genuine, not a regression guard)", () => {
      const template = fs.readFileSync(specTemplatePath, "utf8");
      const filled = template
        .replace(
          "<!-- One paragraph describing what this feature does and why -->",
          "GENUINE-SUMMARY-MARKER: derives Domains from real modules instead of a fixed checklist.",
        )
        .replace(
          "- [ ] Given [precondition], When [action], Then [expected result]\n- [ ] Given [precondition], When [action], Then [expected result]",
          "- [ ] Given a filled spec, When its sections are read directly, Then GENUINE-AC-MARKER is present",
        )
        .replace(
          "<!-- How do we revert if something goes wrong? -->",
          "GENUINE-ROLLBACK-MARKER: revert the commit.",
        );

      // Guards the fixture itself: if any of the three replacements silently no-ops
      // (e.g. the template's placeholder text drifted), fail loudly here instead of
      // the assertions below passing for the wrong reason.
      expect(filled).not.toBe(template);

      // 024 removes the PR-body extractor this test used to go through --
      // slice each "## <heading>" section directly off the filled markdown
      // instead, and assert its own marker landed there and no other
      // section's marker bled in.
      // Trailing sentinel guarantees the lazy match below always finds a
      // closing "## " to stop at, including for the file's last section.
      const withSentinel = `${filled}\n## `;
      const section = (heading) => {
        const match = withSentinel.match(new RegExp(`## ${heading}\\n([\\s\\S]*?)\\n## `));
        return match ? match[1] : "";
      };

      const summary = section("Summary");
      const acceptanceCriteria = section("Acceptance Criteria");
      const rollbackPlan = section("Rollback Plan");

      expect(summary).toContain("GENUINE-SUMMARY-MARKER");
      expect(acceptanceCriteria).toContain("GENUINE-AC-MARKER");
      expect(rollbackPlan).toContain("GENUINE-ROLLBACK-MARKER");

      expect(summary).not.toContain("GENUINE-AC-MARKER");
      expect(summary).not.toContain("GENUINE-ROLLBACK-MARKER");
      expect(acceptanceCriteria).not.toContain("GENUINE-ROLLBACK-MARKER");
    });
  });

  test("replaces the fixed vendor-selection Evaluation criteria list with a derived-criteria instruction, not an addition (T006)", () => {
    const template = fs.readFileSync(path.join(repoRoot, ".specify/templates/research-template.md"), "utf8");

    // Proves this was a replacement, not an addition alongside the old list — picks
    // substrings that cannot appear elsewhere in the file by coincidence.
    expect(template).not.toContain("Vendor lock-in");
    expect(template).not.toContain("Team fit");

    // The section keeps its name — sdd-research-spike.md:38 reads it as guidance — and now
    // instructs criteria derived from what's actually being evaluated.
    expect(template).toContain("## Evaluation criteria");
    expect(template).toContain("Derive from what is evaluated");
    expect(template).toContain("vendor list (cost, lock-in,");
  });

  describe("plan-template.md conditional sections (T007)", () => {
    const planTemplatePath = path.join(repoRoot, ".specify/templates/plan-template.md");

    test("Touched areas becomes a Module / path table, not the four fixed sub-fields", () => {
      const template = fs.readFileSync(planTemplatePath, "utf8");

      // Proves replacement, not addition alongside the old fixed sub-fields.
      expect(template).not.toContain("APIs/contracts:");
      expect(template).not.toContain("DB/schema:");
      expect(template).not.toContain("Jobs/workers:");
      expect(template).not.toContain("UI surfaces:");

      // Heading name is unchanged — nothing parses it, but 3 archived plans already drifted
      // to "## Touched files" and this feature should not add more drift.
      expect(template).toContain("## Touched areas");
      expect(template).toContain("| Module / path | Change |");
    });

    test("Observability and Migration / rollout become conditional, one-line sections", () => {
      const template = fs.readFileSync(planTemplatePath, "utf8");

      // Fixed sub-field lists are gone — proves replacement, not addition.
      expect(template).not.toContain("- Logs:");
      expect(template).not.toContain("- Metrics:");
      expect(template).not.toContain("- Alerts:");
      expect(template).not.toContain("- Backfill:");
      expect(template).not.toContain("- Compatibility:");
      expect(template).not.toContain("- Feature flags:");
      expect(template).not.toContain("- Rollback:");

      // Headings survive unchanged — regression guard against further drift.
      expect(template).toContain("## Observability");
      expect(template).toContain("## Migration / rollout");

      // F5's adopted convention: `N/A — <reason>` as a section-level value, not a new
      // fourth syntax alongside field-level N/A and `## Test-skip rationale`.
      expect(template).toContain("N/A — <reason>");
    });

    test("plan-feature/SKILL.md drops Observability and Migration from the mandatory Fills-in list", () => {
      const planFeature = fs.readFileSync(path.join(repoRoot, ".claude/skills/plan-feature/SKILL.md"), "utf8");

      expect(planFeature).not.toContain("Migration / rollout strategy");
      expect(planFeature).not.toContain("Observability plan");
      expect(planFeature).not.toContain("Touched files/modules, APIs, DB/schema, jobs, UI");
    });

    test("plan-feature/SKILL.md resolves domain vocabulary via `sdd domain-vocab` in a new Step 2.5, ahead of Step 3 (T005)", () => {
      const planFeature = fs.readFileSync(path.join(repoRoot, ".claude/skills/plan-feature/SKILL.md"), "utf8");

      // Wiring regression guard, not behavioral coverage — this asserts the prose
      // instruction exists, not that an agent follows it (ADR 0003's own caveat).

      // Step 2.5 exists and calls the CLI subcommand — the content-resolution path
      // ADR 0003 chose over the grep-in-a-prompt pattern F1 originally used.
      expect(planFeature).toContain("2.5. **Domain vocabulary**");
      expect(planFeature).toContain("sdd domain-vocab");

      // Step 3 no longer hardcodes the old fixed web taxonomy — domains now come
      // from Step 2.5's vocabulary (or its spec-derived fallback) instead.
      expect(planFeature).not.toContain("db, api, frontend, infra, auth, notifications, integrations");

      // The empty/unavailable fallback names the spec — read in Step 2, always
      // present — never step 4's exploration findings, which the discovery-resume
      // path (:37) skips entirely. 021 took exactly that path.
      expect(planFeature).not.toContain("the exploration findings you collected in step 4");

      // The now-false "CLI never does" claim is gone from this file's copy of the
      // closing sentence (the other three consumers are T006's).
      expect(planFeature).not.toContain("the agent reads the rules file directly, the CLI never does");
    });

    test("sdd-designer.md fill list matches the template's new conditional shape", () => {
      const designer = fs.readFileSync(path.join(repoRoot, ".claude/agents/sdd-designer.md"), "utf8");

      expect(designer).not.toContain("Touched files/modules, APIs, DB/schema, jobs, UI");
      expect(designer).not.toContain("Migration / rollout strategy** — phased if MEDIUM/LARGE");
      expect(designer).toContain("N/A — <reason>");
    });
  });

  describe("sdd domain-vocab (T001, repointed to domains.md by 024)", () => {
    // Real binary, real repo. The old section-extraction helper's fence/CRLF/comment-shape
    // axes (its predecessor tests) all existed to find and bound a "## Domain rules" SECTION
    // inside a larger file -- heading match, fence-gated terminator, CRLF-safe
    // compare. None of that applies anymore: cmd_domain_vocab reads
    // .claude/rules/domains.md whole, so there is no heading to find and no
    // terminator to fence-gate. What survives is the comment-stripping awk loop
    // (index()/substr()) and the blank-line emptiness filter, both unchanged by
    // this feature -- the cases below exercise those, plus the file's three exit
    // states named by AC2 (content => 0, absent => 3, comment-only => 3).
    test("this repo's own domains.md carries real domain vocabulary: sdd domain-vocab prints it and exits 0", () => {
      const output = execFileSync(sddBin, ["domain-vocab"], {
        cwd: repoRoot,
        encoding: "utf8",
      });

      // SDD_HOME's own domains.md names its actual functional areas, not just the
      // template comment a fresh `sdd init` seed copy ships with.
      expect(output).toContain("CLI surface");
      expect(output).toContain("Phase agents");
      expect(output).toContain("bin/sdd");
    });

    test("domains.md missing entirely: no stdout, exit 3 (AC2)", () => {
      const project = makeTempProject();

      const error = sddFail(["domain-vocab"], { cwd: project });

      expect(error.status).toBe(3);
      expect(error.stdout.toString()).toBe("");
    });

    test("domains.md reduced to only its HTML template comment counts as empty: no stdout, exit 3 (AC2)", () => {
      const project = makeTempProject();
      fs.mkdirSync(path.join(project, ".claude/rules"), { recursive: true });
      fs.writeFileSync(
        path.join(project, ".claude/rules/domains.md"),
        "<!-- Project-specific business logic rules -->\n",
      );

      const error = sddFail(["domain-vocab"], { cwd: project });

      expect(error.status).toBe(3);
      expect(error.stdout.toString()).toBe("");
    });

    test("domains.md reduced to only a multi-line HTML comment counts as empty: no stdout, exit 3", () => {
      const project = makeTempProject();
      fs.mkdirSync(path.join(project, ".claude/rules"), { recursive: true });
      fs.writeFileSync(
        path.join(project, ".claude/rules/domains.md"),
        [
          "<!-- Project-specific",
          "     business logic rules,",
          "     spanning multiple lines -->",
          "",
        ].join("\n"),
      );

      const error = sddFail(["domain-vocab"], { cwd: project });

      expect(error.status).toBe(3);
      expect(error.stdout.toString()).toBe("");
    });

    // Judge finding (review fix cycle 3, carried over from the old section-extraction era): a
    // comment BODY containing '--' (an em-dash, common in this repo's own prose) used
    // to survive a naive regex strip and print as if it were real vocabulary. The
    // index()/substr() loop that replaced it is unchanged by this feature -- still
    // exercised here because it is still live code, just reading a whole file instead
    // of an extracted section.
    test("comment-only content with an internal '--' in the body still counts as empty: no stdout, exit 3", () => {
      const project = makeTempProject();
      fs.mkdirSync(path.join(project, ".claude/rules"), { recursive: true });
      fs.writeFileSync(
        path.join(project, ".claude/rules/domains.md"),
        "<!-- revisar esta lista -- no esta cerrada -->\n",
      );

      const error = sddFail(["domain-vocab"], { cwd: project });

      expect(error.status).toBe(3);
      expect(error.stdout.toString()).toBe("");
    });

    test("real content plus a comment containing '--': prints the file, exit 0", () => {
      const project = makeTempProject();
      fs.mkdirSync(path.join(project, ".claude/rules"), { recursive: true });
      fs.writeFileSync(
        path.join(project, ".claude/rules/domains.md"),
        "- regla real\n<!-- nota -- pendiente -->\n",
      );

      const output = execFileSync(sddBin, ["domain-vocab"], {
        cwd: project,
        encoding: "utf8",
      });

      expect(output).toContain("- regla real");
    });

    test("an unterminated comment ('<!--' with no closing '-->') still counts as real content: exit 0", () => {
      const project = makeTempProject();
      fs.mkdirSync(path.join(project, ".claude/rules"), { recursive: true });
      fs.writeFileSync(
        path.join(project, ".claude/rules/domains.md"),
        "<!-- revisar esta lista sin cerrar\n",
      );

      const output = execFileSync(sddBin, ["domain-vocab"], {
        cwd: project,
        encoding: "utf8",
      });

      expect(output).toContain("revisar esta lista sin cerrar");
    });

    test("an empty comment '<!---->' alone still counts as empty: no stdout, exit 3", () => {
      const project = makeTempProject();
      fs.mkdirSync(path.join(project, ".claude/rules"), { recursive: true });
      fs.writeFileSync(path.join(project, ".claude/rules/domains.md"), "<!---->\n");

      const error = sddFail(["domain-vocab"], { cwd: project });

      expect(error.status).toBe(3);
      expect(error.stdout.toString()).toBe("");
    });
  });

  describe("cmd_init seeds .claude/rules/ from a pristine seed, not SDD_HOME's own rules (T009)", () => {
    // SEED-CONTAMINATION (decisions.md): SDD_HOME's own .claude/rules/conventions.md
    // and model-overrides.md carry THIS repo's domain vocabulary and a real model
    // override row (filled by T008 / feature 020). cmd_init used to copy those files
    // verbatim into every new project. This is the real shipped code path — no
    // reimplementation of the copy loop — so a genuine RED here means the bug is real.
    test("a fresh `sdd init` does not leak this repo's domain vocabulary or model overrides, and drops the retired commit-policy knob", () => {
      const project = makeTempProject();

      execFileSync(sddBin, ["init"], { cwd: project, encoding: "utf8" });

      const conventions = fs.readFileSync(
        path.join(project, ".claude/rules/conventions.md"),
        "utf8",
      );
      const domains = fs.readFileSync(path.join(project, ".claude/rules/domains.md"), "utf8");
      const modelOverrides = fs.readFileSync(
        path.join(project, ".claude/rules/model-overrides.md"),
        "utf8",
      );
      const gitMd = fs.readFileSync(path.join(project, ".claude/rules/git.md"), "utf8");

      // 024: Domain rules moved out of conventions.md into its own file — the seed
      // no longer carries the section at all, and the seed copy loop (`cmd_init`'s
      // generic `*.md` glob over .specify/templates/rules/) picks up domains.md
      // without any dedicated code for it.
      expect(conventions).not.toContain("## Domain rules");

      // None of SDD_HOME's own domain vocabulary (T008, moved to domains.md by 024)
      // leaks into a new project's domains.md either — the seed copy is a pristine
      // placeholder, not this repo's own filled-in file (021 T009's SEED-CONTAMINATION).
      expect(domains).not.toContain("CLI surface");
      expect(domains).not.toContain("Phase agents");
      expect(domains).not.toContain("bin/sdd` subcommands");
      expect(domains).toContain("<!-- Project-specific business logic rules -->");

      // None of SDD_HOME's own model override row leaks into a new project.
      expect(modelOverrides).not.toContain("haiku");
      expect(modelOverrides).not.toContain("| Review agent |");

      // 025/T008: the commit-policy knob (feature 020) was deleted from the seed
      // template too, so a fresh project's git.md no longer ships it either.
      // Needle assembled at runtime so this proof-of-removal doesn't trip its
      // own AC5 grep (bin/, .claude/, .specify/, tests/ must all read 0 hits
      // for the literal knob name).
      const knobNeedle = ["auto", "commit"].join("-");
      expect(gitMd).not.toContain(`${knobNeedle}: on|off`);
      expect(gitMd).not.toContain("## Auto-commit");
    });
  });

  describe("021's spec.md and plan.md stay reconciled with decisions.md (T010)", () => {
    // Regression guards, not behavioral coverage: these are prose artifacts.
    // They assert the artifacts stay in sync with decisions.md's own record —
    // catching the exact drift judge findings #3 and #4 flagged, so archiving
    // this feature doesn't freeze a spec/plan that contradicts its decision log.
    const dir021 = featureDir("021-project-aware-templates");
    const specPath = path.join(dir021, "spec.md");
    const planPath = path.join(dir021, "plan.md");

    // 024 deleted bin/sdd's old section-extraction helper (and its Node port,
    // src/extract-section.js) once its last real caller moved off it — this
    // test's own sourcing of that helper directly was the one remaining call
    // site (F5, decisions.md). Plain JS slicing between the heading and the next "## "
    // heading replaces it; the assertions below are unchanged, only the
    // mechanism is.
    function sectionFromMarkdown(content, heading) {
      const headingLine = `## ${heading}`;
      const lines = content.split("\n");
      const start = lines.findIndex((line) => line === headingLine);
      if (start === -1) {
        return "";
      }
      let end = lines.length;
      for (let i = start + 1; i < lines.length; i += 1) {
        if (lines[i].startsWith("## ")) {
          end = i;
          break;
        }
      }
      return lines.slice(start + 1, end).join("\n");
    }

    test("spec.md no longer names sdd-reviewer.md as a Domain or requires it to accept a discard line — decisions.md REMOVED that edge case", () => {
      const spec = fs.readFileSync(specPath, "utf8");

      expect(spec).not.toContain("sdd-reviewer.md");
    });

    test("plan.md's Touched areas names T009's files — bin/sdd and the pristine rules seed — so the archived plan doesn't omit them", () => {
      const plan = fs.readFileSync(planPath, "utf8");
      const touchedAreas = sectionFromMarkdown(plan, "Touched areas");

      expect(touchedAreas).toContain("bin/sdd");
      expect(touchedAreas).toContain(".specify/templates/rules/");
    });
  });

  describe("§F: archive is not exempt from validation, and non-retryable phases exist (T004)", () => {
    // Wiring regression guard, not behavioral coverage: these assert the instruction
    // text is present in all five prose locations decisions.md (F3/F4) names as needing
    // lockstep edits. They cannot verify an orchestrator actually obeys the text — only
    // that it's there to obey. That gap is exactly how archiving 021 broke the build and
    // still returned Status: success: the "skip if phase produces no code" hatch read
    // literally over archive's file-move. A test that looked like coverage wasn't; this
    // one is deliberately scoped to what it can actually check.
    const phaseCommon = fs.readFileSync(
      path.join(repoRoot, ".claude/skills/_shared/sdd-phase-common.md"),
      "utf8",
    );
    const sddNext = fs.readFileSync(path.join(repoRoot, ".claude/skills/sdd-next/SKILL.md"), "utf8");
    const sddAuto = fs.readFileSync(path.join(repoRoot, ".claude/skills/sdd-auto/SKILL.md"), "utf8");

    // Distinctive substrings only — "archive" and "retry" alone already appear throughout
    // these files and would pass before the fix. These exact clauses do not exist pre-fix
    // (verified: zero hits for either substring in all three files before this task).
    const notExemptClause = "is not exempt: it moves files, not prose, so this step still runs";
    const nonRetryableClause = "zero retries, never `ESCALATED`";

    test("sdd-phase-common.md §F names archive-feature as not exempt from the no-code-skip hatch", () => {
      expect(phaseCommon).toContain(notExemptClause);
    });

    test("sdd-phase-common.md §F declares a non-retryable-phases list, checked before the retry loop", () => {
      expect(phaseCommon).toContain("Non-retryable phases");
      expect(phaseCommon).toContain("checked before the retry loop below starts");
      expect(phaseCommon).toContain("`archive-feature`");
      expect(phaseCommon).toContain(nonRetryableClause);
    });

    test("sdd-next/SKILL.md Step 4 restates the archive carve-out inline (:177)", () => {
      expect(sddNext).toContain(notExemptClause);
    });

    test("sdd-next/SKILL.md Step 4 restates the non-retryable check before its 2-retry-then-ESCALATED logic (:196-197)", () => {
      expect(sddNext).toContain("Non-retryable phases");
      expect(sddNext).toContain(nonRetryableClause);
      // The existing 2-retry-then-ESCALATED logic must survive untouched, not be replaced.
      expect(sddNext).toContain("**Max 2 retries** per phase invocation");
      expect(sddNext).toContain("If 2 retries are exhausted without passing, **STOP** and report with `Status: ESCALATED`");
    });

    test("sdd-auto/SKILL.md Step 3 restates the archive carve-out inline (:120)", () => {
      expect(sddAuto).toContain(notExemptClause);
    });

    test("sdd-auto/SKILL.md restates the non-retryable check before its non-implement-task retry logic (:125)", () => {
      expect(sddAuto).toContain("Non-retryable phases");
      expect(sddAuto).toContain(nonRetryableClause);
      // The existing non-implement-task retry logic must survive untouched, not be replaced.
      expect(sddAuto).toContain(
        "For **non-implement-task phases**: max 2 retries per phase invocation. If exhausted → ESCALATE and STOP.",
      );
    });
  });

  describe("T003: bin/sdd's last runtime Node dependency is gone (AC3)", () => {
    // Inverts pathWithoutNode()'s original premise (see its doc comment above):
    // before this feature, the only reason to strip Node off PATH was to prove
    // the old section-extraction helper failed loudly without it. That helper is deleted
    // now (along with src/extract-section.js), so bin/sdd has no runtime Node
    // dependency left at all. sdd domain-vocab is the command this proves it
    // against -- it's the one that used to depend on Node, via
    // cmd_domain_vocab's now-removed call into that helper (T001).
    test("sdd domain-vocab succeeds against a fixture with content, with Node off PATH", () => {
      const project = makeTempProject();
      fs.mkdirSync(path.join(project, ".claude/rules"), { recursive: true });
      fs.writeFileSync(path.join(project, ".claude/rules/domains.md"), "- regla real de dominio\n");

      const output = execFileSync(sddBin, ["domain-vocab"], {
        cwd: project,
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: pathWithoutNode(),
        },
      });

      expect(output).toContain("- regla real de dominio");
    });
  });

  describe("T004: TRIANGULATE joins the TDD cycle, TDD-Evidence joins the envelope (026/AC2)", () => {
    // Prose-pin tests, not behavioral coverage -- same honest framing as the §F describe
    // above: these assert the instruction text exists in the files plan.md names as
    // needing lockstep edits for AC2, not that an agent actually produces the evidence
    // at runtime (that's AC3/T005's job).
    const implementTask = fs.readFileSync(path.join(repoRoot, ".claude/agents/sdd-implement-task.md"), "utf8");
    const phaseCommon = fs.readFileSync(
      path.join(repoRoot, ".claude/skills/_shared/sdd-phase-common.md"),
      "utf8",
    );
    const testingRules = fs.readFileSync(path.join(repoRoot, ".claude/rules/testing.md"), "utf8");
    const testingTemplate = fs.readFileSync(
      path.join(repoRoot, ".specify/templates/rules/testing.md"),
      "utf8",
    );
    const tddSkill = fs.readFileSync(path.join(repoRoot, ".claude/skills/tdd/SKILL.md"), "utf8");

    test("sdd-implement-task.md's cycle is 4-step: RED -> GREEN -> TRIANGULATE -> REFACTOR", () => {
      expect(implementTask).toContain("RED → GREEN → TRIANGULATE → REFACTOR cycle");
      // Step 4c's parenthetical must name the same 4-step cycle, not the old 3-step one.
      expect(implementTask).toContain(
        "c. Write the code change (if TDD mode: follow RED → GREEN → TRIANGULATE → REFACTOR cycle).",
      );
    });

    test("TRIANGULATE is default-mandatory, with a minimum-2-cases rule and an annotated structural skip", () => {
      expect(implementTask).toContain("minimum 2 cases per behavior");
      expect(implementTask).toContain(
        "Default-mandatory. Skip ONLY for a purely-structural task with literally one possible output",
      );
      expect(implementTask).toContain("Triangulation skipped: <reason>");
    });

    test("the quality bar's RED-evidence and refactor-timing bullets stay consistent with the 4-step cycle", () => {
      // L79: RED evidence now has one home (the envelope field), not a dispersed pair.
      expect(implementTask).toContain("Paste the real RED output in the `TDD-Evidence` envelope field");
      expect(implementTask).not.toContain("Paste the real RED output in `Validations-Output` or the task notes.");
      // L82: refactor timing now follows TRIANGULATE, not GREEN directly.
      expect(implementTask).toContain("Refactor only after TRIANGULATE");
    });

    test("sdd-implement-task.md's Result envelope carries a mandatory TDD-Evidence field", () => {
      expect(implementTask).toContain(
        '- **TDD-Evidence**: [RED: real failure output pasted | GREEN: pass output | TRIANGULATE: N cases, or "skipped: <reason>"]',
      );
      expect(implementTask).toContain("mandatory for every task in this agent's own contract");
      expect(implementTask).toContain("the same skip note as the `Test-skip rationale` entry");
    });

    test("Step 7.5 points at the work-unit-commits skill for choosing --files", () => {
      expect(implementTask).toContain("the `work-unit-commits` skill");
    });

    test("sdd-phase-common.md §D declares TDD-Evidence optional at the schema level, mandatory in implement-task's own contract", () => {
      expect(phaseCommon).toContain(
        "**TDD-Evidence** _(optional)_: [RED failure output, GREEN pass output, TRIANGULATE case count or skip note]",
      );
      expect(phaseCommon).toContain("mandatory in `/implement-task`'s own contract");
    });

    test("testing.md and its templates mirror both name the 4-step cycle, not the old undifferentiated test-first mention", () => {
      for (const doc of [testingRules, testingTemplate]) {
        expect(doc).toContain("RED → GREEN → TRIANGULATE → REFACTOR cycle is mandatory");
        expect(doc).toContain("start the RED → GREEN → TRIANGULATE → REFACTOR cycle");
      }
    });

    test("/tdd points at implement-task's stricter 4-step contract without rewriting its own doctrine", () => {
      expect(tddSkill).toContain("/implement-task` runs a 4-step variant of this cycle");
      expect(tddSkill).toContain("TDD-Evidence");
    });
  });

  describe("T005: orchestrators + reviewer validate TDD-Evidence against reality (026/AC3)", () => {
    // Same honest framing as the §F/T004 describes above: prose-pin tests, not behavioral
    // coverage. T004 declared the TDD-Evidence FIELD (§D); this task adds the VALIDATION
    // rule that treats a missing/incomplete field as an envelope-complete failure, plus
    // the reviewer's mechanical evidence-vs-reality check. These assert the instruction
    // text exists in the four locations plan.md names, not that an agent obeys it at runtime.
    const phaseCommon = fs.readFileSync(
      path.join(repoRoot, ".claude/skills/_shared/sdd-phase-common.md"),
      "utf8",
    );
    const sddNext = fs.readFileSync(path.join(repoRoot, ".claude/skills/sdd-next/SKILL.md"), "utf8");
    const sddAuto = fs.readFileSync(path.join(repoRoot, ".claude/skills/sdd-auto/SKILL.md"), "utf8");
    const reviewer = fs.readFileSync(path.join(repoRoot, ".claude/agents/sdd-reviewer.md"), "utf8");

    // Distinctive substring only — verified zero hits in all three files before this task.
    const tddEvidenceGateClause =
      "absent or incomplete TDD-Evidence counts as an envelope-complete failure";

    test("sdd-phase-common.md §F ties TDD-Evidence to the envelope-complete check for implement-task", () => {
      expect(phaseCommon).toContain(tddEvidenceGateClause);
      expect(phaseCommon).toContain("For `implement-task`");
    });

    test("sdd-phase-common.md §F does not invent a new retry mechanism — it rides the existing budget", () => {
      // Second case, different code path than the presence check above: the clause must sit
      // inside §F (the section governing retry→ESCALATED), not merely exist somewhere in the file.
      const sectionFStart = phaseCommon.indexOf("## F. Post-Phase Validation Protocol");
      const sectionGStart = phaseCommon.indexOf("## G. Engram Persistent Memory");
      expect(sectionFStart).toBeGreaterThan(-1);
      expect(sectionGStart).toBeGreaterThan(sectionFStart);
      const sectionF = phaseCommon.slice(sectionFStart, sectionGStart);
      expect(sectionF).toContain(tddEvidenceGateClause);
    });

    test("sdd-next/SKILL.md Step 4 restates the TDD-Evidence gate inline", () => {
      expect(sddNext).toContain(tddEvidenceGateClause);
    });

    test("sdd-auto/SKILL.md Step 2 item 3 restates the TDD-Evidence gate inline", () => {
      expect(sddAuto).toContain(tddEvidenceGateClause);
    });

    test("sdd-reviewer.md gains a mechanical step 2.5 validating TDD-Evidence against reality", () => {
      expect(reviewer).toContain("2.5. **Validate TDD-Evidence against reality**");
      expect(reviewer).toContain("EXISTS");
      expect(reviewer).toContain("PASSES");
    });

    test("sdd-reviewer.md's step 2.5 checks the claimed triangulation count and escalates fabrication to CRITICAL", () => {
      // Second case: the N-cases check and the fabrication consequence are two different
      // clauses within the same step — pin both, not just the step's existence above.
      expect(reviewer).toContain("N triangulation cases");
      expect(reviewer).toContain("fabricated or unverifiable");
      expect(reviewer).toContain("CRITICAL");
    });
  });

  describe("T007: orchestrator post-archive gate (026/AC6)", () => {
    // Prose-pin tests, same framing as T005/T006 above. T006 gave archive-feature its
    // own self-check (agent-side, before deleting .sdd-state); this task is the
    // independent orchestrator-side gate AC6 also names: after archive-feature
    // returns, the orchestrator re-runs `sdd verify-archive` itself and trusts only
    // the exit code -- so a hand-run archive (no agent self-check in the loop at all)
    // is still caught the next time an orchestrator touches the feature. Unlike T005's
    // TDD-Evidence clause (a shared substring only, worded differently per file), this
    // clause is specified as byte-identical across all three files -- the stronger pin.
    const phaseCommon = fs.readFileSync(
      path.join(repoRoot, ".claude/skills/_shared/sdd-phase-common.md"),
      "utf8",
    );
    const sddNext = fs.readFileSync(path.join(repoRoot, ".claude/skills/sdd-next/SKILL.md"), "utf8");
    const sddAuto = fs.readFileSync(path.join(repoRoot, ".claude/skills/sdd-auto/SKILL.md"), "utf8");

    // The full sentence, verbatim in all three files -- not just an overlapping substring.
    const archiveVerifyGateClause =
      "For `archive-feature`, step 3 (Lint/tests pass) also runs `sdd verify-archive <feature-id>` " +
      "and trusts only its exit code: a nonzero exit is a validation failure for this non-retryable " +
      "phase, so the orchestrator reports `Status: blocked` with the CLI's stderr and stops — zero " +
      "retries, never `ESCALATED`.";

    test("the same archive-verify gate clause is present verbatim in all 3 files", () => {
      expect(phaseCommon).toContain(archiveVerifyGateClause);
      expect(sddNext).toContain(archiveVerifyGateClause);
      expect(sddAuto).toContain(archiveVerifyGateClause);
    });

    test("the clause sits inside each file's own post-phase-validation section, not merely somewhere in the file", () => {
      // Second case, a different code path than the presence check above: bound each
      // file to its own validation section (heading-to-heading) and assert the clause
      // falls inside that slice, not e.g. trailing off in an unrelated section.
      const fStart = phaseCommon.indexOf("## F. Post-Phase Validation Protocol");
      const gStart = phaseCommon.indexOf("## G. Engram Persistent Memory");
      expect(fStart).toBeGreaterThan(-1);
      expect(gStart).toBeGreaterThan(fStart);
      expect(phaseCommon.slice(fStart, gStart)).toContain(archiveVerifyGateClause);

      const step4Start = sddNext.indexOf("## Step 4: Validate and retry");
      const step5Start = sddNext.indexOf("## Step 5: Evaluator-optimizer loop (review→fix→re-review)");
      expect(step4Start).toBeGreaterThan(-1);
      expect(step5Start).toBeGreaterThan(step4Start);
      expect(sddNext.slice(step4Start, step5Start)).toContain(archiveVerifyGateClause);

      const step2Start = sddAuto.indexOf("## Step 2: Run pipeline loop");
      const step2bStart = sddAuto.indexOf("## Step 2b: Evaluator-optimizer loop (review→fix→re-review)");
      expect(step2Start).toBeGreaterThan(-1);
      expect(step2bStart).toBeGreaterThan(step2Start);
      expect(sddAuto.slice(step2Start, step2bStart)).toContain(archiveVerifyGateClause);
    });

    test("the existing not-exempt / non-retryable clauses stay byte-identical -- the new clause sits alongside, not instead of, them", () => {
      // Third case: a regression guard, not a presence check on the new text at all --
      // if the new clause had been spliced in by rewording these instead of adding
      // beside them, this is what would catch it.
      const notExemptClause =
        "`archive-feature` is not exempt: it moves files, not prose, so this step still runs";
      expect(phaseCommon).toContain(notExemptClause);
      expect(sddNext).toContain(notExemptClause);
      expect(sddAuto).toContain(notExemptClause);

      const sharedNonRetryableSentence =
        "Its post-move pre-flight can't succeed on a second attempt, so on failure report " +
        "`Status: blocked` with the validation output and stop — zero retries, never `ESCALATED`.";
      expect(sddNext).toContain(sharedNonRetryableSentence);
      expect(sddAuto).toContain(sharedNonRetryableSentence);

      expect(phaseCommon).toContain(
        "On validation failure for a non-retryable phase, the orchestrator MUST report " +
          "`Status: blocked` with the validation output and stop — zero retries, never `ESCALATED`.",
      );
    });
  });
});
