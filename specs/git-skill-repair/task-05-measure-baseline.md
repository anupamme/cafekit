# Task 05 — The unchanged skill is measured on the four cases

Status: pending

## Outcome
The skill at commit `26103b9` has, for each of four cells (the four cases on `claude-opus-5-5`), a result file, a skill-loaded count, a verify-run file and a cost, the same `n` for every cell, a locked instrument digest, and total spend within $60.

## Scope
- In: the four baseline pilots, instrument repairs during the pilots only (D-08), the instrument lock, the estimate for both sides, the four paid cells of the `goc` side, copying each result into `evals/results/git/`.
- Out: any change to the skill; the `sau` side; any push, real-repository operation, or real Orca/Herdr call; any model other than `claude-opus-5-5`.

## Coverage
- CP-03

## Ownership
- Create: `evals/results/git/base-*/` (result directories only), `evals/results/git/instrument.digest`
- Modify (pilot phase only, each change in the Receipt with the new digest): `evals/git/**`, `evals/compare-git.mjs`, `evals/budget-git-sau.mjs`, `evals/git/stage-root.sh`, `evals/git/skill-loaded.mjs`
- Read: `evals/run.sh`

## Steps
1. Record `claude --version`, `node --version` and the model id in the Receipt. Every paid line runs with `DISABLE_AUTOUPDATER=1`, a fixed node `PATH` with `evals/git/shim/` first (D-09), no `SHIMLOG` (each run's shim log is its own workspace's `./shim.log`), and every `ORCA_*` and `HERDR_*` variable unset (`env $(env | grep -E '^(ORCA|HERDR)_' | cut -d= -f1 | sed 's/^/-u /') …`), and with `--model claude-opus-5-5 --ablation none --keep-temp`; if a harness grader of type `llm` is ever added, `--judge-model claude-opus-5-5`.
2. `r=$(mktemp -d)`; `bash evals/git/stage-root.sh goc "$r"`; record the three digests; run `$r/evals/run.sh git …` (the staged copy of the harness) so the baseline skill is the one measured. After every `--out <name>` run, copy `$r/evals/results/git/<name>` to `evals/results/git/<name>` at once (D-07).
3. Pilots: one run per case, `--out base-pilot-<case>-opus --runs 1 --max-cost-usd 3` (a bound chosen to cap the four pilots near $12 before any cost is known; the first pilot cost replaces it), then `node evals/git/skill-loaded.mjs` and `node evals/git/verify-run.mjs` on each, saved beside the result. Stop and return to the user if (a) any pilot loads the skill 0 times (D-05) or (b) the harness does not keep `box/`, or does not let the model write inside it. A defect in the instrument found here may be repaired: write it in the Receipt (what, why, new instrument digest), rename each of the four pilot directories to `-lan1` in both places — `$r/evals/results/git/` and `evals/results/git/` (`evals/run.sh:109-111` refuses an existing `--out`, so the staged copy must be renamed too; they still count in the budget) — re-stage with `stage-root.sh goc "$r"` so the repaired instrument is in the run root, and run the four pilots again.
4. Lock: write the current instrument digest (D-08) to `evals/results/git/instrument.digest`. Run `node evals/budget-git-sau.mjs estimate --runs 10` (it covers both sides). If `total` exceeds the cap, STOP and ask the user; do not reduce `n` on your own (the user may choose a lower `n`, never below 5). From here on the instrument is locked: a defect found later makes this task `blocked` with the cause; do not repair it.
5. Cells: for each case, `node evals/budget-git-sau.mjs check <cell estimate>` then the paid run with `--out base-<case>-opus --runs <n> --max-cost-usd <min(cap left, 1.5 × cell estimate)>`; confirm the instrument digest still matches `instrument.digest` before each; the cell estimate is `n` × the highest pilot cost per run; copy the result at once; save `skill-loaded.txt` and `verify-run.txt` in the cell directory. A failed or partial cell is renamed `base-<case>-opus-lan1` (`-lan2` …) in both `$r/evals/results/git/` and `evals/results/git/`, still counted, and the canonical name is run again.
6. Run the Command; paste its output into the Receipt with the shasum of each `result.json`.

## Acceptance
- AC-03: four `base-<case>-opus` directories each hold `result.json`, `skill-loaded.txt`, `verify-run.txt`; every cell has the same `n ≥ 5`; `compare-git.mjs --base-only --strict` exits 0 (no cell with `loaded` 0 or all runs errored, instrument `same`); total spend including pilots and reruns is within $60.

## Dependencies
- task-04-compare-budget-tools.md

## Verification Plan
- Command: `out=$(node evals/compare-git.mjs --base-only --strict) && printf '%s\n' "$out" && bash -c 'for c in wt-plain-git-no-orca wt-cleanup-prune commit-secret-scan-portable wrong-checkout-guard; do test -s evals/results/git/base-$c-opus/result.json && test -s evals/results/git/base-$c-opus/skill-loaded.txt && test -s evals/results/git/base-$c-opus/verify-run.txt && test -s evals/results/git/base-pilot-$c-opus/result.json || exit 1; done' && [ "$(printf '%s\n' "$out" | grep -c ' cost base=')" = 4 ] && [ "$(printf '%s\n' "$out" | grep -c ' loaded base=')" = 4 ] && printf '%s\n' "$out" | grep -qx 'instrument=same' && node evals/budget-git-sau.mjs spent | grep -qE '^budget: spent=[0-9.]+ cap=60$'`
- Named probe: `compare-git.mjs --base-only --strict` (per-cell `cost`, `loaded`, `errored`, `instrument` lines); the saved `skill-loaded.txt` and `verify-run.txt`; `budget-git-sau.mjs spent`.
- Reachability: reads files written by Steps 3-5 only; no paid run is inside the Command, so it replays after a reboot.
- Oracle: exit 0; four cells, each with its skill-loaded and verify-run files; `instrument=same`; `spent` within the cap (the call exits 1 above it).
- Counterexample: a cell whose skill never loaded or whose runs all errored, a changed instrument, a missing pilot or cell, a different `n` between cells, or spend above $60 makes `--strict` or `spent` exit 1.
- Artifacts: `evals/results/git/base-*/` and `instrument.digest` kept in the working tree (gitignored by `.gitignore:122`, so not committed); digests recorded in the Receipt.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
