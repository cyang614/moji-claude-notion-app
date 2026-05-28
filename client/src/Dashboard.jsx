import { useEffect, useMemo, useState } from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";
const jlptOrder = ["N5", "N4", "N3", "N2", "N1", "Unknown"];
const difficultyOrder = ["1", "2", "3", "4", "5"];
const jlptLabels = {
  N5: "N5 基礎",
  N4: "N4 初級",
  N3: "N3 中級",
  N2: "N2 中高級",
  N1: "N1 高級",
  Unknown: "未分類",
};

async function fetchDashboardStats() {
  const response = await fetch(`${API_BASE_URL}/api/dashboard-stats`);
  const result = await response.json().catch(() => null);

  if (!response.ok || !result?.ok) {
    throw new Error(result?.message || `儀表板 API 錯誤：HTTP ${response.status}`);
  }

  return result;
}

function getMaxEntry(record = {}) {
  return Object.entries(record).reduce(
    (best, entry) => (entry[1] > best[1] ? entry : best),
    ["—", 0],
  );
}

function getAverageDifficulty(difficulty = {}) {
  const total = Object.entries(difficulty).reduce((sum, [level, count]) => sum + Number(level) * Number(count || 0), 0);
  const count = Object.values(difficulty).reduce((sum, value) => sum + Number(value || 0), 0);
  return count > 0 ? (total / count).toFixed(1) : "0.0";
}

