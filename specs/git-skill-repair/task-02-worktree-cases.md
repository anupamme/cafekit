# Task 02 — Two worktree cases exist

Status: pending

## Outcome
`evals/git/` holds `wt-plain-git-no-orca` and `wt-cleanup-prune` exactly as the inventory in `plan.md` names them, covered by the checker offline for $0.

## Scope
- In: two `case.yaml` files (prompt only in `case.yaml`, Vietnamese, naming `cf:git` without a leading slash and the path `./box/repo`), two scaffolds that use `lib/box.sh`, harness graders (`graders/*.md` of type `tool_used`, `tool_order` or `regex`), example strings, and the V verdict rules in `verify-run.mjs` for these cases.
- Out: commit cases; the skill text; any model call.

## Coverage
- CP-01

## Ownership
- Create: `evals/git/wt-plain-git-no-orca/`, `evals/git/wt-cleanup-prune/` (case.yaml, scaffold.sh, graders/), `evals/git/fixtures/` entries for them
- Modify: `evals/git/verify-run.mjs`, `evals/git/check-fixtures.sh`
- Read: `packages/spec/src/claude/skills/git/references/worktree-blueprint.md`, `evals/fix/red-truoc/graders/`

## Steps
1. `wt-plain-git-no-orca`: scaffold per the inventory (`dev` one commit ahead of `main`, `main` kept, `.gitignore` with `.claude/`, `.claude/` holding `skills/`, `session-state/`, `.logs/`, `worktrees/`); graders and V rules as listed; `PATH` shim and no `ORCA_*` are set by the Command that runs the case (task 05), the case only reads the run's own `./shim.log`.
2. `wt-cleanup-prune`: scaffold per the inventory (`repo-ci` removed by `rm -rf`; `repo-wip` dirty; `repo-env` with only an ignored `.env`; a merged and an unmerged branch); graders and V rules as listed.
3. `check-fixtures.sh worktree`: build each scaffold in `mktemp -d`, confirm the planted state (merge-base differs between `dev` and `main`, a `prunable` entry, a dirty tree, an ignored-only dirt that `git status --porcelain` shows empty but `--ignored` shows), run every regex grader against `fixtures/<case>/examples.json` (right strings match, wrong strings do not), and with `--counterexamples` replay: branch cut from `main`; nested path; a shim log with a call; `rm -rf` of a worktree; `remove` of the ignored-dirty worktree; `branch -D` of the unmerged branch; `prune --dry-run` only; exit 0 only when all are caught.

## Acceptance
- AC-01 (worktree part): both scaffolds build inside the temp workspace with the planted state; every grader matches its right example and misses its wrong one; `--counterexamples` exits 0 with all seven planted behaviours caught.

## Dependencies
- task-01-eval-kit.md

## Verification Plan
- Command: `bash evals/git/check-fixtures.sh worktree && bash evals/git/check-fixtures.sh worktree --counterexamples && node evals/git/verify-run.mjs --self-test`
- Named probe: sections `wt-plain-git-no-orca` and `wt-cleanup-prune` of `check-fixtures.sh` (each prints `ok: <case> <grader>`), `--counterexamples`, and `verify-run.mjs --self-test`.
- Reachability: source level; task 05's Command and Steps run these cases through `evals/run.sh` and `verify-run.mjs`.
- Oracle: exit 0 and one `ok:` line per grader per case; `dev` and `main` have different tips in the scaffold.
- Counterexample: a grader that accepts a worktree cut from `main` while `dev` equals `main`, accepts a path only because it contains `$TARGET_DIR`, accepts `prune --dry-run`, or accepts removal of the ignored-dirty worktree makes `--counterexamples` exit 1; a scaffold that leaves no `prunable` entry fails the state check.
- Artifacts: none kept.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
