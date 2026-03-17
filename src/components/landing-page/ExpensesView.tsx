import { Fragment, useState, useEffect, useMemo } from "react";
import Contact from "./Contact";
import {
  FaArrowLeft,
  FaExclamationTriangle,
  FaHandHoldingHeart,
  FaMoneyBillWave,
  FaChartLine,
  FaServer,
  FaLaptop,
  FaCouch,
  FaBuilding,
  FaBolt,
  FaGlobe,
  FaUsers,
  FaHeartBroken,
} from "react-icons/fa";

type Currency = "INR" | "USD" | "HIVE";

const FALLBACK_HIVE_USD = 0.07;
const FALLBACK_USD_INR = 85;

interface LiveRates {
  hiveUsd: number;
  usdInr: number;
}

const useLiveRates = (): { rates: LiveRates; loading: boolean } => {
  const [rates, setRates] = useState<LiveRates>({
    hiveUsd: FALLBACK_HIVE_USD,
    usdInr: FALLBACK_USD_INR,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRates = async () => {
      try {
        const res = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=hive&vs_currencies=usd,inr"
        );
        const data = await res.json();
        if (data?.hive?.usd && data?.hive?.inr) {
          setRates({
            hiveUsd: data.hive.usd,
            usdInr: data.hive.inr / data.hive.usd,
          });
        }
      } catch {
        // keep fallback rates
      } finally {
        setLoading(false);
      }
    };
    fetchRates();
  }, []);

  return { rates, loading };
};

const CURRENCY_DISPLAY: Record<
  Currency,
  { symbol: string; suffix: string; locale: string }
> = {
  USD: { symbol: "$", suffix: "", locale: "en-US" },
  HIVE: { symbol: "", suffix: " HIVE", locale: "en-US" },
  INR: { symbol: "₹", suffix: "", locale: "en-IN" },
};

const BASE_AMOUNTS = {
  salary3: 1250,
  salary2: 900,
  rent: 300,
  utilities: 50,
  vps: 175,
  devPrograms: 15,
  domains: 15,
  infraDepMonth: 50,
  infraMaintMonth: 20,
  furnDepMonth: 30,
  infraCost: 6000,
  furnitureCost: 2400,
};

// Semantic / accent colors — independent of the parent's theme
const ACCENT = {
  accent: "#818cf8",
  error: "#f87171",
  errorBg: "rgba(248,113,113,0.12)",
  errorBorder: "rgba(248,113,113,0.3)",
  warning: "#fbbf24",
  warningBg: "rgba(251,191,36,0.15)",
  success: "#34d399",
  successBg: "rgba(52,211,153,0.15)",
  info: "#38bdf8",
  infoBg: "rgba(56,189,248,0.15)",
  primary: "#6366f1",
  primaryBg: "rgba(99,102,241,0.15)",
  progressTrack: "rgba(30,41,59,0.72)",
  blurOverlay: "rgba(2,6,23,0.72)",
  gradientFrom: "rgba(2,6,23,0.55)",
  gradientTo: "rgba(15,23,42,0.2)",
};

const getMultiplier = (currency: Currency, rates: LiveRates): number => {
  if (currency === "USD") return 1;
  if (currency === "INR") return rates.usdInr;
  return 1 / rates.hiveUsd;
};

const getAmounts = (currency: Currency, rates: LiveRates) => {
  const m = getMultiplier(currency, rates);
  return {
    salary3: Math.round(BASE_AMOUNTS.salary3 * m),
    salary2: Math.round(BASE_AMOUNTS.salary2 * m),
    rent: Math.round(BASE_AMOUNTS.rent * m),
    utilities: Math.round(BASE_AMOUNTS.utilities * m),
    vps: Math.round(BASE_AMOUNTS.vps * m),
    devPrograms: Math.round(BASE_AMOUNTS.devPrograms * m),
    domains: Math.round(BASE_AMOUNTS.domains * m),
    infraDepMonth: Math.round(BASE_AMOUNTS.infraDepMonth * m),
    infraMaintMonth: Math.round(BASE_AMOUNTS.infraMaintMonth * m),
    furnDepMonth: Math.round(BASE_AMOUNTS.furnDepMonth * m),
    infraCost: Math.round(BASE_AMOUNTS.infraCost * m),
    furnitureCost: Math.round(BASE_AMOUNTS.furnitureCost * m),
  };
};

const formatCurrency = (amount: number, currency: Currency) => {
  const { symbol, suffix, locale } = CURRENCY_DISPLAY[currency];
  const formatted = Math.round(amount).toLocaleString(locale);
  return `${symbol}${formatted}${suffix}`;
};

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

