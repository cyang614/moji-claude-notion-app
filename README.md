# Moji 辭書 → Claude → Notion 學習網頁 V3

這是一個 Node.js Express + React 專案：前端貼上 Moji 辭書完整單字頁面，後端使用官方 `@anthropic-ai/sdk` 呼叫 Claude，把資料整理成 V3 日文學習 JSON，再用 `@notionhq/client` 新增到 Notion Database。

V3 特色：除了基礎單字資料，會自動補強 JLPT、難度、標籤、常用搭配、語感、常見錯誤、記憶法、複習狀態、下次複習日、原始 Moji 文字、活用變化、關聯詞整理、近義詞、反義詞、全部例句、漢字假名對照等台灣繁體中文欄位。Claude Prompt 也明確要求分析所有 Moji 資料，並將簡體中文轉成台灣繁體用語；後端另使用 `opencc-js` 做一次簡體到台灣繁體的轉換保險。新增 Notion 頁面時，除了欄位 properties，也會把所有 Claude 整理內容寫進該資料列的頁面內文。

## 專案結構

```text
moji-claude-notion-app/
  client/                 # React + Vite 前端
  server/                 # Express API 後端
    src/
      prompt.js           # Claude Prompt
      claudeService.js    # Claude API 呼叫
      claudeJson.js       # JSON 解析、驗證與 V2 預設值
      notionMapper.js     # Notion properties 轉換
      app.js              # Express routes
      index.js            # Server entry
    test/                 # Vitest + Supertest 測試
  docs/
    ubuntu-v2-operation-manual.md
```

## Notion Database 欄位需求

請先建立一個 Notion Database，欄位名稱與型別如下：

| 欄位名稱 | 型別 |
|---|---|
| 單字 | Title |
| 讀音 | Text / Rich text |
| 詞性 | Select |
| 中文意思 | Text / Rich text |
| 文法重點 | Text / Rich text |
| 核心例句（日文） | Text / Rich text |
| 例句翻譯 | Text / Rich text |
| 學習筆記 | Text / Rich text |
| JLPT 等級 | Select |
| 難度 | Select |
| 標籤 | Multi-select |
| 常用搭配 | Text / Rich text |
| 語感 | Text / Rich text |
| 常見錯誤 | Text / Rich text |
| 記憶法 | Text / Rich text |
| 複習狀態 | Select |
| 下次複習日 | Date |
| 原始 Moji 文字 | Text / Rich text |
| 活用變化 | Text / Rich text |
| 關聯詞整理 | Text / Rich text |
| 近義詞 | Text / Rich text |
| 反義詞 | Text / Rich text |
| 全部例句 | Text / Rich text |
| 漢字假名對照 | Text / Rich text |

如果你的欄位名稱不同，請修改：

```text
server/src/notionMapper.js
```

## 環境變數

建立後端環境變數：

```bash
cd /home/rickyyang/workspace/moji-claude-notion-app/server
cp .env.example .env
nano .env
```

填入：

```env
ANTHROPIC_API_KEY=你的_Claude_API_Key
NOTION_API_KEY=你的_Notion_Integration_Secret
NOTION_DATABASE_ID=你的_Notion_Database_ID
CLAUDE_MODEL=claude-3-5-sonnet-latest
CORS_ORIGIN=http://localhost:5173
PORT=3001
```

注意：

1. Claude API Key 和 Notion API Key 只能放在後端 `.env`，不要放到 React 前端。
2. Notion Integration 必須先被邀請到指定 Database，否則 API 會沒有權限。
3. `NOTION_DATABASE_ID` 可從 Notion Database 網址取得。

## 安裝

在專案根目錄執行：

```bash
cd /home/rickyyang/workspace/moji-claude-notion-app
npm run install:all
```

## 啟動開發環境

開兩個 Ubuntu terminal。

第一個 terminal 啟動後端：

```bash
cd /home/rickyyang/workspace/moji-claude-notion-app
npm run dev:server
```

第二個 terminal 啟動前端：

```bash
cd /home/rickyyang/workspace/moji-claude-notion-app
npm run dev:client
```

前端預設網址：

```text
http://localhost:5173
```

後端 API：

```text
POST http://localhost:3001/api/moji-to-notion
GET  http://localhost:3001/api/health
```

## 測試與建置

後端測試：

```bash
cd /home/rickyyang/workspace/moji-claude-notion-app
npm test
```

前端建置：

```bash
cd /home/rickyyang/workspace/moji-claude-notion-app
npm run build
```

## API Request 範例

```json
{
  "mojiText": "勉強【べんきょう】\n名詞・スル動詞\n學習；用功\n例文：毎日日本語を勉強します。"
}
```

成功回應會包含 V2 欄位：

```json
{
  "ok": true,
  "data": {
    "vocab": "勉強",
    "kana": "べんきょう",
    "pos": "名詞・スル動詞",
    "meaning": "學習；用功",
    "grammar": "勉強する：做學習這個動作",
    "example_jp": "毎日日本語を勉強します。",
    "example_zh": "我每天學日文。",
    "notes": "常搭配「を」表示學習的內容。",
    "jlpt_level": "N5",
    "difficulty": "1",
    "tags": ["日常", "學習", "N5"],
    "collocations": "日本語を勉強する、試験勉強",
    "nuance": "中性用語，日常與正式場合皆可使用。",
    "common_mistakes": "不要把「勉強」誤解成中文的勉強、不情願。",
    "memory_hook": "想到「用功讀書」的勉強，而不是中文的硬撐。",
    "review_status": "New",
    "next_review": "2026-05-28",
    "raw_moji_text": "勉強【べんきょう】\n學習；用功"
  },
  "notionPageId": "...",
  "notionUrl": "..."
}
```

詳細操作手冊請看：

```text
docs/ubuntu-v2-operation-manual.md
docs/github-workflow.md
```

> `ubuntu-v2-operation-manual.md` 檔名沿用既有文件，但內容已補充 V3 欄位與完整 Moji 頁面分析流程。
