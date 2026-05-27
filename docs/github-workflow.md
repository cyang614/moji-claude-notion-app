# GitHub 上傳與版本管理操作手冊

本專案目前在：

```bash
/home/rickyyang/workspace/moji-claude-notion-app
```

建議做法：

1. 用 Git 管理每次程式碼修改。
2. `.env` 與 API Key 永遠不要上傳。
3. 每次上傳前先跑測試與 build。
4. 使用 `scripts/safe-push.sh` 一鍵測試、建置、commit、push。

---

## 1. 第一次設定 Git 身分

在 Ubuntu 執行：

```bash
git config --global user.name "你的 GitHub 名稱"
git config --global user.email "你的 GitHub Email"
```

確認：

```bash
git config --global user.name
git config --global user.email
```

---

## 2. 第一次初始化 Git repo

```bash
cd /home/rickyyang/workspace/moji-claude-notion-app
git init
git branch -M main
```

確認 `.gitignore` 已包含：

```text
node_modules/
dist/
.env
.env.*
!.env.example
```

這樣可以避免：

```text
server/.env
```

被提交到 GitHub。

---

## 3. 第一次建立 GitHub repo

### 方法 A：用 GitHub 網頁建立，最直覺

1. 到 GitHub。
2. 點右上角 `+` → `New repository`。
3. Repository name 建議：

```text
moji-claude-notion-app
```

4. 選 Public 或 Private。
5. 不要勾 `Add a README file`，因為本機已經有 README。
6. 建立後複製 GitHub 給你的 remote URL。

例如：

```text
https://github.com/<你的帳號>/moji-claude-notion-app.git
```

回到 Ubuntu：

```bash
cd /home/rickyyang/workspace/moji-claude-notion-app
git remote add origin https://github.com/<你的帳號>/moji-claude-notion-app.git
```

### 方法 B：如果有安裝 gh CLI

```bash
cd /home/rickyyang/workspace/moji-claude-notion-app
gh repo create moji-claude-notion-app --private --source . --remote origin
```

如果要公開 repo，把 `--private` 改成 `--public`。

---

## 4. GitHub 登入方式

### 推薦：GitHub CLI

檢查是否有 `gh`：

```bash
gh --version
```

登入：

```bash
gh auth login
```

照畫面選：

```text
GitHub.com
HTTPS
Login with a web browser
```

設定 git 使用 gh 認證：

```bash
gh auth setup-git
```

### 沒有 gh CLI：用 Personal Access Token

1. 到 GitHub：`Settings` → `Developer settings` → `Personal access tokens`。
2. 建立 token。
3. 至少需要 repo 權限。
4. 第一次 `git push` 時：
   - Username：你的 GitHub 帳號
   - Password：貼上 token，不是 GitHub 密碼

可設定儲存認證：

```bash
git config --global credential.helper store
```

---

## 5. 第一次提交與上傳

```bash
cd /home/rickyyang/workspace/moji-claude-notion-app
npm test
npm run build
git add .
git commit -m "feat: initial moji claude notion app"
git push -u origin main
```

---

## 6. 之後每次更新程式碼，建議流程

最推薦直接使用 helper：

```bash
cd /home/rickyyang/workspace/moji-claude-notion-app
./scripts/safe-push.sh "feat: update moji full-page analysis"
```

這支 script 會自動做：

1. 檢查 `.env` 是否誤被 git 追蹤。
2. 執行後端測試：`npm test`。
3. 執行前端 build：`npm run build`。
4. `git add .`
5. `git commit -m "你的訊息"`
6. 如果已設定 `origin`，自動 `git push`。

---

## 7. 手動更新流程

如果不用 helper，每次修改後：

```bash
cd /home/rickyyang/workspace/moji-claude-notion-app
npm test
npm run build
git status
git add .
git commit -m "清楚描述這次修改"
git push
```

---

## 8. 絕對不要上傳的檔案

不要提交：

```text
server/.env
.env
node_modules/
client/dist/
```

目前 `.gitignore` 已排除這些檔案。

如果不小心把 `.env` 加進 git：

```bash
git rm --cached server/.env
git commit -m "chore: remove env file from git tracking"
git push
```

如果已經把 API Key 推到 GitHub，請立刻：

1. 到 Anthropic / Notion 後台撤銷舊 key。
2. 建立新 key。
3. 更新 `server/.env`。
4. 不要只靠刪除 commit，因為 secret 可能已經外洩。

---

## 9. 檢查目前是否已連到 GitHub

```bash
cd /home/rickyyang/workspace/moji-claude-notion-app
git remote -v
```

如果沒有任何輸出，代表還沒設定 remote。

---

## 10. 我建議你的固定工作流

每次改程式後執行：

```bash
cd /home/rickyyang/workspace/moji-claude-notion-app
./scripts/safe-push.sh "feat: 描述這次修改"
```

例如：

```bash
./scripts/safe-push.sh "feat: add full moji page analysis fields"
```

這樣可以確保：

- 測試通過才提交
- 前端能 build 才提交
- `.env` 不會被提交
- GitHub 永遠保持最新版本
