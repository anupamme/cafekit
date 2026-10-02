# Task 07 — The repaired skill is measured and compared, and both changelogs record it

Status: pending

## Outcome
The same four cells run on the repaired skill, on the same model, the same `n` and the locked instrument, and are compared with the baseline grader by grader with exact p-values and stated limits; both changelogs name the change and its measured effect.

## Scope
- In: four after-pilots, the four after-cells, copying results, two changelog entries.
- Out: any further skill or instrument edit (a defect blocks the task and goes to the user); `pr`/`finish` flows; any model other than `claude-opus-5-5`.

## Coverage
- CP-06

## Ownership
- Create: `evals/results/git/sau-*/` (result directories)
- Modify: `packages/spec/CHANGELOG.md`, `docs/project-changelog.md`
- Read: `evals/git/**`, `evals/compare-git.mjs`, `evals/budget-git-sau.mjs`

## Steps
1. Same environment as task 05 Step 1 (record the `claude` and `node` versions; state any difference from the baseline). `r=$(mktemp -d)`; `bash evals/git/stage-root.sh sau "$r"`; require its `instrument:` digest to equal `evals/results/git/instrument.digest` and its `skill-git:` digest to differ from the `goc` one; otherwise stop.
2. `node evals/budget-git-sau.mjs estimate --runs <n of the baseline>`; if `total` exceeds the cap, STOP and ask the user (no reduction on its own).
3. Pilots: one run per case, `--out sau-pilot-<case>-opus --runs 1 --max-cost-usd <3>`; the instrument is already locked, so a defect found here blocks the task and goes to the user. Then the four cells with the baseline's `n`, `--out sau-<case>-opus`, each with `check` first, `--max-cost-usd`, an immediate copy to `evals/results/git/`, and `skill-loaded.txt` and `verify-run.txt` saved; a failed or partial cell is renamed `-lan1` in both the staged run root and `evals/results/git/` (`evals/run.sh:109-111` refuses an existing `--out`), still counted, and re-run; the cell estimate is `n` × the highest pilot cost per run.
4. Changelogs: one entry in each of the two files (each file's own language and format) stating what changed in `cf:git` and the measured result for each primary grader, including any that did not improve.
5. Run the Command; paste its output into the Receipt, then list the limits (one model, drift between phases, lexical graders, the "before the first stage or commit" approximation, `n`).

## Acceptance
- AC-09: `compare-git.mjs --strict` prints one `grader=` line per grader per cell with both sides, four `cost` lines, four `loaded` lines and `instrument=same`; both changelogs mention `cf:git`; total spend (both sides, pilots and reruns) ≤ $60.

## Dependencies
- task-06-repair-skill-text.md

## Verification Plan
- Command: `out=$(node evals/compare-git.mjs --strict) && printf '%s\n' "$out" && [ "$(printf '%s\n' "$out" | grep -c ' cost base=')" = 4 ] && [ "$(printf '%s\n' "$out" | grep -c ' loaded base=')" = 4 ] && printf '%s\n' "$out" | grep -qx 'instrument=same' && [ "$(printf '%s\n' "$out" | grep ' grader=' | grep -cE ' base=[0-9]+/[0-9]+ after=[0-9]+/[0-9]+ p=[0-9.]+ (primary|watch)$')" = "$(printf '%s\n' "$out" | grep -c ' grader=')" ] && bash -c 'for c in wt-plain-git-no-orca wt-cleanup-prune commit-secret-scan-portable wrong-checkout-guard; do test -s evals/results/git/sau-$c-opus/result.json && test -s evals/results/git/sau-$c-opus/skill-loaded.txt && test -s evals/results/git/sau-$c-opus/verify-run.txt && test -s evals/results/git/sau-pilot-$c-opus/result.json || exit 1; done' && node evals/budget-git-sau.mjs spent | grep -qE '^budget: spent=[0-9.]+ cap=60$' && grep -q 'cf:git' packages/spec/CHANGELOG.md && grep -q 'cf:git' docs/project-changelog.md`
- Named probe: `compare-git.mjs --strict` per-cell lines for the primary graders of the inventory in `plan.md`; `budget-git-sau.mjs spent`.
- Reachability: reads files written by Steps 1-4 only; no paid run in the Command.
- Oracle: exit 0 and the counts as stated; each primary grader's before and after counts and p-value are in the output for GATE-DONE.
- Counterexample: a missing `sau-*` cell or pilot, a comparison whose two sides are the same directory, a changed instrument, a cell whose skill never loaded, a changelog without `cf:git`, or spend above the cap makes the Command fail.
- Artifacts: `evals/results/git/sau-*/` kept in the working tree (gitignored); digests recorded in the Receipt.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
