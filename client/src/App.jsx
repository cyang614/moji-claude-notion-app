import { useMemo, useState } from "react";
import Dashboard from "./Dashboard.jsx";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

const sampleText = `退く②⓪
どく
doku
自動·五段
ます形
退きます
て形
退いて
簡明釋義
Ai生成
让开；躲开；退让
釋義
退出，離開
しりぞく。
ちょっとどいてくれ。
躲開點！
近義詞
引っ込む
引き下がる
反義詞
進む`;

const basicFields = [
  ["單字", "vocab"],
  ["讀音", "kana"],
  ["詞性", "pos"],
  ["中文意思", "meaning"],
  ["文法重點", "grammar"],
  ["核心例句", "example_jp"],
  ["例句翻譯", "example_zh"],
  ["學習筆記", "notes"],
];

const enhancedFields = [
  ["漢字假名對照", "kanji_readings"],
  ["活用變化", "conjugations"],
  ["常用搭配", "collocations"],
  ["語感與情境", "nuance"],
  ["常見錯誤", "common_mistakes"],
  ["記憶法", "memory_hook"],
];

const mojiDetailFields = [
  ["關聯詞整理", "related_words"],
  ["近義詞", "synonyms"],
  ["反義詞", "antonyms"],
  ["全部例句", "all_examples"],
  ["原始 Moji 文字", "raw_moji_text"],
];

async function submitMojiText(mojiText) {
  const response = await fetch(`${API_BASE_URL}/api/moji-to-notion`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mojiText }),
  });

  const result = await response.json().catch(() => null);

  if (response.status === 409 && result?.duplicate) {
    return result;
  }

  if (!response.ok || !result?.ok) {
    throw new Error(result?.message || `API 錯誤：HTTP ${response.status}`);
  }

  return result;
}

function Field({ label, value, wide = false }) {
  return (
    <div className={`field-card ${wide ? "field-card-wide" : ""}`}>
      <div className="field-label">{label}</div>
      <div className="field-value">{value || "—"}</div>
    </div>
  );
}

function TagList({ tags = [] }) {
  if (!Array.isArray(tags) || tags.length === 0) return <span className="muted-text">—</span>;

  return (
    <div className="tag-list">
      {tags.map((tag) => (
        <span className="tag" key={tag}>{tag}</span>
      ))}
    </div>
  );
}

export default function App() {
  const [mojiText, setMojiText] = useState(sampleText);
  const [activeTab, setActiveTab] = useState("analyzer");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [showInputClearedNotice, setShowInputClearedNotice] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = useMemo(() => mojiText.trim().length > 0 && !isSubmitting, [mojiText, isSubmitting]);
  const vocabData = result?.data;

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setDuplicateWarning(null);
    setShowInputClearedNotice(false);
    setIsSubmitting(true);

    try {
      const data = await submitMojiText(mojiText.trim());

      if (data.duplicate) {
        setDuplicateWarning(data);
        return;
      }

      setResult(data);
      setMojiText("");
      setShowInputClearedNotice(true);
    } catch (err) {
      setError(err.message || "發生未知錯誤");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Japanese Learning Workflow V3</p>
          <h1>Moji 辭書完整頁面分析器</h1>
          <p className="subtitle">
            貼上 Moji 辭書完整頁面，Claude 會分析釋義、活用、關聯詞、近反義詞與所有例句，並把簡體中文轉成台灣繁體後寫入 Notion。
          </p>
        </div>
        <div className="status-pill">Claude API + Notion API + 台灣繁中化</div>
      </section>

      <nav className="tab-nav" aria-label="主要功能切換">
        <button
          type="button"
          className={activeTab === "analyzer" ? "tab-button active" : "tab-button"}
          onClick={() => setActiveTab("analyzer")}
        >
          分析器
        </button>
        <button
          type="button"
          className={activeTab === "dashboard" ? "tab-button active" : "tab-button"}
          onClick={() => setActiveTab("dashboard")}
        >
          儀表板
        </button>
      </nav>

      {activeTab === "dashboard" ? <Dashboard /> : (
        <section className="workspace-grid">
        <form className="panel editor-panel" onSubmit={handleSubmit}>
          <div className="panel-header">
            <div>
              <h2>輸入 Moji 原始文字</h2>
              <p>可直接貼上整個 Moji 單字頁面，包含釋義、活用、關聯詞、近反義詞與例句。</p>
            </div>
            <button type="button" className="ghost-button" onClick={() => setMojiText("")}>清空</button>
          </div>

          <textarea
            value={mojiText}
            onChange={(event) => setMojiText(event.target.value)}
            placeholder="請貼上從 Moji 辭書複製的完整內容..."
          />

          <button className="primary-button" disabled={!canSubmit} type="submit">
            {isSubmitting ? "處理中，正在寫入 Notion..." : "分析完整頁面並新增到 Notion"}
          </button>

          {error && <div className="alert error">{error}</div>}
          {duplicateWarning && (
            <div className="alert warning">
              <div>{duplicateWarning.message}</div>
              {duplicateWarning.notionUrl && (
                <a href={duplicateWarning.notionUrl} target="_blank" rel="noreferrer">
                  開啟既有 Notion 頁面
                </a>
              )}
            </div>
          )}
        </form>

        <section className="panel result-panel">
          <div className="panel-header">
            <div>
              <h2>
                Claude 解析結果
                {result?.ok && <span className="success-badge">已儲存到 Notion ✓</span>}
              </h2>
              <p>成功後會顯示完整 Moji 分析欄位與 Notion 頁面連結。</p>
            </div>
          </div>

          {!result && !error && (
            <div className="empty-state">
              <div className="empty-icon">日</div>
              <p>送出後，解析結果會出現在這裡。</p>
            </div>
          )}

          {vocabData && (
            <div className="result-content">
              {showInputClearedNotice && <div className="info-tip">輸入框已清空，可貼入下一個單字</div>}
              <div className="summary-strip">
                <div>
                  <span>JLPT</span>
                  <strong>{vocabData.jlpt_level || "Unknown"}</strong>
                </div>
                <div>
                  <span>難度</span>
                  <strong>{vocabData.difficulty || "3"}/5</strong>
                </div>
                <div>
                  <span>複習狀態</span>
                  <strong>{vocabData.review_status || "New"}</strong>
                </div>
                <div>
                  <span>下次複習</span>
                  <strong>{vocabData.next_review || "—"}</strong>
                </div>
              </div>

              <div className="field-card field-card-wide">
                <div className="field-label">標籤</div>
                <div className="field-value"><TagList tags={vocabData.tags} /></div>
              </div>

              <h3 className="section-title">基礎資料</h3>
              <div className="field-grid">
                {basicFields.map(([label, key]) => (
                  <Field key={key} label={label} value={vocabData[key]} />
                ))}
              </div>

              <h3 className="section-title">學習強化</h3>
              <div className="field-grid">
                {enhancedFields.map(([label, key]) => (
                  <Field key={key} label={label} value={vocabData[key]} wide />
                ))}
              </div>

              <h3 className="section-title">Moji 完整頁面整理</h3>
              <div className="field-grid">
                {mojiDetailFields.map(([label, key]) => (
                  <Field key={key} label={label} value={vocabData[key]} wide />
                ))}
              </div>

              {result.notionUrl && (
                <a className="notion-link" href={result.notionUrl} target="_blank" rel="noreferrer">
                  開啟 Notion 頁面
                </a>
              )}
            </div>
          )}
        </section>
      </section>
      )}
    </main>
  );
}
