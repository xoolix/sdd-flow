const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..");
const sddBin = path.join(repoRoot, "bin", "sdd");

function makeTempProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sdd-test-"));
  execFileSync("git", ["init", "-q"], { cwd: dir });
  fs.mkdirSync(path.join(dir, "specs", "001-demo"), { recursive: true });
  fs.writeFileSync(path.join(dir, "specs", "001-demo", "spec.md"), "# Spec\n");
  fs.writeFileSync(path.join(dir, "specs", "001-demo", "plan.md"), "# Plan\n");
  fs.writeFileSync(
    path.join(dir, "specs", "001-demo", "tasks.md"),
    "# Tasks\n\n- [ ] First behavior\n- [ ] Second behavior\n",
  );
  return dir;
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

  test("review agents use reviewer plus judge topology", () => {
    expect(fs.existsSync(path.join(repoRoot, ".claude/agents/sdd-reviewer.md"))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, ".claude/agents/sdd-judge.md"))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, ".claude/agents/sdd-reviewer-voter.md"))).toBe(false);
    expect(fs.existsSync(path.join(repoRoot, ".claude/agents/sdd-adversarial-reviewer.md"))).toBe(false);
  });

  test("conversational fast-lane intakes run inline, not as native agents", () => {
    const agentFiles = fs.readdirSync(path.join(repoRoot, ".claude/agents")).filter((file) => /^sdd-.*\.md$/.test(file));

    expect(agentFiles).toHaveLength(10);
    expect(fs.existsSync(path.join(repoRoot, ".claude/agents/sdd-new-fix.md"))).toBe(false);
    expect(fs.existsSync(path.join(repoRoot, ".claude/agents/sdd-new-quick-feature.md"))).toBe(false);

    const newFix = fs.readFileSync(path.join(repoRoot, ".claude/skills/new-fix/SKILL.md"), "utf8");
    const newQuick = fs.readFileSync(path.join(repoRoot, ".claude/skills/new-quick-feature/SKILL.md"), "utf8");
    const sddNew = fs.readFileSync(path.join(repoRoot, ".claude/skills/sdd-new/SKILL.md"), "utf8");

    expect(newFix).toContain("Main Claude executes this skill body inline");
    expect(newQuick).toContain("Main Claude executes this skill body inline");
    expect(newFix).not.toContain("Launch the native agent");
    expect(newQuick).not.toContain("Launch the native agent");
    expect(sddNew).toContain(".claude/skills/new-fix/SKILL.md");
    expect(sddNew).toContain(".claude/skills/new-quick-feature/SKILL.md");
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
