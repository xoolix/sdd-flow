const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { extractSection } = require("../src/extract-section");

const scriptPath = path.resolve(__dirname, "..", "src", "extract-section.js");

// Direct unit tests of src/extract-section.js's pure `extractSection`
// function -- no `source bin/sdd`, no spawned bash process, no temp git
// repo. This is the win the Node move was chosen for (decisions.md,
// 2026-08-31): a source-and-call test mirrors the implementation's own call
// shape rather than exercising a public interface (feature 022's gotcha);
// requiring the module and calling it is the module's real public
// interface. bin/sdd's `extract_section` wrapper and its two real
// consumers (cmd_domain_vocab, build_pr_body_file) keep their own
// end-to-end coverage in tests/sdd.test.js -- this file does not replace
// that, it removes the need for every grammar case to pay for a bash
// process and a temp git repo just to prove the matcher itself is right.
//
// Coverage here ports tests/sdd.test.js's "CommonMark fence grammar"
// describe blocks (T002 / AC4 / AC8) plus review fix cycle 2's two new
// defects (judge findings #6 and #7), against spec.commonmark.org 0.31.2
// §4.5.

function extractionOf(lines) {
  return extractSection(lines.join("\n") + "\n", "Heading");
}

describe("extractSection", () => {
  describe("heading matching", () => {
    test("returns everything between the heading and the next '## ' heading", () => {
      const result = extractionOf(["# Title", "## Heading", "line one", "line two", "## Next"]);
      expect(result).toBe("line one\nline two\n");
    });

    test("heading absent: returns empty string", () => {
      const result = extractSection("# Title\n## Other\ncontent\n", "Heading");
      expect(result).toBe("");
    });

    test("heading present with no content before the next heading: returns empty string", () => {
      const result = extractionOf(["## Heading", "## Next"]);
      expect(result).toBe("");
    });

    test("heading at end of file with no following heading: returns content through EOF", () => {
      const result = extractionOf(["## Heading", "line one", "line two"]);
      expect(result).toBe("line one\nline two\n");
    });

    test("requires an exact '## <heading>' match, not a prefix", () => {
      const result = extractSection("## Heading Extra\ncontent\n## Heading\nreal\n", "Heading");
      expect(result).toBe("real\n");
    });

    test("a heading-shaped line inside a fence is not recognized as the section start", () => {
      const content = ["# Title", "```", "## Heading", "fenced, not real", "```", "no real section here"].join(
        "\n",
      );
      expect(extractSection(content, "Heading")).toBe("");
    });

    test("a heading-shaped line inside a fence, plus a real section afterward: only the real section resolves", () => {
      const content = [
        "```",
        "## Heading",
        "fenced, not real",
        "```",
        "## Heading",
        "the real content",
        "## Next",
      ].join("\n");
      expect(extractSection(content, "Heading")).toBe("the real content\n");
    });
  });

  describe("fence tracking — position constraints", () => {
    test("no fence at all: unaffected", () => {
      const result = extractionOf(["## Heading", "plain content", "## Next"]);
      expect(result).toBe("plain content\n");
    });

    test("a '## '-shaped line inside a ``` fence does not terminate the section", () => {
      const result = extractionOf([
        "## Heading",
        "before",
        "```",
        "## looks like a heading",
        "still fenced",
        "```",
        "after",
        "## Next",
      ]);
      expect(result).toBe("before\n```\n## looks like a heading\nstill fenced\n```\nafter\n");
    });

    test("a '## '-shaped line inside a ~~~ fence does not terminate the section", () => {
      const result = extractionOf([
        "## Heading",
        "before",
        "~~~",
        "## looks like a heading",
        "still fenced",
        "~~~",
        "after",
        "## Next",
      ]);
      expect(result).toBe("before\n~~~\n## looks like a heading\nstill fenced\n~~~\nafter\n");
    });

    test("a literal '~~~' line inside an open ``` fence is content, not a closer -- the ``` fence stays open", () => {
      const result = extractionOf(["## Heading", "```", "~~~", "## still fenced", "```", "after", "## Next"]);
      expect(result).toBe("```\n~~~\n## still fenced\n```\nafter\n");
    });

    test("a literal '```' line inside an open ~~~ fence is content, not a closer -- the ~~~ fence stays open", () => {
      const result = extractionOf(["## Heading", "~~~", "```", "## still fenced", "~~~", "after", "## Next"]);
      expect(result).toBe("~~~\n```\n## still fenced\n~~~\nafter\n");
    });

    test("an unclosed fence: content stays included through EOF, including a heading-shaped line", () => {
      const result = extractionOf(["## Heading", "```", "content", "## looks like a heading, still fenced"]);
      expect(result).toBe("```\ncontent\n## looks like a heading, still fenced\n");
    });

    test("a fence opened before the heading and still open when the heading line is reached: heading is not recognized", () => {
      const content = ["```", "## Heading", "content"].join("\n");
      expect(extractSection(content, "Heading")).toBe("");
    });

    test("a fence indented 1, 2, or 3 spaces is still tracked", () => {
      for (const indent of [" ", "  ", "   "]) {
        const result = extractionOf(["## Heading", `${indent}\`\`\``, "## fenced", `${indent}\`\`\``, "after", "## Next"]);
        expect(result).toBe(`${indent}\`\`\`\n## fenced\n${indent}\`\`\`\nafter\n`);
      }
    });

    test("a fence marker indented 4 spaces is NOT tracked (CommonMark: that's an indented code block)", () => {
      const content = ["## Heading", "    ```", "## Next"].join("\n");
      // The 4-space-indented ``` never opens a fence, so "## Next" (itself
      // unindented) terminates normally.
      expect(extractSection(content, "Heading")).toBe("    ```\n");
    });

    test("a closing run longer than the opening also closes: a 3-backtick fence is closed by 4 backticks", () => {
      const result = extractionOf(["## Heading", "```", "content", "````", "after", "## Next"]);
      expect(result).toBe("```\ncontent\n````\nafter\n");
    });

    test("a 4-backtick fence tolerates an inner triple-backtick line as content", () => {
      const result = extractionOf(["## Heading", "````", "```", "## still fenced", "````", "after", "## Next"]);
      expect(result).toBe("````\n```\n## still fenced\n````\nafter\n");
    });

    test("tilde mirror: a 4-tilde fence tolerates an inner triple-tilde line as content", () => {
      const result = extractionOf(["## Heading", "~~~~", "~~~", "## still fenced", "~~~~", "after", "## Next"]);
      expect(result).toBe("~~~~\n~~~\n## still fenced\n~~~~\nafter\n");
    });

    test("a closing fence indented differently from the opening still closes (each line's indentation is independent)", () => {
      const result = extractionOf(["## Heading", "```", "content", "  ```", "after", "## Next"]);
      expect(result).toBe("```\ncontent\n  ```\nafter\n");
    });

    test("a fence opened with an info string (```js) is still closed by a bare ```", () => {
      const result = extractionOf(["## Heading", "```js", "## fenced", "```", "after", "## Next"]);
      expect(result).toBe("```js\n## fenced\n```\nafter\n");
    });

    test("tilde equivalent: an info string (~~~js) is still closed by a bare ~~~", () => {
      const result = extractionOf(["## Heading", "~~~js", "## fenced", "~~~", "after", "## Next"]);
      expect(result).toBe("~~~js\n## fenced\n~~~\nafter\n");
    });

    test("a line that looks like a closer but carries an info string does not close -- only a bare run does", () => {
      const result = extractionOf(["## Heading", "```", "content", "```js", "still fenced", "```", "after", "## Next"]);
      expect(result).toBe("```\ncontent\n```js\nstill fenced\n```\nafter\n");
    });

    test("tilde mirror: a closer carrying an info string does not close -- only a bare tilde run does", () => {
      const result = extractionOf(["## Heading", "~~~", "content", "~~~js", "still fenced", "~~~", "after", "## Next"]);
      expect(result).toBe("~~~\ncontent\n~~~js\nstill fenced\n~~~\nafter\n");
    });
  });

  describe("fence tracking — line endings (CRLF)", () => {
    test("CRLF line endings extract cleanly, with no stray '\\r' in the output", () => {
      const content = "## Heading\r\nline one\r\n## Next\r\n";
      expect(extractSection(content, "Heading")).toBe("line one\n");
    });

    test("CRLF does not defeat fence tracking", () => {
      const content = "## Heading\r\n```\r\n## still fenced\r\n```\r\nafter\r\n## Next\r\n";
      expect(extractSection(content, "Heading")).toBe("```\n## still fenced\n```\nafter\n");
    });

    test("a file with no trailing final newline still extracts the last line", () => {
      const content = "## Heading\nlast line, no trailing newline";
      expect(extractSection(content, "Heading")).toBe("last line, no trailing newline\n");
    });
  });

  // Review fix cycle 2 (JUDGMENT-DAY-HIGH (2)) -- two defects the judge and
  // reviewer independently reproduced against spec.commonmark.org 0.31.2
  // §4.5, after review fix cycle 1's rewrite closed the earlier indented-
  // fence and 4+-backtick findings.
  describe("review fix cycle 2 — CONTENT constraints (judge findings #6, #7)", () => {
    test("judge #6: a backtick in a backtick fence's info string means the line never opens a fence", () => {
      const result = extractionOf(["## Heading", "before", "```code`example", "## Next"]);
      // Not a fence opener at all -- "```code`example" is ordinary content,
      // and the real "## Next" (unindented, outside any fence) terminates.
      expect(result).toBe("before\n```code`example\n");
    });

    test("judge #6 control: a backtick-free info string still opens a fence normally", () => {
      const result = extractionOf(["## Heading", "```code-example", "## still fenced", "```", "after", "## Next"]);
      expect(result).toBe("```code-example\n## still fenced\n```\nafter\n");
    });

    test("judge #6 does not apply to tilde fences: a tilde info string may contain backticks", () => {
      const result = extractionOf(["## Heading", "~~~code`example", "## still fenced", "~~~", "after", "## Next"]);
      expect(result).toBe("~~~code`example\n## still fenced\n~~~\nafter\n");
    });

    test("judge #6 does not apply to tilde fences: a tilde info string may contain tildes too", () => {
      const result = extractionOf(["## Heading", "~~~code~example", "## still fenced", "~~~", "after", "## Next"]);
      expect(result).toBe("~~~code~example\n## still fenced\n~~~\nafter\n");
    });

    test("judge #7: a closing ``` line followed by a trailing tab still closes the fence", () => {
      const result = extractionOf(["## Heading", "```", "fenced", "```\t", "after", "## Next"]);
      expect(result).toBe("```\nfenced\n```\t\nafter\n");
    });

    test("judge #7: a closing ~~~ line followed by a trailing tab still closes the fence", () => {
      const result = extractionOf(["## Heading", "~~~", "fenced", "~~~\t", "after", "## Next"]);
      expect(result).toBe("~~~\nfenced\n~~~\t\nafter\n");
    });

    test("judge #7: a closer followed by a mix of trailing spaces and tabs still closes", () => {
      const result = extractionOf(["## Heading", "```", "fenced", "``` \t \t", "after", "## Next"]);
      expect(result).toBe("```\nfenced\n``` \t \t\nafter\n");
    });

    test("judge #7 control: a leading tab before the closer's run is not recognized as indentation, so the fence never closes", () => {
      // A tab BEFORE the delimiter run is not spaces-only indentation
      // (pre-existing, out-of-scope limitation shared with the awk
      // version, ported unchanged) -- pinned here as a control so it's
      // visibly distinct from judge #7's TRAILING-tab fix above, not a
      // claim that this input shape is handled ideally. An unclosed fence
      // swallows content through EOF, including "## Next".
      const result = extractionOf(["## Heading", "```", "fenced", "\t```", "after", "## Next"]);
      expect(result).toBe("```\nfenced\n\t```\nafter\n## Next\n");
    });
  });
});

