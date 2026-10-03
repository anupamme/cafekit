#!/usr/bin/env node
// Trần riêng của gói test-eval-baseline ($100, plan D-04): cộng costUsd tầng trên cùng của mọi result.json dưới
// evals/results/test/ (mọi độ sâu, gồm -lan1), cộng mọi _kept/**/*.lost.json — một ô bị ngắt không có result.json nên
// driver ghi số tiền tối đa nó có thể đã tiêu (plan D-06).
//   node evals/test/budget.mjs spent [--root <results root>]          in spent=; thoát 1 khi đã vượt 100
//   node evals/test/budget.mjs check <next> [--root …]                thoát 1 khi spent + next vượt 100
//   node evals/test/budget.mjs ceiling <sonnet|opus> [--root …]       in một số nguyên max(4, ⌈12 × pilot đắt nhất⌉)
//   node evals/test/budget.mjs reserve <sonnet|opus> [--root …]       in ceiling + pilot đắt nhất (một ô có thể vượt một lượt)
//   node evals/test/budget.mjs fits [--assume-missing <usd>] [--root …]
//                                     thoát 1 khi spent + 4 × reserve mỗi model vượt 100; --assume-missing cộng <usd> vào
//                                     spent cho mỗi pilot còn thiếu, và trần của model lấy từ các pilot đã có
//   node evals/test/budget.mjs --self-test
// ceiling đọc pilot-<ca>-<model> (hoặc -lan1) của bốn ca; thoát 1 khi một pilot thiếu, partial hay không đúng một lượt sạch.
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const SELF = fileURLToPath(import.meta.url);
const CAP = 100;
const CASES = ["sach", "do", "khong-test", "thieu-cong-cu"];
const MODELS = ["sonnet", "opus"];
const round = (x) => Number(x.toFixed(4));
const resolveCell = (dir) => (fs.existsSync(`${dir}-lan1`) ? `${dir}-lan1` : dir);
// An unreadable file or a missing cost must not count as $0: the budget would then open instead of close.
const costOf = (file) => {
  let j; try { j = JSON.parse(fs.readFileSync(file, "utf8")); } catch { throw new Error(`${file}: unreadable, its cost is unknown`); }
  if (!Number.isFinite(Number(j.costUsd))) throw new Error(`${file}: no costUsd`);
  return Number(j.costUsd);
};

export function spent(root) {
  let total = 0;
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name === "result.json" || (e.name.endsWith(".lost.json") && p.includes(`${path.sep}_kept${path.sep}`))) total += costOf(p);
    }
  };
  const res = path.join(root, "test");
  if (fs.existsSync(res)) walk(res);
  return round(total);
}

// The pilots of one model: their highest cost and how many are missing. A present pilot must be one clean run.
function pilots(root, model) {
  let top = 0, missing = 0;
  for (const kase of CASES) {
    const dir = resolveCell(path.join(root, "test", `pilot-${kase}-${model}`)), file = path.join(dir, "result.json");
    if (!fs.existsSync(file)) { missing++; continue; }
    const r = JSON.parse(fs.readFileSync(file, "utf8")), runs = r.cases?.[0]?.arms?.with || [];
    if (r.partial || runs.length !== 1 || runs[0].error) return { error: `${dir}: not one clean run` };
    top = Math.max(top, r.costUsd || 0);
  }
  return { top, missing };
}
// ⌈12 × top⌉ on nine decimals: float noise below 1e-9 never adds a dollar, and a real fraction always does.
const ceilingOf = (top) => Math.max(4, Math.ceil(Number((12 * top).toFixed(9))));

export function ceiling(root, model, { allowMissing = false } = {}) {
  const p = pilots(root, model);
  if (p.error) return p;
  if (p.missing && !allowMissing) return { error: `${model}: ${p.missing} pilot(s) missing` };
  return { value: ceilingOf(p.top), reserve: round(ceilingOf(p.top) + p.top), missing: p.missing };
}

