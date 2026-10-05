#!/usr/bin/env node
// Trần tiền của gói lean-fix-debug, $150 (plan D-04): cộng costUsd tầng trên cùng và judgeCostUsd của mọi lượt, trên mọi
// result.json nằm ngay dưới một thư mục evals/results/{fix,debug}/lean-* (pilot, ô và các ô -lan1 đều tính).
//   node evals/lean/budget.mjs spent [--root <results root>]         in `budget: spent=<x> cap=150`; thoát 1 khi vượt trần
//   node evals/lean/budget.mjs check <next> [--root <results root>]  in thêm next= total=; thoát 1 khi spent + next vượt trần
//   node evals/lean/budget.mjs --self-test
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const CAP = 150;
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export function spent(root) {
  let total = 0;
  for (const skill of ["fix", "debug"]) {
    const dir = path.join(root, skill);
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      if (!e.isDirectory() || !e.name.startsWith("lean-")) continue;
      const file = path.join(dir, e.name, "result.json");
      if (!fs.existsSync(file)) continue;
      const r = JSON.parse(fs.readFileSync(file, "utf8"));
      total += r.costUsd || 0;
      for (const c of r.cases || []) for (const arm of Object.values(c.arms || {})) for (const x of arm || []) total += x.judgeCostUsd || 0;
    }
  }
  return Number(total.toFixed(4));
}

function main(args) {
  let root = path.join(repo, "evals", "results");
  const i = args.indexOf("--root");
  if (i >= 0) { root = path.resolve(args[i + 1]); args = args.filter((_, k) => k !== i && k !== i + 1); }
  const s = spent(root);
  if (args[0] === "spent" && args.length === 1) {
    console.log(`budget: spent=${s} cap=${CAP}`);
    return s > CAP ? 1 : 0;
  }
  if (args[0] === "check" && args.length === 2 && Number.isFinite(Number(args[1])) && Number(args[1]) >= 0) {
    const next = Number(args[1]);
    const total = Number((s + next).toFixed(4));
    console.log(`budget: spent=${s} next=${next} total=${total} cap=${CAP}`);
    return total > CAP ? 1 : 0;
  }
  console.error("usage: node evals/lean/budget.mjs spent | check <next> [--root <results root>] | --self-test");
  return 2;
}

function selfTest() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lean-budget-"));
  let failed = 0;
  const expect = (label, cond, detail) => { console.log(`${cond ? "ok" : "fail"}: ${label}${cond ? "" : ` → ${detail}`}`); if (!cond) failed++; };
  try {
    expect("empty root → 0", spent(tmp) === 0, spent(tmp));
    const mk = (skill, name, cost, judges) => {
      const dir = path.join(tmp, skill, name);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, "result.json"), JSON.stringify({ costUsd: cost, cases: [{ arms: { with: judges.map((j) => ({ judgeCostUsd: j })) } }] }));
    };
    mk("fix", "lean-goc-a-sonnet", 2, [0.1, 0.2]);
    mk("debug", "lean-pilot-goc-b-opus", 1.5, [0.05]);
    mk("fix", "lean-goc-a-sonnet-lan1", 1, []);
    mk("fix", "base-a-sonnet", 50, [1]);
    mk("ask", "lean-goc-x-sonnet", 50, []);
    fs.mkdirSync(path.join(tmp, "fix", "lean-empty"), { recursive: true });
    expect("sums lean-* under fix and debug only", spent(tmp) === 4.85, spent(tmp));
    expect("check within cap → 0", main(["check", "100", "--root", tmp]) === 0, "exit");
    expect("check above cap → 1", main(["check", "146", "--root", tmp]) === 1, "exit");
    expect("spent within cap → 0", main(["spent", "--root", tmp]) === 0, "exit");
    mk("debug", "lean-sau-big-opus", 200, []);
    expect("spent above cap → 1", main(["spent", "--root", tmp]) === 1, "exit");
    expect("bad usage → 2", main(["check", "-1", "--root", tmp]) === 2, "exit");
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  if (failed) { console.log(`self-test: ${failed} failed`); process.exit(1); }
  console.log("self-test: ok");
}

const args = process.argv.slice(2);
if (args[0] === "--self-test") selfTest();
else process.exit(main(args));
