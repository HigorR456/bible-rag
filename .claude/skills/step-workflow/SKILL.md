---
name: step-workflow
description: Runs the full implement -> test -> review cycle for the next pending step (or a named step) of specs/tasks/implementation-plan.md, using the implementer, tester and reviewer agents, with a bounded fix loop. Use when the user asks to run the workflow, or to implement a step end to end.
argument-hint: "[step id, e.g. S03a — optional]"
disable-model-invocation: true
---

Orchestrate one step of `specs/tasks/implementation-plan.md` through three agents, in order. You (the main session) are the orchestrator: subagents cannot call each other, so you pass context between them. Do not implement, test or review yourself.

Target: `$ARGUMENTS` if given, otherwise the next `pending` step chosen by the implementer.

## Phase 1 — Implement
Launch the `implementer` agent (foreground). Prompt: the target step (or "next pending step"), plus any blockers/instructions from the user.
- If it stops because of a blocked dependency, spec conflict, or a step that is too large: **stop the workflow** and report to the user. Do not continue.
- Otherwise, note from its report: step id, files changed, AC covered, external commands left for the user.

## Phase 2 — Test
Launch the `tester` agent with the step id, the list of files the implementer changed, and any decisions the user made (e.g. approved spec edits). Do NOT pass the implementer's claims ("typecheck passes", "AC covered"); the tester must verify them itself. It writes tests only and never edits `src/`.
- Collect: bugs found (AC, file:line, expected vs actual), spec ambiguities, verdict.

## Phase 3 — Review
Launch the `reviewer` agent with ONLY the step id (and its AC from the plan) plus any decisions the user made (e.g. approved spec edits). Do NOT pass the implementer's or tester's reports, summaries, caveats or verdicts: the reviewer must form an independent judgment from the working tree, the Spec and its own test runs. It is read-only.
- Collect: verdict, findings by severity, test assessment (weak/missing tests), surviving mutations.

## Independence rule
Reports from earlier agents are for you (the orchestrator) and the final report only. Downstream agents receive facts (step id, AC, changed file list, user decisions), never another agent's conclusions. In the fix loop, re-run the tester/reviewer under the same rule; give the implementer the findings, but give the re-run reviewer only the step id.
- Tell every agent not to read whole large data files (see below).

## Token economy (pass to every agent)
- **Spec list**: look up the step in the plan's "Spec reading list per step" and pass that list of documents to each agent (facts, not conclusions). Agents read only those plus constitution, non-goals and the step's AC tags.
- **Plan**: agents Grep the step's row and AC tags; they do not read the whole plan.
- **Verification commands**: the implementer runs `typecheck` + full `npm test`; the tester runs focused tests while iterating plus one final `typecheck` + full `npm test`; the reviewer runs only focused tests unless the diff goes beyond the step's modules.
- **Diff-scoped reading**: agents read the changed files (pass the list; otherwise `git status` / `git diff --stat`) and what they directly import, never whole directories.
- **Short reports**: implementer ~20 lines, tester ~25, reviewer ~30; no code listings.

## Large data files
`ingestion/chunks_onbv.jsonl` is ~5.4 MB / 8,102 lines. Tell agents never to Read/cat it. Inspect it with a command that prints only the answer (e.g. `node -e` / `jq` / `grep -c` printing unique book codes, counts or a few sample lines), or `head -n 3`. Tests may read it at runtime via `readFileSync`; that costs no tokens.

## Phase 4 — Fix loop (max 2 rounds)
If the tester reported production bugs, or the reviewer's verdict is `changes requested` (any `blocker`/`major`):
1. Send the findings (verbatim, with file:line and AC) to the `implementer` to fix production code. Do not let it change tests to make them pass.
2. If the reviewer flagged weak/missing tests, send those items to the `tester`.
3. Re-run the `tester` (if code changed) and then the `reviewer` on the result.
4. Repeat at most 2 rounds. If blockers remain after round 2, stop and escalate to the user with the open findings. Spec ambiguities always go to the user; never let an agent guess.

`minor` findings and `question`s are not loop triggers; just list them.

## Phase 5 — Final report to the user
Concise, in the user's language (Portuguese if they wrote in Portuguese):
- Step, rounds used, final verdicts of tester and reviewer.
- Files changed (implementation and tests), AC covered / not covered.
- Final `npm run typecheck` and `npm test` results as reported by the agents (never claim a pass you did not see reported).
- Open items: minor findings, spec ambiguities, external commands the user must run (Vectorize, ingestion, deploy, secrets), pre-existing failures.
- The next pending step.

## Rules
- Never commit, stage, push or create branches. If everything is green and approved, **ask** the user whether to mark the step `done` in the plan and whether to commit; do nothing until they answer.
- Never mark `done` yourself, and do not edit the plan's Status (only the implementer sets `implemented`).
- One step per run. Parallel independent steps only if the user explicitly asks.
- Do not run steps with external effects (real Cloudflare calls, deploy, secrets); leave them to the user.
