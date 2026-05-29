import { useMemo, useState } from "react";
import Dashboard from "./Dashboard.jsx";
import TodayTasks from "./TodayTasks.jsx";
import { speakJapanese } from "./speech.js";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

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

const editableFields = [...basicFields, ...enhancedFields, ...mojiDetailFields];

async function postJson(endpoint, payload) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
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

async function submitMojiText(mojiText) {
  return postJson("/api/moji-to-notion", { mojiText });
}

async function previewMojiText(mojiText) {
  return postJson("/api/moji-preview", { mojiText });
}

async function saveVocabData(data) {
  return postJson("/api/vocab-to-notion", { data });
}

async function batchImportMoji(entries) {
  return postJson("/api/batch-moji-to-notion", { entries });
}

async function fetchSchemaHealth() {
  const response = await fetch(`${API_BASE_URL}/api/notion-schema-health`);
  const result = await response.json().catch(() => null);

  if (!response.ok || !result?.ok) {
    throw new Error(result?.message || `Schema API 錯誤：HTTP ${response.status}`);
  }

  return result;
}

function splitBatchEntries(text) {
  return text
    .split(/\n-{3,}\n/g)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function Field({ label, value, wide = false, onSpeak, speakLabel }) {
  return (
    <div className={`field-card ${wide ? "field-card-wide" : ""}`}>
      <div className="field-label">{label}</div>
      <div className="field-value-row">
        <div className="field-value">{value || "—"}</div>
        {onSpeak && value && (
          <button className="speak-button" type="button" onClick={onSpeak} aria-label={speakLabel || `播放 ${value} 發音`}>🔊</button>
        )}
      </div>
    </div>
  );
}

function EditableField({ label, fieldKey, value, onChange }) {
  const isLong = ["meaning", "grammar", "example_jp", "example_zh", "notes", "collocations", "nuance", "common_mistakes", "memory_hook", "related_words", "all_examples", "raw_moji_text"].includes(fieldKey);
  return (
    <label className={`edit-field ${isLong ? "edit-field-wide" : ""}`}>
      <span>編輯 {label}</span>
      {isLong ? (
        <textarea
          className="edit-textarea"
          aria-label={`編輯 ${label}`}
          value={value || ""}
          onChange={(event) => onChange(fieldKey, event.target.value)}
        />
      ) : (
        <input
          aria-label={`編輯 ${label}`}
          value={value || ""}
          onChange={(event) => onChange(fieldKey, event.target.value)}
        />
      )}
    </label>
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

function ResultDisplay({ result, vocabData, showInputClearedNotice }) {
  if (!vocabData) return null;

  return (
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
          <Field
            key={key}
            label={label}
            value={vocabData[key]}
            onSpeak={key === "vocab" ? () => speakJapanese(vocabData[key]) : undefined}
            speakLabel={key === "vocab" ? `播放 ${vocabData[key]} 發音` : undefined}
          />
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

      {result?.notionUrl && (
        <a className="notion-link" href={result.notionUrl} target="_blank" rel="noreferrer">
          開啟 Notion 頁面
        </a>
      )}
    </div>
  );
}

function PreviewEditor({ previewData, isSaving, onChange, onSave }) {
  if (!previewData) return null;

  return (
    <div className="preview-editor">
      <div className="info-tip preview-tip">預覽待確認</div>
      <div className="preview-meta-row">
        <label>
          <span>JLPT 等級</span>
          <select value={previewData.jlpt_level || "Unknown"} onChange={(event) => onChange("jlpt_level", event.target.value)}>
            {["N5", "N4", "N3", "N2", "N1", "Unknown"].map((level) => <option key={level} value={level}>{level}</option>)}
          </select>
        </label>
        <label>
          <span>難度</span>
          <select value={previewData.difficulty || "3"} onChange={(event) => onChange("difficulty", event.target.value)}>
            {["1", "2", "3", "4", "5"].map((level) => <option key={level} value={level}>{level}</option>)}
          </select>
        </label>
      </div>
      <div className="edit-grid">
        {editableFields.map(([label, key]) => (
          <EditableField key={key} label={label} fieldKey={key} value={previewData[key]} onChange={onChange} />
        ))}
      </div>
      <button className="primary-button" type="button" disabled={isSaving} onClick={onSave}>
        {isSaving ? "儲存中..." : "確認儲存到 Notion"}
      </button>
    </div>
  );
}

export default function App() {
  const [mojiText, setMojiText] = useState("");
  const [activeTab, setActiveTab] = useState("analyzer");
  const [result, setResult] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [error, setError] = useState("");
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [showInputClearedNotice, setShowInputClearedNotice] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSavingPreview, setIsSavingPreview] = useState(false);
  const [schemaHealth, setSchemaHealth] = useState(null);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [batchText, setBatchText] = useState("");
  const [batchResult, setBatchResult] = useState(null);
  const [isBatching, setIsBatching] = useState(false);

  const canSubmit = useMemo(() => mojiText.trim().length > 0 && !isSubmitting && !isPreviewing, [mojiText, isSubmitting, isPreviewing]);
  const vocabData = result?.data;

  function clearMessages() {
    setError("");
    setDuplicateWarning(null);
    setShowInputClearedNotice(false);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    clearMessages();
    setIsSubmitting(true);

    try {
      const data = await submitMojiText(mojiText.trim());

      if (data.duplicate) {
        setDuplicateWarning(data);
        return;
      }

      setResult(data);
      setPreviewData(null);
      setMojiText("");
      setShowInputClearedNotice(true);
    } catch (err) {
      setError(err.message || "發生未知錯誤");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePreview() {
    clearMessages();
    setIsPreviewing(true);
    setResult(null);

    try {
      const data = await previewMojiText(mojiText.trim());
      setPreviewData(data.data);
    } catch (err) {
      setError(err.message || "預覽失敗");
    } finally {
      setIsPreviewing(false);
    }
  }

  function updatePreviewField(fieldKey, value) {
    setPreviewData((current) => ({ ...current, [fieldKey]: value }));
  }

  async function handleSavePreview() {
    clearMessages();
    setIsSavingPreview(true);

    try {
      const data = await saveVocabData(previewData);
      if (data.duplicate) {
        setDuplicateWarning(data);
        return;
      }
      setResult(data);
      setPreviewData(null);
      setMojiText("");
      setShowInputClearedNotice(true);
    } catch (err) {
      setError(err.message || "儲存失敗");
    } finally {
      setIsSavingPreview(false);
    }
  }

  async function handleSchemaHealth() {
    setSchemaLoading(true);
    setError("");
    try {
      setSchemaHealth(await fetchSchemaHealth());
    } catch (err) {
      setSchemaHealth(null);
      setError(err.message || "Schema 檢查失敗");
    } finally {
      setSchemaLoading(false);
    }
  }

  async function handleBatchImport() {
    const entries = splitBatchEntries(batchText);
    if (entries.length === 0) {
      setError("請先輸入至少一筆批次內容");
      return;
    }

    setIsBatching(true);
    setBatchResult(null);
    setError("");
    try {
      setBatchResult(await batchImportMoji(entries));
    } catch (err) {
      setError(err.message || "批次匯入失敗");
    } finally {
      setIsBatching(false);
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
          className={activeTab === "today" ? "tab-button active" : "tab-button"}
          onClick={() => setActiveTab("today")}
        >
          今日任務
        </button>
        <button
          type="button"
          className={activeTab === "dashboard" ? "tab-button active" : "tab-button"}
          onClick={() => setActiveTab("dashboard")}
        >
          儀表板
        </button>
      </nav>

      {activeTab === "dashboard" ? <Dashboard /> : activeTab === "today" ? <TodayTasks /> : (
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

            <div className="action-row">
              <button className="primary-button" disabled={!canSubmit} type="submit">
                {isSubmitting ? "處理中，正在寫入 Notion..." : "分析完整頁面並新增到 Notion"}
              </button>
              <button className="ghost-button preview-button" disabled={!canSubmit} type="button" onClick={handlePreview}>
                {isPreviewing ? "分析中..." : "只分析預覽"}
              </button>
            </div>

            <section className="utility-box">
              <div className="utility-header">
                <div>
                  <h3>Notion Schema Health</h3>
                  <p>檢查資料庫欄位名稱與型別是否符合目前匯入流程。</p>
                </div>
                <button className="ghost-button" type="button" onClick={handleSchemaHealth} disabled={schemaLoading}>
                  {schemaLoading ? "檢查中..." : "檢查 Notion 欄位"}
                </button>
              </div>
              {schemaHealth && (
                <div className={`schema-result ${schemaHealth.healthy ? "schema-healthy" : "schema-unhealthy"}`}>
                  <strong>{schemaHealth.healthy ? "Schema 正常" : "Schema 需要調整"}</strong>
                  <span>已檢查 {schemaHealth.checked} 個欄位</span>
                  {[...(schemaHealth.missing || [])].map((item) => (
                    <div key={`missing-${item.property}`}>缺少欄位：{item.property}（{item.expectedType}）</div>
                  ))}
                  {[...(schemaHealth.typeMismatches || [])].map((item) => (
                    <div key={`mismatch-${item.property}`}>型別不符：{item.property} 應為 {item.expectedType}，目前是 {item.actualType}</div>
                  ))}
                </div>
              )}
            </section>

            <section className="utility-box srs-settings-box">
              <div className="utility-header">
                <div>
                  <h3>SRS 設定</h3>
                  <p>新增單字會自動初始化複習排程：N5/N4 = 3 天、N3 = 5 天、N2/N1/Unknown = 7 天；複習結果使用 Again/Hard/Good/Easy 四選。</p>
                </div>
              </div>
              <div className="srs-rules-row">
                <span>Again：3 天</span>
                <span>Hard：×1.2</span>
                <span>Good：×2.5</span>
                <span>Easy：×4.0</span>
              </div>
            </section>

            <section className="utility-box">
              <div className="utility-header">
                <div>
                  <h3>批次匯入</h3>
                  <p>用三個以上連字號 `---` 分隔多筆 Moji 內容，後端會逐筆分析、查重並匯入。</p>
                </div>
              </div>
              <textarea
                className="batch-textarea"
                value={batchText}
                onChange={(event) => setBatchText(event.target.value)}
                placeholder="每個單字以 --- 分隔，可一次貼上多筆 Moji 內容..."
              />
              <button className="ghost-button batch-button" type="button" disabled={isBatching} onClick={handleBatchImport}>
                {isBatching ? "批次匯入中..." : "開始批次匯入"}
              </button>
              {batchResult && (
                <div className="batch-result">
                  <strong>批次完成：成功 {batchResult.summary.created}、重複 {batchResult.summary.duplicate}、失敗 {batchResult.summary.failed} / 共 {batchResult.summary.total} 筆</strong>
                  <div className="batch-items">
                    {batchResult.items.map((item) => (
                      <div key={`${item.index}-${item.vocab || item.status}`}>
                        {item.vocab || `第 ${item.index + 1} 筆`}：{item.status}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

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
                <p>{previewData ? "請先確認或修正 Claude 解析內容，再儲存到 Notion。" : "成功後會顯示完整 Moji 分析欄位與 Notion 頁面連結。"}</p>
              </div>
            </div>

            {!result && !previewData && !error && (
              <div className="empty-state">
                <div className="empty-icon">日</div>
                <p>送出後，解析結果會出現在這裡。</p>
              </div>
            )}

            <PreviewEditor
              previewData={previewData}
              isSaving={isSavingPreview}
              onChange={updatePreviewField}
              onSave={handleSavePreview}
            />
            <ResultDisplay result={result} vocabData={vocabData} showInputClearedNotice={showInputClearedNotice} />
          </section>
        </section>
      )}
    </main>
  );
}
