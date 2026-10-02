# Task 06 — The skill's worktree and commit text is repaired

Status: pending

## Outcome
`cf:git` tells the model to open, list, remove and prune worktrees with git alone and without losing uncommitted, ignored or unmerged work, to check the checkout and scan for secrets before staging, to stage by group, to stop on a secret without touching the index, and to scan without the helper — and the source pins, the Codex mirror, a fallback replay and a weakening check all pass.

## Scope
- In: `SKILL.md` (worktree and cleanup lines, secret-scan section, errors table), `references/worktree-blueprint.md`, `references/commit-protocols.md`, `references/finish-branch.md` only where it contradicts the lifecycle, the self-test pins, and two new scripts under `packages/spec/scripts/`.
- Out: `pr`/`push` flows beyond "current branch only, never `--force`", the scanner script, hooks, description and routing text, reinstalling `.claude/`.

## Coverage
- CP-04
- CP-05

## Ownership
- Modify: `packages/spec/src/claude/skills/git/SKILL.md`
- Modify: `packages/spec/src/claude/skills/git/references/worktree-blueprint.md`
- Modify: `packages/spec/src/claude/skills/git/references/commit-protocols.md`
- Modify: `packages/spec/src/claude/skills/git/references/finish-branch.md` (only if it contradicts the lifecycle)
- Modify: `packages/spec/scripts/run-skill-self-tests.mjs`
- Create: `packages/spec/scripts/check-git-fallback.sh`, `packages/spec/scripts/weaken-git-pins.sh`
- Read: `packages/spec/bin/__tests__/codex-native.test.js` (`:1555-1569`: exact list of source files containing `AskUserQuestion`; `git/SKILL.md` already holds one), `packages/spec/src/claude/scripts/scan-staged-secrets.cjs`

## Steps
1. Worktree blueprint. Keep Steps 1-5 and the pinned text (`"$TARGET_DIR" "$BASE_BRANCH"`, the hydration loop, `--exclude 'session-state/'`, `--exclude 'worktrees/'`, "from the current branch"). Replace the "never nested" rule by D-02. Replace the `||` at `:36` by explicit branches: the directory exists → stop and ask; the branch name exists → ask whether to reuse it (`git worktree add <dir> <branch>`) or choose a new name; never mask a `git` error. Add one line: Orca, Herdr and Claude Code's host worktree are optional shortcuts, never required. Add one sentence: a worktree holds one specs packet and the new session starts in that directory. Add the **lifecycle**, with exactly these rules:
   - list: `git worktree list --porcelain`;
   - remove `<dir>`: run `git -C <dir> status --porcelain --ignored` (ignore entries under the hydrated `.claude/`, `.codex/`, `.agents/`) and `git -C <dir> log --oneline <base>..HEAD` (`<base>` = the branch the worktree was cut from, else the integration branch); clean → `git worktree remove <dir>` without `--force`; any output → show it and ask for the typed confirmation `remove <dir-name>`;
   - prune: an entry marked `prunable` is removed with `git worktree prune`; never `rm -rf` a worktree directory;
   - branches: delete with `git branch -d <branch>`; `-D` only after the user typed `delete <branch>`; "merged" means the branch is listed by `git branch --merged <base>`;
   - never run `git clean -fdx` from the repository root while a nested worktree exists.
