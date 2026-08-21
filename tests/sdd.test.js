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

describe("sdd CLI smoke tests", () => {
  test("prints version", () => {
    const output = execFileSync(sddBin, ["version"], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    expect(output.trim()).toMatch(/^sdd v\d+\.\d+\.\d+$/);
  });

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
    expect(gitMd).toContain("sdd commit-slice");
    expect(gitMd).toContain("Nothing is pushed during development");

    // The human-confirmed PR gate.
    expect(gitMd).toContain("sdd open-pr <feature-id>");
    expect(gitMd).toContain("draft");

    // Auto-commit knob, mirroring testing.md's tdd: knob shape.
    expect(gitMd).toContain("auto-commit: on|off");
    expect(gitMd).toContain("auto-commit: off");

    // Commit style now documents the conventional-commit format sdd commit-slice produces.
    expect(gitMd).toContain("<type>(<feature-id>): [Tnnn ]<title>");

    // Untouched section stays intact.
    expect(gitMd).toContain("## Base branch resolution");
  });

  test("simplify-code commits before writing the sentinel and gitignores .simplified but not .pr-opened (T007)", () => {
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

    // .simplified is gitignored (same sentinel-commit hazard the ordering rule above guards against);
    // .pr-opened must stay tracked — it is the durable PR-URL record, not a self-invalidating sentinel.
    expect(gitignore).toContain("specs/**/.simplified");
    expect(gitignore).not.toContain(".pr-opened");
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
  });

  describe("sdd open-pr", () => {
    // Filters the current PATH down to directories that do NOT contain a `gh`
    // executable, so the pre-flight "gh present on PATH" check deterministically
    // fails without depending on this machine's real gh auth state (AC6).
    function pathWithoutGh() {
      const dirs = (process.env.PATH || "").split(path.delimiter);
      return dirs
        .filter((dir) => {
          try {
            fs.accessSync(path.join(dir, "gh"), fs.constants.X_OK);
            return false;
          } catch {
            return true;
          }
        })
        .join(path.delimiter);
    }

    // A real local bare repo used as "origin" so a push can be verified to have
    // (not) happened by inspecting its refs, without touching any network.
    function makeBareRemote() {
      const remoteDir = fs.mkdtempSync(path.join(os.tmpdir(), "sdd-remote-"));
      execFileSync("git", ["init", "--bare", "-q", remoteDir]);
      return remoteDir;
    }

    test("exits non-zero and prints usage when feature-id is missing", () => {
      const project = makeTempProject();

      const error = sddFail(["open-pr"], { cwd: project });

      expect(error.status).toBe(2);
      expect(error.stderr).toContain("open-pr");
    });

    test("exits 3 and prints the manual command when not on the feature branch", () => {
      const project = makeTempProject();
      seedCommit(project);
      // Never switched to feature/001-demo — still on the default branch.

      const error = sddFail(["open-pr", "001-demo"], { cwd: project });

      expect(error.status).toBe(3);
      expect(error.stderr).toContain("feature/001-demo");
      expect(error.stderr).toContain("git push -u origin HEAD");
      expect(error.stderr).toContain("gh pr create --draft");
      expect(fs.existsSync(path.join(project, "specs", "001-demo", ".pr-opened"))).toBe(false);
    });

    test("exits 3, pushes nothing, and writes no sentinel when gh is absent from PATH (AC6)", () => {
      const project = makeTempProject();
      seedCommit(project);
      execFileSync(sddBin, ["branch", "001-demo"], { cwd: project, encoding: "utf8" });
      const remoteDir = makeBareRemote();
      execFileSync("git", ["remote", "add", "origin", remoteDir], { cwd: project });

      const error = sddFail(["open-pr", "001-demo"], {
        cwd: project,
        env: { ...process.env, PATH: pathWithoutGh() },
      });

      expect(error.status).toBe(3);
      expect(error.stderr.toLowerCase()).toContain("gh");
      expect(error.stderr).toContain("git push -u origin HEAD");
      expect(error.stderr).toContain("gh pr create --draft");

      // No push happened — the bare remote has no refs at all.
      const remoteRefs = execFileSync("git", ["ls-remote", remoteDir], { encoding: "utf8" }).trim();
      expect(remoteRefs).toBe("");

      expect(fs.existsSync(path.join(project, "specs", "001-demo", ".pr-opened"))).toBe(false);
    });

    test("exits 3 and reports feature not found when the feature dir cannot be resolved", () => {
      const project = makeTempProject();
      seedCommit(project);
      execFileSync(sddBin, ["branch", "999-missing"], { cwd: project, encoding: "utf8" });

      const error = sddFail(["open-pr", "999-missing"], { cwd: project });

      expect(error.status).toBe(3);
      expect(error.stderr).toContain("feature not found");
    });
  });

  describe("sdd status — archived vs ready-to-pr (T004)", () => {
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

    test("reports ready-to-pr for an archived feature with no .pr-opened sentinel", () => {
      const project = makeTempProject();
      archiveFeature(project);

      const output = execFileSync(sddBin, ["status", "001-demo"], {
        cwd: project,
        encoding: "utf8",
      });

      const status = JSON.parse(output);
      expect(status).toMatchObject({
        feature_id: "001-demo",
        phase: "ready-to-pr",
        next_command: "sdd open-pr 001-demo",
      });
    });

    test("still reports archived when .pr-opened is present in the archived dir", () => {
      const project = makeTempProject();
      const archiveDir = archiveFeature(project);
      fs.writeFileSync(path.join(archiveDir, ".pr-opened"), "url: https://example.com/pr/1\n");

      const output = execFileSync(sddBin, ["status", "001-demo"], {
        cwd: project,
        encoding: "utf8",
      });

      const status = JSON.parse(output);
      expect(status).toMatchObject({
        feature_id: "001-demo",
        phase: "archived",
        next_command: "(none — feature archived)",
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
});
