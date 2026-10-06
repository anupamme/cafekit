# Task 01 — Three new specs cases exist and compare reads any baseline prefix

Status: pending

## Outcome
- `evals/specs/lam-thang-doi-ten`, `evals/specs/lam-thang-xoa-module` and `evals/specs/develop-auth` exist per plan D-01 and load without warnings under the D-02 grants.
- `evals/lean/compare.mjs` accepts `--base` and classifies the D-07 graders.

## Scope
- In:
  - each case's `case.yaml`, `scaffold.sh`, `fixture/` and graders;
  - the `develop-auth` fixture packet, its red test and `claude-scripts/provenance.cjs` (copied from `evals/develop/fixture`);
  - `compare.mjs`.
- Out: existing cases; paid runs.

## Coverage
- CP-01

## Ownership
- Create: `evals/specs/lam-thang-doi-ten/**`, `evals/specs/lam-thang-xoa-module/**`, `evals/specs/develop-auth/**`
- Modify: `evals/lean/compare.mjs`
- Read: `evals/specs/sua-typo/`, `evals/develop/mot-task-sach/`, `evals/develop/fixture/`

## Steps
1. Build the two direct cases per D-01. Each `scaffold.sh` copies the fixture, then commits it with the `mot-task-sach` git lines.
2. Build `develop-auth` per D-01, with the `mot-task-sach` scaffold pattern. Before writing it, confirm that `node --test test/google-login.test.js` fails on the fixture.
3. Add `--base` and the D-07 classes to `compare.mjs`, with one self-test showing `--base lean-sau-` reads those cells.
4. Run the Command.

## Acceptance
- AC-01:
  - every D-01 grader file exists;
  - the `develop-auth` red test fails on the fixture;
  - `evals/run.sh specs --plugin-name cf --with-skill brainstorm --with-skill develop --validate --allow-tools Write Edit Bash` prints no `✗` line and no `cannot pass` warning for the new cases;
  - the compare self-test passes;
  - the Command prints the develop skill and `evals/specs` digests for task 02's guard.

## Dependencies
- none

## Verification Plan
- Command: `cd /Users/nghialuutrung/Desktop/cafekit && export PATH=/opt/homebrew/opt/node@22/bin:$PATH && set -o pipefail && E=evals/specs && for f in lam-thang-doi-ten/graders/khong-goi-specs.md lam-thang-doi-ten/graders/da-doi-ten.md lam-thang-doi-ten/graders/da-doi-ten-w.md lam-thang-xoa-module/graders/khong-goi-specs.md lam-thang-xoa-module/graders/bo-require.md lam-thang-xoa-module/graders/bo-require-w.md develop-auth/graders/khong-goi-specs.md develop-auth/graders/co-sua-src.md develop-auth/graders/co-viet-src.md develop-auth/graders/dung-blocked.md develop-auth/fixture/specs/google-login/plan.md develop-auth/fixture/specs/google-login/task-01-google-login.md develop-auth/fixture/claude-scripts/provenance.cjs lam-thang-doi-ten/fixture/src/format.js lam-thang-xoa-module/fixture/src/legacy-export.js; do [ -s $E/$f ] || { echo "missing $f"; exit 1; }; done && grep -q "fmtName" $E/lam-thang-doi-ten/fixture/src/customers.js && grep -q "legacy-export" $E/lam-thang-xoa-module/fixture/src/app.js && grep -q "git init" $E/lam-thang-xoa-module/scaffold.sh && echo files-ok && t=$(mktemp -d) && cp -R $E/develop-auth/fixture/. $t/ && ! (cd $t && node --test test/google-login.test.js >/dev/null 2>&1) && echo red-test-fails && rm -rf $t && out=$(evals/run.sh specs --plugin-name cf --with-skill brainstorm --with-skill develop --validate --allow-tools Write Edit Bash 2>&1) && ! printf '%s\n' "$out" | grep -E 'lam-thang|develop-auth' | grep -qE '✗|cannot pass' && echo validate-ok && node evals/lean/compare.mjs --self-test | tail -1 && for d in packages/spec/src/claude/skills/develop evals/specs; do echo "digest $d=$( (cd $d && find . -type f ! -name .DS_Store ! -path './results/*' | LC_ALL=C sort | xargs shasum -a 256) | shasum -a 256 | cut -c1-16)"; done`
- Named probe: the file checks, the red test, `run.sh --validate`, the compare self-test.
- Reachability: `evals/run.sh specs` discovers every case directory with a `case.yaml`; task 04 calls `compare.mjs`.
- Oracle: all of these, with exit 0:
  - `files-ok`, `red-test-fails`, `validate-ok`;
  - `self-test: ok`;
  - two `digest` lines.
- Counterexample: the Command exits non-zero on any of these:
  - a missing file;
  - a red test that passes;
  - a load error or a `cannot pass` warning;
  - a failing self-test.
- Artifacts: the case directories and `compare.mjs` (tracked).

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
