import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  AreaChart,
  Area,
  BarChart,
  Bar,
  ReferenceLine,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { AssetCategory, CurrencyCode, Holding } from '../types/wealth';
import { convertCurrency, formatCurrency, formatPercent } from '../utils/currency';
import {
  generateAutomatedInsights,
  computePortfolioRiskScore,
  getHolding30DayGainPct,
} from '../utils/taxAndDiversification';
import {
  downloadPortfolioExcelTemplate,
  exportHoldingsToExcel,
  exportHoldingsToCsv,
} from '../utils/statementImport';
import {
  CATEGORY_META,
  buildPortfolioTrendSeries,
  buildMomGrowthSeries,
  MomGrowthPoint,
} from '../utils/portfolioMetrics';
import { generatePortfolioPdfReport } from '../utils/pdfReport';
import {
  Clock,
  Search,
  ChevronRight,
  Trash2,
  FileSpreadsheet,
  FileText,
  Plus,
  PlusCircle,
  ShieldCheck,
  ArrowRight,
  RotateCcw,
  Table2,
  Sliders,
  Download,
  TrendingUp,
  TrendingDown,
  Gauge,
  Shuffle,
  Pencil,
} from 'lucide-react';

interface TrendChartTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: {
      month: string;
      fullDate: string;
      valuation: number;
      invested: number;
      unrealizedGain: number;
      gainPct: number;
      isCurrent: boolean;
    };
  }>;
  label?: string;
  baseCurrency: CurrencyCode;
}

const TrendChartTooltip: React.FC<TrendChartTooltipProps> = ({ active, payload, label, baseCurrency }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const isPositive = data.unrealizedGain >= 0;
    return (
      <div className="bg-paper border border-slate-700 rounded-xl p-3.5 shadow-ink/10 shadow-lg min-w-[205px]">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-700 text-xs">
          <span className="font-semibold text-ink">{data.fullDate || label}</span>
          {data.isCurrent && <span className="text-2xs font-mono text-emerald-700">Current</span>}
        </div>
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center justify-between gap-4">
            <span className="text-ink/70">Avg Valuation</span>
            <span className="font-mono font-semibold text-ink tabular-nums">
              {formatCurrency(data.valuation, baseCurrency, { compact: false, showDecimals: false })}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-ink/70">Invested Base</span>
            <span className="font-mono text-ink/70 tabular-nums">
              {formatCurrency(data.invested, baseCurrency, { compact: false, showDecimals: false })}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4 pt-1 border-t border-slate-700/60">
            <span className="text-ink/70">Net Gain</span>
            <span className={`font-mono font-medium tabular-nums ${isPositive ? 'text-emerald-700' : 'text-rose-600'}`}>
              {isPositive ? '+' : ''}
              {formatCurrency(data.unrealizedGain, baseCurrency, { compact: true })} ({formatPercent(data.gainPct)})
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

interface MomGrowthTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: MomGrowthPoint }>;
  label?: string;
  baseCurrency: CurrencyCode;
}

