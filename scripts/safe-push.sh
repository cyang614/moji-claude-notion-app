#!/usr/bin/env bash
set -euo pipefail

COMMIT_MESSAGE="${1:-chore: update moji learning app}"

if [ ! -d .git ]; then
  echo "尚未初始化 git repo。請先執行：git init"
  exit 1
fi

if git ls-files --error-unmatch server/.env >/dev/null 2>&1; then
  echo "錯誤：server/.env 已被 git 追蹤，請先移除：git rm --cached server/.env"
  exit 1
fi

if git ls-files --error-unmatch .env >/dev/null 2>&1; then
  echo "錯誤：.env 已被 git 追蹤，請先移除：git rm --cached .env"
  exit 1
fi

npm test
npm run build

git add .

if git diff --cached --quiet; then
  echo "沒有可提交的變更。"
  exit 0
fi

git commit -m "$COMMIT_MESSAGE"

if git remote get-url origin >/dev/null 2>&1; then
  git push -u origin "$(git branch --show-current)"
else
  echo "已完成 commit，但尚未設定 GitHub remote。"
  echo "請建立 GitHub repo 後執行："
  echo "git remote add origin https://github.com/<你的帳號>/moji-claude-notion-app.git"
  echo "git push -u origin main"
fi