interface MonthRow {
  year: number;
  month: number;
  label: string;
  salaries: number;
  rent: number;
  utilities: number;
  vps: number;
  devPrograms: number;
  domains: number;
  infraDepreciation: number;
  infraMaintenance: number;
  furnitureDepreciation: number;
  total: number;
}

function generateExpenses(currency: Currency, rates: LiveRates): MonthRow[] {
  const cfg = getAmounts(currency, rates);
  const rows: MonthRow[] = [];

  let infraDepRatio = 1;
  let infraMaintRatio = 1;
  let furnDepRatio = 1;

  const startDate = new Date(2022, 0);
  const endDate = new Date(2026, 2);

  const cur = new Date(startDate);
  while (cur <= endDate) {
    const y = cur.getFullYear();
    const m = cur.getMonth();

    const hasInfra = cur >= new Date(2022, 6);

    if (hasInfra && m === 6 && !(y === 2022 && m === 6)) {
      infraDepRatio *= 0.9;
      infraMaintRatio *= 0.9;
      furnDepRatio *= 0.85;
    }

    let salaries = cfg.salary3;
    if (y === 2026 && m >= 1) salaries = cfg.salary2;
    if (y > 2026) salaries = cfg.salary2;

    const rent = hasInfra ? cfg.rent : 0;
    const utilities = hasInfra ? cfg.utilities : 0;
    const vps = hasInfra ? cfg.vps : 0;
    const devPrograms = hasInfra ? cfg.devPrograms : 0;
    const domains = hasInfra ? cfg.domains : 0;
    const infraDep = hasInfra ? Math.round(cfg.infraDepMonth * infraDepRatio) : 0;
    const infraMaint = hasInfra ? Math.round(cfg.infraMaintMonth * infraMaintRatio) : 0;
    const furnDep = hasInfra ? Math.round(cfg.furnDepMonth * furnDepRatio) : 0;

    const total =
      salaries + rent + utilities + vps + devPrograms + domains +
      infraDep + infraMaint + furnDep;

    rows.push({
      year: y, month: m,
      label: `${MONTH_NAMES[m]} ${y}`,
      salaries, rent, utilities, vps, devPrograms, domains,
      infraDepreciation: infraDep,
      infraMaintenance: infraMaint,
      furnitureDepreciation: furnDep,
      total,
    });

    cur.setMonth(cur.getMonth() + 1);
  }
  return rows;
}

interface MobileExpenseRowProps {
  row: MonthRow;
  fmt: (n: number) => string;
  textColor: string;
  cardBackgroundColor: string;
  dividerColor: string;
}