function StatCard({ label, value, tone = "default", helper }) {
  return (
    <div className={`stat-card stat-${tone}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {helper && <div className="stat-helper">{helper}</div>}
    </div>
  );
}

function SkeletonDashboard() {
  return (
    <div className="dashboard-grid" aria-label="儀表板載入中">
      {Array.from({ length: 4 }).map((_, index) => <div className="skeleton-card" key={index} />)}
      <div className="panel dashboard-section skeleton-wide"><div className="skeleton-line" /><div className="skeleton-line short" /><div className="skeleton-line" /></div>
      <div className="panel dashboard-section skeleton-wide"><div className="skeleton-line" /><div className="skeleton-line short" /><div className="skeleton-line" /></div>
    </div>
  );
}

function BarDistribution({ title, data, order, labelFor = (key) => key, classPrefix = "" }) {
  const total = Object.values(data || {}).reduce((sum, value) => sum + Number(value || 0), 0);

  return (
    <section className="panel dashboard-section">
      <div className="panel-header compact-header">
        <div>
          <h2>{title}</h2>
          <p>長條寬度依照數量佔總數比例自動計算。</p>
        </div>
      </div>
      <div className="bar-list">
        {order.map((key) => {
          const count = Number(data?.[key] || 0);
          const width = total > 0 ? `${Math.max((count / total) * 100, count > 0 ? 4 : 0)}%` : "0%";
          return (
            <div className="bar-row" key={key}>
              <div className="bar-meta">
                <strong>{labelFor(key)}</strong>
                <span>{count} 個</span>
              </div>
              <div className="bar-track">
                <div className={`bar-fill ${classPrefix}${key}`} style={{ width }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ReviewCard({ item }) {
  return (
    <article className="review-card">
      <div>
        <div className="review-vocab">{item.vocab || "—"}</div>
        <div className="review-kana">{item.kana || "—"}</div>
      </div>
      <div className="review-actions">
        <span className="tag">{item.jlpt_level || "Unknown"}</span>
        {item.notionUrl && <a className="mini-link" href={item.notionUrl} target="_blank" rel="noreferrer">開啟 Notion</a>}
      </div>
    </article>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  async function loadStats() {
    setIsLoading(true);
    setError("");
    try {
      const data = await fetchDashboardStats();
      setStats(data);
    } catch (err) {
      setError(err.message || "儀表板載入失敗");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadStats();
  }, []);

  const summary = useMemo(() => {
    const [topJlpt, topJlptCount] = getMaxEntry(stats?.jlpt || {});
    return {
      dueCount: stats?.dueToday?.length || 0,
      topJlpt,
      topJlptCount,
      averageDifficulty: getAverageDifficulty(stats?.difficulty || {}),
    };
  }, [stats]);

  if (isLoading) {
    return (
      <section className="dashboard-shell">
        <div className="dashboard-title-row">
          <div>
            <p className="eyebrow dashboard-eyebrow">Learning Analytics</p>
            <h1>學習數據儀表板</h1>
          </div>
        </div>
        <SkeletonDashboard />
      </section>
    );
  }

  if (error) {
    return (
      <section className="dashboard-shell">
        <div className="dashboard-title-row">
          <div>
            <p className="eyebrow dashboard-eyebrow">Learning Analytics</p>
            <h1>學習數據儀表板</h1>
          </div>
        </div>
        <div className="panel dashboard-error">
          <div className="alert error">{error}</div>
          <button className="primary-button reload-button" type="button" onClick={loadStats}>重新載入</button>
        </div>
      </section>
    );
  }

  return (
    <section className="dashboard-shell">
      <div className="dashboard-title-row">
        <div>
          <p className="eyebrow dashboard-eyebrow">Learning Analytics</p>
          <h1>學習數據儀表板</h1>
          <p className="dashboard-subtitle">從 Notion 學習筆記即時整理 JLPT、難度與複習進度。</p>
        </div>
      </div>

      <div className="stats-row">
        <StatCard label="總單字數" value={stats?.total ?? 0} helper="Notion 資料庫統計" />
        <StatCard
          label="今日待複習數量"
          value={summary.dueCount === 0 ? "✓ 今日無待複習" : summary.dueCount}
          tone={summary.dueCount === 0 ? "success" : "danger"}
          helper={summary.dueCount === 0 ? "保持節奏，很棒！" : "建議今天完成"}
        />
        <StatCard label="最高比例的 JLPT 等級" value={summary.topJlpt} helper={`${summary.topJlptCount} 個單字`} />
        <StatCard label="平均難度" value={summary.averageDifficulty} helper="1 簡單 / 5 困難" />
      </div>

      <div className="dashboard-two-column">
        <BarDistribution title="JLPT 等級分佈" data={stats?.jlpt} order={jlptOrder} labelFor={(key) => jlptLabels[key] || key} classPrefix="jlpt-" />
        <BarDistribution title="難度分佈" data={stats?.difficulty} order={difficultyOrder} labelFor={(key) => `難度 ${key}`} classPrefix="difficulty-" />
      </div>

      <section className="panel dashboard-section">
        <div className="panel-header compact-header">
          <div>
            <h2>今日待複習清單</h2>
            <p>下次複習日已到且狀態為 New 的單字，最多顯示 20 筆。</p>
          </div>
        </div>
        {stats?.dueToday?.length ? (
          <div className="review-list">
            {stats.dueToday.map((item) => <ReviewCard item={item} key={`${item.vocab}-${item.notionUrl}`} />)}
          </div>
        ) : (
          <div className="empty-dashboard-state">🎉 今日單字都複習完了！</div>
        )}
      </section>

      <section className="panel dashboard-section">
        <div className="panel-header compact-header">
          <div>
            <h2>最近新增單字</h2>
            <p>依照「下次複習日」由新到舊排序，顯示前 10 筆。</p>
          </div>
        </div>
        <div className="table-wrap">
          <table className="recent-table">
            <thead>
              <tr>
                <th>vocab</th>
                <th>kana</th>
                <th>JLPT</th>
                <th>難度</th>
                <th>Notion</th>
              </tr>
            </thead>
            <tbody>
              {(stats?.recentlyAdded || []).map((item) => (
                <tr key={`${item.vocab}-${item.notionUrl}`}>
                  <td>{item.vocab || "—"}</td>
                  <td>{item.kana || "—"}</td>
                  <td>{item.jlpt_level || "Unknown"}</td>
                  <td>{item.difficulty || "—"}</td>
                  <td>{item.notionUrl ? <a href={item.notionUrl} target="_blank" rel="noreferrer">開啟</a> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
