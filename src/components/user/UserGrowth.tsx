/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { TrendingUp, TrendingDown, Award, Coins, Zap } from "lucide-react";
import { userService, type GrowthAnalyticsResult, type GrowthDailyPoint } from "@/services/userService";

// Logic adapted from mrtats/hivelytics — daily reward / power-up / power-down
// buckets backfilled from condenser_api.get_account_history, then visualised.

export interface UserGrowthProps {
  username: string;
  /** Default range when the tab opens. Can still be toggled by the user. */
  defaultRange?: 7 | 30;
  className?: string;
}

const RANGES: { value: 7 | 30; label: string }[] = [
  { value: 7, label: "7 Days" },
  { value: 30, label: "30 Days" },
];

const fmtHp = (v: number): string => {
  if (!Number.isFinite(v)) return "0 HP";
  if (Math.abs(v) >= 1000) return `${v.toLocaleString(undefined, { maximumFractionDigits: 0 })} HP`;
  return `${v.toFixed(3)} HP`;
};

const fmtUsd = (v: number): string => {
  if (!Number.isFinite(v)) return "$0";
  if (Math.abs(v) >= 1000) return `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  return `$${v.toFixed(2)}`;
};

const UserGrowth: React.FC<UserGrowthProps> = ({ username, defaultRange = 7, className }) => {
  const [range, setRange] = useState<7 | 30>(defaultRange);
  const [data, setData] = useState<GrowthAnalyticsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Cache the full 30-day result so toggling the range slices it without
  // re-issuing account history requests.
  const [full, setFull] = useState<GrowthAnalyticsResult | null>(null);
  const reqRef = useRef(0);

  useEffect(() => {
    const target = username.replace(/^@/, "").trim();
    if (!target) return;
    setFull(null);
    setData(null);
    setError(null);
    setLoading(true);
    const id = ++reqRef.current;
    const controller = new AbortController();

    userService
      .getGrowthAnalytics(target, 30, (partial) => {
        if (id !== reqRef.current) return;
        setFull(partial);
      }, controller.signal)
      .then((res) => {
        if (id !== reqRef.current) return;
        setFull(res);
      })
      .catch((err) => {
        if (id !== reqRef.current) return;
        if (err?.name === "AbortError") return;
        console.error("Growth analytics error:", err);
        setError("Failed to load growth analytics");
      })
      .finally(() => {
        if (id !== reqRef.current) return;
        setLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [username]);

  // Slice the cached 30-day window down to the active range
  useEffect(() => {
    if (!full) return;
    if (range >= full.series.length) {
      setData(full);
      return;
    }
    const sliced: GrowthAnalyticsResult = {
      ...full,
      days: full.days.slice(-range),
      series: full.series.slice(-range),
      totals: recomputeTotals(full.series.slice(-range)),
    };
    sliced.startHp = sliced.series[0]?.cumulativeHp != null
      ? Number((sliced.series[0].cumulativeHp - sliced.series[0].hpDelta).toFixed(3))
      : full.startHp;
    sliced.hpDelta = Number(
      sliced.series.reduce((acc, d) => acc + (d.hpDelta || 0), 0).toFixed(3)
    );
    setData(sliced);
  }, [full, range]);

  if (error) {
    return (
      <div className={`text-center py-12 ${className || ""}`}>
        <TrendingUp className="h-10 w-10 text-gray-500 mx-auto mb-2" />
        <p className="text-gray-400 text-sm">{error}</p>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className={`max-w-3xl mx-auto space-y-4 animate-pulse ${className || ""}`}>
        <div className="flex gap-2">
          <div className="h-8 bg-gray-700 rounded w-20" />
          <div className="h-8 bg-gray-700 rounded w-20" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-800 rounded-lg border border-gray-700" />
          ))}
        </div>
        <div className="h-56 bg-gray-800 rounded-lg border border-gray-700" />
        <div className="h-56 bg-gray-800 rounded-lg border border-gray-700" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className={`max-w-3xl mx-auto space-y-4 ${className || ""}`}>
      {/* Range selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={`px-3 py-1.5 text-xs sm:text-sm rounded-full font-medium transition-colors ${
                range === r.value
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        {loading && (
          <span className="text-xs text-gray-400 animate-pulse">Refreshing…</span>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <SummaryCard
          icon={<Zap className="h-4 w-4 text-orange-400" />}
          label="HP Now"
          value={fmtHp(data.currentHp)}
        />
        <SummaryCard
          icon={data.hpDelta >= 0
            ? <TrendingUp className="h-4 w-4 text-green-400" />
            : <TrendingDown className="h-4 w-4 text-red-400" />}
          label={`Δ HP (${range}d)`}
          value={`${data.hpDelta >= 0 ? "+" : ""}${fmtHp(data.hpDelta)}`}
          tone={data.hpDelta >= 0 ? "up" : "down"}
        />
        <SummaryCard
          icon={<Award className="h-4 w-4 text-sky-400" />}
          label="Author + Curation"
          value={fmtHp(data.totals.authorHp + data.totals.curationHp)}
          subValue={fmtUsd(data.totals.authorUsd + data.totals.curationUsd)}
        />
        <SummaryCard
          icon={<Coins className="h-4 w-4 text-purple-400" />}
          label="Witness"
          value={fmtHp(data.totals.witnessHp)}
          subValue={fmtUsd(data.totals.witnessUsd)}
        />
      </div>

      {/* Account HP growth chart */}
      <ChartCard title={`Account HP — last ${range} days`}>
        <GrowthChart series={data.series} />
        <ChartLegend
          items={[
            { color: "#22c55e", label: "Account HP" },
            { color: "rgba(34,197,94,0.6)", label: "Power Up" },
            { color: "rgba(239,68,68,0.7)", label: "Power Down" },
            { color: "rgba(125,211,252,0.7)", label: "Author + Curation" },
            { color: "rgba(167,139,250,0.8)", label: "Witness" },
            { color: "rgba(251,146,60,0.8)", label: "Benefactor" },
          ]}
        />
      </ChartCard>

      {/* Earned (USD) chart */}
      <ChartCard title={`Earned per day — last ${range} days`}>
        <EarnedChart series={data.series} />
        <ChartLegend
          items={[
            { color: "rgba(34,197,94,0.85)", label: "Author" },
            { color: "rgba(56,189,248,0.85)", label: "Curation" },
            { color: "rgba(167,139,250,0.85)", label: "Witness" },
            { color: "rgba(251,146,60,0.85)", label: "Benefactor" },
          ]}
        />
      </ChartCard>

      {/* Daily breakdown */}
      <ChartCard title="Daily breakdown">
        <div className="overflow-x-auto -mx-2 px-2">
          <table className="w-full text-xs sm:text-sm text-left">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="py-2 pr-3 font-medium">Day</th>
                <th className="py-2 pr-3 font-medium text-right">Author</th>
                <th className="py-2 pr-3 font-medium text-right">Curation</th>
                <th className="py-2 pr-3 font-medium text-right">Witness</th>
                <th className="py-2 pr-3 font-medium text-right">Δ HP</th>
              </tr>
            </thead>
            <tbody>
              {data.series.slice().reverse().map((d) => (
                <tr key={d.key} className="border-b border-gray-800 last:border-0">
                  <td className="py-1.5 pr-3 text-gray-300 whitespace-nowrap">{d.label}</td>
                  <td className="py-1.5 pr-3 text-right text-green-300">{d.authorHp ? fmtHp(d.authorHp) : "—"}</td>
                  <td className="py-1.5 pr-3 text-right text-sky-300">{d.curationHp ? fmtHp(d.curationHp) : "—"}</td>
                  <td className="py-1.5 pr-3 text-right text-purple-300">{d.witnessHp ? fmtHp(d.witnessHp) : "—"}</td>
                  <td className={`py-1.5 pr-3 text-right ${d.hpDelta >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {d.hpDelta ? `${d.hpDelta >= 0 ? "+" : ""}${d.hpDelta.toFixed(3)}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>
    </div>
  );
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const SummaryCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  subValue?: string;
  tone?: "up" | "down";
}> = ({ icon, label, value, subValue, tone }) => (
  <div className="bg-gray-800 border border-gray-700 rounded-lg p-2.5">
    <div className="flex items-center gap-1.5 text-[11px] text-gray-400 mb-0.5">
      {icon}
      <span className="truncate">{label}</span>
    </div>
    <div className={`text-sm sm:text-base font-semibold truncate ${
      tone === "up" ? "text-green-400" : tone === "down" ? "text-red-400" : "text-white"
    }`}>{value}</div>
    {subValue && <div className="text-[11px] text-gray-400 truncate">{subValue}</div>}
  </div>
);

const ChartCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 sm:p-4">
    <div className="text-xs sm:text-sm font-medium text-gray-300 mb-2">{title}</div>
    {children}
  </div>
);

const ChartLegend: React.FC<{ items: { color: string; label: string }[] }> = ({ items }) => (
  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[11px] text-gray-400">
    {items.map((it) => (
      <span key={it.label} className="flex items-center gap-1">
        <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: it.color }} />
        {it.label}
      </span>
    ))}
  </div>
);

// ─── Charts (lightweight SVG) ────────────────────────────────────────────────

const CHART_W = 760;
const CHART_H = 200;
const PAD_L = 36;
const PAD_R = 8;
const PAD_T = 10;
const PAD_B = 22;

const niceTicks = (min: number, max: number, count = 4): number[] => {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
    return [min];
  }
  const step = (max - min) / count;
  const ticks: number[] = [];
  for (let i = 0; i <= count; i++) ticks.push(min + step * i);
  return ticks;
};

const formatTick = (v: number): string => {
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)}k`;
  if (Math.abs(v) >= 10) return v.toFixed(0);
  return v.toFixed(2);
};

const recomputeTotals = (series: GrowthDailyPoint[]) => series.reduce(
  (acc, d) => {
    acc.authorHp += d.authorHp;
    acc.curationHp += d.curationHp;
    acc.witnessHp += d.witnessHp;
    acc.benefactorHp += d.benefactorHp;
    acc.powerUp += d.powerUp;
    acc.powerDown += d.powerDown;
    acc.authorUsd += d.authorUsd;
    acc.curationUsd += d.curationUsd;
    acc.witnessUsd += d.witnessUsd;
    acc.benefactorUsd += d.benefactorUsd;
    return acc;
  },
  { authorHp: 0, curationHp: 0, witnessHp: 0, benefactorHp: 0, powerUp: 0, powerDown: 0,
    authorUsd: 0, curationUsd: 0, witnessUsd: 0, benefactorUsd: 0 }
);

interface HoverInfo { x: number; y: number; index: number; lines: { color: string; label: string; value: string }[] }

const GrowthChart: React.FC<{ series: GrowthDailyPoint[] }> = ({ series }) => {
  const [hover, setHover] = useState<HoverInfo | null>(null);

  const view = useMemo(() => {
    const n = series.length;
    if (!n) return null;
    const lineMin = Math.min(...series.map((d) => d.cumulativeHp));
    const lineMax = Math.max(...series.map((d) => d.cumulativeHp));
    const linePad = Math.max(1, (lineMax - lineMin) * 0.08) || 1;
    const yLineMin = Math.max(0, lineMin - linePad);
    const yLineMax = lineMax + linePad;

    // Bars range
    const barTop = series.map((d) => d.powerUp + d.authorHp + d.curationHp + d.witnessHp + d.benefactorHp);
    const barBottom = series.map((d) => -d.powerDown);
    const yBarsMax = Math.max(0, ...barTop) || 1;
    const yBarsMin = Math.min(0, ...barBottom);
    const yBarPad = (yBarsMax - yBarsMin) * 0.1 || 0.5;

    const xStep = (CHART_W - PAD_L - PAD_R) / Math.max(1, n - 1);
    const innerH = CHART_H - PAD_T - PAD_B;

    const yLine = (v: number) => PAD_T + (1 - (v - yLineMin) / (yLineMax - yLineMin || 1)) * innerH;
    const yBar = (v: number) => PAD_T + (1 - (v - (yBarsMin - yBarPad)) / ((yBarsMax + yBarPad) - (yBarsMin - yBarPad) || 1)) * innerH;
    const xAt = (i: number) => PAD_L + i * xStep;

    const linePath = series.map((d, i) => `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(1)} ${yLine(d.cumulativeHp).toFixed(1)}`).join(" ");

    const barWidth = Math.max(2, Math.min(18, xStep * 0.5));

    const ticks = niceTicks(yLineMin, yLineMax, 4);

    return { n, xStep, yLine, yBar, xAt, linePath, barWidth, ticks, yBarsMin, yBarsMax };
  }, [series]);

  if (!view) return <div className="h-32 flex items-center justify-center text-xs text-gray-400">No data</div>;

  return (
    <div className="relative" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="w-full h-44 sm:h-56">
        {/* grid + y-axis ticks */}
        {view.ticks.map((t, i) => {
          const y = view.yLine(t);
          return (
            <g key={i}>
              <line x1={PAD_L} y1={y} x2={CHART_W - PAD_R} y2={y} stroke="rgba(255,255,255,0.06)" />
              <text x={PAD_L - 4} y={y + 3} fontSize="9" fill="#a9b3c1" textAnchor="end">{formatTick(t)}</text>
            </g>
          );
        })}

        {/* zero line for bars */}
        <line x1={PAD_L} y1={view.yBar(0)} x2={CHART_W - PAD_R} y2={view.yBar(0)} stroke="rgba(255,255,255,0.12)" />

        {/* stacked bars */}
        {series.map((d, i) => {
          const x = view.xAt(i) - view.barWidth / 2;
          const segments = [
            { v: d.powerUp, color: "rgba(34,197,94,0.6)" },
            { v: d.authorHp + d.curationHp, color: "rgba(125,211,252,0.7)" },
            { v: d.witnessHp, color: "rgba(167,139,250,0.8)" },
            { v: d.benefactorHp, color: "rgba(251,146,60,0.8)" },
          ];
          let cumulative = 0;
          const rects: React.ReactElement[] = [];
          segments.forEach((s, idx) => {
            if (s.v <= 0) return;
            const yTop = view.yBar(cumulative + s.v);
            const yBot = view.yBar(cumulative);
            cumulative += s.v;
            rects.push(
              <rect key={`p-${i}-${idx}`} x={x} y={yTop} width={view.barWidth} height={Math.max(0, yBot - yTop)} fill={s.color} />
            );
          });
          if (d.powerDown > 0) {
            const yTop = view.yBar(0);
            const yBot = view.yBar(-d.powerDown);
            rects.push(
              <rect key={`pd-${i}`} x={x} y={yTop} width={view.barWidth} height={Math.max(0, yBot - yTop)} fill="rgba(239,68,68,0.7)" />
            );
          }
          return <g key={d.key}>{rects}</g>;
        })}

        {/* line */}
        <path d={view.linePath} fill="none" stroke="#22c55e" strokeWidth={2} />

        {/* x-axis labels (sparse) */}
        {series.map((d, i) => {
          const stride = Math.max(1, Math.ceil(series.length / 7));
          if (i % stride !== 0 && i !== series.length - 1) return null;
          return (
            <text key={`xl-${i}`} x={view.xAt(i)} y={CHART_H - 6} fontSize="9" fill="#a9b3c1" textAnchor="middle">{d.label}</text>
          );
        })}

        {/* hover overlay */}
        {series.map((d, i) => (
          <rect
            key={`hov-${i}`}
            x={view.xAt(i) - view.xStep / 2}
            y={PAD_T}
            width={Math.max(2, view.xStep)}
            height={CHART_H - PAD_T - PAD_B}
            fill="transparent"
            onMouseEnter={() => setHover({
              x: view.xAt(i),
              y: view.yLine(d.cumulativeHp),
              index: i,
              lines: [
                { color: "#22c55e", label: "Account HP", value: fmtHp(d.cumulativeHp) },
                { color: "rgba(34,197,94,0.6)", label: "Power Up", value: fmtHp(d.powerUp) },
                { color: "rgba(239,68,68,0.7)", label: "Power Down", value: fmtHp(d.powerDown) },
                { color: "rgba(125,211,252,0.7)", label: "Author + Curation", value: fmtHp(d.authorHp + d.curationHp) },
                { color: "rgba(167,139,250,0.8)", label: "Witness", value: fmtHp(d.witnessHp) },
                { color: "rgba(251,146,60,0.8)", label: "Benefactor", value: fmtHp(d.benefactorHp) },
              ],
            })}
          />
        ))}

        {hover && (
          <g pointerEvents="none">
            <line x1={hover.x} y1={PAD_T} x2={hover.x} y2={CHART_H - PAD_B} stroke="rgba(255,255,255,0.15)" />
            <circle cx={hover.x} cy={hover.y} r={3.5} fill="#22c55e" stroke="white" strokeWidth={1} />
          </g>
        )}
      </svg>

      {hover && (
        <Tooltip
          x={hover.x}
          chartW={CHART_W}
          dayLabel={series[hover.index]?.label}
          lines={hover.lines}
        />
      )}
    </div>
  );
};

const EarnedChart: React.FC<{ series: GrowthDailyPoint[] }> = ({ series }) => {
  const [hover, setHover] = useState<HoverInfo | null>(null);

  const view = useMemo(() => {
    const n = series.length;
    if (!n) return null;
    const totals = series.map((d) => d.authorUsd + d.curationUsd + d.witnessUsd + d.benefactorUsd);
    const max = Math.max(0.001, ...totals);
    const xStep = (CHART_W - PAD_L - PAD_R) / Math.max(1, n);
    const innerH = CHART_H - PAD_T - PAD_B;
    const y = (v: number) => PAD_T + (1 - v / max) * innerH;
    const xAt = (i: number) => PAD_L + i * xStep + xStep / 2;
    const barW = Math.max(2, xStep * 0.6);
    const ticks = niceTicks(0, max, 4);
    return { n, xStep, y, xAt, barW, ticks, max };
  }, [series]);

  if (!view) return <div className="h-32 flex items-center justify-center text-xs text-gray-400">No data</div>;

  return (
    <div className="relative" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="w-full h-44 sm:h-56">
        {view.ticks.map((t, i) => (
          <g key={i}>
            <line x1={PAD_L} y1={view.y(t)} x2={CHART_W - PAD_R} y2={view.y(t)} stroke="rgba(255,255,255,0.06)" />
            <text x={PAD_L - 4} y={view.y(t) + 3} fontSize="9" fill="#a9b3c1" textAnchor="end">${formatTick(t)}</text>
          </g>
        ))}

        {series.map((d, i) => {
          const x = view.xAt(i) - view.barW / 2;
          const segs = [
            { v: d.authorUsd, color: "rgba(34,197,94,0.85)", label: "Author" },
            { v: d.curationUsd, color: "rgba(56,189,248,0.85)", label: "Curation" },
            { v: d.witnessUsd, color: "rgba(167,139,250,0.85)", label: "Witness" },
            { v: d.benefactorUsd, color: "rgba(251,146,60,0.85)", label: "Benefactor" },
          ];
          let acc = 0;
          return (
            <g key={d.key}>
              {segs.map((s, idx) => {
                if (s.v <= 0) return null;
                const top = view.y(acc + s.v);
                const bot = view.y(acc);
                acc += s.v;
                return <rect key={idx} x={x} y={top} width={view.barW} height={Math.max(0, bot - top)} fill={s.color} />;
              })}
            </g>
          );
        })}

        {series.map((d, i) => {
          const stride = Math.max(1, Math.ceil(series.length / 7));
          if (i % stride !== 0 && i !== series.length - 1) return null;
          return (
            <text key={`x-${i}`} x={view.xAt(i)} y={CHART_H - 6} fontSize="9" fill="#a9b3c1" textAnchor="middle">{d.label}</text>
          );
        })}

        {series.map((d, i) => (
          <rect
            key={`hov-${i}`}
            x={view.xAt(i) - view.xStep / 2}
            y={PAD_T}
            width={Math.max(2, view.xStep)}
            height={CHART_H - PAD_T - PAD_B}
            fill="transparent"
            onMouseEnter={() => setHover({
              x: view.xAt(i),
              y: view.y(d.authorUsd + d.curationUsd + d.witnessUsd + d.benefactorUsd),
              index: i,
              lines: [
                { color: "rgba(34,197,94,0.85)", label: "Author", value: fmtUsd(d.authorUsd) },
                { color: "rgba(56,189,248,0.85)", label: "Curation", value: fmtUsd(d.curationUsd) },
                { color: "rgba(167,139,250,0.85)", label: "Witness", value: fmtUsd(d.witnessUsd) },
                { color: "rgba(251,146,60,0.85)", label: "Benefactor", value: fmtUsd(d.benefactorUsd) },
              ],
            })}
          />
        ))}

        {hover && (
          <line x1={hover.x} y1={PAD_T} x2={hover.x} y2={CHART_H - PAD_B} stroke="rgba(255,255,255,0.15)" />
        )}
      </svg>

      {hover && (
        <Tooltip
          x={hover.x}
          chartW={CHART_W}
          dayLabel={series[hover.index]?.label}
          lines={hover.lines}
        />
      )}
    </div>
  );
};

const Tooltip: React.FC<{
  x: number;
  chartW: number;
  dayLabel?: string;
  lines: { color: string; label: string; value: string }[];
}> = ({ x, chartW, dayLabel, lines }) => {
  // Position tooltip as a percentage of chart width so it sits over the
  // hovered bar regardless of the SVG's rendered size.
  const leftPct = Math.min(85, Math.max(2, (x / chartW) * 100));
  return (
    <div
      className="absolute top-1 z-10 pointer-events-none rounded-md bg-gray-900/95 border border-gray-700 px-2 py-1.5 shadow-lg text-[11px]"
      style={{ left: `${leftPct}%`, transform: "translateX(-50%)" }}
    >
      {dayLabel && <div className="text-gray-300 font-semibold mb-0.5">{dayLabel}</div>}
      {lines.map((ln) => (
        <div key={ln.label} className="flex items-center gap-1.5 whitespace-nowrap">
          <span className="inline-block w-2 h-2 rounded-sm" style={{ background: ln.color }} />
          <span className="text-gray-400">{ln.label}:</span>
          <span className="text-gray-100 font-medium">{ln.value}</span>
        </div>
      ))}
    </div>
  );
};

export default UserGrowth;
