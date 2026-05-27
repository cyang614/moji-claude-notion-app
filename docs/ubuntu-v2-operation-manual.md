# V3 日文學習筆記強化版：Ubuntu 操作手冊

本手冊適用於 WSL2 Ubuntu 環境，專案位置：

```bash
/home/rickyyang/workspace/moji-claude-notion-app
```

---

## 1. V3 功能摘要

V3 會將 Moji 辭書完整頁面整理成 Notion 學習筆記，包含原本欄位，並新增/強化：

- `JLPT_Level`：N5 / N4 / N3 / N2 / N1 / Unknown
- `Difficulty`：1-5 難度
- `Tags`：可篩選的學習標籤
- `Collocations`：常用搭配詞、慣用句、助詞搭配
- `Nuance`：語感、正式度、使用情境
- `Common_Mistakes`：台灣學習者常見錯誤
- `Memory_Hook`：記憶法或聯想
- `Review_Status`：預設 New
- `Next_Review`：預設明天，方便做複習排程
- `Raw_Moji_Text`：保留原始 Moji 文字
- `Conjugations`：ます形、て形等活用變化
- `Related_Words`：關聯詞、同詞位、多音詞、話題詞、外語關聯詞
- `Synonyms`：近義詞
- `Antonyms`：反義詞
- `All_Examples`：所有例句與台灣繁體中文翻譯

> 所有中文輸出都要求轉成台灣繁體中文；Moji 來源中的簡體中文，例如「让开、躲开、退让」，會要求 Claude 轉成「讓開、躲開、退讓」。後端也已加入 `opencc-js`，會對中文輸出欄位再做一次簡體到台灣繁體轉換。

---

## 2. 開啟 Ubuntu Terminal

### 方法 A：Windows Terminal 內開 Ubuntu

1. 點 Windows Terminal 上方 `+` 旁邊的下拉箭頭。
2. 選 `Ubuntu` 或 `Ubuntu-22.04`。
3. 若只開到 PowerShell，輸入：

```powershell
wsl
```

或：

```powershell
wsl -d Ubuntu
```

### 方法 B：開兩個 terminal

後端和前端需要同時執行，請開兩個 Ubuntu terminal。

如果新分頁預設是 PowerShell，就在每個 PowerShell 分頁輸入：

```powershell
wsl
```

---

## 3. 第一次安裝

在 Ubuntu terminal 執行：

```bash
cd /home/rickyyang/workspace/moji-claude-notion-app
npm run install:all
```

這會分別安裝：

- `server/` 的 Express、Anthropic SDK、Notion SDK
- `client/` 的 React、Vite

---

## 4. 建立後端環境變數

進入後端資料夾：

```bash
cd /home/rickyyang/workspace/moji-claude-notion-app/server
cp .env.example .env
nano .env
```

內容格式：

```env
ANTHROPIC_API_KEY=你的_Claude_API_Key
NOTION_API_KEY=你的_Notion_Integration_Secret
NOTION_DATABASE_ID=你的_Notion_Database_ID
CLAUDE_MODEL=claude-3-5-sonnet-latest
CORS_ORIGIN=http://localhost:5173
PORT=3001
```

儲存 nano：

1. `Ctrl + O`
2. `Enter`
3. `Ctrl + X`

> 注意：API Key 只能放在 `server/.env`，不要放到 React 前端。

---

## 5. 設定 Notion Database

請在 Notion Database 建立以下欄位：

| 欄位名稱 | 型別 | 說明 |
|---|---|---|
| `Vocab` | Title | 單字主標題 |
| `Kana` | Text | 讀音 |
| `POS` | Select | 詞性 |
| `Meaning` | Text | 中文意思 |
| `Grammar` | Text | 文法重點 |
| `Example_JP` | Text | 日文例句 |
| `Example_ZH` | Text | 中文翻譯 |
| `Notes` | Text | 學習筆記 |
| `JLPT_Level` | Select | JLPT 等級 |
| `Difficulty` | Select | 1-5 難度 |
| `Tags` | Multi-select | 標籤 |
| `Collocations` | Text | 常用搭配 |
| `Nuance` | Text | 語感情境 |
| `Common_Mistakes` | Text | 常見錯誤 |
| `Memory_Hook` | Text | 記憶法 |
| `Review_Status` | Select | 複習狀態 |
| `Next_Review` | Date | 下次複習日 |
| `Raw_Moji_Text` | Text | 原始資料 |
| `Conjugations` | Text | 活用變化 |
| `Related_Words` | Text | 關聯詞、多音詞、話題詞 |
| `Synonyms` | Text | 近義詞 |
| `Antonyms` | Text | 反義詞 |
| `All_Examples` | Text | 所有例句與繁中翻譯 |

### Notion Integration 權限

1. 打開目標 Notion Database。
2. 右上角點 `...`。
3. 找到 `Connections`。
4. 加入你的 Notion Integration。

如果沒做這步，常見錯誤是：

```text
Unauthorized
Could not find database with ID
```

---

## 6. 開發模式啟動 app

### Terminal 1：啟動後端

```bash
cd /home/rickyyang/workspace/moji-claude-notion-app
npm run dev:server
```

成功會看到：

```text
Express server is running on http://localhost:3001
```