// The CLI entry point (`main()`) has its own two error branches, exercised
// here via a real spawned `node` process (the module's actual public
// interface when invoked from bin/sdd's extract_section wrapper) rather
// than by calling `main()` in-process -- neither had test coverage before
// this (review fix cycle 3, added alongside the build_pr_body_file fix
// while already in this file). Both branches are pre-existing, correct
// behavior -- this is coverage only, not a bug fix.
describe("extract-section.js CLI", () => {
  test("missing arguments (no file, no heading) exits 2 with a usage message on stderr", () => {
    let error;
    try {
      execFileSync("node", [scriptPath], { encoding: "utf8" });
    } catch (err) {
      error = err;
    }
    expect(error).toBeDefined();
    expect(error.status).toBe(2);
    expect(error.stderr).toBe("usage: extract-section.js <file> <heading>\n");
  });

  test("a file argument with no heading argument also exits 2 with the same usage message", () => {
    let error;
    try {
      execFileSync("node", [scriptPath, "/some/file.md"], { encoding: "utf8" });
    } catch (err) {
      error = err;
    }
    expect(error).toBeDefined();
    expect(error.status).toBe(2);
    expect(error.stderr).toBe("usage: extract-section.js <file> <heading>\n");
  });

  test("an unreadable file exits 1 and names the file on stderr", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "extract-section-cli-"));
    const filePath = path.join(dir, "spec.md");
    fs.writeFileSync(filePath, "## Heading\ncontent\n");
    fs.chmodSync(filePath, 0o000);

    let error;
    try {
      execFileSync("node", [scriptPath, filePath, "Heading"], { encoding: "utf8" });
    } catch (err) {
      error = err;
    } finally {
      fs.chmodSync(filePath, 0o644);
    }

    expect(error).toBeDefined();
    expect(error.status).toBe(1);
    expect(error.stderr).toContain(filePath);
    expect(error.stderr).toContain("cannot read");
  });

  test("an existing, readable file with a present heading exits 0 and prints the section on stdout", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "extract-section-cli-"));
    const filePath = path.join(dir, "spec.md");
    fs.writeFileSync(filePath, "## Heading\ncontent\n## Next\n");

    const stdout = execFileSync("node", [scriptPath, filePath, "Heading"], { encoding: "utf8" });

    expect(stdout).toBe("content\n");
  });
});
