import { useEffect, useState, useCallback } from "react";
import "./App.css";

// デプロイ済みのCrypto Radar Workerのベースアドレス
const API_BASE = "https://crypto-radar-api.elcojpn2021.workers.dev";

const CATEGORIES = [
  { id: "metaverse", label: "メタバース" },
  { id: "gaming", label: "ゲーミング" },
  { id: "ai", label: "AI" },
  { id: "all", label: "全銘柄" }
];

const CRITERIA_LABELS = {
  change_7d: "7日変化",
  change_30d: "30日変化",
  volume: "出来高",
  ath: "ATH下落",
  market_cap: "時価総額"
};

function formatPrice(price) {
  if (price == null) return "-";
  if (price >= 1) {
    return `$${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  }
  return `$${price.toPrecision(3)}`;
}

function formatPercent(value) {
  if (value == null) return "-";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function formatRelativeTime(iso) {
  if (!iso) return "-";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "たった今";
  if (mins < 60) return `${mins}分前`;
  const hours = Math.floor(mins / 60);
  return `${hours}時間前`;
}

function scoreColor(score) {
  if (score >= 75) return "var(--accent)";
  if (score >= 50) return "var(--accent-cool)";
  return "var(--text-faint)";
}

function ScoreGauge({ score }) {
  const radius = 19;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);
  const color = scoreColor(score);

  return (
    <div className="gauge">
      <svg viewBox="0 0 46 46">
        <circle className="gauge-track" cx="23" cy="23" r={radius} />
        <circle
          className="gauge-fill"
          cx="23"
          cy="23"
          r={radius}
          stroke={color}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="gauge-number">{score}</span>
    </div>
  );
}

function CriterionBar({ criterionKey, detail }) {
  if (!detail) return null;
  const label = CRITERIA_LABELS[criterionKey] || criterionKey;
  const pct = Math.round((detail.score / 20) * 100);
  const rawValue = detail.value ?? detail.ratio;
  const valueText =
    criterionKey === "volume"
      ? `出来高比率 ${(rawValue * 100).toFixed(1)}%`
      : criterionKey === "market_cap"
      ? `時価総額 $${Number(rawValue).toLocaleString()}`
      : `${formatPercent(rawValue)}`;

  return (
    <div className="criterion">
      <span className="criterion-label">{label}</span>
      <div className="criterion-track">
        <div className="criterion-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="criterion-score">{detail.score}/20</span>
      <span className="criterion-value">{valueText}</span>
    </div>
  );
}

function CoinRow({ coin, expanded, onToggle }) {
  const change7d = coin.change_7d;
  const rankClass = coin.rank <= 3 ? `rank-${coin.rank}` : "";

  return (
    <div className={`coin-row ${rankClass}`}>
      <div className="coin-row-main" onClick={onToggle}>
        <span className="rank">{coin.rank}</span>
        <img
          className="coin-icon"
          src={coin.image}
          alt=""
          loading="lazy"
          onError={(e) => {
            e.currentTarget.style.visibility = "hidden";
          }}
        />
        <div className="coin-id">
          <div className="coin-name">
            {coin.name} <span style={{ color: "var(--text-faint)" }}>{coin.symbol}</span>
          </div>
          <div className="coin-sub">
            <span className={change7d >= 0 ? "change-pos" : "change-neg"}>
              7d {formatPercent(change7d)}
            </span>
          </div>
        </div>
        <span className="coin-price">{formatPrice(coin.price)}</span>
        <ScoreGauge score={coin.score} />
      </div>

      {expanded && (
        <div className="coin-detail">
          {Object.keys(CRITERIA_LABELS).map((key) => (
            <CriterionBar key={key} criterionKey={key} detail={coin.score_detail?.[key]} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [category, setCategory] = useState("metaverse");
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [errorMessage, setErrorMessage] = useState("");
  const [expandedId, setExpandedId] = useState(null);

  const fetchRanking = useCallback((cat) => {
    setStatus("loading");
    setExpandedId(null);
    fetch(`${API_BASE}/api/ranking?category=${cat}`)
      .then((res) => res.json())
      .then((json) => {
        if (!json.success) {
          setErrorMessage(json.error || "データを取得できませんでした");
          setStatus("error");
          return;
        }
        setData(json);
        setStatus("ready");
      })
      .catch(() => {
        setErrorMessage("通信に失敗しました。回線状況を確認してください");
        setStatus("error");
      });
  }, []);

  useEffect(() => {
    fetchRanking(category);
  }, [category, fetchRanking]);

  return (
    <div className="app">
      <header className="header">
        <div className="wordmark">
          RADAR SIGNAL <small>V1.0</small>
        </div>
        <p className="tagline">カテゴリー別・上昇転換スコア TOP10</p>
      </header>

      <nav className="tabs">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            className={`tab ${category === c.id ? "active" : ""}`}
            onClick={() => setCategory(c.id)}
          >
            {c.label}
          </button>
        ))}
      </nav>

      {status === "ready" && data && (
        <div className="status-bar">
          <span>更新: {formatRelativeTime(data.updated_at)}</span>
          <span className="count">{data.total_coins}銘柄中 TOP10</span>
        </div>
      )}

      {status === "loading" && (
        <div className="state-panel">
          <div className="state-title">スキャン中</div>
          <div className="state-detail">カテゴリーの銘柄データを取得しています…</div>
        </div>
      )}

      {status === "error" && (
        <div className="state-panel">
          <div className="state-title">取得できませんでした</div>
          <div className="state-detail">{errorMessage}</div>
          <button className="retry-btn" onClick={() => fetchRanking(category)}>
            再試行
          </button>
        </div>
      )}

      {status === "ready" && data && (
        <div className="coin-list">
          {data.top10.map((coin) => (
            <CoinRow
              key={coin.id}
              coin={coin}
              expanded={expandedId === coin.id}
              onToggle={() => setExpandedId(expandedId === coin.id ? null : coin.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