function main(args) {
  let root = path.join(path.dirname(SELF), "..", "results");
  const r = args.indexOf("--root"); if (r >= 0) { root = args[r + 1]; args.splice(r, 2); }
  let x; try { x = spent(root); } catch (e) { console.error(e.message); return 1; }
  const num = (s) => s !== undefined && s.trim() !== "" && Number.isFinite(Number(s)) && Number(s) >= 0;
  if (args[0] === "spent" && args.length === 1) { console.log(`spent=${x} cap=${CAP}`); return x > CAP ? 1 : 0; }
  if (args[0] === "check" && args.length === 2 && num(args[1])) {
    const next = Number(args[1]); console.log(`spent=${x} next=${next} total=${round(x + next)} cap=${CAP}`); return x + next > CAP ? 1 : 0;
  }
  if ((args[0] === "ceiling" || args[0] === "reserve") && args.length === 2 && MODELS.includes(args[1])) {
    const c = ceiling(root, args[1]); if (c.error) { console.error(c.error); return 1; }
    console.log(String(args[0] === "ceiling" ? c.value : c.reserve)); return 0;
  }
  const am = args.indexOf("--assume-missing");
  if (args[0] === "fits" && (args.length === 1 || (args.length === 3 && am === 1 && num(args[2])))) {
    const assume = am === 1 ? Number(args[2]) : null;
    const cs = MODELS.map((m) => ceiling(root, m, { allowMissing: assume !== null })), err = cs.find((c) => c.error);
    if (err) { console.error(err.error); return 1; }
    const extra = assume === null ? 0 : assume * cs.reduce((n, c) => n + c.missing, 0);
    const need = round(x + extra + 4 * cs[0].reserve + 4 * cs[1].reserve);
    console.log(`spent=${x} missing=${round(extra)} sonnet=${cs[0].value}+${round(cs[0].reserve - cs[0].value)} opus=${cs[1].value}+${round(cs[1].reserve - cs[1].value)} need=${need} cap=${CAP}`);
    return need > CAP ? 1 : 0;
  }
  console.error("usage: node evals/test/budget.mjs spent | check <next> | ceiling <model> | reserve <model> | fits [--assume-missing <usd>] [--root <results root>] | --self-test");
  return 2;
}

