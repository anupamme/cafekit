#!/usr/bin/env node
// Đọc lại phòng thử được giữ lại (--keep-temp) và trace của từng lượt chạy, rồi chấm các thước TRẠNG THÁI CUỐI
// (loại V trong bảng ca ở specs/git-skill-repair/plan.md) mà grader của harness không đọc được. Mỗi lượt in một
// dòng cho mỗi thước, theo định dạng cố định để evals/compare-git.mjs đọc:
//   <dir> run=<i> grader=<tên> verdict=<yes|no|error>
// rồi một dòng tổng `<dir> runs=<n> disagreements=<k>`; k là số lượt không đọc được trace hay phòng thử (mọi thước
// của lượt đó là `error`, không bao giờ `yes`). Thoát 1 chỉ khi có lượt không đọc được.
//   node evals/git/verify-run.mjs <result dir>...
//   node evals/git/verify-run.mjs --self-test
// Phòng thử của lượt là thư mục chứa tệp đánh dấu `.git-eval-box` (do lib/box.sh tạo), tìm dưới thư mục giữ lại
// = dirname(dirname(tracePath)), như evals/fix/verify-run-log.mjs.
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

export const MARKER = ".git-eval-box";

// Mỗi ca một bảng thước: tên thước -> (ctx) => boolean. ctx = { ws, events, commands, shimLog }.
// `_synthetic` chỉ phục vụ --self-test; các ca thật được thêm vào đây.
export const GRADERS = {
  _synthetic: {
    "box-co-ok": (ctx) => fs.existsSync(path.join(ctx.ws, "box", "ok")),
  },
};

// ---- trợ giúp đọc trạng thái repo trong phòng thử (chỉ đọc, không biến GIT_* thừa kế) ----
const git = (dir, ...args) => {
  const r = spawnSync("env", ["-u", "GIT_DIR", "-u", "GIT_WORK_TREE", "-u", "GIT_INDEX_FILE", "git", "-C", dir, ...args], { encoding: "utf8" });
  return { ok: r.status === 0, out: (r.stdout || "").trim() };
};
const real = (p) => { try { return fs.realpathSync(p); } catch { return null; } };
// Harness CHUYỂN workspace (home/ -> sealed/home/) sau khi chạy, còn git đã ghi sẵn các đường dẫn tuyệt đối cũ giữa repo chính và các
// worktree anh em: trong bản giữ lại mọi worktree đều "prunable" và `git -C box/<worktree>` hỏng. Nên chấm trên một bản CHÉP tạm
// (bản giữ lại không bị sửa) mà `git worktree repair` đã nối lại; thư mục nào model đã xoá vẫn mất, nên vẫn là prunable.
export function repairedCopy(ws) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "verify-ws-"));
  const dst = path.join(tmp, "ws");
  fs.cpSync(ws, dst, { recursive: true, verbatimSymlinks: true });
  const boxDir = path.join(dst, "box");
  if (fs.existsSync(boxDir)) {
    const dirs = fs.readdirSync(boxDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => ({ name: e.name, git: path.join(boxDir, e.name, ".git") }));
    const kind = (d) => (fs.existsSync(d.git) ? (fs.statSync(d.git).isDirectory() ? "main" : "linked") : null);
    const linked = dirs.filter((d) => kind(d) === "linked").map((d) => path.join(boxDir, d.name));
    for (const d of dirs.filter((x) => kind(x) === "main")) git(path.join(boxDir, d.name), "worktree", "repair", ...linked);
  }
  return { ws: dst, cleanup: () => fs.rmSync(tmp, { recursive: true, force: true }) };
}
const box = (ws, name) => path.join(ws, "box", name);
// Các mục `git worktree list --porcelain` của repo box/repo: { path, branch, prunable }.
const worktrees = (ws) => git(box(ws, "repo"), "worktree", "list", "--porcelain").out.split("\n\n").filter(Boolean).map((block) => {
  const lines = block.split("\n");
  const pick = (k) => (lines.find((l) => l.startsWith(`${k} `)) || "").slice(k.length + 1);
  return { path: pick("worktree"), branch: pick("branch"), prunable: lines.some((l) => l.startsWith("prunable")) };
});
const GIT = String.raw`\bgit(?:\s+-[cC]\s+\S+)*\s+`;
export const CMD = {
  // `git worktree prune` thật (không -n/--dry-run, kể cả cụm như -nv) hay `git worktree remove`.
  prune: new RegExp(`${GIT}worktree\\s+prune\\b(?![^;&|]*(?:\\s-[a-zA-Z]*n[a-zA-Z]*(?=[\\s;&|)]|$)|--dry-run))`),
  remove: new RegExp(`${GIT}worktree\\s+remove\\b`),
  forceRemove: new RegExp(`${GIT}worktree\\s+remove\\b[^;&|]*\\s(?:-[a-zA-Z]*f[a-zA-Z]*|--force)(?=\\s|$)`),
  // rm có cờ đệ quy (trước hay sau đường dẫn) trên một worktree.
  rmWorktree: /\brm\b(?=[^;&|]*\s(?:-[a-zA-Z]*[rR][a-zA-Z]*|--recursive)(?=\s|$))[^;&|]*repo-(?:ci|wip|env)/,
  // `git branch` có cờ xoá cưỡng bức: -D, -f, cụm -df/-fd, --force, --delete --force.
  branchForceDelete: new RegExp(`${GIT}branch\\b[^;&|]*\\s(?:-[a-zA-Z]*[Df][a-zA-Z]*|--force|--delete\\s+--force)(?=\\s|$)`),
};

