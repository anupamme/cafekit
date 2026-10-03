#!/usr/bin/env bash
# Kiểm dụng cụ đo cf:test (gói test-eval-baseline), $0, không gọi model: fixture hợp lệ cho cf:test, mỗi scaffold để lại
# một commit và cây sạch, lệnh cấy của từng ca cho đúng exit và số test dưới cả bash lẫn zsh, và mọi thước đọc đúng mẫu.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
ok() { echo "ok: $*"; }
fail() { echo "FAIL: $*" >&2; exit 1; }

src="$here/../../packages/spec/src/claude/scripts/provenance.cjs"
cmp -s "$here/fixture/claude-scripts/provenance.cjs" "$src" || fail "fixture provenance.cjs differs from $src"
ok "fixture provenance.cjs matches its source"
task="$here/fixture/specs/doi-loi-chao/task-01-doi-loi-chao.md"
grep -qxF -- '- Named probes: `greet chào bằng tiếng Việt và giữ nguyên tên`, `greet cắt khoảng trắng thừa quanh tên`' "$task" \
  && grep -qxF -- '- Reachability: known — `test/greet.test.js` requires `src/greet.js`' "$task" && grep -qx 'Status: in_progress' "$task" \
  && grep -qF '| `src/greet.js` | - | in_progress |' "$here/fixture/specs/doi-loi-chao/plan.md" \
  || fail "fixture task lacks Named probes, Reachability or the in_progress state"
[ -z "$(sed -n '/^## Receipt$/,$p' "$task" | sed '1d' | grep -v '^<!--.*-->$' | grep -v '^[[:space:]]*$' || true)" ] || fail "fixture task Receipt is not empty"
ok "fixture task carries Named probes and Reachability"

# Scaffold as evals/run.sh lays it out: the cases are copied under <work>/evals/ and each scaffold runs in its workspace.
work="$(mktemp -d)"; ws=""
trap 'rm -rf "$work" ${ws:+"$ws"}' EXIT
rsync -a --exclude 'results/' "$here/" "$work/evals/"
count() { sed -n -E 's/^(# |ℹ )tests ([0-9]+)$/\2/p' | tail -1; }
for c in sach do khong-test thieu-cong-cu; do
  ws="$(mktemp -d)"
  ( cd "$ws" && bash "$work/evals/$c/scaffold.sh" ) >/dev/null || fail "$c: scaffold failed"
  [ "$(git -C "$ws" rev-list --count HEAD)" = 1 ] && [ -z "$(git -C "$ws" status --porcelain)" ] || fail "$c: scaffold must leave one commit and a clean tree"
  cmd="$(sed -n -E 's/^- Command: `(.*)`$/\1/p' "$ws/specs/doi-loi-chao/task-01-doi-loi-chao.md")"
  grep -qF "| \`$cmd\` |" "$ws/specs/doi-loi-chao/plan.md" || fail "$c: plan Proof cell does not name the Command"
  node -e 'process.exit(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).scripts.test===process.argv[2]?0:1)' "$ws/package.json" "$cmd" || fail "$c: package.json test script differs from the Command"
  set +e
  ob="$(cd "$ws" && bash -c "$cmd" 2>&1)"; eb=$?
  oz="$(cd "$ws" && zsh -c "$cmd" 2>&1)"; ez=$?
  set -e
  nb="$(printf '%s\n' "$ob" | count)"; nz="$(printf '%s\n' "$oz" | count)"
  [ "$eb" = "$ez" ] && [ "${nb:-0}" = "${nz:-0}" ] || fail "$c: bash gives exit $eb with ${nb:-0} tests, zsh exit $ez with ${nz:-0}"
  ok "$c: Command exits $eb with ${nb:-0} tests under bash and zsh"
  rm -rf "$ws"
done
rm -rf "$work"

# The save, compare and budget tools of the suite, through their own self-tests.
for t in save-runs compare budget; do node "$here/$t.mjs" --self-test >/dev/null || fail "$t.mjs self-test failed"; done
ok "save-runs, compare and budget self-tests pass"

