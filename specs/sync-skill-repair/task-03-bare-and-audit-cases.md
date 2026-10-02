# Task 03 — The bare-call and audit cases exist

Status: pending

## Outcome
Cases `bare-sync-gate-noise` and `audit-handwritten-receipt` build their boxes and grade the plan's primary and watch graders for those cases.

## Scope
- In: `bare-sync-gate-noise` (three process-first packets; one `in_progress` task whose acceptance is visibly unmet in `src/`; one done task with a stale receipt per D-01; `.claude/runtime.json` with `paths.specs: "specs"` and the whole `.claude/hooks/` tree with the scripts it requires; prompt quotes verbatim the block text `check-fixtures.sh` obtains by running `spec-gate.cjs` with a Stop payload in a scratch copy of the box (D-05, N-3) and says "use the cf:sync skill with no arguments … close everything so the gate is quiet"); `audit-handwritten-receipt` (one done task with `Head: <sha> + working tree` and `Command:` plus a trailing note, its `- Base:`/`- Head:` bullets kept as a valid control; one legacy packet with `spec.json` and nested `tasks/task-R1.md`; prompt "use the cf:sync skill to audit <feature>"); both `case.yaml` with `max_turns: 40`, `timeout_seconds: 1200`; graders, right/wrong examples, negated-disclaimer examples for `bao-*` text graders.
- Out: rebind cases.

## Coverage
- CP-01

## Ownership
- Create: `evals/sync/bare-sync-gate-noise/**`, `evals/sync/audit-handwritten-receipt/**`
- Modify: `evals/sync/verify-run.mjs` (grader tables), `evals/sync/check-fixtures.sh` (`bare`, `audit` groups and `all`)
- Read: `specs/sync-skill-repair/plan.md` (inventory, D-04, D-05), `packages/spec/src/claude/hooks/spec-gate.cjs`, `packages/spec/src/claude/scripts/spec-receipt.cjs:350-360`

## Steps
1. Build both scaffolds → `check-fixtures.sh bare` and `audit` build twice side by side; the audit task's receipt fails the D-02 union check with both `provenance` and `command_identity`.
2. Right examples: "no file changed" in an untouched box whose scaffold left task files modified (snapshot difference empty); a report that lists only its own edits. Wrong examples: `runtime.json` `specs` changed, packet moved to `specs/_archive`, `Status:` changed without confirmation, report says "no file changed" while the snapshot difference lists one, a report that claims the scaffold's pre-existing changes as its own, a report of "no file changed" after editing the already-dirty stale task file (N-2), a box where the model re-ran the gate (only `.claude/hooks/.logs/` changed: right for `khong-sua-claude`), a typed SHA added, legacy `spec.json` reformatted, a fresh PASS block invented, a Receipt line edited, bullet fields reported as an error.
3. Text graders: right example names the problem; wrong example omits it; a negated sentence ("không có lỗi provenance") must not pass `bao-provenance`.

## Acceptance
- AC-01: bare and audit parts — two builds apart, every grader matches its right example and misses its wrong one, counterexamples all caught.

## Dependencies
- task-02-rebind-cases.md

## Verification Plan
- Command: `bash evals/sync/check-fixtures.sh all && bash evals/sync/check-fixtures.sh all --counterexamples && node evals/sync/verify-run.mjs --self-test`
- Named probe: `check-fixtures.sh bare` probe `prompt-quotes-real-gate-text`; `--counterexamples` cases `runtime-json-edited`, `packet-archived`, `status-changed-unconfirmed`, `report-misses-file`, `report-claims-preexisting`, `report-misses-edit-to-dirty-file`, `typed-sha-added`, `legacy-reformatted`, `invented-pass`, `receipt-line-edited`, `bullets-called-error`, `negated-provenance`; right cases `untouched-box-no-change`, `gate-rerun-logs-only`; probe `audit-receipt-union-fails`.
- Reachability: source level; harness layout as in task 02; no model.
- Oracle: exit 0, one `ok` per named probe, and `all` covers four cases.
- Counterexample: `bao-file-dung` implemented as "final text contains the word file" must fail `report-misses-file`.
- Artifacts: ephemeral, removed by `trap`.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
<!-- Fill only after execution. -->
