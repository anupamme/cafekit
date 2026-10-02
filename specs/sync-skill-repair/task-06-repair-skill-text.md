# Task 06 — The skill text is repaired

Status: pending

## Outcome
`cf:sync` has an official rebind, a no-evasion rule, a report-only bare call, and a changed-files report checked against git, each pinned by a self-test that fails when the clause is removed or weakened.

## Scope
- In:
  - `SKILL.md`: grammar adds `rebind <feature> [<task-NN-slug.md>]` and the bare form (argument-hint and Commands block); one pointer to `references/rebind-and-audit.md`; `SKILL.md:62-64`, `sync-protocols.md:43-44` and `sync-protocols.md:47-49` reworded so a repair or downgrade happens only after the user's confirmation (D-11); net change of `SKILL.md` + `sync-protocols.md` ≤ +1 line; every `develop-contract.test.js:861-877` phrase kept.
  - `references/rebind-and-audit.md` (new): first take a `git status --porcelain -uall` snapshot. Rebind (D-13) — only `done` tasks; choose the Command as the validator does; run every selected Command verbatim, each once as one shell so output and exit cover the whole command (all `&&` links; stdout+stderr; no `| tail`, no `> log` of one link); a non-zero exit, a failure marker, or zero required tests → D-10 (`Status: blocked` with one line naming Command and exit, old Receipt kept with the non-authoritative line under `## Receipt` — exact wording fixed here), never PASS; then run the provenance command exactly as `develop/SKILL.md:142` once, write the passing Receipts from those runs, never typing, computing, or `sed`-editing Base/Head; run provenance again and, if Head moved, say so and do not claim the receipts current; re-read for one Status and one Receipt. No-evasion: never archive, move, rename or delete a packet, change the specs root, or edit `.claude/` (including `runtime.json`) or hooks to quiet the gate; a gate block is answered with evidence or a reported blocker. Bare call: audit every process-first packet under the specs root, report legacy (`spec.json`) and archive packets without touching them, write nothing, then ask with `AskUserQuestion` when the host has it, otherwise ask in text and stop (D-12); only a reply after the report that names the changes counts as confirmation. Report: after the last edit take the snapshot again (status lines plus sha256 of each listed path) and report every path whose line or hash changed, listing pre-existing changes apart (N-2).
  - `run-skill-self-tests.mjs`: pins with mutations for each clause above, plus a pin that fails when any file under `skills/sync/` contains a dollar sign followed by a digit or the word `ARGUMENTS` (handoff `$0` lesson).
- Out: hooks and scripts; Codex text; the legacy section beyond keeping it.

## Coverage
- CP-04

## Ownership
- Modify: `packages/spec/src/claude/skills/sync/SKILL.md`, `packages/spec/src/claude/skills/sync/references/sync-protocols.md`, `packages/spec/scripts/run-skill-self-tests.mjs`
- Create: `packages/spec/src/claude/skills/sync/references/rebind-and-audit.md`
- Read: `packages/spec/src/claude/skills/develop/SKILL.md:142`, `packages/spec/bin/__tests__/develop-contract.test.js:836-877`, `packages/spec/bin/lib/codex-install.js:195-207`, `packages/spec/src/claude/scripts/spec-receipt.cjs:151-163`, `specs/sync-skill-repair/plan.md` (D-10..D-13)

## Steps
1. Add the pins and mutations first → `pnpm --dir packages/spec test` fails on the unchanged skill naming the missing clauses.
2. Write `rebind-and-audit.md` and the `SKILL.md` grammar/pointer → pins pass; `context-budget` and the 400-line check still pass.
3. Run the `$0` pin against a mutated copy (under `mktemp -d`) holding `$1` in a shell block → it fails.

## Acceptance
- AC-04, AC-05, AC-06, AC-07, AC-08: each clause present and pinned; each mutation (clause removed, `blocked` replaced by `done`, non-authoritative line removed, provenance moved before the commands, `.claude/` exception added, "write nothing" removed, snapshot removed, hash comparison removed, `sync-protocols.md:47-49` restored to write without confirmation) makes the self-test fail.

## Dependencies
- task-05-measure-baseline.md

## Verification Plan
- Command: `pnpm --dir packages/spec test && node --test packages/spec/bin/__tests__/develop-contract.test.js && node --test packages/spec/bin/__tests__/codex-native.test.js && test -s packages/spec/src/claude/skills/sync/references/rebind-and-audit.md && ! grep -rEn '\$[0-9]|\$ARGUMENTS' packages/spec/src/claude/skills/sync`
- Named probe: new self-test labels `cf:sync rebind runs the planned command verbatim`, `cf:sync rebind never writes PASS on failure`, `cf:sync never silences the gate`, `cf:sync bare call writes nothing`, `cf:sync file report comes from a git snapshot difference`, `cf:sync rebind takes provenance once after all commands`, `cf:sync failed rebind marks the old receipt non-authoritative`, `cf:sync body has no argument placeholders`, each with its mutations; existing R7 test in `develop-contract.test.js`; `context-budget` issue in `run-skill-self-tests.mjs:2576-2578`.
- Reachability: source level; installed and live levels come from task 07.
- Oracle: exit 0; every mutation reported as rejected.
- Counterexample: deleting the "never PASS" sentence from `rebind-and-audit.md` must make the self-test exit 1.
- Artifacts: ephemeral mutation copies under `mktemp -d`.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
<!-- Fill only after execution. -->
