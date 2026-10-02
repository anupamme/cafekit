#!/usr/bin/env bash
# Hàm dùng chung cho scaffold của bộ ca git: dựng mọi repo tạm dưới ./box ngay trong phòng thử của lượt chạy.
# Mỗi hàm từ chối chạy khi thư mục hiện tại nằm trong một repo git hay là $HOME hay /, không đặt remote và
# không đụng ngoài ./box. Khoá giả được ghép từ các mảnh lúc chạy để không có chuỗi giống khoá trong văn bản repo.
BOX_MARKER=".git-eval-box"

box_fail() { echo "box: $*" >&2; return 1; }

# git với danh tính cố định, không ký, không hook của người dùng, không biến GIT_* thừa kế từ tiến trình cha.
box_git() {
  env -u GIT_DIR -u GIT_WORK_TREE -u GIT_INDEX_FILE git -c user.name=eval -c user.email=eval@example.invalid -c commit.gpgsign=false \
    -c core.hooksPath=/dev/null -c init.defaultBranch=main "$@"
}

box_name_ok() {
  case "$1" in
    ""|.*|*/*|*[!A-Za-z0-9._-]*) box_fail "unsafe name: $1"; return 1;;
  esac
}

# Phòng thử phải nằm dưới một thư mục tạm (mktemp -d, /tmp, /var/folders, TMPDIR) hay dưới $BOX_ALLOW_DIR do
# người gọi truyền; $HOME và / bị từ chối, và cây đang đứng không được thuộc một repo git.
box_in_temp() {
  local here root
  here="$(pwd -P)"
  for root in /tmp /private/tmp /var/tmp /private/var/tmp /var/folders /private/var/folders \
    "$(cd "${TMPDIR:-/tmp}" 2>/dev/null && pwd -P)" ${BOX_ALLOW_DIR:+"$(cd "$BOX_ALLOW_DIR" 2>/dev/null && pwd -P)"}; do
    [ -n "$root" ] && [ "$root" != / ] && [ "$root" != "$(cd "$HOME" 2>/dev/null && pwd -P)" ] || continue
    case "$here/" in "$root"/*) return 0;; esac
  done
  return 1
}

box_init() {
  case "$PWD" in
    /|"$HOME") box_fail "refusing to build in $PWD"; return 1;;
  esac
  box_in_temp || { box_fail "cwd is not under a temp directory or BOX_ALLOW_DIR: $PWD"; return 1; }
  if env -u GIT_DIR -u GIT_WORK_TREE git rev-parse --git-dir >/dev/null 2>&1; then box_fail "cwd is inside a git repository: $PWD"; return 1; fi
  [ ! -L box ] || { box_fail "box is a symlink"; return 1; }
  mkdir -p box && : > "$BOX_MARKER"
}

box_guard() { [ -f "$BOX_MARKER" ] && [ -d box ] && [ ! -L box ] || box_fail "box_init has not run in $PWD"; }

# Đường dẫn tương đối an toàn trong một repo: không rỗng, không tuyệt đối, không có thành phần "..".
box_path_ok() {
  case "$1" in
    ""|/*) box_fail "unsafe path: $1"; return 1;;
  esac
  case "/$1/" in */../*) box_fail "unsafe path: $1"; return 1;; esac
}

# box_repo <name>: repo box/<name> trên nhánh main với một commit.
box_repo() {
  box_guard && box_name_ok "$1" || return 1
  [ ! -e "box/$1" ] || { box_fail "box/$1 exists"; return 1; }
  mkdir "box/$1" && box_git -C "box/$1" init -q -b main && echo "$1" > "box/$1/README" &&
    box_git -C "box/$1" add README && box_git -C "box/$1" commit -q -m "init"
}

# box_commit <repo> <file> <content> <message>
box_commit() {
  box_guard && box_name_ok "$1" && box_path_ok "$2" || return 1
  mkdir -p "$(dirname "box/$1/$2")" && printf '%s\n' "$3" > "box/$1/$2" &&
    box_git -C "box/$1" add -- "$2" && box_git -C "box/$1" commit -q -m "$4"
}

# box_ignore <repo> <pattern>: thêm một dòng vào .gitignore của repo và commit.
box_ignore() {
  box_guard && box_name_ok "$1" || return 1
  printf '%s\n' "$2" >> "box/$1/.gitignore" && box_git -C "box/$1" add .gitignore &&
    box_git -C "box/$1" commit -q -m "ignore $2"
}

# box_worktree <repo> <dir-name> <branch> [base]: worktree anh em box/<dir-name> trên nhánh mới.
box_worktree() {
  box_guard && box_name_ok "$1" && box_name_ok "$2" || return 1
  [ ! -e "box/$2" ] || { box_fail "box/$2 exists"; return 1; }
  box_git -C "box/$1" worktree add -q -b "$3" "../$2" ${4:+"$4"}
}

# box_fake_key: in một khoá giả không dùng được; chuỗi chỉ tồn tại lúc chạy.
box_fake_key() { printf '%s%s%s' "sk-" "fake0123456789" "ABCDEFGHIJKLMN"; }
