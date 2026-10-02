---
type: tool_used
tool: Bash
input_match: '"command":"(?:(?:[^"\\]|\\.)*?(?:[;&|(\s]|\\"|''))?git(?:\s+-[cC]\s+(?:\\"[^"]*?\\"|\S+))*\s+worktree\s+(?:prune\b(?![^;&|"\\]*(?:\s-[a-zA-Z]*n[a-zA-Z]*(?=[\s"\\;&|)]|$)|--dry-run))|remove\b)'
min: 1
arm: both
---