const MobileExpenseRow = ({ row: r, fmt, textColor, cardBackgroundColor, dividerColor }: MobileExpenseRowProps) => {
  const [open, setOpen] = useState(false);

  const details: { label: string; value: number }[] = [];
  details.push({ label: "Salaries", value: r.salaries });
  if (r.rent) details.push({ label: "Rent", value: r.rent });
  if (r.utilities) details.push({ label: "Utilities", value: r.utilities });
  if (r.vps) details.push({ label: "VPS & Hosting", value: r.vps });
  if (r.devPrograms) details.push({ label: "Dev Programs", value: r.devPrograms });
  if (r.domains) details.push({ label: "Domains", value: r.domains });
  if (r.infraDepreciation) details.push({ label: "Infra Depreciation", value: r.infraDepreciation });
  if (r.infraMaintenance) details.push({ label: "Infra Maintenance", value: r.infraMaintenance });
  if (r.furnitureDepreciation) details.push({ label: "Furniture Depreciation", value: r.furnitureDepreciation });

  return (
    <div style={{ borderBottom: `1px solid ${dividerColor}` }}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full flex justify-between items-center py-3 px-2 transition-colors"
        style={{ color: textColor }}
      >
        <span className="font-medium text-sm">{r.label}</span>
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm" style={{ color: ACCENT.error }}>{fmt(r.total)}</span>
          <span
            className={`text-xs transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            style={{ color: ACCENT.accent }}
          >
            ▼
          </span>
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 rounded-b-lg mx-2 mb-1" style={{ backgroundColor: cardBackgroundColor }}>
          {details.map((d, i) => (
            <div
              key={d.label}
              className="flex justify-between py-1.5"
              style={{ borderTop: i > 0 ? `1px solid ${dividerColor}` : "none" }}
            >
              <span className="text-sm" style={{ color: ACCENT.accent }}>{d.label}</span>
              <span className="font-medium text-sm" style={{ color: textColor }}>{fmt(d.value)}</span>
            </div>
          ))}
          <div
            className="flex justify-between py-2 mt-1"
            style={{ borderTop: `2px solid ${dividerColor}` }}
          >
            <span className="font-bold text-sm" style={{ color: textColor }}>Total</span>
            <span className="font-bold text-sm" style={{ color: ACCENT.error }}>{fmt(r.total)}</span>
          </div>
        </div>
      )}
    </div>
  );
};

interface ExpensesViewProps {
  onBack: () => void;
  backgroundColor?: string;
  textColor?: string;
  cardBackgroundColor?: string;
  dividerColor?: string;
}

const ExpensesView: React.FC<ExpensesViewProps> = ({
  onBack,
  backgroundColor = "#020617",
  textColor = "#e5e7eb",
  cardBackgroundColor = "rgba(15,23,42,0.85)",
  dividerColor = "rgba(148,163,184,0.4)",
}) => {
  const [currency, setCurrency] = useState<Currency>("USD");
  const { rates, loading } = useLiveRates();

  const rows = useMemo(() => generateExpenses(currency, rates), [currency, rates]);
  const cfg = useMemo(() => getAmounts(currency, rates), [currency, rates]);

  const fmt = (n: number) => formatCurrency(n, currency);

  const years = [...new Set(rows.map((r) => r.year))];
  const yearlyTotals: Record<number, number> = {};
  years.forEach((y) => {
    yearlyTotals[y] = rows.filter((r) => r.year === y).reduce((s, r) => s + r.total, 0);
  });
  const grandTotal = rows.reduce((s, r) => s + r.total, 0);
  const capitalInvestments = cfg.infraCost + cfg.furnitureCost;
  const totalWithCapital = grandTotal + capitalInvestments;

  const CURRENCIES: Currency[] = ["USD", "HIVE", "INR"];

  const cardShadow = "0 18px 45px rgba(0,0,0,0.6)";

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background — same pattern as HiveContributionsLanding */}
      <div className="fixed inset-0 z-0" style={{ backgroundColor }} />
      <div
        className="fixed inset-0 z-10 backdrop-blur-md"
        style={{ backgroundColor: ACCENT.blurOverlay }}
      />
      <div
        className="fixed inset-0 z-20"
        style={{
          background: `linear-gradient(135deg, ${ACCENT.gradientFrom}, transparent, ${ACCENT.gradientTo})`,
        }}
      />
      <div
        className="fixed inset-0 z-20"
        style={{
          background: `linear-gradient(180deg, ${ACCENT.gradientFrom}, transparent, ${ACCENT.gradientTo})`,
        }}
      />

      {/* Content */}
      <div className="relative z-30" style={{ color: textColor }}>
        <main className="min-h-screen">

          {/* Back button */}
          <div className="pt-8 pb-4">
            <div className="container mx-auto px-4">
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-2 hover:underline font-medium"
                style={{ color: ACCENT.accent }}
              >
                <FaArrowLeft className="w-4 h-4" /> Back to Home
              </button>
            </div>
          </div>

          {/* Hero */}
          <section className="py-12">
            <div className="container mx-auto px-4 text-center">
              <div
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-sm mb-6"
                style={{ backgroundColor: ACCENT.errorBg, color: ACCENT.error }}
              >
                <FaExclamationTriangle className="w-4 h-4" />
                Transparency Report — Running in Heavy Debt
              </div>
              <h1 className="text-4xl md:text-5xl font-extrabold mb-4" style={{ color: textColor }}>
                Our Expenses — Every Single{" "}
                {currency === "USD" ? "Dollar" : currency === "HIVE" ? "Hive" : "Rupee"}
              </h1>
              <p className="max-w-2xl mx-auto text-lg" style={{ color: textColor, opacity: 0.85 }}>
                We have never asked for funding. Every rupee has come out of our own pockets.
                All we ask in return is{" "}
                <span className="font-bold" style={{ color: ACCENT.accent }}>
                  your Hive witness vote
                </span>.
              </p>
            </div>
          </section>

          {/* Currency switcher */}
          <section className="pb-8">
            <div className="container mx-auto px-4">
              <div className="flex justify-center">
                <div
                  className="inline-flex rounded-xl p-1 gap-1"
                  style={{ backgroundColor: cardBackgroundColor, boxShadow: cardShadow }}
                >
                  {CURRENCIES.map((c) => (
                    <button
                      key={c}
                      onClick={() => setCurrency(c)}
                      className="px-6 py-2.5 rounded-lg font-semibold text-sm transition-all duration-200"
                      style={
                        currency === c
                          ? { backgroundColor: ACCENT.primary, color: "#ffffff", boxShadow: "0 4px 14px rgba(99,102,241,0.4)" }
                          : { color: textColor, opacity: 0.7 }
                      }
                    >
                      {c === "INR" && "₹ INR"}
                      {c === "USD" && "$ USD"}
                      {c === "HIVE" && "HIVE"}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-center text-xs mt-2" style={{ color: textColor, opacity: 0.5 }}>
                {loading ? "Fetching live rates…" : (
                  <>Live rates via CoinGecko: 1 HIVE ≈ ${rates.hiveUsd.toFixed(4)} • 1 USD ≈ ₹{rates.usdInr.toFixed(2)}</>
                )}
              </p>
            </div>
          </section>

          {/* Month-by-month table */}
          <section className="py-8">
            <div className="container mx-auto px-4">
              <h2 className="text-2xl md:text-3xl font-bold text-center mb-8" style={{ color: textColor }}>
                Month-by-Month Expense Breakdown
              </h2>

              {/* Desktop table */}
              <div
                className="max-w-6xl mx-auto hidden md:block rounded-2xl"
                style={{ backgroundColor: cardBackgroundColor, boxShadow: cardShadow }}
              >
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${dividerColor}` }}>
                      {[
                        { label: "Month", align: "left", cls: "" },
                        { label: "Salaries", align: "right", cls: "" },
                        { label: "Rent", align: "right", cls: "" },
                        { label: "Utilities", align: "right", cls: "" },
                        { label: "VPS", align: "right", cls: "hidden lg:table-cell" },
                        { label: "Dev Prog", align: "right", cls: "hidden lg:table-cell" },
                        { label: "Domains", align: "right", cls: "hidden lg:table-cell" },
                        { label: "Infra Dep.", align: "right", cls: "hidden xl:table-cell" },
                        { label: "Infra Maint.", align: "right", cls: "hidden xl:table-cell" },
                        { label: "Furn. Dep.", align: "right", cls: "hidden xl:table-cell" },
                        { label: "Total", align: "right", cls: "" },
                      ].map(({ label, align, cls }) => (
                        <th
                          key={label}
                          className={`px-3 py-4 font-semibold uppercase tracking-wider whitespace-nowrap ${cls}`}
                          style={{ textAlign: align as "left" | "right", color: textColor, opacity: 0.5 }}
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {years.map((year) => {
                      const yearRows = rows.filter((r) => r.year === year);
                      return (
                        <Fragment key={year}>
                          <tr>
                            <td
                              colSpan={11}
                              className="px-3 py-3 font-bold text-center tracking-widest uppercase"
                              style={{ backgroundColor: ACCENT.primaryBg, color: ACCENT.primary }}
                            >
                              {year}
                            </td>
                          </tr>
                          {yearRows.map((r) => (
                            <tr
                              key={r.label}
                              className="transition-colors"
                              style={{ borderBottom: `1px solid ${dividerColor}` }}
                              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.03)")}
                              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                            >
                              <td className="px-3 py-3 font-medium whitespace-nowrap" style={{ color: textColor }}>{r.label}</td>
                              <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap" style={{ color: textColor, opacity: 0.85 }}>{fmt(r.salaries)}</td>
                              <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap" style={{ color: textColor, opacity: 0.85 }}>{r.rent ? fmt(r.rent) : <span style={{ opacity: 0.3 }}>—</span>}</td>
                              <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap" style={{ color: textColor, opacity: 0.85 }}>{r.utilities ? fmt(r.utilities) : <span style={{ opacity: 0.3 }}>—</span>}</td>
                              <td className="px-5 py-3 text-right tabular-nums whitespace-nowrap hidden lg:table-cell" style={{ color: textColor, opacity: 0.85 }}>{r.vps ? fmt(r.vps) : <span style={{ opacity: 0.3 }}>—</span>}</td>
                              <td className="px-5 py-3 text-right tabular-nums whitespace-nowrap hidden lg:table-cell" style={{ color: textColor, opacity: 0.85 }}>{r.devPrograms ? fmt(r.devPrograms) : <span style={{ opacity: 0.3 }}>—</span>}</td>
                              <td className="px-5 py-3 text-right tabular-nums whitespace-nowrap hidden lg:table-cell" style={{ color: textColor, opacity: 0.85 }}>{r.domains ? fmt(r.domains) : <span style={{ opacity: 0.3 }}>—</span>}</td>
                              <td className="px-5 py-3 text-right tabular-nums whitespace-nowrap hidden xl:table-cell" style={{ color: textColor, opacity: 0.85 }}>{r.infraDepreciation ? fmt(r.infraDepreciation) : <span style={{ opacity: 0.3 }}>—</span>}</td>
                              <td className="px-5 py-3 text-right tabular-nums whitespace-nowrap hidden xl:table-cell" style={{ color: textColor, opacity: 0.85 }}>{r.infraMaintenance ? fmt(r.infraMaintenance) : <span style={{ opacity: 0.3 }}>—</span>}</td>
                              <td className="px-5 py-3 text-right tabular-nums whitespace-nowrap hidden xl:table-cell" style={{ color: textColor, opacity: 0.85 }}>{r.furnitureDepreciation ? fmt(r.furnitureDepreciation) : <span style={{ opacity: 0.3 }}>—</span>}</td>
                              <td className="px-3 py-3 text-right font-bold tabular-nums whitespace-nowrap" style={{ color: ACCENT.error }}>{fmt(r.total)}</td>
                            </tr>
                          ))}
                          <tr style={{ borderTop: `2px solid ${ACCENT.errorBorder}`, backgroundColor: "rgba(248,113,113,0.06)" }}>
                            <td colSpan={10} className="px-3 py-3.5 font-bold" style={{ color: ACCENT.error }}>{year} Total</td>
                            <td className="px-3 py-3.5 text-right font-bold tabular-nums whitespace-nowrap" style={{ color: ACCENT.error }}>
                              {fmt(yearlyTotals[year])}
                            </td>
                          </tr>
                        </Fragment>
                      );
                    })}

                    <tr style={{ borderTop: `3px solid ${ACCENT.error}`, backgroundColor: ACCENT.errorBg }}>
                      <td colSpan={10} className="px-3 py-4 text-2xl font-extrabold" style={{ color: ACCENT.error }}>GRAND TOTAL (Recurring)</td>
                      <td className="px-3 py-4 text-right text-2xl font-extrabold tabular-nums whitespace-nowrap" style={{ color: ACCENT.error }}>{fmt(grandTotal)}</td>
                    </tr>
                    <tr style={{ backgroundColor: ACCENT.errorBg, borderTop: `1px solid ${dividerColor}` }}>
                      <td colSpan={10} className="px-3 py-3 text-2xl font-extrabold" style={{ color: ACCENT.warning }}>+ Capital Investments</td>
                      <td className="px-3 py-3 text-right text-2xl font-extrabold tabular-nums whitespace-nowrap" style={{ color: ACCENT.warning }}>{fmt(capitalInvestments)}</td>
                    </tr>
                    <tr style={{ backgroundColor: "rgba(248,113,113,0.16)", borderTop: `2px solid ${ACCENT.error}` }}>
                      <td colSpan={10} className="px-3 py-4 text-2xl font-extrabold" style={{ color: ACCENT.error }}>TOTAL EXPENSES</td>
                      <td className="px-3 py-4 text-right text-2xl font-extrabold tabular-nums whitespace-nowrap" style={{ color: ACCENT.error }}>{fmt(totalWithCapital)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Mobile list */}
              <div className="md:hidden max-w-lg mx-auto">
                {years.map((year) => {
                  const yearRows = rows.filter((r) => r.year === year);
                  return (
                    <Fragment key={year}>
                      <div
                        className="font-extrabold text-center py-3 text-lg rounded-lg mt-4 first:mt-0"
                        style={{ backgroundColor: ACCENT.primaryBg, color: ACCENT.primary }}
                      >
                        {year}
                      </div>
                      {yearRows.map((r) => (
                        <MobileExpenseRow
                          key={r.label}
                          row={r}
                          fmt={fmt}
                          textColor={textColor}
                          cardBackgroundColor={cardBackgroundColor}
                          dividerColor={dividerColor}
                        />
                      ))}
                      <div
                        className="flex justify-between items-center py-4 mb-2"
                        style={{ borderTop: `2px solid ${ACCENT.errorBorder}` }}
                      >
                        <span className="font-extrabold text-lg" style={{ color: ACCENT.error }}>{year} Total</span>
                        <span className="font-extrabold text-lg" style={{ color: ACCENT.error }}>{fmt(yearlyTotals[year])}</span>
                      </div>
                    </Fragment>
                  );
                })}

                <div className="mt-2 rounded-xl overflow-hidden">
                  <div
                    className="flex justify-between items-center px-4 py-4"
                    style={{ backgroundColor: ACCENT.errorBg, borderTop: `4px solid ${ACCENT.error}` }}
                  >
                    <span className="font-extrabold text-base" style={{ color: ACCENT.error }}>GRAND TOTAL (Recurring)</span>
                    <span className="font-extrabold text-base" style={{ color: ACCENT.error }}>{fmt(grandTotal)}</span>
                  </div>
                  <div
                    className="flex justify-between items-center px-4 py-3"
                    style={{ backgroundColor: ACCENT.errorBg }}
                  >
                    <span className="font-extrabold text-base" style={{ color: ACCENT.warning }}>+ Capital Investments</span>
                    <span className="font-extrabold text-base" style={{ color: ACCENT.warning }}>{fmt(capitalInvestments)}</span>
                  </div>
                  <div
                    className="flex justify-between items-center px-4 py-4"
                    style={{ backgroundColor: "rgba(248,113,113,0.18)", borderTop: `2px solid ${ACCENT.error}` }}
                  >
                    <span className="font-extrabold text-lg" style={{ color: ACCENT.error }}>TOTAL EXPENSES</span>
                    <span className="font-extrabold text-lg" style={{ color: ACCENT.error }}>{fmt(totalWithCapital)}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="py-2">
            <div className="max-w-5xl mx-auto" style={{ height: 1, backgroundColor: dividerColor }} />
          </div>

          {/* Summary cards */}
          <section className="py-8">
            <div className="container mx-auto px-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
                {[
                  {
                    icon: FaMoneyBillWave,
                    iconColor: ACCENT.error,
                    borderColor: ACCENT.error,
                    label: "Total Recurring Expenses",
                    value: fmt(grandTotal),
                    valueColor: ACCENT.error,
                    sub: null,
                  },
                  {
                    icon: FaLaptop,
                    iconColor: ACCENT.warning,
                    borderColor: ACCENT.warning,
                    label: "Capital Investments",
                    value: fmt(capitalInvestments),
                    valueColor: ACCENT.warning,
                    sub: null,
                  },
                  {
                    icon: FaChartLine,
                    iconColor: ACCENT.error,
                    borderColor: ACCENT.error,
                    label: "Grand Total Spent",
                    value: fmt(totalWithCapital),
                    valueColor: ACCENT.error,
                    sub: null,
                  },
                  {
                    icon: FaHandHoldingHeart,
                    iconColor: ACCENT.success,
                    borderColor: ACCENT.success,
                    label: "Revenue / Funding",
                    value: fmt(0),
                    valueColor: ACCENT.success,
                    sub: "Zero. Nothing. Nada.",
                  },
                ].map(({ icon: Icon, iconColor, borderColor, label, value, valueColor, sub }) => (
                  <div
                    key={label}
                    className="card glass-effect p-6 rounded-xl text-center border-l-4"
                    style={{ backgroundColor: cardBackgroundColor, boxShadow: cardShadow, borderColor }}
                  >
                    <Icon className="w-8 h-8 mx-auto mb-2" style={{ color: iconColor }} />
                    <p className="text-sm uppercase tracking-wide mb-1" style={{ color: textColor, opacity: 0.6 }}>{label}</p>
                    <p className="text-2xl font-extrabold" style={{ color: valueColor }}>{value}</p>
                    {sub && <p className="text-xs mt-1 font-semibold" style={{ color: ACCENT.error }}>{sub}</p>}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <div className="py-2">
            <div className="max-w-5xl mx-auto" style={{ height: 1, backgroundColor: dividerColor }} />
          </div>

          {/* Capital investments */}
          <section className="py-8">
            <div className="container mx-auto px-4">
              <h2 className="text-2xl md:text-3xl font-bold text-center mb-8" style={{ color: textColor }}>
                Capital Investments (One-Time)
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto">
                <div
                  className="card glass-effect hover-lift p-6 rounded-xl"
                  style={{ backgroundColor: cardBackgroundColor, boxShadow: cardShadow }}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: ACCENT.warningBg }}>
                      <FaLaptop className="w-5 h-5" style={{ color: ACCENT.warning }} />
                    </div>
                    <h3 className="text-lg font-bold" style={{ color: textColor }}>IT Infrastructure</h3>
                  </div>
                  <p className="text-sm mb-2" style={{ color: textColor, opacity: 0.75 }}>
                    Laptops, computers, networking equipment — purchased since July 2022
                  </p>
                  <p className="text-2xl font-extrabold" style={{ color: ACCENT.warning }}>{fmt(cfg.infraCost)}</p>
                  <p className="text-xs mt-1" style={{ color: textColor, opacity: 0.45 }}>Depreciating at 10%/year • 5%/year maintenance</p>
                </div>
                <div
                  className="card glass-effect hover-lift p-6 rounded-xl"
                  style={{ backgroundColor: cardBackgroundColor, boxShadow: cardShadow }}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: ACCENT.infoBg }}>
                      <FaCouch className="w-5 h-5" style={{ color: ACCENT.info }} />
                    </div>
                    <h3 className="text-lg font-bold" style={{ color: textColor }}>Fixtures &amp; Furniture</h3>
                  </div>
                  <p className="text-sm mb-2" style={{ color: textColor, opacity: 0.75 }}>
                    Office furniture, fixtures, and setup — since July 2022
                  </p>
                  <p className="text-2xl font-extrabold" style={{ color: ACCENT.info }}>{fmt(cfg.furnitureCost)}</p>
                  <p className="text-xs mt-1" style={{ color: textColor, opacity: 0.45 }}>Depreciating at 15%/year</p>
                </div>
              </div>
            </div>
          </section>

          <div className="py-2">
            <div className="max-w-5xl mx-auto" style={{ height: 1, backgroundColor: dividerColor }} />
          </div>

          {/* Monthly categories */}
          <section className="py-8">
            <div className="container mx-auto px-4">
              <h2 className="text-2xl md:text-3xl font-bold text-center mb-8" style={{ color: textColor }}>
                Monthly Recurring Expense Categories
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
                {[
                  {
                    icon: FaUsers,
                    iconBg: ACCENT.primaryBg,
                    iconColor: ACCENT.primary,
                    label: "Developer Salaries",
                    desc: `3 devs (Jan 2022 – Jan 2026): ${fmt(cfg.salary3)}/mo\n2 devs (Feb 2026 – present): ${fmt(cfg.salary2)}/mo`,
                  },
                  {
                    icon: FaBuilding,
                    iconBg: ACCENT.errorBg,
                    iconColor: ACCENT.error,
                    label: "Office Rent",
                    desc: `${fmt(cfg.rent)}/month since July 2022`,
                  },
                  {
                    icon: FaBolt,
                    iconBg: ACCENT.warningBg,
                    iconColor: ACCENT.warning,
                    label: "Utilities",
                    desc: `Internet, Electricity & Backup = ${fmt(cfg.utilities)}/mo`,
                  },
                  {
                    icon: FaServer,
                    iconBg: ACCENT.infoBg,
                    iconColor: ACCENT.info,
                    label: "VPS & Hosting",
                    desc: `Hive witness, VSC witness, app backends — ${fmt(cfg.vps)}/mo`,
                  },
                  {
                    icon: FaGlobe,
                    iconBg: ACCENT.successBg,
                    iconColor: ACCENT.success,
                    label: "Dev Programs & Domains",
                    desc: `Apple/Google dev programs ${fmt(cfg.devPrograms)} + Domains ${fmt(cfg.domains)} = ${fmt(cfg.devPrograms + cfg.domains)}/mo`,
                  },
                  {
                    icon: FaLaptop,
                    iconBg: ACCENT.warningBg,
                    iconColor: ACCENT.warning,
                    label: "Depreciation & Maintenance",
                    desc: "IT infra: 10% depreciation + 5% maintenance/yr\nFurniture: 15% depreciation/yr",
                  },
                ].map(({ icon: Icon, iconBg, iconColor, label, desc }) => (
                  <div
                    key={label}
                    className="card glass-effect hover-lift p-5 rounded-xl"
                    style={{ backgroundColor: cardBackgroundColor, boxShadow: cardShadow }}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: iconBg }}>
                        <Icon className="w-5 h-5" style={{ color: iconColor }} />
                      </div>
                      <h3 className="font-bold text-sm" style={{ color: textColor }}>{label}</h3>
                    </div>
                    <p className="text-xs whitespace-pre-line" style={{ color: textColor, opacity: 0.7 }}>{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <div className="py-2">
            <div className="max-w-5xl mx-auto" style={{ height: 1, backgroundColor: dividerColor }} />
          </div>

          {/* The Hard Truth */}
          <section className="py-12">
            <div className="container mx-auto px-4">
              <div className="max-w-3xl mx-auto">
                <div
                  className="card glass-effect rounded-2xl p-8"
                  style={{
                    backgroundColor: cardBackgroundColor,
                    boxShadow: cardShadow,
                    border: `2px solid ${dividerColor}`,
                  }}
                >
                  <div className="text-center mb-6">
                    <FaHeartBroken className="w-12 h-12 mx-auto mb-4" style={{ color: ACCENT.error }} />
                    <h2 className="text-3xl font-extrabold mb-2" style={{ color: ACCENT.error }}>The Hard Truth</h2>
                  </div>

                  <div className="space-y-4 text-base" style={{ color: textColor, opacity: 0.9 }}>
                    <p>
                      We have spent{" "}
                      <span className="font-extrabold" style={{ color: ACCENT.error }}>{fmt(totalWithCapital)}</span>{" "}
                      of our own money building apps, running infrastructure, and supporting the Hive ecosystem.
                    </p>
                    <p>
                      Except for 3Speak-funded projects —{" "}
                      <span className="font-semibold" style={{ color: textColor }}>Distriator</span>,{" "}
                      <span className="font-semibold" style={{ color: textColor }}>CheckInWithXYZ</span>{" "}
                      &{" "}
                      <span className="font-semibold" style={{ color: textColor }}>3Speak</span>{" "}
                      — we have{" "}
                      <span className="font-extrabold" style={{ color: ACCENT.error }}>never received any funding</span>{" "}
                      for any of our other projects. Everything else has been entirely self-funded.
                    </p>
                    <p>
                      We have{" "}
                      <span className="font-bold" style={{ color: ACCENT.error }}>never asked for DHF funding or any grants</span>.
                      We have not monetized any of our apps. We have not put ads in our apps. Everything is free, open-source,
                      and built for the Hive community.
                    </p>
                    <p>
                      On top of all this, we are holding{" "}
                      <span className="font-extrabold" style={{ color: ACCENT.accent }}>Hive Power (staked HIVE) worth $11,000</span>{" "}
                      — locked for 3 months — and we are continuously investing and increasing our stake in Hive.
                      We don't just build on Hive, we put our money where our mouth is.
                    </p>
                    <p>
                      Since July 2023, we also send approximately{" "}
                      <span className="font-bold" style={{ color: textColor }}>$10 to $20 worth of support every month</span>{" "}
                      to community initiatives like{" "}
                      <span className="font-semibold">Ladies of Hive</span>,{" "}
                      <span className="font-semibold">Shadow Hunters</span>,{" "}
                      <span className="font-semibold">Reflection Hunters</span>,{" "}
                      <span className="font-semibold">Bird Watchers</span>,{" "}
                      <span className="font-semibold">Power Plant Vegan</span>,{" "}
                      <span className="font-semibold">India United</span>, and{" "}
                      <span className="font-semibold">Amazing Drinks</span>.
                      On top of that, we actively support many Hive users by upvoting their content and
                      rewarding them with Hive inflation through our curation efforts.
                    </p>
                    <p>
                      This is not sustainable. We are running in{" "}
                      <span className="font-extrabold" style={{ color: ACCENT.error }}>heavy debt</span>.
                      Every month, the expenses pile up — salaries, rent, hosting, infrastructure — and nothing comes back.
                    </p>
                    <p className="font-semibold" style={{ color: textColor }}>
                      This is taking a heavy toll — financially, mentally, and emotionally. Building for years without any
                      return is exhausting. But we keep going because we believe in Hive and its community.
                    </p>
                  </div>

                  <div className="my-6" style={{ height: 1, backgroundColor: dividerColor }} />

                  <div className="text-center">
                    <h3 className="text-2xl font-extrabold mb-3" style={{ color: ACCENT.accent }}>
                      All We Ask Is Your Witness Vote
                    </h3>
                    <p className="mb-6 max-w-lg mx-auto" style={{ color: textColor, opacity: 0.85 }}>
                      We have never asked for money. We are not asking for money now.
                      Just your{" "}
                      <span className="font-bold" style={{ color: ACCENT.accent }}>
                        Hive witness vote for @sagarkothari88
                      </span>{" "}
                      — that's it. That small gesture of support means the world to us and helps us
                      keep building for the ecosystem.
                    </p>
                    <a
                      href="https://vote.hive.uno/@sagarkothari88"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-primary btn-lg gap-2"
                    >
                      <FaHandHoldingHeart className="w-5 h-5" />
                      Vote @sagarkothari88 as Witness
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Debt vs Revenue bar */}
          <section className="py-8">
            <div className="container mx-auto px-4">
              <div className="max-w-3xl mx-auto text-center">
                <h3 className="text-xl font-bold mb-4" style={{ color: textColor }}>
                  Debt vs Revenue
                </h3>
                <div className="w-full rounded-full h-8 overflow-hidden mb-2" style={{ backgroundColor: ACCENT.progressTrack }}>
                  <div
                    className="h-full rounded-full flex items-center justify-end pr-3"
                    style={{
                      width: "100%",
                      background: `linear-gradient(90deg, ${ACCENT.error}, rgba(248,113,113,0.7))`,
                    }}
                  >
                    <span className="text-xs font-bold text-white">DEBT: {fmt(totalWithCapital)}</span>
                  </div>
                </div>
                <div className="w-full rounded-full h-8 overflow-hidden" style={{ backgroundColor: ACCENT.progressTrack }}>
                  <div
                    className="h-full rounded-full flex items-center pl-3"
                    style={{ width: "2%", minWidth: "80px", backgroundColor: ACCENT.success }}
                  >
                    <span className="text-xs font-bold text-white">{fmt(0)}</span>
                  </div>
                </div>
                <p className="text-xs mt-2" style={{ color: textColor, opacity: 0.45 }}>
                  Revenue bar is at minimum width because the actual value is {fmt(0)}
                </p>
              </div>
            </div>
          </section>

          <div className="py-20"></div>
        </main>

        <Contact />
      </div>
    </div>
  );
};

export default ExpensesView;
