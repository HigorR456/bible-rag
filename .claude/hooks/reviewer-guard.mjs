// PreToolUse guard for the `reviewer` agent: allows only read-only Bash commands.
// Allowlist approach: every command in a pipeline/chain must be explicitly permitted.
// Exit code 2 blocks the tool call (stderr is shown to the agent).

let raw = "";
for await (const chunk of process.stdin) raw += chunk;

let input;
try {
  input = JSON.parse(raw);
} catch {
  block("invalid hook input, blocking by default.");
}

const command = input?.tool_input?.command;
if (typeof command !== "string" || !command.trim()) process.exit(0);

function block(reason) {
  console.error(
    `reviewer-guard: blocked (${reason}). The reviewer agent is read-only and may only run: ` +
      `git read-only commands, npm test / npm run typecheck|test|validate, npx vitest run, ` +
      `and simple inspection tools (ls, cat, head, tail, wc, grep, rg, find, sort, uniq, diff, pwd). ` +
      `Report the needed change instead of making it.`,
  );
  process.exit(2);
}

// ---- Tokenizer: splits into segments (separated by ; & | && || newline) -------------
const segments = [[]];
let word = "";
let hasWord = false;
let quote = null; // "'" | '"' | null

const pushWord = () => {
  if (hasWord) segments.at(-1).push(word);
  word = "";
  hasWord = false;
};
const newSegment = () => {
  pushWord();
  if (segments.at(-1).length) segments.push([]);
};

for (let i = 0; i < command.length; i++) {
  const c = command[i];

  if (quote === "'") {
    if (c === "'") quote = null;
    else word += c;
    continue;
  }
  if (quote === '"') {
    if (c === '"') quote = null;
    else if (c === "`" || (c === "$" && command[i + 1] === "(")) block("command substitution");
    else if (c === "\\" && i + 1 < command.length) word += command[++i];
    else word += c;
    continue;
  }

  if (c === "'" || c === '"') {
    quote = c;
    hasWord = true;
    continue;
  }
  if (c === "`" || (c === "$" && command[i + 1] === "(")) block("command substitution");
  if (c === "\\" && i + 1 < command.length) {
    word += command[++i];
    hasWord = true;
    continue;
  }
  if (c === "\n" || c === ";" || c === "|" || c === "&") {
    // `2>&1` is consumed in the redirect branch below, so a bare & here is a separator/background op.
    newSegment();
    continue;
  }
  if (c === ">") {
    const rest = command.slice(i);
    const m = rest.match(/^>>?\s*\/dev\/null(?![\w/.-])/) || rest.match(/^>&[12](?!\d)/);
    if (!m) block("output redirection / writing to a file");
    if (/^\d$/.test(word)) {
      word = "";
      hasWord = false;
    } else pushWord();
    i += m[0].length - 1;
    continue;
  }
  if (c === "<" && command[i + 1] === "(") block("process substitution");
  if (/\s/.test(c)) {
    pushWord();
    continue;
  }
  word += c;
  hasWord = true;
}
if (quote) block("unterminated quote");
pushWord();

// ---- Per-command rules ---------------------------------------------------------------
const GIT_OK = new Set([
  "status", "diff", "log", "show", "blame", "ls-files", "ls-tree", "rev-parse", "rev-list",
  "cat-file", "shortlog", "merge-base", "describe", "grep", "diff-tree", "show-ref", "whoami",
]);
const NPM_RUN_OK = new Set(["typecheck", "test", "validate"]);
const SIMPLE_OK = new Set([
  "ls", "cat", "head", "tail", "wc", "grep", "rg", "find", "sort", "uniq", "diff", "pwd",
]);
const FIND_BAD = new Set(["-delete", "-exec", "-execdir", "-ok", "-okdir", "-fprint", "-fprint0", "-fprintf", "-fls"]);
const SECRET_FILE = /(^|[\\/])(\.env(\..*)?|\.dev\.vars(\..*)?)$/;
const UPDATE_FLAGS = new Set(["-u", "--update", "--updateSnapshot"]);

for (const tokens of segments) {
  if (!tokens.length) continue;
  const [cmd, ...args] = tokens;

  for (const t of tokens) if (SECRET_FILE.test(t)) block(`secret file access: ${t}`);

  if (cmd === "git") {
    if (!GIT_OK.has(args[0])) block(`git ${args[0] ?? ""} is not allowed`);
    for (const a of args) {
      if (/^--output(=|$)/.test(a) || a === "--ext-diff" || a === "--textconv") block(`git flag ${a}`);
    }
  } else if (cmd === "npm") {
    const ok =
      args[0] === "test" || (args[0] === "run" && NPM_RUN_OK.has(args[1]));
    if (!ok) block(`npm ${args.join(" ")} is not allowed`);
    if (args.some((a) => UPDATE_FLAGS.has(a) || /^--outputFile/.test(a))) block("npm test flag that writes files");
  } else if (cmd === "npx") {
    const ok =
      (args[0] === "vitest" && args[1] === "run") ||
      (args[0] === "tsc" && args.includes("--noEmit"));
    if (!ok) block(`npx ${args.join(" ")} is not allowed`);
    if (args.some((a) => UPDATE_FLAGS.has(a) || /^--outputFile/.test(a) || a === "--coverage")) {
      block("npx flag that writes files");
    }
  } else if (SIMPLE_OK.has(cmd)) {
    if (cmd === "find" && args.some((a) => FIND_BAD.has(a))) block("find action that executes or writes");
    if (cmd === "sort" && args.some((a) => a === "-o" || a.startsWith("--output"))) block("sort -o writes a file");
    if (cmd === "rg" && args.some((a) => a === "--pre" || a.startsWith("--pre="))) block("rg --pre executes commands");
  } else {
    block(`command not allowed: ${cmd}`);
  }
}

process.exit(0);
