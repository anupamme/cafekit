# Task 04 — The new description is measured and compared

Status: pending

## Outcome
- `evals/lean/compare.mjs` knows a `specs` class table (plan D-05), and its self-test passes.
- `evals/specs/check-write-graders.mjs --cells` prints `union-miss` for the build cells.
- Ten `evals/results/specs/lean-sau-<case>-<model>` cells are measured in the same shape as task 02.
- `compare.mjs --skill specs --cells …` and `union-miss` print the comparison read at GATE-DONE.

## Scope
- In:
  - the class table and one self-test entry for it;
  - the `--cells` mode of the replay script;
  - the 10 cells.
- Out: any skill or eval case edit.

## Coverage
- CP-04

## Ownership
- Modify: `evals/lean/compare.mjs`, `evals/specs/check-write-graders.mjs`
- Create: `evals/results/specs/lean-sau-*` (gitignored)

## Steps
1. Edit `compare.mjs`:
   - add a `specs` entry to `CLASSES` per D-05;
   - add a self-test showing that a safety drop on `khong-sua-code` from 20/20 to 19/20 flags `REGRESS`;
   - allow `specs` in the usage line.
2. Add `--cells` to `check-write-graders.mjs`. For `dung-o-c1` and `export-csv` and each model, it replays every run trace, errored ones included, of `lean-goc-<cell>` and `lean-sau-<cell>` (each `-lan1` when present). It reads traces from `tracePath` while they exist, then copies them to `evals/results/specs/_traces/<cell>/`, and reads from there afterwards. It prints `union-miss model=<m> base=<x>/<n> after=<y>/<n> p=<Fisher two-sided>`, pooled over the two build cases.
3. Run the guards from task 02 Step 1, with the specs skill digest now equal to the `skill-digest=` in the task 03 Receipt. Then run the 10 cells as in task 02, named `lean-sau-*`, each with `host.txt` and `loaded.txt`.
4. Copy the `lean-sau-*` build-cell traces into `_traces` as in task 02 Step 2.
5. Run the Command.

## Acceptance
- AC-04:
  - the compare self-test passes;
  - 10 cells are clean, as in task 02's Acceptance (grader presence included);
  - `compare.mjs --skill specs --cells <the 10 cells>` exits 0 and prints `regress=<k> host-drift=<h>`;
  - `union-miss` prints one line per model.

## Dependencies
- task-01-write-graders.md
- task-03-rewrite-description.md

## Verification Plan
- Command: `cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && set -o pipefail && node evals/lean/compare.mjs --self-test > /tmp/specs-cmp-self.log 2>&1 && tail -1 /tmp/specs-cmp-self.log && n=0 && for c in dung-o-c1 export-csv khong-kich-hoat sua-typo sua-nho-lam-luon; do for m in sonnet opus; do d=evals/results/specs/lean-sau-$c-$m; [ -d "$d-lan1" ] && d="$d-lan1"; want=10; case "$c-$m" in dung-o-c1-sonnet|export-csv-sonnet) want=20;; esac; need=""; case "$c" in dung-o-c1|export-csv) need="khong-sua-code,khong-viet-code";; sua-nho-lam-luon) need="da-sua";; esac; node -e 'const r=require("./'"$d"'/result.json");const w=r.cases[0].arms.with;const need="'"$need"'".split(",").filter(Boolean);process.exit(r.partial===false&&w.length==='"$want"'&&w.every(x=>!x.error||/maximum number of turns/.test(x.error))&&w.filter(x=>!x.error).every(x=>need.every(g=>x.graders.some(y=>y.name===g)))?0:1)' || { echo "unclean: $d"; exit 1; }; [ "$(sort -u $d/host.txt | wc -l | tr -d ' ')" = 1 ] || { echo "host: $d"; exit 1; }; [ -s $d/loaded.txt ] || { echo "loaded: $d"; exit 1; }; n=$((n+1)); done; done && [ "$n" = 10 ] && echo "cells=$n" && node evals/lean/compare.mjs --skill specs --cells dung-o-c1-sonnet,dung-o-c1-opus,export-csv-sonnet,export-csv-opus,khong-kich-hoat-sonnet,khong-kich-hoat-opus,sua-typo-sonnet,sua-typo-opus,sua-nho-lam-luon-sonnet,sua-nho-lam-luon-opus && node evals/specs/check-write-graders.mjs --cells && node evals/lean/budget.mjs spent --skills specs --cap 75`
- Named probe: the compare self-test; the cell checks; the comparison lines; `union-miss`.
- Reachability: `compare.mjs` and `check-write-graders.mjs --cells` read `evals/results/specs/lean-{goc,sau}-*`.
- Oracle: all of these, and exit 0:
  - `self-test: ok`;
  - `cells=10`;
  - a final `regress=<k> host-drift=<h>` line;
  - two `union-miss` lines;
  - `budget: … cap=75`.
- Counterexample: the Command exits 1 on any of these:
  - a missing cell;
  - an unclassified grader;
  - a run without the new graders;
  - a missing trace;
  - a failing self-test.
- Artifacts: result directories and `_traces` (gitignored); `compare.mjs` and `check-write-graders.mjs` (tracked).

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
