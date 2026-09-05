import { useEffect, useState, useCallback } from "react";
import "./App.css";

// デプロイ済みのCrypto Radar Workerのベースアドレス
const API_BASE = "https://crypto-radar-api.elcojpn2021.workers.dev";

const CATEGORIES = [
  { id: "metaverse", label: "メタバース" },
  { id: "gaming", label: "ゲーミング" },
  { id: "artificial-intelligence", label: "AI" },
  { id: "all", label: "全銘柄" }
];

const EXCHANGES = [
  { id: "", name: "指定なし" },
  { id: "coincheck", name: "コインチェック" },
  { id: "bitflyer", name: "bitFlyer" },
  { id: "bitbank", name: "bitbank" },
  { id: "gmo-japan", name: "GMOコイン" }
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

const ACTION_TIERS = [
  {
    min: 85,
    range: "85点以上",
    label: "買い時",
    color: "var(--accent)",
    desc: "5項目すべてが揃って強く出ている、シグナルが最も濃い状態"
  },
  {
    min: 70,
    range: "70〜84点",
    label: "もうすぐ買い",
    color: "var(--accent-cool)",
    desc: "反発の兆候は出ているが、まだ決め手が1〜2項目足りない状態"
  },
  {
    min: 50,
    range: "50〜69点",
    label: "買い待機",
    color: "var(--text-muted)",
    desc: "動き始めてはいるが根拠が弱く、もう少し様子を見たい状態"
  },
  {
    min: 0,
    range: "50点未満",
    label: "圏外",
    color: "var(--text-faint)",
    desc: "反転の兆候はまだ弱く、TOP10に入っていても優先度は低い状態"
  }
];

function getAction(score) {
  return ACTION_TIERS.find((tier) => score >= tier.min) || ACTION_TIERS[ACTION_TIERS.length - 1];
}

function scoreColor(score) {
  return getAction(score).color;
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
  const action = getAction(coin.score);

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
            <span className="action-badge" style={{ color: action.color, borderColor: action.color }}>
              {action.label}
            </span>
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

function ScoreLegend({ open, onToggle }) {
  return (
    <div className="legend">
      <button className="legend-toggle" onClick={onToggle}>
        スコアの見方 {open ? "▲" : "▼"}
      </button>
      {open && (
        <ul className="legend-list">
          {ACTION_TIERS.map((tier) => (
            <li key={tier.label} className="legend-item">
              <span className="legend-badge" style={{ color: tier.color, borderColor: tier.color }}>
                {tier.label}
              </span>
              <span className="legend-range">{tier.range}</span>
              <span className="legend-desc">{tier.desc}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function App() {
  const [category, setCategory] = useState("metaverse");
  const [exchange, setExchange] = useState("");
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [errorMessage, setErrorMessage] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [legendOpen, setLegendOpen] = useState(false);

  const fetchRanking = useCallback((cat, ex) => {
    setStatus("loading");
    setExpandedId(null);
    const params = new URLSearchParams({ category: cat });
    if (ex) params.set("exchange", ex);
    fetch(`${API_BASE}/api/ranking?${params}`)
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
    fetchRanking(category, exchange);
  }, [category, exchange, fetchRanking]);

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

      <div className="exchange-select-row">
        <label htmlFor="exchange-select" className="exchange-label">
          取引所で絞り込み
        </label>
        <select
          id="exchange-select"
          className="exchange-select"
          value={exchange}
          onChange={(e) => setExchange(e.target.value)}
        >
          {EXCHANGES.map((ex) => (
            <option key={ex.id} value={ex.id}>
              {ex.name}
            </option>
          ))}
        </select>
      </div>

      <ScoreLegend open={legendOpen} onToggle={() => setLegendOpen(!legendOpen)} />

      {status === "ready" && data && (
        <div className="status-bar">
          <span>更新: {formatRelativeTime(data.updated_at)}</span>
          <span className="count">
            {data.exchange_name ? `${data.exchange_name}取扱銘柄・` : ""}
            {data.total_coins}銘柄中 TOP10
          </span>
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
          <button className="retry-btn" onClick={() => fetchRanking(category, exchange)}>
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

      {status === "ready" && data && (
        <p className="disclaimer">
          ※ スコアは過去の価格・出来高データに基づく目安です。投資判断は自己責任でお願いします。
        </p>
      )}
    </div>
  );
}
