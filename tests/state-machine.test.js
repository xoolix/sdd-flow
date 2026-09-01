// State-machine harness for 025/T012 (AC12) -- walks `sdd status` through all eight
// phases in order: missing -> spec -> planned -> implementing -> ready-to-simplify
// -> ready-to-review -> reviewed -> archived. Asserts `phase` and `next_command` at
// every step.
//
// HONEST LIMIT (declared here per spec.md's edge case and discovery.md finding A,
// same class of disclosure as this file's sibling tests/sweep-retired-symbols.test.js
// header and the "prose an LLM follows, not executable code" notes throughout
// tests/sdd.test.js's T006/T007/T009/T010/T011 describe blocks):
//
// AC11 originally asked this harness to "run plan->implement->simplify->review->
// archive with mocked envelopes". That is not buildable. Every phase transition in
// this pipeline is executed by an LLM agent reading prose out of a `.md` file --
// bin/sdd itself never advances a phase. detect_feature_phase() (bin/sdd) only READS
// four inputs: archive-folder location, artifact existence, `- [x]` checkbox counts,
// and the `.sdd-state` sentinel file. There is no `runPhase()` a test can call, and
// nothing below invokes one.
//
// So what this file actually proves, and nothing more, is: "does `sdd status` report
// the correct phase, given the file state each phase is DOCUMENTED to leave behind?"
// That is a test of the CLI's reads, driven by fixtures that imitate each agent's
// documented writes -- never a test of any agent's behavior. Each step below is
// marked as one of two things:
//
//   - FIXTURE: a raw fs.* call imitating what an agent's prose instructs it to
//     write (spec.md, plan.md/tasks.md, a checkbox flip, the archive folder move).
//     No agent runs here. This proves `sdd status` reads that shape correctly IF
//     some writer produces it -- never that an agent actually produces it.
//   - REAL CLI: an actual `bin/sdd` subcommand invocation (`sdd branch`,
//     `sdd commit-slice`, `sdd state-write`) -- real code, exercised the same way
//     the rest of this test suite (tests/sdd.test.js) exercises it.
//
// This walk is also the first test to touch the ready-to-review/ready-to-simplify
// sentinel-freshness fork at all: before 025, `grep 'ready-to-review|sentinel_fresh|
// git-head' tests/sdd.test.js` returned zero hits (discovery.md finding B). Both
// halves of that fork are exercised here -- an uncommitted edit (tree-digest drifts,
// git-head does not) and a new commit (git-head moves) -- as part of the walk, not as
// a parallel test, per the T012 task description.

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..");
const sddBin = path.join(repoRoot, "bin", "sdd");

// No jest.config.* and no "jest" key in package.json (discovery.md finding H) means
// the 5000ms default per-test timeout applies. This walk chains ~30 execFileSync
// calls (git init/config, sdd branch, two commit-slice calls, three state-write
// calls, several sdd status reads) against a fresh temp repo -- comfortably over
// 5000ms on a loaded machine. Set explicitly rather than left to the default.
jest.setTimeout(30000);

const FEATURE_ID = "099-state-walk";

// A bare project with no feature directory at all -- unlike tests/sdd.test.js's own
// makeTempProject(), which pre-seeds specs/001-demo with spec.md/plan.md/tasks.md
// already in place (that fixture starts at "planned", past the two phases this walk
// needs to visit first). .gitignore is written and committed BEFORE anything else:
// skipping this makes .sdd-state an untracked file the instant `sdd state-write`
// creates it, which self-invalidates the very digest it just recorded (025/T005's
// documented trap), and also makes T001's hardened commit-slice refuse every commit
// below over an undeclared, un-ignored file.
function makeBareProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sdd-state-machine-"));
  execFileSync("git", ["init", "-q"], { cwd: dir });
  execFileSync("git", ["config", "user.email", "sdd-test@example.com"], { cwd: dir });
  execFileSync("git", ["config", "user.name", "SDD Test"], { cwd: dir });
  execFileSync("git", ["config", "commit.gpgsign", "false"], { cwd: dir });
  fs.writeFileSync(
    path.join(dir, ".gitignore"),
    "specs/**/.parent-branch\nspecs/**/.sdd-state\n",
  );
  execFileSync("git", ["add", "-A"], { cwd: dir });
  execFileSync("git", ["commit", "-q", "-m", "seed: bare repo"], { cwd: dir });
  return dir;
}

function status(project, featureId) {
  return JSON.parse(
    execFileSync(sddBin, ["status", featureId], { cwd: project, encoding: "utf8" }),
  );
}

