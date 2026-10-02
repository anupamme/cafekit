# Task 07 — The repaired skill is measured and compared, and both changelogs record it

Status: pending

## Outcome
Eight after-cells on the repaired skill with the locked instrument, n=20 each, compared grader by grader with the baseline (exact p), every limit named, spend within $120, and an entry in both changelogs.

## Scope
- In: after pilots (counted in budget, outside the comparison), eight `sau-<case>-<model>` cells, copy-out, `compare-sync.mjs --strict`, the plan's Known limits updated with any post-lock wrong grader (D-09), changelog entries under Unreleased.
- Out: any instrument edit; any skill edit (a defect found here goes to Known limits or back to Bro).

## Coverage
- CP-05

## Ownership
- Create: `evals/results/sync/sau-*`, `evals/results/sync/sau-pilot-*`, `evals/results/sync/kept/sau-*`
- Modify: `packages/spec/CHANGELOG.md`, `docs/project-changelog.md`, `specs/sync-skill-repair/plan.md` (Known limits only)
- Read: `evals/results/sync/instrument.digest`

## Steps
1. Same environment pins (absolute shim PATH) and per-line `budget check` as task 05; before each cell, `node evals/compare-sync.mjs --digest` must equal `evals/results/sync/instrument.digest` or the cell is not started; copy-out writes `<cell>/instrument.digest`. An over-cap estimate → stop and ask Bro with `AskUserQuestion` as in task 05.
2. Run pilots, then the eight cells; copy out after each.
3. Write both changelog entries naming `cf:sync` and the measured figures from the Command output.

## Acceptance
- AC-09

## Dependencies
- task-06-repair-skill-text.md

## Verification Plan
- Command: `claude --version && node --version && out=$(node evals/compare-sync.mjs --strict) && printf '%s\n' "$out" && [ "$(printf '%s\n' "$out" | grep -c ' cost base=')" = 8 ] && [ "$(printf '%s\n' "$out" | grep -c ' loaded base=')" = 8 ] && printf '%s\n' "$out" | grep -qx 'instrument=same' && [ "$(printf '%s\n' "$out" | grep ' grader=' | grep -cE ' base=[0-9]+/[0-9]+ after=[0-9]+/[0-9]+ p=[01]\.[0-9]{6} (primary|watch)$')" = "$(printf '%s\n' "$out" | grep -c ' grader=')" ] && node evals/budget-sync.mjs spent | grep -qE '^budget: spent=[0-9.]+ cap=120$' && node evals/budget-sync.mjs check 0 && grep -q 'cf:sync' packages/spec/CHANGELOG.md && grep -q 'cf:sync' docs/project-changelog.md`
- Named probe: `compare-sync.mjs --strict` (n=20 both sides, same digest, model id present per cell).
- Reachability: live level; paid runs in Steps; the Command is $0 and re-runnable.
- Oracle: exit 0; every grader line has base, after and p.
- Counterexample: an after-cell whose `<cell>/instrument.digest` differs from the locked digest must make `instrument=same` absent and the Command exit 1.
- Artifacts: `evals/results/sync/sau-*/result.json` sha256 in the Receipt.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
<!-- Fill only after execution. -->
