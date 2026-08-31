#!/usr/bin/env node
"use strict";

// Extracts one "## <heading>" section's body from a Markdown file, tracking
// CommonMark 0.31.2 fenced-code-block state (spec.commonmark.org §4.5) so a
// "## "-shaped line inside a fence is never mistaken for a real heading or
// terminator.
//
// Ported out of bin/sdd's `extract_section` awk implementation (see
// decisions.md, 2026-08-31): three rewrites across two features shipped five
// live defects in that one function, all sharing the same mechanical cause.
// The awk scanner could check structural POSITION (delimiter run length,
// indentation, run count) but had no natural way to express full-line
// CONTENT constraints from the grammar -- e.g. "an opening backtick fence's
// info string may not contain a backtick" needs a substring search over the
// rest of the line, and "trailing spaces OR TABS are ignored" needs a
// character class, both awkward in awk and ordinary here. This module keeps
// the two kinds of constraint visibly separate (see the two branches below)
// so the next grammar clause is a JS expression, not a new awk idiom.
//
// Contract callers rely on (bin/sdd's extract_section wrapper, called under
// `set -euo pipefail`): given an existing, readable file, always resolve
// (never throw) regardless of whether the heading is found -- an absent or
// empty section is "" on stdout, exit 0, not a caller-visible error. Both
// `cmd_domain_vocab` and `build_pr_body_file` capture this via command
// substitution with no `|| true` guard, so a non-zero exit here would abort
// the whole script under `set -e`, not degrade gracefully.
//
// WHAT COUNTS AS A FENCE is derived from the grammar, not from the specific
// shapes past bugs happened to hit -- this is the FOURTH design in three
// features, and each prior pass closed exactly the case that had just been
// reproduced live, leaving the next value of the same axis undiscovered
// (decisions.md: review fix cycles 1 and 2, JUDGMENT-DAY-HIGH (1) and (2)).
// The rules, so the next person extends this by reading the spec instead of
// the last bug report:
//   - an opening delimiter is a run of 3+ backticks or 3+ tildes;
//   - the opening may be indented up to 3 spaces -- 4+ spaces is an
//     indented code block, not a fence, and is deliberately left untracked
//     (a heading inside one is NOT protected; this is the documented,
//     intentional boundary of what this scanner treats as a fence);
//   - a backtick fence's info string (the rest of the opening line) may not
//     itself contain a backtick, or the line never opens a fence at all --
//     a tilde fence's info string has no such restriction;
//   - the closer must use the SAME character and a run AT LEAST AS LONG as
//     the opener's (not an exact-length match) -- a 4-backtick line closes
//     a 3-backtick fence, and a 4-backtick fence needs 4+ to close;
//   - the closer's own indentation is checked independently (also up to 3
//     spaces) and need not match the opener's;
//   - a closer may be followed only by spaces or tabs, which are ignored --
//     anything else (an info string included) means it isn't a closer, just
//     fenced content;
//   - `fenceChar`/`fenceLen` is ONE state, not independent per-character
//     toggles: CommonMark closes a fence only with the SAME character, so a
//     `~~~` line while a ``` fence is open is just literal text;
//   - fence state is tracked from line 1 regardless of whether the sought
//     heading has been found yet -- a fence opened in an earlier, unrelated
//     section still gates the heading if still open when that line is
//     reached; an unclosed fence needs no extra code, since `fenceChar`
//     never flipped back holds through EOF, same as real CommonMark.

/**
 * Splits file content into logical lines the way awk's default record
 * splitting (RS="\n") does: a trailing newline ends the last real line
 * without producing a spurious empty one, but a missing trailing newline
 * still yields the final partial line as a record.
 * @param {string} content
 * @returns {string[]}
 */
function splitLines(content) {
  if (content === "") return [];
  const endsWithNewline = content.endsWith("\n");
  const lines = content.split("\n");
  if (endsWithNewline) lines.pop();
  return lines;
}

/**
 * @param {string} content - raw file content; CRLF line endings are
 *   normalized per line (mirrors the awk version's `sub(/\r$/, "")`).
 * @param {string} headingText - heading text WITHOUT the leading "## ".
 * @returns {string} the section body, one trailing "\n" per line (matching
 *   awk `print` semantics) -- "" when the heading is absent, or present but
 *   empty.
 */
function extractSection(content, headingText) {
  const heading = `## ${headingText}`;
  const lines = splitLines(content);

  let found = false;
  let fenceChar = ""; // "`" | "~" | "" (not currently inside a fence)
  let fenceLen = 0;
  const out = [];

  for (const raw of lines) {
    const line = raw.replace(/\r$/, "");

    const indent = (line.match(/^ */) || [""])[0].length;
    const rest = line.slice(indent);

    if (fenceChar === "") {
      // Opening a fence is a POSITION constraint (indentation <=3, a run of
      // >=3 of the same character) gated by a CONTENT constraint for
      // backticks only (§4.5): "If the info string comes after a backtick
      // fence, it may not contain any backtick characters." Tilde fences
      // carry no such restriction -- their info string may contain
      // anything, backticks and tildes included.
      if (indent <= 3) {
        const backtickRun = rest.match(/^`+/);
        if (backtickRun && backtickRun[0].length >= 3) {
          const runLen = backtickRun[0].length;
          const infoString = rest.slice(runLen);
          if (!infoString.includes("`")) {
            fenceChar = "`";
            fenceLen = runLen;
          }
          // else: a backtick in the info string means this line never
          // opens a fence at all -- it stays ordinary content.
        } else {
          const tildeRun = rest.match(/^~+/);
          if (tildeRun && tildeRun[0].length >= 3) {
            fenceChar = "~";
            fenceLen = tildeRun[0].length;
          }
        }
      }
    } else if (indent <= 3) {
      // Closing: same character, run length >= the opener's, and "may be
      // followed only by spaces or tabs, which are ignored" -- strip both
      // (not spaces only) before checking the rest is a pure run of the
      // fence character with nothing else (no info string on a closer).
      const closer = rest.replace(/[ \t]+$/, "");
      if (fenceChar === "`" && /^`+$/.test(closer) && closer.length >= fenceLen) {
        fenceChar = "";
        fenceLen = 0;
      } else if (fenceChar === "~" && /^~+$/.test(closer) && closer.length >= fenceLen) {
        fenceChar = "";
        fenceLen = 0;
      }
    }

    if (fenceChar === "" && line === heading) {
      found = true;
      continue;
    }
    if (found && fenceChar === "" && line.startsWith("## ")) {
      break;
    }
    if (found) {
      out.push(line);
    }
  }

  return out.length ? out.join("\n") + "\n" : "";
}

function main() {
  const [, , filePath, headingText] = process.argv;
  if (!filePath || headingText === undefined) {
    process.stderr.write("usage: extract-section.js <file> <heading>\n");
    process.exitCode = 2;
    return;
  }

  let content;
  try {
    content = require("fs").readFileSync(filePath, "utf8");
  } catch (err) {
    process.stderr.write(`extract-section.js: cannot read ${filePath}: ${err.message}\n`);
    process.exitCode = 1;
    return;
  }

  process.stdout.write(extractSection(content, headingText));
}

if (require.main === module) {
  main();
}

module.exports = { extractSection };