describe("state-machine harness: sdd status across all eight phases (025/T012/AC12)", () => {
  test("missing -> spec -> planned -> implementing -> ready-to-simplify -> ready-to-review -> reviewed -> archived", () => {
    const project = makeBareProject();
    const featureDir = path.join(project, "specs", FEATURE_ID);

    // ── 1. missing ──────────────────────────────────────────────────
    // FIXTURE: an empty specs/<id>/ directory with no spec.md and no
    // quick-spec.md -- the shape /sdd-new leaves behind before anything is
    // written. (resolve_feature_dir requires the directory to exist for
    // `sdd status <id>` to resolve at all; a wholly absent directory is a
    // different, already-covered error path -- "feature not found", not a
    // phase.)
    fs.mkdirSync(featureDir, { recursive: true });

    let s = status(project, FEATURE_ID);
    expect(s.phase).toBe("missing");
    expect(s.next_command).toBe("/sdd-new");

    // ── 2. spec ──────────────────────────────────────────────────────
    // FIXTURE: /new-feature (or /sdd-new's full-lane intake) writes spec.md
    // and stops there -- plan.md/tasks.md do not exist yet.
    fs.writeFileSync(path.join(featureDir, "spec.md"), "# Spec\n");

    s = status(project, FEATURE_ID);
    expect(s.phase).toBe("spec");
    expect(s.next_command).toBe(`/plan-feature ${FEATURE_ID}`);

    // ── 3. planned ───────────────────────────────────────────────────
    // FIXTURE: /plan-feature writes plan.md and tasks.md, all slices
    // unchecked -- the shape before any /implement-task run.
    fs.writeFileSync(path.join(featureDir, "plan.md"), "# Plan\n");
    fs.writeFileSync(
      path.join(featureDir, "tasks.md"),
      "# Tasks\n\n- [ ] First behavior\n- [ ] Second behavior\n",
    );

    s = status(project, FEATURE_ID);
    expect(s.phase).toBe("planned");
    expect(s.next_command).toBe(`/implement-task ${FEATURE_ID}`);

    // ── 4. implementing ──────────────────────────────────────────────
    // REAL CLI: `sdd branch` -- every /implement-task run starts by ensuring
    // the feature branch exists (.claude/rules/git.md's convention); T004
    // requires commit-slice below to run on exactly `feature/<id>`.
    execFileSync(sddBin, ["branch", FEATURE_ID], { cwd: project, encoding: "utf8" });

    // FIXTURE: the checkbox flip for the first task is a raw file write, the
    // same as /implement-task's Step 6 editing tasks.md by hand.
    fs.writeFileSync(
      path.join(featureDir, "tasks.md"),
      "# Tasks\n\n- [x] First behavior\n- [ ] Second behavior\n",
    );
    // A stand-in for the slice's actual code change -- commit-slice's
    // undeclared-file check (T001/AC1) requires every new file to be
    // declared via --files, so this cannot be omitted even though this
    // harness doesn't care about the file's content.
    fs.writeFileSync(path.join(project, "t001-change.txt"), "slice T001 change\n");

    // REAL CLI: the slice commit. Mirrors /implement-task's own commit-slice
    // call shape (tests/sdd.test.js's commit-slice describe block).
    execFileSync(
      sddBin,
      [
        "commit-slice",
        FEATURE_ID,
        "--type",
        "feat",
        "--task",
        "T001",
        "--title",
        "First behavior",
        "--files",
        "t001-change.txt",
      ],
      { cwd: project, encoding: "utf8" },
    );

    s = status(project, FEATURE_ID);
    expect(s.phase).toBe("implementing");
    expect(s.next_command).toBe(`/implement-task ${FEATURE_ID}`);

    // ── 5. ready-to-simplify ─────────────────────────────────────────
    // FIXTURE + REAL CLI, same shape as step 4, for the second and last task.
    fs.writeFileSync(
      path.join(featureDir, "tasks.md"),
      "# Tasks\n\n- [x] First behavior\n- [x] Second behavior\n",
    );
    fs.writeFileSync(path.join(project, "t002-change.txt"), "slice T002 change\n");
    execFileSync(
      sddBin,
      [
        "commit-slice",
        FEATURE_ID,
        "--type",
        "feat",
        "--task",
        "T002",
        "--title",
        "Second behavior",
        "--files",
        "t002-change.txt",
      ],
      { cwd: project, encoding: "utf8" },
    );

    s = status(project, FEATURE_ID);
    expect(s.phase).toBe("ready-to-simplify");
    expect(s.next_command).toBe(`/simplify-code ${FEATURE_ID}`);
    expect(s.sentinel_fresh).toBe(false); // no .sdd-state written yet

    // ── 6. ready-to-review ───────────────────────────────────────────
    // REAL CLI: /simplify-code's own final step -- `sdd state-write --phase
    // ready-to-review`. All tasks are done and the sentinel is fresh
    // (git-head and tree-digest both match what was just written).
    execFileSync(
      sddBin,
      ["state-write", FEATURE_ID, "--phase", "ready-to-review"],
      { cwd: project, encoding: "utf8" },
    );

    s = status(project, FEATURE_ID);
    expect(s.phase).toBe("ready-to-review");
    expect(s.next_command).toBe(`/review-feature ${FEATURE_ID}`);
    expect(s.sentinel_fresh).toBe(true);

    // ── 6a. freshness fork, branch 1: uncommitted edit (V6) ───────────
    // The branch with zero coverage before 025 (discovery.md finding B):
    // tree-digest is computed over the WHOLE working tree, so editing any
    // tracked file without committing changes the digest while git-head
    // stays put. A git-head-only check (the old .simplified behaviour)
    // would miss this entirely.
    fs.appendFileSync(path.join(featureDir, "spec.md"), "\nUncommitted edit.\n");

    s = status(project, FEATURE_ID);
    expect(s.phase).not.toBe("ready-to-review");
    expect(s.phase).toBe("ready-to-simplify"); // stale sentinel falls back, per detect_feature_phase
    expect(s.sentinel_fresh).toBe(false);

    // Revert the uncommitted edit (undoes the only thing that changed) --
    // tree-digest now matches the stored sentinel again with no re-write
    // needed, proving the check is a live comparison, not a one-shot flag.
    execFileSync("git", ["checkout", "--", "specs/" + FEATURE_ID + "/spec.md"], {
      cwd: project,
      encoding: "utf8",
    });

    s = status(project, FEATURE_ID);
    expect(s.phase).toBe("ready-to-review");
    expect(s.sentinel_fresh).toBe(true);

    // ── 6b. freshness fork, branch 2: a new commit (git-head moves) ───
    // `--allow-empty` stages nothing, so the tree is byte-identical to what
    // is already recorded -- this isolates the git-head equality check from
    // the tree-digest check exercised above; either mismatch alone must
    // invalidate the sentinel.
    execFileSync("git", ["commit", "--allow-empty", "-q", "-m", "advance head only"], {
      cwd: project,
    });

    s = status(project, FEATURE_ID);
    expect(s.phase).not.toBe("ready-to-review");
    expect(s.sentinel_fresh).toBe(false);

    // REAL CLI: re-seal against the new HEAD so the walk can continue --
    // exactly what a real pipeline run does the next time /simplify-code (or
    // here, moving straight on to review) completes after any change.
    execFileSync(
      sddBin,
      ["state-write", FEATURE_ID, "--phase", "ready-to-review"],
      { cwd: project, encoding: "utf8" },
    );

    s = status(project, FEATURE_ID);
    expect(s.phase).toBe("ready-to-review");
    expect(s.sentinel_fresh).toBe(true);

    // ── 7. reviewed ──────────────────────────────────────────────────
    // REAL CLI: /review-feature's Step 4 -- `sdd state-write --phase
    // reviewed --verdict PASS`.
    execFileSync(
      sddBin,
      ["state-write", FEATURE_ID, "--phase", "reviewed", "--verdict", "PASS"],
      { cwd: project, encoding: "utf8" },
    );

    s = status(project, FEATURE_ID);
    expect(s.phase).toBe("reviewed");
    expect(s.next_command).toBe(`/archive-feature ${FEATURE_ID}`);
    expect(s.sentinel_fresh).toBe(true);

    // ── 8. archived ──────────────────────────────────────────────────
    // FIXTURE: sdd-archive-feature.md's Step 3 -- a plain filesystem move,
    // no git awareness. The receipt travels with the folder untouched.
    const archiveDir = path.join(project, "specs", "archive", `2099-01-01-${FEATURE_ID}`);
    fs.mkdirSync(path.join(project, "specs", "archive"), { recursive: true });
    fs.renameSync(featureDir, archiveDir);

    // REAL CLI: Step 3.5's exact call shape -- no --files, since no delta
    // merge happened, just the move.
    execFileSync(
      sddBin,
      [
        "commit-slice",
        FEATURE_ID,
        "--type",
        "chore",
        "--title",
        `Archive ${FEATURE_ID}`,
        "--moved-from",
        `specs/${FEATURE_ID}`,
      ],
      { cwd: project, encoding: "utf8" },
    );

    // FIXTURE: Step 3.5's "on success" instruction -- delete the receipt
    // only now, after the commit lands (T007's ordering decision: deleting
    // it before a successful commit would leave an archived-looking folder
    // with no receipt at all if the commit failed).
    fs.rmSync(path.join(archiveDir, ".sdd-state"), { force: true });

    s = status(project, FEATURE_ID);
    expect(s.phase).toBe("archived");
    expect(s.next_command).toBe("(none — feature archived)");
  });
});