可用瀏覽器或 curl 檢查：

```bash
curl http://localhost:3001/api/health
```

若設定正確，會看到：

```json
{
  "ok": true,
  "service": "moji-claude-notion-server",
  "hasClaudeClient": true,
  "hasNotionClient": true,
  "hasNotionDatabaseId": true
}
```

### Terminal 2：啟動前端

```bash
cd /home/rickyyang/workspace/moji-claude-notion-app
npm run dev:client
```

成功後打開：

```text
http://localhost:5173
```

---

## 7. 使用流程

1. 打開 `http://localhost:5173`。
2. 將 Moji 辭書複製的完整單字頁面貼到輸入框，可包含簡體中文釋義、活用、關聯詞、近反義詞、話題詞與原聲例句。
3. 點擊「整理並新增到 Notion」。
4. 等待 Claude 分析。
5. 成功後前端會顯示：
   - 基礎單字資料
   - JLPT / 難度 / 標籤
   - 搭配詞 / 語感 / 常見錯誤 / 記憶法
   - 活用變化 / 關聯詞 / 近義詞 / 反義詞 / 所有例句
   - Notion 頁面連結
6. 點「開啟 Notion 頁面」檢查資料是否正確寫入。

---

## 8. 建置與驗證

### 跑後端測試

```bash
cd /home/rickyyang/workspace/moji-claude-notion-app
npm test
```

目前應看到：

```text
Test Files  4 passed
Tests       9 passed
```

### 建置前端

```bash
cd /home/rickyyang/workspace/moji-claude-notion-app
npm run build
```

成功會產生：

```text
client/dist/
```

### 預覽前端建置結果

```bash
cd /home/rickyyang/workspace/moji-claude-notion-app/client
npm run preview
```

Vite 會顯示 preview 網址。若 preview port 不是 `5173`，且後端 CORS 只允許 `http://localhost:5173`，請把 `server/.env` 的 `CORS_ORIGIN` 改成 preview 顯示的網址，然後重啟後端。

---

## 9. 常見問題排除

### 問題 1：前端送出後顯示 API 錯誤

先檢查後端是否有啟動：

```bash
curl http://localhost:3001/api/health
```

如果連不上，請重新啟動：

```bash
npm run dev:server
```

### 問題 2：`hasClaudeClient` 是 false

代表 `server/.env` 沒有正確設定：

```env
ANTHROPIC_API_KEY=...
```

修改後需要重啟後端。

### 問題 3：`hasNotionClient` 是 false

代表缺少：

```env
NOTION_API_KEY=...
```

修改後需要重啟後端。

### 問題 4：`hasNotionDatabaseId` 是 false

代表缺少：

```env
NOTION_DATABASE_ID=...
```

修改後需要重啟後端。

### 問題 5：Notion 回傳 property not found

代表 Notion Database 欄位名稱與程式不一致。

請檢查欄位名稱是否完全一致，例如：

```text
JLPT_Level
Common_Mistakes
Memory_Hook
Next_Review
Raw_Moji_Text
Conjugations
Related_Words
Synonyms
Antonyms
All_Examples
```

大小寫與底線都要相同。

### 問題 6：Notion 回傳 validation error

通常是欄位型別不一致。請確認：

- `Vocab` 是 Title
- `POS` / `JLPT_Level` / `Difficulty` / `Review_Status` 是 Select
- `Tags` 是 Multi-select
- `Next_Review` 是 Date
- `Conjugations` / `Related_Words` / `Synonyms` / `Antonyms` / `All_Examples` 是 Text / Rich text
- 其他說明欄位是 Text / Rich text

### 問題 7：CORS 錯誤

檢查前端網址是否與 `server/.env` 一致：

```env
CORS_ORIGIN=http://localhost:5173
```

如果前端跑在不同 port，例如 `http://localhost:4173`，請更新 `CORS_ORIGIN` 並重啟後端。

---

## 10. 日常使用快速指令

Terminal 1：

```bash
cd /home/rickyyang/workspace/moji-claude-notion-app
npm run dev:server
```

Terminal 2：

```bash
cd /home/rickyyang/workspace/moji-claude-notion-app
npm run dev:client
```

瀏覽器：

```text
http://localhost:5173
```

---

## 11. 修改欄位或 Prompt 的位置

| 想修改的內容 | 檔案 |
|---|---|
| Claude 要輸出的 JSON 欄位與規則 | `server/src/prompt.js` |
| Claude JSON 驗證與預設值 | `server/src/claudeJson.js` |
| JSON 寫入 Notion 欄位對應 | `server/src/notionMapper.js` |
| Express API route | `server/src/app.js` |
| React 畫面顯示 | `client/src/App.jsx` |
| 前端樣式 | `client/src/styles.css` |

修改後建議執行：

```bash
npm test
npm run build
```

---

## 12. GitHub 上傳流程

每次更新程式碼後，建議照這份文件操作：

```text
docs/github-workflow.md
```

最常用的一鍵流程：

```bash
cd /home/rickyyang/workspace/moji-claude-notion-app
./scripts/safe-push.sh "feat: 描述這次修改"
```

這會先跑測試與 build，再 commit / push，並檢查 `.env` 不會被提交。
