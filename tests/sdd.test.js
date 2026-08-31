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

  // sdd-sweep-exempt:start — this regression test must name the retired `open-pr`
  // command literally to prove bin/sdd truly rejects it (AC1); a proof of removal,
  // not a dangling reference. See tests/sweep-retired-symbols.test.js's header
  // comment for why this is a different case than the sweep's own self-reference.
  test("open-pr no longer exists: unknown command in dispatch, and usage() does not list it (024 AC1)", () => {
    const project = makeTempProject();

    const error = sddFail(["open-pr", "001-demo"], { cwd: project });

    expect(error.status).toBe(1);
    expect(error.stderr).toContain("Unknown command");

    const help = execFileSync(sddBin, ["help"], { cwd: project, encoding: "utf8" });
    expect(help).not.toContain("open-pr");
  });
  // sdd-sweep-exempt:end

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
    expect(phaseCommon).toContain("auto-commit: off");
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

  test("implement-task wires sdd branch, the auto-commit knob, and a Step 7.5 commit-with-revert (T006)", () => {
    const implementTask = fs.readFileSync(path.join(repoRoot, ".claude/agents/sdd-implement-task.md"), "utf8");

    // Pre-flight: branch creation goes through the CLI, never a raw git checkout.
    expect(implementTask).toContain("sdd branch $ARGUMENTS");
    expect(implementTask).toContain("ADR 0002");

    // Auto-commit knob: same grep-the-rules-file shape as the tdd: knob, absent ⇒ on.
    expect(implementTask).toContain("auto-commit:\\s*off");
    expect(implementTask).toContain("Commit: none");

    // Step 7.5: the commit-slice call, gated on the knob, after checkbox+marker+delta.
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

  test("git.md rewrites the never-commit policy to commit-per-slice + auto-commit knob (T013)", () => {
    const gitMd = fs.readFileSync(path.join(repoRoot, ".claude/rules/git.md"), "utf8");

    // Old opt-out-only policy must be gone — this proves a rewrite, not an append.
    expect(gitMd).not.toContain("Never commit or push");
    expect(gitMd).not.toContain("The human handles commits, merges, and PRs.");

    // New policy: branch creation goes through the CLI, cites the ADR.
    expect(gitMd).toContain("sdd branch <feature-id>");
    expect(gitMd).toContain("docs/adr/0002-sdd-git-write-boundary.md");

    // New policy: phases commit their own work per validated slice; nothing pushes.
    // sdd-sweep-exempt:start — must name the retired gate command literally to prove
    // git.md no longer mentions it; a proof of removal, not a dangling reference.
    // 024 removes the `sdd open-pr` gate command — pushing and opening a PR are
    // manual, human-run steps now (no CLI command left to pin here).
    expect(gitMd).toContain("sdd commit-slice");
    expect(gitMd).toContain("Nothing is pushed during development");
    expect(gitMd).not.toContain("sdd open-pr");
    // sdd-sweep-exempt:end

    // Auto-commit knob, mirroring testing.md's tdd: knob shape.
    expect(gitMd).toContain("auto-commit: on|off");
    expect(gitMd).toContain("auto-commit: off");

    // Commit style now documents the conventional-commit format sdd commit-slice produces.
    expect(gitMd).toContain("<type>(<feature-id>): [Tnnn ]<title>");

    // Untouched section stays intact.
    expect(gitMd).toContain("## Base branch resolution");
  });

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

  test("simplify-code commits before writing the sentinel and gitignores .simplified (T007)", () => {
    const simplifyCode = fs.readFileSync(path.join(repoRoot, ".claude/agents/sdd-simplify-code.md"), "utf8");
    const gitignore = fs.readFileSync(path.join(repoRoot, ".gitignore"), "utf8");

    // New step: commit-slice call between post-validation and sentinel write, refactor type, no task id.
    expect(simplifyCode).toContain("5.5. Commit the slice");
    expect(simplifyCode).toContain("sdd commit-slice $ARGUMENTS --type refactor --files <SCOPED_FILES...>");
    expect(simplifyCode).toContain("No `--task` flag — a simplify pass has no task ID.");

    // Auto-commit knob, same grep-the-rules-file shape as implement-task's Step 7.5.
    expect(simplifyCode).toContain("auto-commit:\\s*off");
    expect(simplifyCode).toContain("Commit: none");

    // Ordering is explicitly documented as load-bearing: commit first, sentinel second,
    // and the self-invalidation consequence of reversing it is spelled out so nobody "fixes" it later.
    expect(simplifyCode).toContain("commit FIRST");
    expect(simplifyCode).toContain("sentinel SECOND");
    expect(simplifyCode).toContain("loop `/simplify-code` forever");

    // Empty-diff path still writes the sentinel and reports no commit — nothing to commit.
    expect(simplifyCode).toContain("skip straight to step 6 and report `Commit: none`");

    // Commit failure blocks before the sentinel is written — same invariant as implement-task's revert.
    expect(simplifyCode).toContain("do NOT write `.simplified`");

    // Envelope gains the Commit field.
    expect(simplifyCode).toContain("- **Commit**:");

    // .simplified is gitignored — same sentinel-commit hazard the ordering rule above guards against.
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

    // Auto-commit knob, same grep-the-rules-file shape as implement-task/simplify-code.
    expect(archiveFeature).toContain("auto-commit:\\s*off");
    expect(archiveFeature).toContain("Commit: none");

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

  // sdd-sweep-exempt:start — this test must name the retired gate's literal strings
  // (`ready-to-pr`, `sdd open-pr`, `.pr-opened`) to prove sdd-next/sdd-auto no longer
  // mention them (AC4); a proof of removal, not a dangling reference. See
  // tests/sweep-retired-symbols.test.js's header comment for the distinction.
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
  // sdd-sweep-exempt:end

  // sdd-sweep-exempt:start — same reasoning as the test above: must name the retired
  // gate's literal strings to prove CLAUDE.md no longer mentions them (AC4).
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
  // sdd-sweep-exempt:end

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

    test("stages only --files plus the derived feature dir, leaving unrelated dirty files out", () => {
      const project = makeTempProject();
      seedCommit(project);
      fs.writeFileSync(path.join(project, "app.js"), "console.log('hi');\n");
      fs.writeFileSync(path.join(project, "unrelated.js"), "console.log('bye');\n");
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

    // The post-commit safety net (the "warning: tracked files still dirty
    // after commit" check) was rescoped alongside the commit itself in the
    // same T008 fix, sharing its root cause and its commit_paths variable —
    // but had no test of its own. These two tests cover both directions:
    // (a) alone would stay green even if the warning were deleted outright,
    // and (b) alone would stay green even if the check were still scanning
    // the whole index instead of just commit_paths. Only both together pin
    // down "scoped, and still functional".
    test("does not warn when an unrelated file was pre-staged before commit-slice ran (scoped safety net stays quiet about work that is not ours)", () => {
      const project = makeTempProject();
      seedCommit(project);
      fs.writeFileSync(path.join(project, "app.js"), "console.log('hi');\n");
      fs.writeFileSync(path.join(project, "ajeno.txt"), "someone else's staged work\n");
      // Pre-staged and left clean — before T008 scoped the dirty-check to
      // commit_paths, this alone (tracked, staged, not "??") was enough to
      // populate `dirty` and print the warning for work this command never
      // touched.
      execFileSync("git", ["add", "--", "ajeno.txt"], { cwd: project });

      const errPath = path.join(project, ".stderr-capture");
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
      expect(stderrOutput).not.toContain("tracked files still dirty after commit");
      expect(stderrOutput).toBe("");
    });

    test("still warns when a file inside the commit scope is left genuinely dirty after the commit (safety net is not silently disabled)", () => {
      const project = makeTempProject();
      seedCommit(project);
      fs.writeFileSync(path.join(project, "app.js"), "console.log('hi');\n");
      // A post-commit hook runs synchronously as part of `git commit`
      // returning — squarely inside cmd_commit_slice's own `git commit`
      // call — so it deterministically reproduces "a tracked file left
      // dirty after the commit that included it" (e.g. an omitted --files
      // entry, or a generated file rewritten post-commit) without racing
      // bin/sdd's own git calls.
      fs.writeFileSync(
        path.join(project, ".git", "hooks", "post-commit"),
        "#!/bin/sh\necho '// dirtied after commit' >> app.js\n",
      );
      fs.chmodSync(path.join(project, ".git", "hooks", "post-commit"), 0o755);

      const errPath = path.join(project, ".stderr-capture");
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
      expect(stderrOutput).toContain("warning: tracked files still dirty after commit");
      expect(stderrOutput).toContain("app.js");

      const status = execFileSync("git", ["status", "--porcelain"], {
        cwd: project,
        encoding: "utf8",
      });
      expect(status).toMatch(/M\s+app\.js/);
    });

    // Review fix cycle 2 (cross #1, Fix 5 option (a)): T008 scoped the
    // post-commit warning to commit_paths, which made it structurally
    // unable to catch its original purpose — an omitted --files entry is by
    // definition outside commit_paths. Restored: the check scans the whole
    // index again, like pre-020, but a snapshot of paths already staged
    // BEFORE this invocation's own 'git add' calls run excludes someone
    // else's legitimate pre-existing work (e.g. this repo's own 13
    // pre-staged May-cleanup renames) from tripping it. Both properties in
    // one test: the omission still warns, the unrelated rename does not.
    test("still warns about a genuinely omitted tracked file even with an unrelated rename pre-staged (cross #1)", () => {
      const project = makeTempProject();
      fs.mkdirSync(path.join(project, "specs", "999-other"), { recursive: true });
      fs.writeFileSync(path.join(project, "specs", "999-other", "f.md"), "old\n");
      fs.writeFileSync(path.join(project, "omitted.js"), "console.log('do not forget me');\n");
      seedCommit(project);

      // Someone else's legitimate, unrelated in-flight rename — pre-staged
      // before commit-slice runs, the same shape as this repo's own 13
      // pre-staged May-cleanup renames.
      fs.mkdirSync(path.join(project, "specs", "archive"), { recursive: true });
      execFileSync("git", ["mv", "specs/999-other", "specs/archive/999-other"], { cwd: project });

      // The agent edits a tracked file but forgets to list it in --files.
      fs.appendFileSync(path.join(project, "omitted.js"), "// forgot to stage this\n");
      fs.writeFileSync(path.join(project, "app.js"), "console.log('hi');\n");

      const errPath = path.join(project, ".stderr-capture");
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
      expect(stderrOutput).toContain("warning: tracked files still dirty after commit");
      expect(stderrOutput).toContain("omitted.js");
      expect(stderrOutput).not.toContain("999-other");

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
      fs.writeFileSync(path.join(project, "app.js"), "console.log('hi');\n");

      const errPath = path.join(project, ".stderr-capture");
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
      fs.writeFileSync(path.join(project, "app.js"), "console.log('hi');\n");
      fs.writeFileSync(path.join(project, "ajeno.txt"), "someone else's staged work\n");
      execFileSync("git", ["add", "--", "ajeno.txt"], { cwd: project });

      const errPath = path.join(project, ".stderr-capture");
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
      fs.writeFileSync(path.join(project, "app.js"), "console.log('hi');\n");
      // A HITL decision (or a stray edit) already staged inside the feature
      // dir before commit-slice runs -- exactly the shape AC5 warns about.
      fs.writeFileSync(
        path.join(project, "specs", "001-demo", "tasks.md"),
        "# Tasks\n\n- [x] First behavior\n- [ ] Second behavior\n",
      );
      execFileSync("git", ["add", "--", "specs/001-demo/tasks.md"], { cwd: project });

      const errPath = path.join(project, ".stderr-capture");
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
      // residue for it. (Not asserting the whole status is empty: the
      // stderr-capture file above is itself untracked in this working tree.)
      const status = execFileSync("git", ["status", "--porcelain"], {
        cwd: project,
        encoding: "utf8",
      });
      expect(status).not.toMatch(/tasks\.md/);
    });

    test("both a pre-staged feature-dir file and a genuinely dirty tracked file at once: both warnings fire independently, proving the inclusion-set and exclusion-set checks did not merge (index-state axis, T003)", () => {
      const project = makeTempProject();
      seedCommit(project);
      fs.writeFileSync(path.join(project, "app.js"), "console.log('hi');\n");
      fs.writeFileSync(
        path.join(project, "specs", "001-demo", "tasks.md"),
        "# Tasks\n\n- [x] First behavior\n- [ ] Second behavior\n",
      );
      execFileSync("git", ["add", "--", "specs/001-demo/tasks.md"], { cwd: project });

      // Reuses the post-commit hook trick from the existing dirty-safety-net
      // test to deterministically dirty app.js -- which IS in this
      // invocation's own commit scope, unlike tasks.md above -- right after
      // 'git commit' returns, without racing bin/sdd's own git calls.
      fs.writeFileSync(
        path.join(project, ".git", "hooks", "post-commit"),
        "#!/bin/sh\necho '// dirtied after commit' >> app.js\n",
      );
      fs.chmodSync(path.join(project, ".git", "hooks", "post-commit"), 0o755);

      const errPath = path.join(project, ".stderr-capture");
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

      // New AC5 warning (inclusion set, computed pre-commit): the
      // feature-dir file staged before this invocation ran.
      expect(stderrOutput).toContain("warning: feature dir file(s) already staged before commit-slice ran");
      expect(stderrOutput).toContain("specs/001-demo/tasks.md");

      // Existing safety net (exclusion set, computed post-commit): app.js
      // was inside this commit's own scope and got dirtied again afterward.
      expect(stderrOutput).toContain("warning: tracked files still dirty after commit");
      expect(stderrOutput).toMatch(/tracked files still dirty after commit:\n[^\n]*app\.js/);

      const files = filesInCommit(project, sha);
      expect(files).toContain("app.js");
      expect(files).toContain("specs/001-demo/tasks.md");
    });

    test("--moved-from deletion still lands in a scoped commit, even with an unrelated file pre-staged", () => {
      const project = makeTempProject();
      seedCommit(project);
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

      const error = sddFail(
        ["commit-slice", "001-demo", "--type", "chore", "--title", "Archive 001-demo"],
        { cwd: project },
      );

      expect(error.status).toBe(2);
      expect(error.stderr).toContain("--files");
    });
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

    // sdd-sweep-exempt:start — must name the retired gate's literal strings to explain
    // and then prove a stray leftover sentinel doesn't change the outcome; a proof of
    // removal (of its effect), not a dangling reference.
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
    // sdd-sweep-exempt:end
  });

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
    test("a fresh `sdd init` does not leak this repo's domain vocabulary or model overrides, but still ships the auto-commit policy knob", () => {
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

      // Framework policy (the auto-commit knob, feature 020) still ships — this
      // file was never repo-specific, so it propagates unchanged.
      expect(gitMd).toContain("auto-commit: on|off");
      expect(gitMd).toContain("## Auto-commit");
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
});
