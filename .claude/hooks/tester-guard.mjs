// PreToolUse guard for the `tester` agent: only allows file writes inside tests/
// (or *.test.ts / *.spec.ts files). Exit code 2 blocks the tool call.
import path from "node:path";

let raw = "";
for await (const chunk of process.stdin) raw += chunk;

let input;
try {
  input = JSON.parse(raw);
} catch {
  console.error("tester-guard: invalid hook input, blocking by default.");
  process.exit(2);
}

const target = input?.tool_input?.file_path ?? input?.tool_input?.notebook_path;
if (!target) process.exit(0);

const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
const rel = path.relative(root, path.resolve(root, target)).split(path.sep).join("/");

const insideRepo = !rel.startsWith("..") && !path.isAbsolute(rel);
const allowed = insideRepo && (rel.startsWith("tests/") || /\.(test|spec)\.[cm]?[jt]sx?$/.test(rel));

if (!allowed) {
  console.error(
    `tester-guard: the tester agent may only create/modify tests (tests/** or *.test.ts). Blocked: ${rel}. ` +
      `Report the needed change instead of making it.`,
  );
  process.exit(2);
}
process.exit(0);
