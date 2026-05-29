import { useEffect, useMemo, useState } from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

async function fetchJson(endpoint) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`);
  const result = await response.json().catch(() => null);

  if (!response.ok || !result?.ok) {
    throw new Error(result?.message || `API 錯誤：HTTP ${response.status}`);
  }

  return result;
}

async function postJson(endpoint, payload) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => null);

  if (!response.ok || !result?.ok) {
    throw new Error(result?.message || `API 錯誤：HTTP ${response.status}`);
  }

  return result;
}

function TaskCard({ task }) {
  return (
    <article className={`today-task-card task-${task.priority || "normal"}`}>
      <div className="task-card-header">
        <div>
          <h2>{task.title}</h2>
          <p>{task.description}</p>
        </div>
        <span className="task-count">{task.count}</span>
      </div>
      {task.items?.length ? (
        <div className="task-item-list">
          {task.items.slice(0, 5).map((item) => (
            <div className="task-item" key={`${task.id}-${item.notionPageId || item.vocab}`}>
              <strong>{item.vocab || "—"}</strong>
              <span>{item.kana || "—"}</span>
              {item.lapseCount > 0 && <em>生疏 {item.lapseCount} 次</em>}
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-dashboard-state small-empty-state">目前沒有項目</div>
      )}
    </article>
  );
}

function QuizPanel({ quizTask }) {
  const [quiz, setQuiz] = useState(null);
  const [selected, setSelected] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const quizItems = quizTask?.items || [];

  async function handleGenerateQuiz() {
    setIsLoading(true);
    setError("");
    setSelected("");
    try {
      const result = await postJson("/api/quiz/generate", { items: quizItems });
      setQuiz(result.quiz);
    } catch (err) {
      setError(err.message || "Claude 小測驗產生失敗");
    } finally {
      setIsLoading(false);
    }
  }

  const isCorrect = selected && quiz && selected === quiz.answer;

  return (
    <section className="panel dashboard-section quiz-panel">
      <div className="panel-header compact-header">
        <div>
          <h2>Claude 小測驗模式</h2>
          <p>使用今日待複習與生疏單字產生一題語感、例句或意思辨析題。</p>
        </div>
        <button className="primary-button compact-primary-button" type="button" disabled={isLoading || quizItems.length === 0} onClick={handleGenerateQuiz}>
          {isLoading ? "產生中..." : "產生 Claude 小測驗"}
        </button>
      </div>

      {error && <div className="alert error">{error}</div>}
      {quiz ? (
        <div className="quiz-card">
          <div className="tag">目標單字：{quiz.target_vocab}</div>
          <h3>{quiz.question}</h3>
          <div className="quiz-choice-grid">
            {quiz.choices.map((choice) => (
              <button
                className={selected === choice ? "quiz-choice selected" : "quiz-choice"}
                key={choice}
                type="button"
                onClick={() => setSelected(choice)}
              >
                {choice}
              </button>
            ))}
          </div>
          {selected && (
            <div className={isCorrect ? "review-feedback remembered" : "review-feedback forgotten"}>
              {isCorrect ? `答對了！「${quiz.answer}」` : `再想想，正解是「${quiz.answer}」`}
            </div>
          )}
          {selected && <p className="quiz-explanation">{quiz.explanation}</p>}
        </div>
      ) : (
        <div className="info-tip">目前會用 {quizItems.length} 個單字做出一題小測驗。</div>
      )}
    </section>
  );
}

function WeaknessReport({ report }) {
  if (!report) return null;

  return (
    <section className="panel dashboard-section weakness-panel">
      <div className="panel-header compact-header">
        <div>
          <h2>錯題本 / 生疏分析</h2>
          <p>依照 Notion 的生疏次數與複習次數找出需要優先補強的單字。</p>
        </div>
      </div>
      <div className="srs-summary-grid weakness-summary-grid">
        <span>高風險：{report.summary?.highRiskCount || 0}</span>
        <span>總生疏次數：{report.summary?.totalLapses || 0}</span>
        <span>平均生疏：{report.summary?.averageLapsesPerReviewedItem || 0}</span>
      </div>
      <div className="recommendation-list">
        {(report.recommendations || []).map((recommendation) => (
          <div className="info-tip" key={recommendation}>{recommendation}</div>
        ))}
      </div>
      <div className="weakness-list">
        {(report.items || []).map((item) => (
          <article className="weakness-item" key={`${item.vocab}-${item.lapseCount}`}>
            <div>
              <strong>{item.vocab}</strong>
              <span>{item.kana || "—"}｜{item.meaning || "—"}</span>
            </div>
            <div className="weakness-meta">
              <span className="tag">{item.riskLevel === "high" ? "高風險" : "中風險"}</span>
              <span>生疏 {item.lapseCount || 0} / 複習 {item.reviewCount || 0}</span>
            </div>
            <p>{item.suggestedAction}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function TodayTasks() {
  const [tasksData, setTasksData] = useState(null);
  const [weaknessReport, setWeaknessReport] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadTodayData() {
    setIsLoading(true);
    setError("");
    try {
      const [tasks, weakness] = await Promise.all([
        fetchJson("/api/today-tasks"),
        fetchJson("/api/weakness-report"),
      ]);
      setTasksData(tasks);
      setWeaknessReport(weakness);
    } catch (err) {
      setError(err.message || "今日任務讀取失敗");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadTodayData();
  }, []);

  const quizTask = useMemo(
    () => tasksData?.tasks?.find((task) => task.id === "claude-quiz"),
    [tasksData],
  );

  if (isLoading) {
    return (
      <section className="dashboard-shell">
        <div className="dashboard-title-row">
          <div>
            <p className="eyebrow dashboard-eyebrow">Daily Mission</p>
            <h1>今日任務模式</h1>
          </div>
        </div>
        <div className="dashboard-grid" aria-label="今日任務載入中">
          {Array.from({ length: 4 }).map((_, index) => <div className="skeleton-card" key={index} />)}
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="dashboard-shell">
        <div className="dashboard-title-row">
          <div>
            <p className="eyebrow dashboard-eyebrow">Daily Mission</p>
            <h1>今日任務模式</h1>
          </div>
        </div>
        <div className="panel dashboard-error">
          <div className="alert error">{error}</div>
          <button className="primary-button reload-button" type="button" onClick={loadTodayData}>重新載入</button>
        </div>
      </section>
    );
  }

  return (
    <section className="dashboard-shell today-shell">
      <div className="dashboard-title-row">
        <div>
          <p className="eyebrow dashboard-eyebrow">Daily Mission</p>
          <h1>今日任務模式</h1>
          <p className="dashboard-subtitle">把每日最該做的複習、生疏補強與 Claude 小測驗整理成一個固定入口。</p>
        </div>
        <button className="ghost-button dashboard-refresh-button" type="button" onClick={loadTodayData}>重新整理今日任務</button>
      </div>

      <div className="stats-row">
        <div className="stat-card stat-danger">
          <div className="stat-label">今日待複習：{tasksData?.summary?.dueReviewCount || 0}</div>
          <div className="stat-value">{tasksData?.summary?.dueReviewCount || 0}</div>
          <div className="stat-helper">先完成這批卡片</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">生疏補強</div>
          <div className="stat-value">{tasksData?.summary?.weakItemCount || 0}</div>
          <div className="stat-helper">錯題本優先項目</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">小測驗素材</div>
          <div className="stat-value">{tasksData?.summary?.suggestedQuizCount || 0}</div>
          <div className="stat-helper">Claude 可出題單字</div>
        </div>
        <div className="stat-card stat-success">
          <div className="stat-label">日期</div>
          <div className="stat-value">{tasksData?.today || "—"}</div>
          <div className="stat-helper">今日任務清單</div>
        </div>
      </div>

      <div className="today-task-grid">
        {(tasksData?.tasks || []).map((task) => <TaskCard task={task} key={task.id} />)}
      </div>

      <QuizPanel quizTask={quizTask} />
      <WeaknessReport report={weaknessReport} />
    </section>
  );
}