function selfTest() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "test-budget-st-"));
  let failed = 0;
  const me = (args) => spawnSync(process.execPath, [SELF, ...args, "--root", root], { encoding: "utf8" });
  const check = (label, ok, out) => { console.log(`${ok ? "ok" : "FAIL"}: budget self-test: ${label}${ok ? "" : ` — ${out}`}`); if (!ok) failed++; };
  const res = (rel, cost, runs = [{}], partial = false) => { const d = path.join(root, rel); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, "result.json"), JSON.stringify({ costUsd: cost, partial, cases: [{ arms: { with: runs } }] })); };
  try {
    res("test/nap-sach-sonnet", 0.5); res("test/base-do-sonnet-lan1/nested", 1.5); res("develop/v3-x", 50); res("brainstorm/x", 9);
    fs.mkdirSync(path.join(root, "test", "_kept", "t05"), { recursive: true });
    fs.writeFileSync(path.join(root, "test", "_kept", "t05", "base-sach-opus.lost.json"), JSON.stringify({ costUsd: 2 }));
    fs.writeFileSync(path.join(root, "test", "notes.lost.json"), JSON.stringify({ costUsd: 50 }));
    let r = me(["spent"]); check("result.json at any depth plus _kept/**/*.lost.json count, other suites and loose files not → spent=4", r.status === 0 && r.stdout.trim() === "spent=4 cap=100", r.stdout);
    r = me(["check", "96"]); check("check 96 on $4 → total=100, exit 0", r.status === 0 && r.stdout.includes("total=100 "), r.stdout);
    r = me(["check", "96.5"]); check("check 96.5 on $4 → exit 1", r.status === 1, r.stdout);
    r = me(["check", "-1"]); check("check -1 → usage, exit 2", r.status === 2, r.stdout);
    for (const k of ["sach", "do", "khong-test"]) res(`test/pilot-${k}-sonnet`, 0.1);
    r = me(["ceiling", "sonnet"]); check("ceiling with a pilot missing → exit 1", r.status === 1 && r.stderr.includes("missing"), r.stderr);
    res("test/pilot-thieu-cong-cu-sonnet", 0.2, [{}, {}]);
    r = me(["ceiling", "sonnet"]); check("ceiling with a pilot of two runs → exit 1", r.status === 1 && r.stderr.includes("not one clean run"), r.stderr);
    res("test/pilot-thieu-cong-cu-sonnet-lan1", 0.25);
    r = me(["ceiling", "sonnet"]); check("ceiling reads -lan1 and keeps the $4 floor: max(4, ⌈12 × 0.25⌉) → 4", r.status === 0 && r.stdout === "4\n", r.stdout);
    r = me(["reserve", "sonnet"]); check("reserve = ceiling + highest pilot → 4.25", r.status === 0 && r.stdout === "4.25\n", r.stdout);
    for (const k of ["sach", "do", "khong-test"]) res(`test/pilot-${k}-opus`, 0.6);
    r = me(["fits"]); check("fits without a pilot → exit 1", r.status === 1 && r.stderr.includes("missing"), r.stderr);
    r = me(["fits", "--assume-missing", "4"]); check("fits --assume-missing 4: spent 6.55 + 4 + 4 × 4.25 + 4 × (8 + 0.6) = 61.95, exit 0", r.status === 0 && r.stdout.includes("missing=4 ") && r.stdout.includes("need=61.95"), r.stdout);
    res("test/pilot-thieu-cong-cu-opus", 0.51, [{ error: "boom" }]);
    r = me(["ceiling", "opus"]); check("ceiling with an errored pilot → exit 1", r.status === 1, r.stderr);
    res("test/pilot-thieu-cong-cu-opus", 0.51);
    r = me(["ceiling", "opus"]); check("ceiling prints one integer: ⌈12 × 0.6⌉ → 8", r.status === 0 && r.stdout === "8\n", r.stdout);
    r = me(["fits"]); check("fits: spent 7.06 + 4 × 4.25 + 4 × 8.6 = 58.46 → exit 0", r.status === 0 && r.stdout.includes("need=58.46"), r.stdout);
    res("test/base-x-opus", 45);
    r = me(["fits"]); check("fits: spent 52.06 + 51.4 = 103.46 > 100 → exit 1", r.status === 1 && r.stdout.includes("need=103.46"), r.stdout);
    res("test/pilot-sach-opus", 0.6, [{}], true);
    r = me(["ceiling", "opus"]); check("ceiling with a partial pilot → exit 1", r.status === 1 && r.stderr.includes("not one clean run"), r.stderr);
    res("test/pilot-sach-opus", 0.6);
    r = me(["ceiling", "haiku"]); check("ceiling for an unknown model → usage, exit 2", r.status === 2, r.stdout);
    r = me(["fits", "--assume-missing"]); check("fits --assume-missing without a cost → usage, exit 2", r.status === 2, r.stdout);
    res("test/base-y-opus", 50); r = me(["spent"]); check("spent 102.06 above the cap → exit 1", r.status === 1, r.stdout);
    const two = fs.mkdtempSync(path.join(os.tmpdir(), "test-budget-two-"));
    try {
      const put = (rel, cost) => { const d = path.join(two, rel); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, "result.json"), JSON.stringify({ costUsd: cost, cases: [{ arms: { with: [{}] } }] })); };
      for (const k of ["sach", "do"]) { put(`test/pilot-${k}-sonnet`, 0.4166667); put(`test/pilot-${k}-opus`, 0.1); }
      const t = (a) => spawnSync(process.execPath, [SELF, ...a, "--root", two], { encoding: "utf8" });
      r = t(["fits", "--assume-missing", "4"]);
      check("fits --assume-missing 4 with four pilots missing adds 4 × 4 = 16", r.status === 0 && r.stdout.includes("missing=16 "), r.stdout);
      check("ceiling is ⌈12 × 0.4166667⌉ = 6, not rounded down", t(["fits", "--assume-missing", "4"]).stdout.includes("sonnet=6+"), r.stdout);
      fs.writeFileSync(path.join(two, "test", "pilot-sach-opus", "result.json"), '{"costUsd":');
      r = t(["spent"]); check("an unreadable result.json makes spent exit 1, not count $0", r.status === 1 && r.stderr.includes("unreadable"), r.stderr + r.stdout);
    } finally { fs.rmSync(two, { recursive: true, force: true }); }
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
  return failed ? 1 : 0;
}

// realpath on both sides: a call through a symlinked path still runs the CLI.
if (process.argv[1] && fs.realpathSync(path.resolve(process.argv[1])) === fs.realpathSync(SELF)) {
  const args = process.argv.slice(2);
  process.exit(args[0] === "--self-test" ? selfTest() : main(args));
}
