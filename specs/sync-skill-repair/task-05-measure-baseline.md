# Task 05 — The unchanged skill is measured

Status: pending

## Outcome
Eight base cells (four cases × `claude-opus-5-5`, `claude-sonnet-5-5`), n=20 each, on the unchanged skill, with the instrument digest locked, every result copied out of `/private/tmp`, and spend within $120.

## Scope
- In: pilots (≥ 3 runs per case per model, D-09) with instrument repair allowed only here; a fresh reviewer reads every failing pilot verdict against its trace before the lock; `estimate` for both sides; the eight cells; copy-out after every cell (D-08).
- Out: any skill edit (task 06).

## Coverage
- CP-03

## Ownership
- Create: `evals/results/sync/base-*`, `evals/results/sync/base-pilot-*`, `evals/results/sync/kept/base-*`, `evals/results/sync/instrument.digest`
- Read: `evals/run.sh`, `specs/sync-skill-repair/plan.md` (D-04..D-09)

## Steps
1. Pin `export PATH="<node v22.23.3 bin>:$PWD/evals/sync/shim:$PATH"` (absolute, D-04), `DISABLE_AUTOUPDATER=1`, unset `ORCA_*`/`HERDR_*`; record `claude --version`.
2. Each paid line: `node evals/budget-sync.mjs check <cap of that line>` first, then `evals/run.sh sync --out base-pilot-<case>-<model> --case <case> --model <model> --runs 1 --ablation none --keep-temp --max-cost-usd <cap>` (later `--out base-pilot-<case>-<model>-b … --runs 2`; D-07, N-5), then `verify-run.mjs` and `skill-loaded.mjs` into the dir, then copy-out with `<cell>/instrument.digest` (D-08, D-09).
3. After the `--runs 1` pilot of every case and model, run `budget-sync.mjs estimate` for the whole set (both sides); after all pilots: every pilot must show the skill loaded on both models (D-06; any unloaded → stop and ask), reviewer pass, instrument fixes (re-run all pilots after any fix), write the digest, estimate again. Any estimate > $120 → stop and ask Bro with `AskUserQuestion`, one estimate per option (raise the cap, lower `n`, drop sonnet, drop cases); never cut on its own (D-07).
4. Run the eight cells with `--runs 20`; a partial cell is renamed `-lan<k>` and still counted.

## Acceptance
- AC-03

## Dependencies
- task-03-bare-and-audit-cases.md
- task-04-compare-budget-tools.md

## Verification Plan
- Command: `claude --version && node --version && cat evals/results/sync/instrument.digest && out=$(node evals/compare-sync.mjs --base-only --strict) && printf '%s\n' "$out" && [ "$(printf '%s\n' "$out" | grep -c ' cost base=')" = 8 ] && [ "$(printf '%s\n' "$out" | grep -c ' loaded base=')" = 8 ] && printf '%s\n' "$out" | grep -qx 'instrument=same' && bash -c 'for m in opus sonnet; do for c in rebind-base-moved rebind-verify-fails bare-sync-gate-noise audit-handwritten-receipt; do d=evals/results/sync/base-$c-$m; test -s $d/result.json && test -s $d/verify-run.txt && test -s $d/skill-loaded.txt || exit 1; done; done' && node evals/budget-sync.mjs spent | grep -qE '^budget: spent=[0-9.]+ cap=120$' && node evals/budget-sync.mjs check 0`
- Named probe: `compare-sync.mjs --strict` refuses a cell with n ≠ 20, a missing model id, or a cell digest other than `instrument.digest`; `budget-sync.mjs check 0` exits 1 when spend exceeds 120.
- Reachability: live level; paid runs happen in Steps, not in the Command; the Command reads saved results only and is re-runnable at $0.
- Oracle: exit 0 with 8 cost lines, 8 loaded lines, `instrument=same`, spend ≤ 120.
- Counterexample: a cell run with `--runs 10` must make `--strict` exit 1.
- Artifacts: `evals/results/sync/base-*/result.json` sha256 recorded in the Receipt; kept evidence under `evals/results/sync/kept/`.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
<!-- Fill only after execution. -->