2. `SKILL.md`: point the `worktree` and cleanup lines at the lifecycle; in the secret section add the **fallback** used when `.claude/scripts/scan-staged-secrets.cjs` is absent, as one bash block between the markers `<!-- fallback-scan:start -->` and `<!-- fallback-scan:end -->`, in this contract: runs on bash 3.2 and BSD awk with no bash 4 feature; scans the added lines of `git diff HEAD -U0` and the lines of every untracked file; reports `file:line:class` and nothing else (never the line, value, or context); classes: `assignment` (a name containing `api_key`, `apikey`, `secret`, `password`, `passwd`, `token`, `private_key`, any case, then optional spaces, `=` or `:`, optional spaces, and a value that is either a quoted string — single, double or backtick quotes — with at least 12 characters between the quotes that does not start with `$`, `<` or `process.env`, or an unquoted single token of `[A-Za-z0-9+/_=-]` with at least 16 characters; a value containing a space, `.`, `(` or `)` outside quotes is not a token), `sk-prefix` (`sk-` followed by `[A-Za-z0-9_-]`, 20 characters or more in all), `gh-prefix` (`gh` + one of `p o s u r` + `_` followed by `[A-Za-z0-9]`, 20 or more in all), `bearer` (`Bearer ` followed by 20 or more of `[A-Za-z0-9._-]`), `private-key-block` (a `-----BEGIN … PRIVATE KEY-----` line); prose such as `// tokens: refresh every thirty minutes`, an empty value, `const password = config.get("db")`, `pw = process.env.PASSWORD` and `secret = $SECRET_FROM_ENV` never match. Keep the existing rule for an untracked secret (`.gitignore`) and for a tracked one (stop, rotate, ask); make "stop" mean the order of D-10: no `git reset`, `git restore --staged` or `git rm --cached` before the user answers.
3. `commit-protocols.md`: replace the opening `git add -A` by: confirm `git rev-parse --show-toplevel` and `git branch --show-current` match the target before staging (a prior `cd` or `git -C <target>` is acceptable only after such a check); scan before staging (fallback or helper per D-10); stage by group with explicit paths; nothing staged → exit cleanly. Replace the `git rm --cached` instruction by the stop rule of Step 2. Add: use no `mapfile`, `readarray`, `declare -A`, `${var,,}` or `&>>` (macOS ships bash 3.2); push only the current branch, never `--force`. Put the sentences that forbid `git add -A` and `git rm --cached` in `SKILL.md`, not in `commit-protocols.md`. Do not write the string `AskUserQuestion` in any file under `references/`.
4. `finish-branch.md`: read it against the lifecycle; change only a line that contradicts it (for example the worktree removal rule at `:49`); otherwise leave it byte-identical.
5. Self-test: keep the pins at `run-skill-self-tests.mjs:5009-5030` passing; add pins for D-02, each lifecycle rule, the confirmation phrases, the absence of a line starting with `git add -A` and of `git rm --cached` in `commit-protocols.md`, the checkout check, the scan-before-stage order, the fallback markers, and the bash 3.2 note.
6. `check-git-fallback.sh`: extract the block between the markers, run it with `/bin/bash` in a `mktemp -d` repository holding: positive shapes (a quoted key built from pieces, a `ghp_`-style token, a `Bearer` string, a private-key header, an unquoted assignment) and negatives (the word `tokens` in a comment, `// tokens: refresh every thirty minutes`, `password: ""`, `const password = config.get("db")`, `pw = process.env.PASSWORD`, `secret = $SECRET_FROM_ENV`); exit 0 only when stdout is exactly `file:line:class` lines for the positives, contains no 20-character value, and is silent for the negatives.
7. `weaken-git-pins.sh`: build a light copy in `mktemp -d` — `rsync -a --exclude node_modules packages/spec <tmp>/packages/`, plus `README.md`, `docs/` and `plans/` (the static pins read `../../README.md`, `../../docs/…`, `../../plans/…`), then `git init -q` there (the static section resolves a git root); in the copy run `node packages/spec/scripts/run-skill-self-tests.mjs --static-only`, which must exit 0 unweakened (replayed 2026-10-02: 627 focused static tests, 11 MB copy). For each new pin remove its sentence from the copy's skill text and require the same command to exit non-zero; exit 0 only when the unweakened copy passes and every weakened copy fails. The full self-test is not used here: it needs `node_modules` and a real git root, and a copy of the whole tree still showed 5 failures in 525 tests (replayed).

## Acceptance
- AC-04, AC-05, AC-06, AC-07, AC-08: `pnpm --dir packages/spec test`, `node --test packages/spec/bin/__tests__/codex-native.test.js` and `package-inventory.test.js` exit 0; `commit-protocols.md` has no line starting with `git add -A` and no `git rm --cached`; `check-git-fallback.sh` and `weaken-git-pins.sh` exit 0.

## Dependencies
- task-05-measure-baseline.md

## Verification Plan
- Command: `pnpm --dir packages/spec test && node --test packages/spec/bin/__tests__/codex-native.test.js && node --test packages/spec/bin/__tests__/package-inventory.test.js && [ "$(grep -c '^git add -A' packages/spec/src/claude/skills/git/references/commit-protocols.md)" = 0 ] && [ "$(grep -c 'git rm --cached' packages/spec/src/claude/skills/git/references/commit-protocols.md)" = 0 ] && ! grep -rn 'AskUserQuestion' packages/spec/src/claude/skills/git/references && grep -q 'git worktree prune' packages/spec/src/claude/skills/git/references/worktree-blueprint.md && bash packages/spec/scripts/check-git-fallback.sh && bash packages/spec/scripts/weaken-git-pins.sh`
- Named probe: the new `cf:git …` entries of `run-skill-self-tests.mjs`; the `git/SKILL.md` snippet and `AskUserQuestion` list checks of `codex-native.test.js`; `package-inventory.test.js` parity; `check-git-fallback.sh`; `weaken-git-pins.sh`.
- Reachability: source level (the written contract) plus the fallback block executed on bash 3.2; live-model behaviour is task 07's measurement. The weakening runs on a light `mktemp -d` copy with `--static-only`, never on tracked bytes.
- Oracle: exit 0 with non-zero test counts (the weakening script prints `unweakened pass, <k>/<k> weakened copies fail`); both `grep -c` print 0; no `AskUserQuestion` under `references/`; the fallback prints only `file:line:class` for the positive shapes and nothing for the negatives; every weakened copy fails the self-test.
- Counterexample: a blueprint that still says "never nested" without D-02, a `commit-protocols.md` that still starts with `git add -A`, a fallback that prints a value or fires on `tokens`, a removed hydration line, a worktree remove that checks only `status --porcelain` (the pin names `--ignored`), or a Codex mirror whose text drifts each fail a probe.
- Artifacts: none; weakening copies are ephemeral and removed.

## Failure Protocol
On a failed Step or Verification Plan run: stop; do not widen scope, change the Command, or weaken a test; record observed versus expected; repair only the cited cause; after three failed rounds, stop and ask the user.

## Receipt
