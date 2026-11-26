#!/usr/bin/env bash
# 민수 AI 오피스 — GitHub Pages 배포 (레포가 이미 있을 때 실행)
# 사용: bash deploy_github_pages.sh [owner/repo]
set -euo pipefail

REPO="${1:-israelkim85-bot/pickle-office}"
DIR="$(cd "$(dirname "$0")" && pwd)"

cd "$DIR"
if [ ! -d .git ]; then
  git init -q
  git checkout -q -b main 2>/dev/null || git branch -M main
fi

git add -A
git -c user.name="israelkim85-bot" -c user.email="israelkim85-bot@users.noreply.github.com" \
  commit -q -m "민수 AI 오피스 PWA" || echo "(커밋할 변경 없음)"

git remote remove origin 2>/dev/null || true
git remote add origin "https://github.com/${REPO}.git"
git push -u origin main

# Pages 활성화 (이미 켜져 있으면 무시)
gh api -X POST "repos/${REPO}/pages" \
  -f "source[branch]=main" -f "source[path]=/" >/dev/null 2>&1 \
  || gh api -X PUT "repos/${REPO}/pages" \
       -f "source[branch]=main" -f "source[path]=/" >/dev/null 2>&1 \
  || echo "Pages 자동 활성화 실패 — 레포 Settings > Pages 에서 main / root 선택 필요"

echo "배포 URL: https://$(echo "$REPO" | cut -d/ -f1).github.io/$(echo "$REPO" | cut -d/ -f2)/"