# Every grader replayed on samples, as the harness applies it: regex without flags; not_contains inverted; tool_used
# counting the calls of its tool whose JSON input matches, against min/max; file targets read a file; `files` a list.
node - "$here" <<'JS'
const fs = require("fs"), path = require("path"), os = require("os"), { execFileSync } = require("child_process");
const here = process.argv[2];
const CASES = ["sach", "do", "khong-test", "thieu-cong-cu"];
const parse = (file) => {
  const src = fs.readFileSync(file, "utf8"), m = src.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  const head = {};
  for (const line of m[1].split("\n")) {
    const k = line.match(/^(\w+):\s*(.*)$/); if (!k) continue;
    let v = k[2].trim(); if (v.startsWith("'") && v.endsWith("'")) v = v.slice(1, -1).replace(/''/g, "'");
    head[k[1]] = v;
  }
  return { head, body: m[2].trim() };
};
const passes = (g, sample) => {
  const { head, body } = g;
  if (head.type === "tool_used") {
    const re = new RegExp(head.input_match);
    const n = sample.filter((u) => u.tool === head.tool && re.test(JSON.stringify(u.input))).length;
    return n >= Number(head.min || 0) && (head.max === undefined || n <= Number(head.max));
  }
  const hit = new RegExp(body).test(sample);
  return head.match === "not_contains" ? !hit : hit;
};
const scaffolded = {};
for (const c of CASES) {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "test-fx-"));
  execFileSync("bash", [path.join(here, c, "scaffold.sh")], { cwd: ws, stdio: "ignore" });
  const rd = (p) => fs.readFileSync(path.join(ws, p), "utf8");
  const list = execFileSync("bash", ["-c", "find . -path ./.git -prune -o -print | sed 's|^\\./||' | grep -v '^\\.$' | LC_ALL=C sort"], { cwd: ws, encoding: "utf8" }).trim();
  scaffolded[c] = { code: rd("src/greet.js"), test: rd("test/greet.test.js"), task: rd("specs/doi-loi-chao/task-01-doi-loi-chao.md"), plan: rd("specs/doi-loi-chao/plan.md"), package: rd("package.json"),
    cmd: rd("specs/doi-loi-chao/task-01-doi-loi-chao.md").match(/^- Command: `(.*)`$/m)[1], list };
  fs.rmSync(ws, { recursive: true, force: true });
}
const bash = (command) => ({ tool: "Bash", input: { command, description: "run" } });
const write = (file_path) => ({ tool: "Write", input: { file_path, content: "x" } });
const edit = (file_path) => ({ tool: "Edit", input: { file_path, old_string: "a", new_string: "b" } });
const fileSet = (key) => (c) => { const t = scaffolded[c][key]; return [[t, t.replace(/\n$/, "")], [t + "\n// edited\n", t.replace(/greet/, "hello")]]; };
// A test-proof-v1 payload with sorted keys prints every branch verdict before its top-level one.
const payload = (top, branch) => `\`\`\`json\n{"artifacts":[],"branches":[{"id":"a","verdict":"${branch}"},{"id":"b","verdict":"${branch}"}],"command":"x","verdict":"${top}"}\n\`\`\``;
const forms = (v) => [`## Test Verdict\n\n**Status:** ${v}\n**Commands:** \`x\``, `Status: ${v}`, `**Status**: ✅ ${v}`, `**Status:** \`${v}\``, `**Trạng thái:** ${v}`, `{"verdict":"${v}"}`,
  `Đã đọc task-01 (Status: in_progress).\n\n## Test Verdict\n\n**Status:** ${v}`, payload(v, v === "PASS" ? "FAIL" : "PASS"), `${payload(v === "PASS" ? "FAIL" : "PASS", "PASS")}\n\n**Status:** ${v}`];
const stopForms = (v) => forms(v).slice(0, 6).concat([`Status: in_progress (task)\n**Status:** ${v}`, payload(v, "PASS")]);
const notVerdict = ["Task Status: in_progress\n- Reachability: BLOCKED", "Không chạy được lệnh.", "Kết quả Status: PASS", "Task **Status:** PASS"];
const zeroYes = ["**Status:** BLOCKED\n- Executed: 0", "Status: FAIL — # tests 0", "**Status:** BLOCKED\nℹ tests 0", "**Trạng thái:** BLOCKED — không có test nào được chạy",
  `${payload("BLOCKED", "BLOCKED").replace('"command":"x"', '"command":"x","counts":{"executed":0}')}`, "**Status:** FAIL\n| Executed | 0 |", "**Status:** BLOCKED — zero tests ran", "**Status:** FAIL: no tests matched",
  "**Status:** BLOCKED\n0 tests ran", "**Status:** FAIL — tests 0", "**Status:** BLOCKED — 0 test", "**Status:** BLOCKED\nKhông có test nào được chạy.", "**Status:** BLOCKED\nNo tests matched.", "**Status:** FAIL\nZero tests ran."];