const MomGrowthTooltip: React.FC<MomGrowthTooltipProps> = ({ active, payload, label, baseCurrency }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const isPositive = data.netGrowth >= 0;
    return (
      <div className="bg-paper border border-slate-700 rounded-xl p-3.5 shadow-ink/10 shadow-lg min-w-[220px]">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-700 text-xs">
          <span className="font-semibold text-ink">{data.fullDate || label}</span>
          <span className={`font-mono font-semibold tabular-nums ${isPositive ? 'text-emerald-700' : 'text-rose-600'}`}>
            {isPositive ? '+' : ''}
            {formatPercent(data.netGrowthPct)}
          </span>
        </div>
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center justify-between gap-4">
            <span className="text-ink/70">Net Growth (MoM)</span>
            <span className={`font-mono font-semibold tabular-nums ${isPositive ? 'text-emerald-700' : 'text-rose-600'}`}>
              {isPositive ? '+' : ''}
              {formatCurrency(data.netGrowth, baseCurrency, { compact: false, showDecimals: false })}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-ink/70">Market Return</span>
            <span className={`font-mono tabular-nums ${data.marketGain >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
              {data.marketGain >= 0 ? '+' : ''}
              {formatCurrency(data.marketGain, baseCurrency, { compact: true })}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-ink/70">Capital Added</span>
            <span className="font-mono text-ink/70 tabular-nums">
              +{formatCurrency(data.capitalFlow, baseCurrency, { compact: true })}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4 pt-1 border-t border-slate-700/60">
            <span className="text-ink/70">Month-End Value</span>
            <span className="font-mono text-ink tabular-nums">
              {formatCurrency(data.endingValuation, baseCurrency, { compact: true })}
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

interface OverviewTabProps {
  holdings: Holding[];
  baseCurrency: CurrencyCode;
  portfolioMode: 'demo' | 'personal';
  profileName: string;
  onNavigateToTab: (tab: 'radar' | 'rebalance' | 'tax' | 'simulator' | 'overview') => void;
  onSelectHoldingToReinvest: (holding: Holding) => void;
  onRebalanceHolding?: (holding: Holding) => void;
  onEditHolding?: (holding: Holding) => void;
  onDeleteHolding: (id: string) => void;
  onOpenValidateModal: (tab?: 'excel' | 'manual' | 'reset') => void;
  onOpenAddModal: () => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  holdings,
  baseCurrency,
  portfolioMode,
  profileName,
  onNavigateToTab,
  onSelectHoldingToReinvest,
  onRebalanceHolding,
  onEditHolding,
  onDeleteHolding,
  onOpenValidateModal,
  onOpenAddModal,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [chartViewMode, setChartViewMode] = useState<'CATEGORY' | 'BROAD'>('CATEGORY');
  const [hoveredSliceIndex, setHoveredSliceIndex] = useState<number | null>(null);
  const [trendHorizon, setTrendHorizon] = useState<'3M' | '6M' | '12M'>('12M');
  const [workspaceView, setWorkspaceView] = useState<'ledger' | 'insights'>('ledger');

  // KPI Calculations in Base Currency
  const totalValuation = useMemo(() => {
    return holdings.reduce(
      (sum, h) => sum + convertCurrency(h.currentValue, h.currency, baseCurrency),
      0
    );
  }, [holdings, baseCurrency]);

  const totalInvested = useMemo(() => {
    return holdings.reduce(
      (sum, h) => sum + convertCurrency(h.investedAmount, h.currency, baseCurrency),
      0
    );
  }, [holdings, baseCurrency]);

  const totalGain = totalValuation - totalInvested;
  const totalGainPct = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;

  // 12-Month Historical Portfolio Valuation Trend (assuming monthly average valuation)
  const fullTrendData = useMemo(
    () => buildPortfolioTrendSeries(totalValuation, totalInvested),
    [totalValuation, totalInvested]
  );

  const visibleTrendData = useMemo(() => {
    if (trendHorizon === '3M') return fullTrendData.slice(-3);
    if (trendHorizon === '6M') return fullTrendData.slice(-6);
    return fullTrendData;
  }, [fullTrendData, trendHorizon]);

  const trendStats = useMemo(() => {
    if (visibleTrendData.length === 0 || totalValuation === 0) {
      return { diff: 0, diffPct: 0 };
    }
    const startVal = visibleTrendData[0].valuation;
    const endVal = visibleTrendData[visibleTrendData.length - 1].valuation;
    const diff = endVal - startVal;
    const diffPct = startVal > 0 ? (diff / startVal) * 100 : 0;
    return { diff, diffPct };
  }, [visibleTrendData, totalValuation]);

  // 30-Day Net Worth Change (Oct -> Current from monthly valuation profile)
  const thirtyDayStats = useMemo(() => {
    if (fullTrendData.length < 2 || totalValuation === 0) {
      return { changeAmount: 0, changePct: 0 };
    }
    const prevVal = fullTrendData[fullTrendData.length - 2].valuation;
    const currVal = fullTrendData[fullTrendData.length - 1].valuation;
    const changeAmount = currVal - prevVal;
    const changePct = prevVal > 0 ? (changeAmount / prevVal) * 100 : 0;
    return { changeAmount, changePct };
  }, [fullTrendData, totalValuation]);

  // Month-over-Month Net Growth series derived from monthly valuation profile
  const momGrowthData = useMemo<MomGrowthPoint[]>(
    () => buildMomGrowthSeries(fullTrendData),
    [fullTrendData]
  );

  const visibleMomData = useMemo(() => {
    if (trendHorizon === '3M') return momGrowthData.slice(-3);
    if (trendHorizon === '6M') return momGrowthData.slice(-6);
    return momGrowthData;
  }, [momGrowthData, trendHorizon]);

  const momSummary = useMemo(() => {
    if (visibleMomData.length === 0 || totalValuation === 0) {
      return { avgMonthlyGrowth: 0, positiveMonths: 0, bestMonth: null as MomGrowthPoint | null };
    }
    const sum = visibleMomData.reduce((acc, p) => acc + p.netGrowth, 0);
    const positiveMonths = visibleMomData.filter((p) => p.netGrowth >= 0).length;
    const bestMonth = visibleMomData.reduce((best, curr) =>
      curr.netGrowth > best.netGrowth ? curr : best
    );
    return {
      avgMonthlyGrowth: Math.round(sum / visibleMomData.length),
      positiveMonths,
      bestMonth,
    };
  }, [visibleMomData, totalValuation]);

  // Maturing and Matured Holdings
  const maturedHoldings = useMemo(() => {
    return holdings.filter(
      (h) => h.isMatured || (h.daysToMaturity !== undefined && h.daysToMaturity <= 0)
    );
  }, [holdings]);

  const maturingSoonHoldings = useMemo(() => {
    return holdings.filter(
      (h) => !h.isMatured && h.daysToMaturity !== undefined && h.daysToMaturity > 0 && h.daysToMaturity <= 30
    );
  }, [holdings]);

  const totalMaturedAmount = useMemo(() => {
    return maturedHoldings.reduce(
      (sum, h) => sum + convertCurrency(h.currentValue, h.currency, baseCurrency),
      0
    );
  }, [maturedHoldings, baseCurrency]);

  // Asset Class Allocation Breakdown
  const categoryStats = useMemo(() => {
    const buckets: Record<string, { label: string; amount: number; count: number }> = {
      EQUITY: { label: 'Equities & Funds', amount: 0, count: 0 },
      FIXED_INCOME: { label: 'Fixed Income & Bonds', amount: 0, count: 0 },
      GOLD: { label: 'Gold / SGB', amount: 0, count: 0 },
      RETIREMENT: { label: 'Retirement (EPF/PPF/NPS)', amount: 0, count: 0 },
      CASH: { label: 'Savings & Cash', amount: 0, count: 0 },
    };

    holdings.forEach((h) => {
      const val = convertCurrency(h.currentValue, h.currency, baseCurrency);
      if (h.category === 'MUTUAL_FUND' || h.category === 'EQUITY_STOCK') {
        buckets.EQUITY.amount += val;
        buckets.EQUITY.count += 1;
      } else if (
        h.category === 'FIXED_DEPOSIT' ||
        h.category === 'RECURRING_DEPOSIT' ||
        h.category === 'GOVT_BOND' ||
        h.category === 'CORP_BOND'
      ) {
        buckets.FIXED_INCOME.amount += val;
        buckets.FIXED_INCOME.count += 1;
      } else if (h.category === 'SOVEREIGN_GOLD_BOND') {
        buckets.GOLD.amount += val;
        buckets.GOLD.count += 1;
      } else if (h.category === 'EPF' || h.category === 'PPF' || h.category === 'NPS') {
        buckets.RETIREMENT.amount += val;
        buckets.RETIREMENT.count += 1;
      } else {
        buckets.CASH.amount += val;
        buckets.CASH.count += 1;
      }
    });

    return buckets;
  }, [holdings, baseCurrency]);

  // Granular Asset Category Data for Donut Chart
  const categoryDonutData = useMemo(() => {
    const map = new Map<
      AssetCategory,
      { key: AssetCategory; label: string; shortLabel: string; color: string; value: number; count: number }
    >();

    holdings.forEach((h) => {
      const val = convertCurrency(h.currentValue, h.currency, baseCurrency);
      const meta = CATEGORY_META[h.category] || {
        label: h.category.replace('_', ' '),
        shortLabel: h.category.replace('_', ' '),
        color: '#6b7a90',
      };
      const existing = map.get(h.category);
      if (existing) {
        existing.value += val;
        existing.count += 1;
      } else {
        map.set(h.category, {
          key: h.category,
          label: meta.label,
          shortLabel: meta.shortLabel,
          color: meta.color,
          value: val,
          count: 1,
        });
      }
    });

    return Array.from(map.values())
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [holdings, baseCurrency]);

  // Broad Asset Class Data for Donut Chart
  const broadClassDonutData = useMemo(() => {
    return Object.entries(categoryStats)
      .map(([key, data]) => {
        const color =
          key === 'EQUITY'
            ? '#4c5ce6'
            : key === 'FIXED_INCOME'
            ? '#1f8a9e'
            : key === 'GOLD'
            ? '#c99a2e'
            : key === 'RETIREMENT'
            ? '#02a26d'
            : '#6b7a90';

        return {
          key: key as AssetCategory,
          label: data.label,
          shortLabel: data.label.split('&')[0].trim(),
          color,
          value: data.amount,
          count: data.count,
        };
      })
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [categoryStats]);

  const activeDonutData = chartViewMode === 'CATEGORY' ? categoryDonutData : broadClassDonutData;

  // Automated Insights
  const automatedInsights = useMemo(() => {
    return generateAutomatedInsights(holdings, baseCurrency);
  }, [holdings, baseCurrency]);

  // Portfolio Risk Score (1-100) based on allocation & holding volatility
  const riskScore = useMemo(() => {
    return computePortfolioRiskScore(holdings, baseCurrency);
  }, [holdings, baseCurrency]);

  // Holdings gaining >15% over the last 30 days
  const surgeHoldings30d = useMemo(() => {
    return holdings
      .map((h) => ({ holding: h, gain30d: getHolding30DayGainPct(h) }))
      .filter((item): item is { holding: Holding; gain30d: number } => item.gain30d !== undefined && item.gain30d > 15)
      .sort((a, b) => b.gain30d - a.gain30d);
  }, [holdings]);

  // Filtered Holdings
  const filteredHoldings = useMemo(() => {
    return holdings.filter((h) => {
      const matchesSearch =
        h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        h.institution.toLowerCase().includes(searchQuery.toLowerCase()) ||
        h.category.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (selectedCategory === 'ALL') return true;
      if (selectedCategory === 'SURGE_30D') {
        const gain30d = getHolding30DayGainPct(h);
        return gain30d !== undefined && gain30d > 15;
      }
      if (selectedCategory === 'MATURED') {
        return h.isMatured || (h.daysToMaturity !== undefined && h.daysToMaturity <= 30);
      }
      if (selectedCategory === 'EQUITY') {
        return h.category === 'MUTUAL_FUND' || h.category === 'EQUITY_STOCK';
      }
      if (selectedCategory === 'DEBT') {
        return (
          h.category === 'FIXED_DEPOSIT' ||
          h.category === 'RECURRING_DEPOSIT' ||
          h.category === 'GOVT_BOND' ||
          h.category === 'CORP_BOND'
        );
      }
      if (selectedCategory === 'GOLD') return h.category === 'SOVEREIGN_GOLD_BOND';
      if (selectedCategory === 'RETIREMENT') {
        return h.category === 'EPF' || h.category === 'PPF' || h.category === 'NPS';
      }
      if (selectedCategory === 'CASH') return h.category === 'SAVINGS_CASH';

      return true;
    });
  }, [holdings, searchQuery, selectedCategory]);

  return (
    <div className="space-y-6">
      {/* 1. Context Header & Bold High-Contrast Quick-Action Cards */}
      <section aria-label="Portfolio Quick Actions" className="space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-ink tracking-tight text-balance">
              {portfolioMode === 'demo'
                ? 'Simulate your own portfolio'
                : 'Your simulated portfolio'}
            </h1>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-ink/70 mt-1">
              <span className="text-ink/70">
                {portfolioMode === 'demo'
                  ? `Viewing sample data (${profileName.split(' ')[0]})`
                  : 'Custom personal session'}
              </span>
              <span aria-hidden="true" className="text-ink/40">·</span>
              <span
                data-tour="privacy-badge"
                className="inline-flex items-center gap-1.5 text-emerald-700 px-1.5 py-0.5 rounded"
              >
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                We don&apos;t store your data with us
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onOpenValidateModal('manual')}
              className="px-3.5 py-2 text-xs font-medium text-ink bg-paper hover:bg-ink/5 border border-slate-700 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
            >
              <Table2 className="w-3.5 h-3.5 text-debt shrink-0" />
              <span>Batch Manual Entry</span>
            </button>
            <button
              type="button"
              onClick={() => downloadPortfolioExcelTemplate(baseCurrency)}
              className="px-3.5 py-2 text-xs font-medium text-ink bg-paper hover:bg-ink/5 border border-slate-700 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
            >
              <Download className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
              <span>Sample Template</span>
            </button>
            <button
              type="button"
              onClick={() => exportHoldingsToExcel(holdings, baseCurrency)}
              disabled={holdings.length === 0}
              className="px-3.5 py-2 text-xs font-medium text-emerald-700 bg-emerald-500/10 hover:bg-emerald-500/20 hover:text-emerald-800 disabled:opacity-45 disabled:cursor-not-allowed border border-emerald-500/40 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
              <span>Export Excel (.xlsx)</span>
            </button>
            <button
              type="button"
              onClick={() =>
                generatePortfolioPdfReport({
                  holdings,
                  baseCurrency,
                  portfolioMode,
                  profileName,
                })
              }
              disabled={holdings.length === 0}
              className="px-3.5 py-2 text-xs font-medium text-ink bg-paper hover:bg-ink/5 disabled:opacity-45 disabled:cursor-not-allowed border border-slate-700 hover:border-rose-600/60 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600"
            >
              <FileText className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              <span>Export PDF Report</span>
            </button>
          </div>
        </div>

        {/* Net Worth Summary Widget alongside the 3 Bold Quick-Action Cards */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch">
          {/* Net Worth Summary Widget */}
          <div
            aria-label="Net Worth Summary"
            className="xl:col-span-4 bg-paper border border-slate-700 shadow-ink/10 shadow-sm rounded-xl p-5 flex flex-col justify-between gap-4"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-medium text-ink/70">Net Worth Summary</span>
                <span className="text-ink/70">30-day change</span>
              </div>

              <div className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-ink tabular-nums">
                {formatCurrency(totalValuation, baseCurrency, { compact: false, showDecimals: false })}
              </div>

              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-mono tabular-nums">
                <span
                  className={`inline-flex items-center gap-1 font-semibold ${
                    thirtyDayStats.changeAmount >= 0 ? 'text-emerald-700' : 'text-rose-600'
                  }`}
                >
                  {thirtyDayStats.changeAmount >= 0 ? (
                    <TrendingUp className="w-3.5 h-3.5 shrink-0" />
                  ) : (
                    <TrendingDown className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span>
                    {thirtyDayStats.changeAmount >= 0 ? '+' : ''}
                    {formatPercent(thirtyDayStats.changePct)}
                  </span>
                </span>
                <span className="text-ink/70">
                  ({thirtyDayStats.changeAmount >= 0 ? '+' : ''}
                  {formatCurrency(thirtyDayStats.changeAmount, baseCurrency, { compact: true })} last 30d)
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-700 flex items-center justify-between gap-3 text-xs text-ink/70 font-mono tabular-nums">
              <span>Invested {formatCurrency(totalInvested, baseCurrency, { compact: true })}</span>
              <span>
                {holdings.length} {holdings.length === 1 ? 'holding' : 'holdings'}
              </span>
            </div>
          </div>

          {/* 3 Bold, High-Contrast Quick-Action Cards */}
          <div className="xl:col-span-8 grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
            <button
              type="button"
              data-tour="import-card"
              onClick={() => onOpenValidateModal('excel')}
              className="group text-left bg-emerald-500 hover:bg-emerald-700 border border-emerald-600/60 rounded-xl p-5 transition-colors duration-150 flex flex-col justify-between gap-4 shadow-lg shadow-ink/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 focus-visible:ring-offset-mist"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 text-xs font-semibold text-white">
                    <FileSpreadsheet className="w-4 h-4 text-white shrink-0" />
                    <span>Excel or CSV</span>
                  </span>
                  <span className="text-xs font-mono font-bold text-white">01</span>
                </div>
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Import or Restore Portfolio
                </h2>
                <p className="text-xs sm:text-sm text-white font-medium leading-relaxed">
                  {portfolioMode === 'demo'
                    ? 'Upload your own .xlsx / .csv or re-import a file you previously saved from Vestora.'
                    : 'Upload a fresh sheet or re-import an earlier Vestora export to restore your progress.'}
                </p>
              </div>
              <div className="pt-3 border-t border-white/15 flex items-center justify-between text-xs font-bold text-white whitespace-nowrap">
                <span>Upload or restore file</span>
                <ArrowRight className="w-4 h-4 shrink-0 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </button>

            <button
              type="button"
              data-tour="add-card"
              onClick={onOpenAddModal}
              className="group text-left bg-paper hover:bg-ink/5 border border-slate-700 hover:border-emerald-600/60 rounded-xl p-5 transition-colors duration-150 flex flex-col justify-between gap-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 focus-visible:ring-offset-mist"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 text-xs font-medium text-emerald-700">
                    <PlusCircle className="w-4 h-4 shrink-0" />
                    <span>Quick entry</span>
                  </span>
                  <span className="text-xs font-mono text-ink/70">02</span>
                </div>
                <h2 className="text-base sm:text-lg font-bold text-ink tracking-tight">
                  Add Single Holding
                </h2>
                <p className="text-xs sm:text-sm text-ink/70 leading-relaxed">
                  Log a mutual fund, direct stock, fixed deposit, bond, or cash account in seconds.
                </p>
              </div>
              <div className="pt-3 border-t border-slate-700 flex items-center justify-between text-xs font-semibold text-emerald-700 whitespace-nowrap">
                <span>Add holding</span>
                <ArrowRight className="w-4 h-4 shrink-0 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </button>

            <button
              type="button"
              onClick={() => onNavigateToTab('simulator')}
              className="group text-left bg-paper hover:bg-ink/5 border border-slate-700 hover:border-amber-600/60 rounded-xl p-5 transition-colors duration-150 flex flex-col justify-between gap-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2 focus-visible:ring-offset-mist"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 text-xs font-medium text-amber-700">
                    <Sliders className="w-4 h-4 shrink-0" />
                    <span>Scenario lab</span>
                  </span>
                  <span className="text-xs font-mono text-ink/70">03</span>
                </div>
                <h2 className="text-base sm:text-lg font-bold text-ink tracking-tight">
                  Run Stress Test
                </h2>
                <p className="text-xs sm:text-sm text-ink/70 leading-relaxed">
                  Simulate rate hikes, market shocks, inflation, and shuffle asset weights dynamically.
                </p>
              </div>
              <div className="pt-3 border-t border-slate-700 flex items-center justify-between text-xs font-semibold text-amber-700 whitespace-nowrap">
                <span>Open Stress Lab</span>
                <ArrowRight className="w-4 h-4 shrink-0 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </button>
          </div>
        </div>
      </section>

      {/* Slim Single-Line Matured Alert Ribbon (only when action needed) */}
      {(maturedHoldings.length > 0 || maturingSoonHoldings.length > 0) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs">
          <div className="flex items-center gap-2 text-ink">
            <Clock className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              {maturedHoldings.length > 0 ? (
                <>
                  <strong className="font-semibold text-amber-800">
                    {maturedHoldings.length} matured holding{maturedHoldings.length > 1 ? 's' : ''}
                  </strong>{' '}
                  ({formatCurrency(totalMaturedAmount, baseCurrency, { compact: true })}) sitting idle.
                </>
              ) : (
                <>
                  <strong className="font-semibold text-amber-800">
                    {maturingSoonHoldings[0]?.name}
                  </strong>{' '}
                  matures in {maturingSoonHoldings[0]?.daysToMaturity} days.
                </>
              )}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onNavigateToTab('radar')}
            className="text-xs font-semibold text-amber-800 hover:text-amber-800 inline-flex items-center gap-1 whitespace-nowrap self-start sm:self-auto"
          >
            <span>Open Maturity Radar</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Visual Notification for Holdings Gaining >15% in Last 30 Days */}
      {surgeHoldings30d.length > 0 && (
        <div
          role="status"
          aria-label="30-day high gainers notification"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/35 text-xs"
        >
          <div className="flex items-start sm:items-center gap-2 text-ink min-w-0">
            <TrendingUp className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5 sm:mt-0" />
            <span className="leading-relaxed">
              <strong className="font-semibold text-emerald-800">
                {surgeHoldings30d.length} holding{surgeHoldings30d.length > 1 ? 's' : ''} gained &gt;15% in 30 days:
              </strong>{' '}
              <span className="font-mono text-ink/80 tabular-nums">
                {surgeHoldings30d
                  .slice(0, 2)
                  .map((item) => `${item.holding.name} (+${item.gain30d.toFixed(1)}%)`)
                  .join(', ')}
                {surgeHoldings30d.length > 2 ? ` +${surgeHoldings30d.length - 2} more` : ''}
              </span>
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              setWorkspaceView('ledger');
              setSelectedCategory((prev) => (prev === 'SURGE_30D' ? 'ALL' : 'SURGE_30D'));
            }}
            className="text-xs font-semibold text-emerald-800 hover:text-emerald-800 inline-flex items-center gap-1 whitespace-nowrap shrink-0 self-start sm:self-auto"
          >
            <span>{selectedCategory === 'SURGE_30D' ? 'Show All Holdings' : 'Filter Top Gainers'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 2. Clean 4-Card KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-paper border border-slate-700 shadow-ink/10 shadow-sm rounded-xl p-5">
          <div className="text-xs text-ink/70">Invested Capital</div>
          <div className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-ink mt-1.5 tabular-nums">
            {formatCurrency(totalInvested, baseCurrency, { compact: false, showDecimals: false })}
          </div>
          <div className="text-xs text-ink/70 mt-1.5 font-mono tabular-nums">
            {totalInvested > 0
              ? `${(totalValuation / totalInvested).toFixed(2)}x current value`
              : 'Total cost basis'}
          </div>
        </div>

        <div className="bg-paper border border-slate-700 shadow-ink/10 shadow-sm rounded-xl p-5">
          <div className="text-xs text-ink/70">Unrealized Gain</div>
          <div
            className={`text-xl sm:text-2xl font-bold font-mono tracking-tight mt-1.5 tabular-nums ${
              totalGain >= 0 ? 'text-emerald-700' : 'text-rose-600'
            }`}
          >
            {totalGain >= 0 ? '+' : ''}
            {formatCurrency(totalGain, baseCurrency, { compact: false, showDecimals: false })}
          </div>
          <div className="text-xs mt-1.5 font-mono tabular-nums">
            <span className={totalGain >= 0 ? 'text-emerald-700 font-semibold' : 'text-rose-600 font-semibold'}>
              {formatPercent(totalGainPct)}
            </span>{' '}
            <span className="text-ink/70">overall return</span>
          </div>
        </div>

        <div className="bg-paper border border-slate-700 shadow-ink/10 shadow-sm rounded-xl p-5">
          <div className="text-xs text-ink/70">Matured / Due 30d</div>
          <div className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-amber-700 mt-1.5 tabular-nums">
            {formatCurrency(totalMaturedAmount, baseCurrency, { compact: false, showDecimals: false })}
          </div>
          <div className="text-xs text-ink/70 mt-1.5">
            {maturedHoldings.length} matured · {maturingSoonHoldings.length} upcoming
          </div>
        </div>

        <div className="bg-paper border border-slate-700 shadow-ink/10 shadow-sm rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-ink/70">Portfolio Risk Score</span>
              <span
                className={`inline-flex items-center gap-1 font-medium ${
                  riskScore.score === 0
                    ? 'text-ink/70'
                    : riskScore.score >= 75
                    ? 'text-rose-600'
                    : riskScore.score >= 55
                    ? 'text-amber-700'
                    : riskScore.score >= 30
                    ? 'text-sky-700'
                    : 'text-emerald-700'
                }`}
              >
                <Gauge className="w-3.5 h-3.5 shrink-0" />
                <span>{riskScore.posture}</span>
              </span>
            </div>

            <div className="flex items-baseline gap-1.5 mt-1.5">
              <span className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-ink tabular-nums">
                {riskScore.score > 0 ? riskScore.score : '—'}
              </span>
              {riskScore.score > 0 && (
                <span className="text-xs font-mono text-ink/70 tabular-nums">/ 100</span>
              )}
            </div>

            <div
              className="mt-2.5 h-1.5 w-full rounded-full bg-mist overflow-hidden"
              role="progressbar"
              aria-label="Portfolio Risk Score"
              aria-valuenow={riskScore.score}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  riskScore.score >= 75
                    ? 'bg-rose-500'
                    : riskScore.score >= 55
                    ? 'bg-amber-700'
                    : riskScore.score >= 30
                    ? 'bg-debt'
                    : 'bg-level-line'
                }`}
                style={{ width: `${riskScore.score}%` }}
              />
            </div>
          </div>

          <div className="text-xs text-ink/70 mt-2 font-mono tabular-nums">
            {riskScore.score > 0
              ? `${riskScore.annualizedVolatilityPct}% est. vol · ${riskScore.equityExposurePct}% equity`
              : 'Add holdings to assess risk'}
          </div>
        </div>
      </div>

      {/* 3. Side-by-Side Visual Analytics Row */}
      {holdings.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* Left (7 cols): 12-Month Historical Value Trend */}
          <div className="lg:col-span-7 bg-paper border border-slate-700 shadow-ink/10 shadow-sm rounded-xl p-5 flex flex-col justify-between space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-ink">Portfolio Value Trend</h3>
                <div className="flex items-center gap-2 text-xs text-ink/70 mt-0.5">
                  <span>Monthly average valuation</span>
                  <span aria-hidden="true">·</span>
                  <span className={`font-mono font-semibold ${trendStats.diff >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                    {trendStats.diff >= 0 ? '+' : ''}
                    {formatPercent(trendStats.diffPct)} ({trendHorizon})
                  </span>
                </div>
              </div>

              <div className="flex items-center bg-mist border border-slate-700 rounded-lg p-0.5 w-fit">
                {(['3M', '6M', '12M'] as const).map((period) => (
                  <button
                    key={period}
                    type="button"
                    onClick={() => setTrendHorizon(period)}
                    className={`px-2.5 py-1 text-2xs font-mono font-semibold rounded-md transition-colors ${
                      trendHorizon === period
                        ? 'bg-ink text-paper'
                        : 'text-ink/70 hover:text-ink'
                    }`}
                  >
                    {period}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={visibleTrendData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="trendValuationGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#02A26D" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="#02A26D" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#D8E0EA" vertical={false} />
                  <XAxis
                    dataKey="month"
                    stroke="#14213d"
                    tick={{ fill: "#14213d", fontSize: 11, fontFamily: "JetBrains Mono, monospace" }}
                    tickLine={false}
                    axisLine={{ stroke: "#D8E0EA" }}
                    dy={6}
                  />
                  <YAxis
                    stroke="#14213d"
                    tick={{ fill: "#14213d", fontSize: 11, fontFamily: "JetBrains Mono, monospace" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => formatCurrency(val, baseCurrency, { compact: true })}
                    domain={['auto', 'auto']}
                    width={62}
                  />
                  <Tooltip content={<TrendChartTooltip baseCurrency={baseCurrency} />} />
                  <Area
                    type="monotone"
                    dataKey="valuation"
                    stroke="#02A26D"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#trendValuationGradient)"
                    activeDot={{ r: 5, fill: "#02A26D", stroke: "#ffffff", strokeWidth: 2 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="invested"
                    stroke="#6b7a90"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-700/60 text-xs text-ink/70">
              <div className="flex items-center gap-4">
                <span className="inline-flex items-center gap-2">
                  <span className="w-3 h-0.5 bg-level-line rounded" />
                  Portfolio Valuation
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="w-3 h-0.5 border-b border-dashed border-ink/50" />
                  Invested Capital
                </span>
              </div>
              <span className="font-mono text-2xs text-ink/70">{baseCurrency}</span>
            </div>
          </div>

          {/* Right (5 cols): Portfolio Allocation Donut */}
          <div className="lg:col-span-5 bg-paper border border-slate-700 shadow-ink/10 shadow-sm rounded-xl p-5 flex flex-col justify-between space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-ink">Asset Allocation</h3>
                <p className="text-xs text-ink/70 mt-0.5">
                  {activeDonutData.length} {chartViewMode === 'CATEGORY' ? 'categories' : 'asset classes'}
                </p>
              </div>

              <div className="flex items-center bg-mist border border-slate-700 rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setChartViewMode('CATEGORY');
                    setHoveredSliceIndex(null);
                  }}
                  className={`px-2.5 py-1 text-2xs font-semibold rounded-md transition-colors ${
                    chartViewMode === 'CATEGORY'
                      ? 'bg-ink text-paper'
                      : 'text-ink/70 hover:text-ink'
                  }`}
                >
                  Category
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setChartViewMode('BROAD');
                    setHoveredSliceIndex(null);
                  }}
                  className={`px-2.5 py-1 text-2xs font-semibold rounded-md transition-colors ${
                    chartViewMode === 'BROAD'
                      ? 'bg-ink text-paper'
                      : 'text-ink/70 hover:text-ink'
                  }`}
                >
                  Class
                </button>
              </div>
            </div>

            <div className="relative h-[180px] flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        const pct = totalValuation > 0 ? (data.value / totalValuation) * 100 : 0;
                        return (
                          <div className="bg-paper border border-slate-700 px-3 py-2 rounded-lg shadow-ink/10 text-xs font-mono">
                            <div className="font-semibold text-ink">{data.label}</div>
                            <div className="text-ink mt-0.5 tabular-nums">
                              {formatCurrency(data.value, baseCurrency, { compact: false, showDecimals: false })} ({pct.toFixed(1)}%)
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Pie
                    data={activeDonutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={56}
                    outerRadius={78}
                    paddingAngle={2.5}
                    dataKey="value"
                    onMouseEnter={(_, index) => setHoveredSliceIndex(index)}
                    onMouseLeave={() => setHoveredSliceIndex(null)}
                    stroke="#ffffff"
                    strokeWidth={2}
                  >
                    {activeDonutData.map((entry, index) => (
                      <Cell
                        key={`cell-${entry.key}`}
                        fill={entry.color}
                        opacity={hoveredSliceIndex === null || hoveredSliceIndex === index ? 1 : 0.35}
                        className="transition-opacity duration-150 cursor-pointer"
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>

              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
                {hoveredSliceIndex !== null && activeDonutData[hoveredSliceIndex] ? (
                  <>
                    <span
                      className="text-2xs font-mono font-semibold truncate max-w-[110px]"
                      style={{ color: activeDonutData[hoveredSliceIndex].color }}
                    >
                      {activeDonutData[hoveredSliceIndex].shortLabel}
                    </span>
                    <span className="text-sm font-bold font-mono text-ink tabular-nums mt-0.5">
                      {formatCurrency(activeDonutData[hoveredSliceIndex].value, baseCurrency, { compact: true })}
                    </span>
                    <span className="text-2xs font-mono text-ink/70">
                      {totalValuation > 0
                        ? `${((activeDonutData[hoveredSliceIndex].value / totalValuation) * 100).toFixed(1)}%`
                        : '0%'}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-2xs text-ink/70">Total</span>
                    <span className="text-sm font-bold font-mono text-ink tabular-nums mt-0.5">
                      {formatCurrency(totalValuation, baseCurrency, { compact: true })}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Clean Top Categories List (no nested boxes) */}
            <div className="space-y-2 max-h-[125px] overflow-y-auto pr-1 pt-2 border-t border-slate-700/60">
              {activeDonutData.map((item, index) => {
                const pct = totalValuation > 0 ? (item.value / totalValuation) * 100 : 0;
                return (
                  <div
                    key={item.key}
                    onMouseEnter={() => setHoveredSliceIndex(index)}
                    onMouseLeave={() => setHoveredSliceIndex(null)}
                    className="flex items-center justify-between gap-3 text-xs py-0.5 cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-ink/70 truncate">{item.label}</span>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0 font-mono tabular-nums">
                      <span className="text-ink">
                        {formatCurrency(item.value, baseCurrency, { compact: true })}
                      </span>
                      <span className="text-ink/70 w-11 text-right">{pct.toFixed(1)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Month-over-Month Net Growth Bar Chart (Full Width below Line & Donut Row) */}
          <div className="lg:col-span-12 bg-paper border border-slate-700 shadow-ink/10 shadow-sm rounded-xl p-5 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-ink">Month-over-Month Net Growth</h3>
                <p className="text-xs text-ink/70 mt-0.5">
                  Monthly portfolio value delta showing expansion months vs. pullbacks ({trendHorizon} horizon)
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs font-mono tabular-nums">
                <div>
                  <span className="text-ink/70">Avg MoM: </span>
                  <span className={`font-semibold ${momSummary.avgMonthlyGrowth >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                    {momSummary.avgMonthlyGrowth >= 0 ? '+' : ''}
                    {formatCurrency(momSummary.avgMonthlyGrowth, baseCurrency, { compact: true })}
                  </span>
                </div>
                {momSummary.bestMonth && (
                  <div>
                    <span className="text-ink/70">Best ({momSummary.bestMonth.month}): </span>
                    <span className="font-semibold text-emerald-700">
                      +{formatPercent(momSummary.bestMonth.netGrowthPct)}
                    </span>
                  </div>
                )}
                <div>
                  <span className="text-ink/70">Positive: </span>
                  <span className="font-semibold text-ink">
                    {momSummary.positiveMonths}/{visibleMomData.length} mo
                  </span>
                </div>
              </div>
            </div>

            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={visibleMomData} margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#D8E0EA" vertical={false} />
                  <XAxis
                    dataKey="month"
                    stroke="#14213d"
                    tick={{ fill: "#14213d", fontSize: 11, fontFamily: "JetBrains Mono, monospace" }}
                    tickLine={false}
                    axisLine={{ stroke: "#D8E0EA" }}
                    dy={6}
                  />
                  <YAxis
                    stroke="#14213d"
                    tick={{ fill: "#14213d", fontSize: 11, fontFamily: "JetBrains Mono, monospace" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => formatCurrency(val, baseCurrency, { compact: true })}
                    width={64}
                  />
                  <ReferenceLine y={0} stroke="#14213d" strokeWidth={1.25} />
                  <Tooltip
                    cursor={{ fill: "rgba(20, 33, 61, 0.05)" }}
                    content={<MomGrowthTooltip baseCurrency={baseCurrency} />}
                  />
                  <Bar dataKey="netGrowth" maxBarSize={42} radius={[4, 4, 4, 4]}>
                    {visibleMomData.map((entry) => (
                      <Cell
                        key={`mom-${entry.month}`}
                        fill={entry.netGrowth >= 0 ? "#02A26D" : "#d8454b"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-700/60 text-xs text-ink/70">
              <div className="flex items-center gap-4">
                <span className="inline-flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-sm bg-level-line shrink-0" />
                  Net Monthly Gain
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-sm bg-risk shrink-0" />
                  Monthly Pullback
                </span>
              </div>
              <span className="font-mono text-2xs text-ink/70">Hover bars for market vs. capital breakdown</span>
            </div>
          </div>
        </div>
      )}

      {/* 4. Focused Lower Workspace: Segmented Toggle between Holdings Ledger & Smart Insights */}
      <div className="bg-paper border border-slate-700 shadow-ink/10 shadow-sm rounded-xl overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 sm:px-5 border-b border-slate-700 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 bg-mist border border-slate-700 rounded-lg w-fit">
            <button
              type="button"
              onClick={() => setWorkspaceView('ledger')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                workspaceView === 'ledger'
                  ? 'bg-ink text-paper'
                  : 'text-ink/70 hover:text-ink'
              }`}
            >
              Holdings Ledger ({holdings.length})
            </button>
            <button
              type="button"
              onClick={() => setWorkspaceView('insights')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                workspaceView === 'insights'
                  ? 'bg-ink text-paper'
                  : 'text-ink/70 hover:text-ink'
              }`}
            >
              Insights & Alerts ({automatedInsights.length})
            </button>
          </div>

          {workspaceView === 'ledger' && holdings.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-ink/70" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search holdings..."
                  className="bg-mist border border-slate-700 text-xs rounded-lg pl-8 pr-3 py-1.5 text-ink placeholder-ink/60 focus:outline-none focus:border-emerald-500 w-44 sm:w-56"
                />
              </div>

              <select
                aria-label="Filter Holdings by Asset Class"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-mist border border-slate-700 text-ink/70 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="ALL">All Asset Classes</option>
                <option value="SURGE_30D">30-Day Gainers (&gt;15%)</option>
                <option value="MATURED">Matured / Near Maturity</option>
                <option value="EQUITY">Equities & Mutual Funds</option>
                <option value="DEBT">Fixed Deposits & Bonds</option>
                <option value="GOLD">Sovereign Gold Bonds</option>
                <option value="RETIREMENT">EPF, PPF & NPS</option>
                <option value="CASH">Savings & Cash</option>
              </select>

              <button
                type="button"
                onClick={() => exportHoldingsToExcel(holdings, baseCurrency)}
                title="Save portfolio as Excel (.xlsx) to re-import later"
                className="px-2.5 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-500/10 hover:bg-emerald-500/20 hover:text-emerald-800 border border-emerald-500/35 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5 shrink-0" />
                <span>Export .xlsx</span>
              </button>

              <button
                type="button"
                onClick={() => exportHoldingsToCsv(holdings)}
                title="Save portfolio as CSV (.csv) to re-import later"
                className="px-2.5 py-1.5 text-xs font-medium text-ink bg-mist hover:bg-ink/5 border border-slate-700 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5 text-debt shrink-0" />
                <span>Export .csv</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  generatePortfolioPdfReport({
                    holdings,
                    baseCurrency,
                    portfolioMode,
                    profileName,
                  })
                }
                title="Download printable PDF wealth report with charts & summary stats"
                className="px-2.5 py-1.5 text-xs font-medium text-ink bg-mist hover:bg-ink/5 border border-slate-700 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <FileText className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span>Export .pdf</span>
              </button>
            </div>
          )}
        </div>

        {/* View A: Clean Holdings Ledger */}
        {workspaceView === 'ledger' && (
          <>
            {holdings.length === 0 ? (
              <div className="py-14 px-6 text-center max-w-md mx-auto">
                <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-700 mx-auto mb-3">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <h3 className="text-base font-semibold text-ink">You haven't added any investments yet.</h3>
                <p className="text-xs text-ink/70 mt-1.5 leading-relaxed">
                  Add your holdings one by one or import a statement — your numbers stay on this device.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3 mt-5">
                  <button
                    type="button"
                    onClick={onOpenAddModal}
                    className="px-4 py-2 text-xs font-semibold text-white bg-emerald-500 hover:bg-emerald-700 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add holding
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenValidateModal('excel')}
                    className="px-4 py-2 text-xs font-medium text-ink bg-mist hover:bg-ink/5 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    Import a file
                  </button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-mist text-ink/70 border-b border-slate-700 font-mono text-2xs uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4 font-medium">Instrument</th>
                      <th className="py-3 px-4 font-medium">Category</th>
                      <th className="py-3 px-4 text-right font-medium">Invested</th>
                      <th className="py-3 px-4 text-right font-medium">Current Value</th>
                      <th className="py-3 px-4 text-right font-medium">Return</th>
                      <th className="py-3 px-4 font-medium">Maturity</th>
                      <th className="py-3 px-4 text-center font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/60">
                    {filteredHoldings.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-10 text-center text-ink/70">
                          No holdings match your search filter.
                        </td>
                      </tr>
                    ) : (
                      filteredHoldings.map((h) => {
                        const valInBase = convertCurrency(h.currentValue, h.currency, baseCurrency);
                        const invInBase = convertCurrency(h.investedAmount, h.currency, baseCurrency);
                        const gainInBase = valInBase - invInBase;
                        const gain30d = getHolding30DayGainPct(h);
                        const isSurge30d = gain30d !== undefined && gain30d > 15;
                        const isMat = h.isMatured || (h.daysToMaturity !== undefined && h.daysToMaturity <= 0);
                        const isSoon =
                          !isMat && h.daysToMaturity !== undefined && h.daysToMaturity > 0 && h.daysToMaturity <= 30;

                        return (
                          <tr
                            key={h.id}
                            className={`hover:bg-ink/5 transition-colors ${
                              isMat ? 'bg-amber-500/10' : isSurge30d ? 'bg-emerald-500/5' : ''
                            }`}
                          >
                            <td className="py-4 px-4">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-medium text-ink">
                                  {h.name}
                                  {h.currency !== baseCurrency && (
                                    <span className="ml-1.5 text-2xs font-mono text-ink/70">
                                      ({h.currency})
                                    </span>
                                  )}
                                </span>
                                {isSurge30d && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/35 text-emerald-700 text-2xs font-mono font-semibold whitespace-nowrap tabular-nums">
                                    <TrendingUp className="w-3 h-3 shrink-0" />
                                    <span>+{gain30d.toFixed(1)}% (30d)</span>
                                  </span>
                                )}
                              </div>
                              <div className="text-ink/70 text-2xs mt-0.5">
                                {h.institution}
                                {h.accountNumberMask ? ` · ${h.accountNumberMask}` : ''}
                              </div>
                            </td>

                            <td className="py-4 px-4 text-ink/70">
                              <span>{CATEGORY_META[h.category]?.shortLabel ?? h.category.replace('_', ' ')}</span>
                              {h.interestRatePct !== undefined && (
                                <span className="block text-2xs text-ink/70 font-mono">
                                  {h.interestRatePct}% p.a.
                                </span>
                              )}
                            </td>

                            <td className="py-4 px-4 text-right font-mono text-ink/70 tabular-nums">
                              {formatCurrency(invInBase, baseCurrency, { showDecimals: false })}
                            </td>

                            <td className="py-4 px-4 text-right font-mono font-medium text-ink tabular-nums">
                              {formatCurrency(valInBase, baseCurrency, { showDecimals: false })}
                            </td>

                            <td className="py-4 px-4 text-right font-mono tabular-nums">
                              <div
                                className={`font-semibold ${
                                  gainInBase >= 0 ? 'text-emerald-700' : 'text-rose-700'
                                }`}
                              >
                                {formatPercent(h.unrealizedGainPct)}
                              </div>
                              <div className="text-2xs text-ink/70">
                                {formatCurrency(gainInBase, baseCurrency, { compact: true })}
                              </div>
                            </td>

                            <td className="py-4 px-4">
                              {isMat ? (
                                <span className="text-amber-700 font-medium">Matured</span>
                              ) : isSoon ? (
                                <span className="text-amber-700 font-medium">In {h.daysToMaturity}d</span>
                              ) : h.maturityDate ? (
                                <span className="text-ink/70 text-2xs font-mono">{h.maturityDate}</span>
                              ) : (
                                <span className="text-ink/70 text-2xs">Open-ended</span>
                              )}
                            </td>

                            <td className="py-4 px-4 text-center">
                              <div className="inline-flex items-center justify-center gap-1.5">
                                {isMat ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onRebalanceHolding
                                          ? onRebalanceHolding(h)
                                          : onSelectHoldingToReinvest(h)
                                      }
                                      className="px-2.5 py-1 text-2xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded transition-colors whitespace-nowrap"
                                      title="Reinvest or diversify matured capital across market instruments or debt payoff"
                                    >
                                      Reinvest
                                    </button>
                                    {onEditHolding && (
                                      <button
                                        type="button"
                                        onClick={() => onEditHolding(h)}
                                        className="p-1.5 text-ink/70 hover:text-emerald-700 hover:bg-emerald-500/10 rounded transition-colors"
                                        title="Edit Holding"
                                        aria-label={`Edit ${h.name}`}
                                      >
                                        <Pencil className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => onDeleteHolding(h.id)}
                                      className="p-1.5 text-ink/70 hover:text-rose-600 transition-colors"
                                      title="Delete Holding"
                                      aria-label={`Delete ${h.name}`}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    {onRebalanceHolding && (
                                      <button
                                        type="button"
                                        onClick={() => onRebalanceHolding(h)}
                                        className="px-2 py-1 text-2xs font-medium text-emerald-700 hover:text-emerald-800 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/35 rounded transition-colors inline-flex items-center gap-1 whitespace-nowrap"
                                        title="Break partial/full amount & move into Market MFs, Bonds, FDs, Stocks or Home Loan"
                                      >
                                        <Shuffle className="w-3 h-3 shrink-0" />
                                        <span>Move</span>
                                      </button>
                                    )}
                                    {onEditHolding && (
                                      <button
                                        type="button"
                                        onClick={() => onEditHolding(h)}
                                        className="p-1.5 text-ink/70 hover:text-emerald-700 hover:bg-emerald-500/10 rounded transition-colors"
                                        title="Edit Holding"
                                        aria-label={`Edit ${h.name}`}
                                      >
                                        <Pencil className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => onDeleteHolding(h.id)}
                                      className="p-1.5 text-ink/70 hover:text-rose-600 transition-colors"
                                      title="Delete Holding"
                                      aria-label={`Delete ${h.name}`}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* View B: Actionable Insights & Alerts */}
        {workspaceView === 'insights' && (
          <div className="p-5">
            {holdings.length === 0 ? (
              <div className="py-8 text-center text-xs text-ink/70">
                Add or upload holdings to generate automated tax, maturity, and concentration insights.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {automatedInsights.map((insight) => (
                  <button
                    type="button"
                    key={insight.id}
                    onClick={() => insight.tabTarget && onNavigateToTab(insight.tabTarget)}
                    className="text-left bg-mist/70 border border-slate-700 rounded-xl p-4 hover:border-emerald-500/45 transition-colors flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 text-2xs font-mono">
                        <span
                          className={`font-semibold ${
                            insight.type === 'CRITICAL'
                              ? 'text-rose-700'
                              : insight.type === 'WARNING'
                              ? 'text-amber-800'
                              : insight.type === 'OPPORTUNITY'
                              ? 'text-emerald-700'
                              : 'text-emerald-700'
                          }`}
                        >
                          {insight.type}
                        </span>
                        {insight.metric && (
                          <span className="text-ink font-semibold tabular-nums">
                            {insight.metric}
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-medium text-ink mt-2 group-hover:text-emerald-700 transition-colors">
                        {insight.title}
                      </h4>
                      <p className="text-xs text-ink/70 mt-1.5 leading-relaxed">
                        {insight.description}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-700 flex items-center justify-between text-xs text-emerald-700 font-medium">
                      <span>{insight.actionableText}</span>
                      <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Footer quick restart action */}
        {holdings.length > 0 && (
          <div className="px-5 py-3 border-t border-slate-700 bg-mist flex flex-wrap items-center justify-between gap-2 text-xs text-ink/70">
            <span>Want to test with your own numbers instead?</span>
            <button
              type="button"
              onClick={() => onOpenValidateModal('excel')}
              className="text-emerald-700 hover:text-emerald-800 font-medium inline-flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Restart & Validate Portfolio
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