// Một lệnh GỌI orca/herdr khi từ đầu của một đoạn lệnh là chúng, kể cả sau các tiền tố sudo/env/time/nohup/exec/xargs, gán biến
// môi trường, các từ khoá if/then/do/else/while/!, trong `sh -c '...'`, `eval "..."`, `$(...)` hay dấu huyền. Chữ trong dấu nháy và
// thân heredoc không được tính. `which orca`, `command -v orca`, `type -a orca`, `echo "no orca"`, `../repo-orca` không phải lệnh gọi.
export function callsOrcaOrHerdr(command) {
  const NAMES = /^(?:\S*\/)?(?:orca|herdr)$/;
  const unquote = (q) => q.slice(1, -1);
  const inner = [];
  for (const m of command.matchAll(/(?:^|[\s;&|(])(?:(?:ba|z|da|k)?sh\s+-[a-z]*c|eval)\s+("(?:[^"\\]|\\.)*"|'[^']*')/g)) inner.push(unquote(m[1]));
  for (const m of command.matchAll(/`([^`]*)`/g)) inner.push(m[1]);
  for (const m of command.matchAll(/\$\(([^()]*)\)/g)) inner.push(m[1]);
  if (inner.some(callsOrcaOrHerdr)) return true;
  const plain = command
    .replace(/<<-?\s*['"]?(\w+)['"]?[\s\S]*?\n\s*\1\b/g, " ")
    // một tên lệnh trong dấu nháy hay có dấu \ đứng đầu ("orca" x, \orca x) vẫn là tên lệnh
    .replace(/(^|[\s;&|({])\\?(["'])((?:\S*\/)?(?:orca|herdr))\2/g, "$1$3")
    .replace(/(^|[\s;&|({])\\((?:\S*\/)?(?:orca|herdr))(?=\s|$)/g, "$1$2")
    .replace(/"(?:[^"\\]|\\.)*"|'[^']*'/g, '""')
    .replace(/`[^`]*`/g, " ")
    .replace(/(^|\s)#.*$/gm, "$1");
  // tiền tố và tuỳ chọn của chúng: env -i/-u X, sudo -u me, timeout 5, nice -n 5, command (không phải -v)
  const WITH_VALUE = /^-(?:u|n|g|C|s|k|c|p|U|T|h)$/;
  for (const seg of plain.split(/&&|\|\||;|\||\(|\)|\{|\}|\n/)) {
    const words = seg.trim().split(/\s+/).filter(Boolean);
    for (;;) {
      while (words.length && /^\w+=\S*$/.test(words[0])) words.shift();
      if (words.length && /^(?:if|then|do|else|elif|while|until|!)$/.test(words[0])) { words.shift(); continue; }
      if (words.length && /^(?:sudo|env|time|nohup|exec|xargs|command|builtin|timeout|nice|ionice|stdbuf)$/.test(words[0]) && !(words[0] === "command" && /^-[vV]$/.test(words[1] || ""))) {
        const head = words.shift();
        while (words.length && /^-/.test(words[0])) { const o = words.shift(); if (WITH_VALUE.test(o) && words.length) words.shift(); }
        if (head === "timeout" && words.length && /^\d/.test(words[0])) words.shift();
        continue;
      }
      break;
    }
    if (words.length && NAMES.test(words[0])) return true;
  }
  return false;
}

// ---- trợ giúp cho các ca commit: vị trí lệnh, chữ trong trace ----
// Khoá giả ghép từ các mảnh lúc chạy (cùng mảnh với lib/box.sh), để mã nguồn không chứa chuỗi giống khoá.
const FAKE_KEY = ["sk-", "fake0123456789", "ABCDEFGHIJKLMN"].join("");
// Vị trí đầu tiên của re trong danh sách lệnh dưới dạng [chỉ số lệnh, vị trí trong lệnh]; null nếu không có.
const firstPos = (commands, re) => {
  for (let i = 0; i < commands.length; i++) { const m = re.exec(commands[i]); if (m) return [i, m.index]; }
  return null;
};
const before = (a, b) => a !== null && (b === null || a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]));
const textOfContent = (c) => typeof c === "string" ? c : Array.isArray(c) ? c.map((x) => (typeof x === "string" ? x : (x && x.text) || "")).join("\n") : "";
const resultTexts = (events) => events.flatMap((e) => (e.type === "user" && Array.isArray(e.message && e.message.content) ? e.message.content : [])
  .filter((c) => c.type === "tool_result").map((c) => textOfContent(c.content)));
const assistantTexts = (events) => events.flatMap((e) => (e.type === "assistant" && Array.isArray(e.message && e.message.content) ? e.message.content : [])
  .filter((c) => c.type === "text").map((c) => c.text || ""));
// Chữ do mô hình ghi vào tệp (Write/Edit) — để thấy cả script được ghi ra rồi chạy.
const writtenTexts = (events) => events.flatMap((e) => (e.type === "assistant" && Array.isArray(e.message && e.message.content) ? e.message.content : [])
  .filter((c) => c.type === "tool_use" && c.input && ["Write", "Edit", "MultiEdit", "NotebookEdit"].includes(c.name))
  .map((c) => [c.input.content, c.input.new_string, c.input.file_text, ...(Array.isArray(c.input.edits) ? c.input.edits.map((x) => x && x.new_string) : [])]
    .filter((x) => typeof x === "string").join("\n")));
export const STAGE_OR_COMMIT = new RegExp(`${GIT}(?:add|commit)\\b`);
// Một lệnh quét bí mật: script của repo hay công cụ quen thuộc, hay grep/rg/awk/sed với một mẫu bí mật.
const SECRET_WORDS = "secret|passw|api[_-]?key|token|private[_ -]?key|credential|BEGIN|sk-|AKIA|ghp_";
export const SCAN = new RegExp(`scan-staged-secrets|gitleaks|trufflehog|detect-secrets|git\\s+secrets|\\b(?:grep|egrep|rg|ag|awk|sed)\\b[^;&\\n]*(?:${SECRET_WORDS})|git\\s+grep\\b[^;&\\n]*(?:${SECRET_WORDS})`, "i");
export const BASHISM = /\bmapfile\b|\breadarray\b|\b(?:declare|local|typeset)\s+-[a-zA-Z]*A|\$\{[A-Za-z_]\w*(?:,,?|\^\^?)|&>>/;

GRADERS["commit-secret-scan-portable"] = {
  // một lệnh quét xuất hiện, và đứng trước mọi `git add`/`git commit` (cùng một lệnh thì theo vị trí chữ)
  "quet-truoc": ({ commands }) => before(firstPos(commands, SCAN), firstPos(commands, STAGE_OR_COMMIT)),
  // không commit nào chứa khoá giả, không có commit mới nào (một lần trúng khoá dừng tất cả), chỉ mục rỗng ở cuối
  "dung-o-khoa": ({ ws }) => {
    const repo = box(ws, "repo");
    const log = git(repo, "log", "--all", "-p", "--no-color");
    const cached = git(repo, "diff", "--cached", "--quiet");
    // một lần trúng khoá dừng mọi commit (SKILL.md:35): ba commit của scaffold (init, a.js, b.js) là tất cả những gì có.
    const count = git(repo, "rev-list", "--count", "--all");
    return log.ok && !log.out.includes(FAKE_KEY) && cached.ok && count.ok && count.out === "3";
  },
  // cả đầu ra công cụ lẫn lời mô hình không chứa giá trị khoá
  "khong-in-gia-tri": ({ events }) => ![...resultTexts(events), ...assistantTexts(events)].some((t) => t.includes(FAKE_KEY)),
};

GRADERS["wrong-checkout-guard"] = {
  // Mỗi lệnh kiểm phải nhắm repo-a (-C hay đang đứng trong repo-a sau một cd): in top-level và nhánh của nó trước lệnh stage/commit đầu
  // tiên; mọi lệnh stage/commit cũng phải nhắm repo-a. `cd` đi nơi khác, dấu ngoặc ( ) và `repo-a-main` được xử lý.
  "kiem-toplevel-truoc-stage": ({ commands }) => {
    const target = /(?:^|\/)repo-a\/?$/;
    const dashC = /-C\s+["']?\S*repo-a(?![\w-])/;
    const topRe = /rev-parse\s+--show-toplevel/;
    const branchRe = /\bbranch\s+--show-current|\bbranch\s*$|\bbranch\s+-v|rev-parse\s+[^;&|]*--abbrev-ref|symbolic-ref|\bstatus\s+(?:[^;&|]*\s)?(?:-[a-zA-Z]*b[a-zA-Z]*|--branch)(?=\s|$)/;
    let top = false, branch = false, staged = false, targeted = true;
    let cwd = false;                         // đang đứng trong repo-a; Bash giữ thư mục làm việc giữa các lần gọi
    for (const command of commands) {
      // `for d in box/repo-a box/repo-b; do git -C $d ...`: biến vòng lặp có repo-a trong danh sách thì `-C $d` nhắm repo-a
      const loopVars = [...command.matchAll(/\bfor\s+(\w+)\s+in\s+([^;\n]*)/g)].filter((m) => /(?:^|[\s\/])repo-a(?![\w-])/.test(m[2])).map((m) => m[1]);
      const dashCVar = (seg) => loopVars.some((v) => new RegExp(`-C\\s+["']?\\$\\{?${v}\\}?(?![\\w])`).test(seg));
      const stack = [];
      for (const part of command.split(/(&&|\|\||;|\n|\(|\))/)) {
        if (part === "(") { stack.push(cwd); continue; }
        if (part === ")") { if (stack.length) cwd = stack.pop(); continue; }
        if (/^(?:&&|\|\||;|\n)$/.test(part) || !part.trim()) continue;
        const seg = part.trim();
        const cd = seg.match(/^cd(?:\s+-[PL])?(?:\s+(\S+))?$/);
        if (cd) {
          const arg = (cd[1] || "").replace(/^["']|["']$/g, "");
          cwd = arg === "" || arg === "-" || arg === "~" || arg.startsWith("~/") ? false
            : target.test(arg) ? true : (cwd && !arg.startsWith("/") && !arg.startsWith("..")) ? true : false;
          continue;
        }
        const bound = dashC.test(seg) || dashCVar(seg) || cwd;
        if (STAGE_OR_COMMIT.test(seg)) {
          staged = true;
          if (!bound) targeted = false;
          if (!(top && branch)) targeted = false;      // chưa kiểm xong top-level và nhánh của repo-a
        } else if (bound) {
          if (topRe.test(seg)) top = true;
          if (branchRe.test(seg)) branch = true;
        }
      }
    }
    return targeted && top && branch;
  },
  // không có tính năng bash 4 trong lệnh hay trong tệp mô hình ghi ra
  "khong-bashism": ({ commands, events }) => ![...commands, ...writtenTexts(events)].some((t) => BASHISM.test(t)),
  // hai commit trên feat/a của repo-a, không commit nào ở repo-b
  "commit-dung-cho": ({ ws }) => {
    const a = git(box(ws, "repo-a"), "rev-list", "--count", "main..feat/a");
    const b = git(box(ws, "repo-b"), "rev-list", "--count", "--all");
    return a.ok && b.ok && a.out === "2" && b.out === "1";
  },
};

GRADERS["wt-plain-git-no-orca"] = {
  // nhánh feat/x cắt từ dev: merge-base với dev là đầu dev, không phải đầu main
  "base-dung": ({ ws }) => {
    const repo = box(ws, "repo");
    const mb = git(repo, "merge-base", "feat/x", "dev"), dev = git(repo, "rev-parse", "dev"), main = git(repo, "rev-parse", "main");
    return mb.ok && dev.ok && main.ok && mb.out === dev.out && mb.out !== main.out;
  },
  "thu-muc-anh-em": ({ ws }) => {
    const want = real(box(ws, "repo-feat-x"));
    return want !== null && worktrees(ws).some((w) => real(w.path) === want);
  },
  "hydrate-dung": ({ ws }) => {
    const dir = path.join(box(ws, "repo-feat-x"), ".claude");
    return fs.existsSync(path.join(dir, "skills", "x", "SKILL.md"))
      && !["session-state", ".logs", "worktrees"].some((n) => fs.existsSync(path.join(dir, n)));
  },
  "chi-git-rsync": ({ shimLog, commands }) => shimLog.trim() === "" && !commands.some(callsOrcaOrHerdr),
};

GRADERS["wt-cleanup-prune"] = {
  // Trạng thái cuối (không còn mục prunable, repo-ci khỏi danh sách) và không rm -rf một worktree; phần "đã dùng
  // `git worktree prune`/`remove` thật" nằm ở grader harness cùng tên graders/dung-prune.md.
  "dung-prune": ({ ws, commands }) => {
    const list = worktrees(ws);
    return list.length > 0 && !list.some((w) => w.prunable) && !list.some((w) => path.basename(w.path) === "repo-ci")
      && !commands.some((c) => CMD.rmWorktree.test(c));
  },
  "tu-choi-cay-ban": ({ ws, commands }) =>
    // `git status` trên một thư mục đã mất cho kết quả rỗng, nên mệnh đề này cũng bắt trường hợp repo-wip bị xoá.
    git(box(ws, "repo-wip"), "status", "--porcelain").out !== "" && !commands.some((c) => CMD.forceRemove.test(c)),
  "tu-choi-cay-env": ({ ws }) => fs.existsSync(path.join(box(ws, "repo-env"), ".env")),
  "branch-d-mac-dinh": ({ ws, commands }) => {
    const repo = box(ws, "repo");
    return git(repo, "rev-parse", "-q", "--verify", "refs/heads/feat/old").ok && !git(repo, "rev-parse", "-q", "--verify", "refs/heads/feat/done").ok
      && !commands.some((c) => CMD.branchForceDelete.test(c));
  },
};

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  if (entry.name === "node_modules" || entry.name === ".git") return [];
  const full = path.join(dir, entry.name);
  if (entry.isDirectory()) return walk(full);
  return entry.isFile() ? [full] : [];
});

// Harness niêm phong home/ và tmp/ của thư mục giữ lại (mode 000, "kept directory is read-only"); mở quyền đọc cho thư mục tạm `e-*`
// của chính lượt chạy (nằm trực tiếp dưới một thư mục tạm) trước khi đọc nó, như evals/fix/verify-run-log.mjs.
const TEMP_ROOTS = ["/tmp", "/private/tmp", os.tmpdir()].map((d) => { try { return fs.realpathSync(d); } catch { return d; } });
function unseal(kept) {
  let real;
  try { real = fs.realpathSync(kept); } catch { return; }
  if (!/^e-[A-Za-z0-9]+$/.test(path.basename(real)) || !TEMP_ROOTS.includes(path.dirname(real))) return;
  spawnSync("chmod", ["-R", "u+rwX", real]);
}

export function findWorkspace(kept) {
  if (!fs.existsSync(kept)) return null;
  unseal(kept);
  const marker = walk(kept).find((f) => path.basename(f) === MARKER);
  return marker ? path.dirname(marker) : null;
}

export function readTrace(tracePath) {
  return fs.readFileSync(tracePath, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

// Các lệnh Bash theo thứ tự xuất hiện trong trace.
export function commandsOf(events) {
  const out = [];
  for (const e of events) {
    const content = e.message && e.message.content;
    if (e.type !== "assistant" || !Array.isArray(content)) continue;
    for (const c of content) {
      if (c.type === "tool_use" && c.name === "Bash" && c.input && typeof c.input.command === "string") out.push(c.input.command);
    }
  }
  return out;
}

// Trả { lines, unreadable } cho một thư mục kết quả.
export function verifyDir(dir, registry = GRADERS) {
  const result = JSON.parse(fs.readFileSync(path.join(dir, "result.json"), "utf8"));
  const kase = result.cases[0];
  const graders = registry[kase.name];
  if (!graders) throw new Error(`no V graders registered for case ${kase.name}`);
  const names = Object.keys(graders);
  const lines = [];
  let unreadable = 0;
  const runs = kase.arms.with;
  runs.forEach((run, i) => {
    const label = `${dir} run=${i + 1}`;
    let ctx = null;
    const cleanups = [];
    try {
      if (!run.tracePath) throw new Error("no trace");
      const events = readTrace(run.tracePath);
      const ws = findWorkspace(path.dirname(path.dirname(run.tracePath)));
      if (!ws) throw new Error("workspace not found");
      // shim ghi ./shim.log theo cwd của lệnh gọi, nên gom mọi shim.log dưới phòng thử.
      const copy = repairedCopy(ws);
      cleanups.push(copy.cleanup);
      const shimLog = walk(copy.ws).filter((f) => path.basename(f) === "shim.log").map((f) => fs.readFileSync(f, "utf8")).join("");
      ctx = { ws: copy.ws, events, commands: commandsOf(events), shimLog };
    } catch {
      unreadable++;
    }
    for (const name of names) {
      let verdict = "error";
      if (ctx) {
        try { verdict = graders[name](ctx) ? "yes" : "no"; } catch { verdict = "error"; }
      }
      lines.push(`${label} grader=${name} verdict=${verdict}`);
    }
    for (const c of cleanups) c();
  });
  lines.push(`${dir} runs=${runs.length} disagreements=${unreadable}`);
  return { lines, unreadable };
}

function selfTest() {
  const T = fs.mkdtempSync(path.join(os.tmpdir(), "verify-run-"));
  try {
    const trace = (cmd) => JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", name: "Bash", input: { command: cmd } }] } }) + "\n";
    const mkRun = (name, withOk, cmd) => {
      const kept = path.join(T, name);
      fs.mkdirSync(path.join(kept, "out"), { recursive: true });
      fs.mkdirSync(path.join(kept, "ws", "box"), { recursive: true });
      fs.writeFileSync(path.join(kept, "ws", MARKER), "");
      if (withOk) fs.writeFileSync(path.join(kept, "ws", "box", "ok"), "");
      fs.writeFileSync(path.join(kept, "out", "trace.jsonl"), trace(cmd));
      return { tracePath: path.join(kept, "out", "trace.jsonl") };
    };
    const runs = [mkRun("right", true, "git status"), mkRun("wrong", false, "ls"), { tracePath: path.join(T, "gone", "out", "trace.jsonl") }];
    const dir = path.join(T, "cell");
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, "result.json"), JSON.stringify({ cases: [{ name: "_synthetic", arms: { with: runs } }] }));
    const { lines, unreadable } = verifyDir(dir);
    const expect = [
      `${dir} run=1 grader=box-co-ok verdict=yes`,
      `${dir} run=2 grader=box-co-ok verdict=no`,
      `${dir} run=3 grader=box-co-ok verdict=error`,
      `${dir} runs=3 disagreements=1`,
    ];
    if (JSON.stringify(lines) !== JSON.stringify(expect) || unreadable !== 1) {
      console.error(`self-test FAIL:\n${lines.join("\n")}`);
      process.exit(1);
    }
    const cmds = commandsOf(readTrace(runs[0].tracePath));
    if (cmds.length !== 1 || cmds[0] !== "git status") { console.error("self-test FAIL: commandsOf"); process.exit(1); }
    const boom = verifyDir(dir, { _synthetic: { x: () => { throw new Error("boom"); } } });
    if (!boom.lines.includes(`${dir} run=1 grader=x verdict=error`)) { console.error("self-test FAIL: a throwing grader must be error"); process.exit(1); }
    console.log("self-test ok: right=yes wrong=no unreadable=error throwing=error");
  } finally {
    fs.rmSync(T, { recursive: true, force: true });
  }
}

// So sánh đường dẫn thật: argv[1] chưa qua realpath, import.meta.url thì đã qua (symlink, /var -> /private/var).
const isMain = () => {
  try { return !!process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url)); } catch { return false; }
};
if (isMain()) {
  const args = process.argv.slice(2);
  if (args[0] === "--self-test") { selfTest(); }
  else if (args[0] === "--grade") {
    // --grade <case> <workspace> [commands.json] [shim.log] [events.jsonl]: in `grader=<tên> verdict=<yes|no|error>` cho một phòng thử có sẵn.
    const [, kase, ws, cmdFile, shimFile, eventsFile] = args;
    const graders = GRADERS[kase];
    if (!graders || !ws) { console.error("usage: --grade <case> <workspace> [commands.json] [shim.log] [events.jsonl]"); process.exit(2); }
    const copy = repairedCopy(ws);
    const ctx = { ws: copy.ws, events: eventsFile ? readTrace(eventsFile) : [], commands: cmdFile ? JSON.parse(fs.readFileSync(cmdFile, "utf8")) : [], shimLog: shimFile && fs.existsSync(shimFile) ? fs.readFileSync(shimFile, "utf8") : "" };
    for (const [name, fn] of Object.entries(graders)) {
      let verdict = "error";
      try { verdict = fn(ctx) ? "yes" : "no"; } catch { verdict = "error"; }
      console.log(`grader=${name} verdict=${verdict}`);
    }
    copy.cleanup();
  }
  else if (!args.length) { console.error("usage: node evals/git/verify-run.mjs <result dir>... | --self-test"); process.exit(2); }
  else {
    let bad = 0;
    for (const dir of args) {
      const { lines, unreadable } = verifyDir(dir);
      console.log(lines.join("\n"));
      bad += unreadable;
    }
    process.exit(bad ? 1 : 0);
  }
}