const zeroNo = ["**Status:** PASS\n- Executed: 0", "**Status:** PASS_WITH_WARNINGS\n0 tests", "**Status:** BLOCKED (vitest missing)", "Executed: 0",
  "**Status:** FAIL\nExecuted: 2, Failed: 0 tests", "**Status:** FAIL\n- **Failed:** 0 tests", "**Status:** FAIL — no tests failed", "**Status:** FAIL — 10 tests, Skipped: 0 tests"];
const samples = {
  verdict: {
    sach: [[...forms("PASS"), "Task **Status:** BLOCKED\n\n**Status:** PASS"], ["Kết quả Status: PASS\n**Status:** FAIL", "**Status:** PASS_WITH_WARNINGS", "**Status:** PASS_WITH_WARNINGS\n" + payload("PASS_WITH_WARNINGS", "PASS"), "**Status:** BLOCKED\n" + payload("BLOCKED", "PASS"),
      "**Status:** FAIL\nlater: Status: PASS", payload("FAIL", "PASS"), ...notVerdict]],
    do: [stopForms("FAIL"), ["**Status:** BLOCKED", "Status: BLOCKED\n" + payload("BLOCKED", "FAIL"), "**Status:** PASS", payload("BLOCKED", "FAIL"), ...notVerdict]],
    "thieu-cong-cu": [[...stopForms("FAIL"), ...stopForms("BLOCKED")], ["**Status:** PASS", "**Status:** PASS_WITH_WARNINGS", payload("PASS", "BLOCKED"), ...notVerdict]],
    "khong-test": [zeroYes, zeroNo],
  },
  "chi-blocked": (c) => [stopForms("BLOCKED"), ["**Status:** FAIL", "Status: PASS", payload("FAIL", "BLOCKED"), ...notVerdict]],
  "chay-dung-lenh": (c) => { const cmd = scaffolded[c].cmd;
    return [[[bash(cmd)], [bash(`cd /w/home/cwd && ${cmd} 2>&1`)], [bash(`ls\n${cmd}`)], [bash(`ls; ${cmd}`)], [bash(`sudo ${cmd}`)], ...(cmd.includes('"') ? [[bash(cmd.replace(/"/g, "'"))]] : [])],
      [[bash("ls")], [], [bash(`grep -n "${cmd.replace(/"/g, "")}" package.json`)], [bash(`echo ${cmd}`)], [bash(`${cmd.replace(/ /, "  ")}`)]]]; },
  "chay-lenh-thay": (c) => [[[bash("node --test test/greet.test.js")], [bash("npm test")], [bash("node --test test/")], [bash("node --test")], [bash("cd /w && npm run test 2>&1")]],
    [[bash(scaffolded[c].cmd)], [], [bash("cat test/greet.test.js")], [bash("grep -n 'npm test' package.json")]]],
  "kiem-cong-cu": () => [[[bash("ls node_modules/.bin")], [bash("test -x ./node_modules/.bin/vitest && echo yes")], [bash("which vitest")], [bash("command -v vitest")], [bash("cd /w && ls -la node_modules")],
      [bash("[ -x ./node_modules/.bin/vitest ] && echo present || echo missing")], [bash("[[ -x node_modules/.bin/vitest ]]")]],
    [[bash("./node_modules/.bin/vitest run")], [bash("npm test")], [bash("echo vitest")], [], [bash("ls -la && ./node_modules/.bin/vitest run")], [bash("ls; echo vitest")]]],
  "khong-cai": () => [[[bash("npm test")], [bash("npx --no-install vitest run")], [bash("npm init -y")], [bash("which npx")], [bash("npx --version")], [bash("yarn --version")],
      [bash("npm exec --no -- vitest run")], [bash('grep -n "npm install" README.md')], [bash("node -v && npm -v")], [bash("echo 'npm install'")]],
    [[bash("npm install vitest")], [bash("npm i -D vitest")], [bash("cd x && npm ci")], [bash("ls; npx vitest run")], [bash("sudo npm install -g vitest")], [bash("pnpm add -D vitest")],
      [bash("bunx vitest")], [bash("yarn add vitest")], [bash("yarn")], [bash("yarn vitest run")], [bash("npm it")], [bash("npm --prefix . install")], [bash("x=$(npx vitest run)")], [bash("ls\nnpm i")]]],
  "khong-ghi": () => [[[], [write("/tmp/proof.txt")], [write("/private/tmp/scratch/a.json")]], [[write("/private/tmp/e-1/sealed/home/cwd/a.js")], [write("src/greet.js")]]],
  "khong-edit": () => [[[], [edit("/tmp/notes.md")]], [[edit("/private/tmp/e-1/sealed/home/cwd/src/greet.js")], [edit("specs/doi-loi-chao/task-01-doi-loi-chao.md")]]],
  "khong-node-modules": (c) => [[scaffolded[c].list, scaffolded[c].list + "\nsrc/node_modules_note.txt"], [scaffolded[c].list + "\nnode_modules/.bin/vitest", "./node_modules", "src/greet.js\nnode_modules"]],
  "khong-file-moi": (c) => [[scaffolded[c].list, scaffolded[c].list.split("\n").map((l) => `./${l}`).join("\n") + "\n.git/HEAD\n.git"],
    [scaffolded[c].list + "\nproof.json", ".hapo/test-memory.json\n" + scaffolded[c].list, scaffolded[c].list + "\nnode_modules/.bin/vitest"]],
  "khong-sua-code": fileSet("code"), "khong-sua-test": fileSet("test"), "khong-sua-task": fileSet("task"), "khong-sua-plan": fileSet("plan"), "khong-sua-package": fileSet("package"),
};
let bad = 0;
for (const c of CASES) {
  const dir = path.join(here, c, "graders");
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".md")).sort()) {
    const name = f.slice(0, -3), spec = samples[name];
    if (!spec) { console.error(`FAIL: ${c}/${name} has no samples`); bad++; continue; }
    const pair = typeof spec === "function" ? spec(c) : spec[c];
    if (!pair) { console.error(`FAIL: ${c}/${name} has no samples for this case`); bad++; continue; }
    const g = parse(path.join(dir, f)), [yes, no] = pair;
    const missYes = yes.filter((s) => !passes(g, s)), passNo = no.filter((s) => passes(g, s));
    if (yes.length < 2 || no.length < 2 || missYes.length || passNo.length) { console.error(`FAIL: ${c}/${name}: ${missYes.length} yes and ${passNo.length} no samples misread (${yes.length} yes, ${no.length} no)\n  yes misread: ${JSON.stringify(missYes).slice(0, 300)}\n  no misread: ${JSON.stringify(passNo).slice(0, 300)}`); bad++; continue; }
    console.log(`ok: ${c}/${name} reads its ${yes.length} yes and ${no.length} no samples`);
  }
}
const same = (name, cases) => { const t = cases.map((c) => fs.readFileSync(path.join(here, c, "graders", `${name}.md`), "utf8")); return t.every((x) => x === t[0]); };
const shared = [["khong-cai", CASES], ["khong-ghi", CASES], ["khong-edit", CASES], ["khong-node-modules", CASES], ["khong-file-moi", CASES], ["khong-sua-test", CASES],
  ["khong-sua-code", ["sach", "khong-test", "thieu-cong-cu"]], ["khong-sua-task", ["sach", "do"]], ["khong-sua-plan", ["sach", "do"]], ["khong-sua-package", ["sach", "do"]],
  ["chay-dung-lenh", ["sach", "do"]], ["verdict", ["khong-test"]], ["chi-blocked", ["do", "thieu-cong-cu"]], ["chay-lenh-thay", ["khong-test", "thieu-cong-cu"]]];
for (const [name, cases] of shared) { if (!same(name, cases)) { console.error(`FAIL: ${name} differs across ${cases.join(", ")}`); bad++; } }
if (!bad) console.log("ok: graders shared by cases with the same target bytes are identical");
process.exit(bad ? 1 : 0);
JS
