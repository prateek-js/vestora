import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from 'recharts';
import { AssetCategory, CurrencyCode, Holding } from '../types/wealth';
import { convertCurrency, formatCurrency, formatPercent } from '../utils/currency';
import { generateAutomatedInsights } from '../utils/taxAndDiversification';
import {
  TrendingUp,
  AlertTriangle,
  Clock,
  Search,
  Filter,
  ArrowUpRight,
  ShieldCheck,
  ChevronRight,
  Sparkles,
  Trash2,
  RefreshCw,
  Info,
  PieChart as PieChartIcon,
  Layers,
} from 'lucide-react';

const CATEGORY_META: Record<AssetCategory, { label: string; shortLabel: string; color: string }> = {
  MUTUAL_FUND: { label: 'Mutual Funds', shortLabel: 'Mutual Funds', color: '#6366f1' }, // Indigo 500
  EQUITY_STOCK: { label: 'Direct Equities (Demat)', shortLabel: 'Equities', color: '#8b5cf6' }, // Violet 500
  FIXED_DEPOSIT: { label: 'Fixed Deposits (FD)', shortLabel: 'Fixed Deposits', color: '#0ea5e9' }, // Sky 500
  RECURRING_DEPOSIT: { label: 'Recurring Deposits (RD)', shortLabel: 'Recurring Deposits', color: '#38bdf8' }, // Sky 400
  CORP_BOND: { label: 'Corporate Bonds', shortLabel: 'Corporate Bonds', color: '#06b6d4' }, // Cyan 500
  GOVT_BOND: { label: 'Government Bonds (G-Sec)', shortLabel: 'Govt Bonds', color: '#14b8a6' }, // Teal 500
  SOVEREIGN_GOLD_BOND: { label: 'Sovereign Gold Bonds (SGB)', shortLabel: 'Sovereign Gold', color: '#f59e0b' }, // Amber 500
  EPF: { label: 'Employees Provident Fund (EPF)', shortLabel: 'EPF', color: '#10b981' }, // Emerald 500
  PPF: { label: 'Public Provident Fund (PPF)', shortLabel: 'PPF', color: '#059669' }, // Emerald 600
  NPS: { label: 'National Pension System (NPS)', shortLabel: 'NPS', color: '#84cc16' }, // Lime 500
  SAVINGS_CASH: { label: 'Liquid Savings & Cash', shortLabel: 'Savings Cash', color: '#94a3b8' }, // Slate 400
};

interface OverviewTabProps {
  holdings: Holding[];
  baseCurrency: CurrencyCode;
  onNavigateToTab: (tab: 'radar' | 'tax' | 'simulator' | 'overview') => void;
  onSelectHoldingToReinvest: (holding: Holding) => void;
  onDeleteHolding: (id: string) => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  holdings,
  baseCurrency,
  onNavigateToTab,
  onSelectHoldingToReinvest,
  onDeleteHolding,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [chartViewMode, setChartViewMode] = useState<'CATEGORY' | 'BROAD'>('CATEGORY');
  const [hoveredSliceIndex, setHoveredSliceIndex] = useState<number | null>(null);

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
      EQUITY: { label: 'Equities & Mutual Funds', amount: 0, count: 0 },
      FIXED_INCOME: { label: 'Fixed Deposits, RDs & Bonds', amount: 0, count: 0 },
      GOLD: { label: 'Sovereign Gold Bonds (SGB)', amount: 0, count: 0 },
      RETIREMENT: { label: 'EPF, PPF & NPS Retirement', amount: 0, count: 0 },
      CASH: { label: 'Liquid Savings Cash', amount: 0, count: 0 },
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
        color: '#94a3b8',
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
            ? '#6366f1'
            : key === 'FIXED_INCOME'
            ? '#0ea5e9'
            : key === 'GOLD'
            ? '#f59e0b'
            : key === 'RETIREMENT'
            ? '#10b981'
            : '#94a3b8';

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

  // Filtered Holdings
  const filteredHoldings = useMemo(() => {
    return holdings.filter((h) => {
      const matchesSearch =
        h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        h.institution.toLowerCase().includes(searchQuery.toLowerCase()) ||
        h.category.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (selectedCategory === 'ALL') return true;
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
      if (selectedCategory === 'GOLD') {
        return h.category === 'SOVEREIGN_GOLD_BOND';
      }
      if (selectedCategory === 'RETIREMENT') {
        return h.category === 'EPF' || h.category === 'PPF' || h.category === 'NPS';
      }
      if (selectedCategory === 'CASH') {
        return h.category === 'SAVINGS_CASH';
      }

      return true;
    });
  }, [holdings, searchQuery, selectedCategory]);

  return (
    <div className="space-y-6">
      {/* 1. Urgent Action Banner for Maturing Capital */}
      {(maturedHoldings.length > 0 || maturingSoonHoldings.length > 0) && (
        <div className="bg-slate-900 border border-amber-500/40 rounded-xl p-4 sm:p-5 shadow-lg relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-white">
                    {maturedHoldings.length > 0
                      ? `${maturedHoldings.length} Matured Investment${maturedHoldings.length > 1 ? 's' : ''} Require Immediate Reinvestment`
                      : `${maturingSoonHoldings.length} Investment${maturingSoonHoldings.length > 1 ? 's' : ''} Maturing Shortly`}
                  </h3>
                  <span className="text-xs text-amber-400 font-mono">
                    {formatCurrency(totalMaturedAmount, baseCurrency, { compact: true })} Ready
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                  {maturedHoldings.length > 0
                    ? `${maturedHoldings.map((h) => h.name).join(', ')} has matured and is currently sitting idle. Deploy into curated solutions (Guaranteed, Low, Moderate, or High risk) to avoid yield drag.`
                    : `${maturingSoonHoldings[0]?.name} matures within ${maturingSoonHoldings[0]?.daysToMaturity} days. Pre-plan your reinvestment strategy to transition seamlessly.`}
                </p>
              </div>
            </div>

            <button
              onClick={() => onNavigateToTab('radar')}
              className="px-4 py-2.5 text-xs font-medium text-slate-900 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors flex items-center justify-center gap-2 shrink-0 font-semibold shadow-sm"
            >
              <span>Explore 8 Curated Solutions</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 2. Primary KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Net Worth */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 sm:p-5">
          <div className="text-xs font-medium text-slate-400">Total Net Worth</div>
          <div className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-white mt-1.5 tabular-nums">
            {formatCurrency(totalValuation, baseCurrency, { compact: false, showDecimals: false })}
          </div>
          <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
            <span>Invested: {formatCurrency(totalInvested, baseCurrency, { compact: true })}</span>
          </div>
        </div>

        {/* Absolute Returns & ROI */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 sm:p-5">
          <div className="text-xs font-medium text-slate-400">Total Unrealized Gains</div>
          <div
            className={`text-xl sm:text-2xl font-bold font-mono tracking-tight mt-1.5 tabular-nums ${
              totalGain >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {formatCurrency(totalGain, baseCurrency, { compact: false, showDecimals: false })}
          </div>
          <div className="text-xs mt-1 flex items-center gap-1.5 font-mono">
            <span
              className={`font-semibold ${totalGain >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
            >
              {formatPercent(totalGainPct)}
            </span>
            <span className="text-slate-500">all-time ROI</span>
          </div>
        </div>

        {/* Matured Capital Radar */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 sm:p-5">
          <div className="text-xs font-medium text-slate-400">Matured / Due In 30d</div>
          <div className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-amber-400 mt-1.5 tabular-nums">
            {formatCurrency(totalMaturedAmount, baseCurrency, { compact: false, showDecimals: false })}
          </div>
          <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
            <span>{maturedHoldings.length} matured · {maturingSoonHoldings.length} upcoming</span>
          </div>
        </div>

        {/* Total Active Assets Count */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 sm:p-5">
          <div className="text-xs font-medium text-slate-400">Active Instruments</div>
          <div className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-white mt-1.5 tabular-nums">
            {holdings.length} <span className="text-xs font-normal text-slate-400">Holdings</span>
          </div>
          <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
            <span>Across 5 asset classes</span>
          </div>
        </div>
      </div>

      {/* 3. Asset Allocation & Donut Chart Visualization */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
              <PieChartIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Portfolio Distribution by Asset Category</h3>
              <p className="text-2xs text-slate-400 mt-0.5">
                Detailed breakdown of {holdings.length} holdings across {activeDonutData.length} distinct {chartViewMode === 'CATEGORY' ? 'categories' : 'asset classes'}.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-2xs font-mono text-slate-500 hidden sm:inline">Group by:</span>
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => {
                  setChartViewMode('CATEGORY');
                  setHoveredSliceIndex(null);
                }}
                className={`px-2.5 py-1 text-2xs font-medium rounded transition-colors ${
                  chartViewMode === 'CATEGORY'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Asset Category
              </button>
              <button
                type="button"
                onClick={() => {
                  setChartViewMode('BROAD');
                  setHoveredSliceIndex(null);
                }}
                className={`px-2.5 py-1 text-2xs font-medium rounded transition-colors ${
                  chartViewMode === 'BROAD'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Broad Classes
              </button>
            </div>
          </div>
        </div>

        {/* Donut Chart & Category Breakdown Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Donut Chart with Interactive Center Readout */}
          <div className="lg:col-span-5 relative flex items-center justify-center min-h-[260px]">
            <div className="w-full h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        const pct = totalValuation > 0 ? (data.value / totalValuation) * 100 : 0;
                        return (
                          <div className="bg-slate-950/95 border border-slate-700/80 px-3 py-2 rounded-lg shadow-xl text-xs font-mono backdrop-blur-xs">
                            <div className="flex items-center gap-2">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: data.color }}
                              />
                              <span className="font-semibold text-white">{data.label}</span>
                            </div>
                            <div className="mt-1 text-slate-200 font-bold tabular-nums">
                              {formatCurrency(data.value, baseCurrency, { compact: false })}
                            </div>
                            <div className="text-2xs text-slate-400 mt-0.5">
                              {pct.toFixed(1)}% of total · {data.count} {data.count === 1 ? 'holding' : 'holdings'}
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
                    innerRadius={70}
                    outerRadius={98}
                    paddingAngle={3}
                    dataKey="value"
                    onMouseEnter={(_, index) => setHoveredSliceIndex(index)}
                    onMouseLeave={() => setHoveredSliceIndex(null)}
                    stroke="#0b0f19"
                    strokeWidth={2}
                  >
                    {activeDonutData.map((entry, index) => (
                      <Cell
                        key={`cell-${entry.key}`}
                        fill={entry.color}
                        opacity={hoveredSliceIndex === null || hoveredSliceIndex === index ? 1 : 0.4}
                        className="transition-opacity duration-200 cursor-pointer"
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Central Donut Readout */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
              {hoveredSliceIndex !== null && activeDonutData[hoveredSliceIndex] ? (
                <>
                  <span
                    className="text-2xs font-mono font-bold uppercase truncate max-w-[130px]"
                    style={{ color: activeDonutData[hoveredSliceIndex].color }}
                  >
                    {activeDonutData[hoveredSliceIndex].shortLabel}
                  </span>
                  <span className="text-base sm:text-lg font-bold font-mono text-white tabular-nums tracking-tight mt-0.5">
                    {formatCurrency(activeDonutData[hoveredSliceIndex].value, baseCurrency, { compact: true })}
                  </span>
                  <span className="text-2xs font-mono text-slate-400">
                    {totalValuation > 0
                      ? `${((activeDonutData[hoveredSliceIndex].value / totalValuation) * 100).toFixed(1)}%`
                      : '0%'}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-2xs font-mono text-slate-400 uppercase tracking-wider">
                    Total Value
                  </span>
                  <span className="text-base sm:text-lg font-bold font-mono text-white tabular-nums tracking-tight mt-0.5">
                    {formatCurrency(totalValuation, baseCurrency, { compact: true })}
                  </span>
                  <span className="text-2xs font-mono text-slate-500">
                    {activeDonutData.length} {chartViewMode === 'CATEGORY' ? 'Categories' : 'Classes'}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Right Column: Ranked Category List with Progress Bars */}
          <div className="lg:col-span-7 space-y-2 max-h-[280px] overflow-y-auto pr-1">
            {activeDonutData.map((item, index) => {
              const pct = totalValuation > 0 ? (item.value / totalValuation) * 100 : 0;
              const isHovered = hoveredSliceIndex === index;

              return (
                <div
                  key={item.key}
                  onMouseEnter={() => setHoveredSliceIndex(index)}
                  onMouseLeave={() => setHoveredSliceIndex(null)}
                  className={`p-2.5 rounded-lg border transition-all cursor-pointer ${
                    isHovered
                      ? 'bg-slate-800/80 border-slate-700'
                      : 'bg-slate-950/40 border-slate-800/60 hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="font-medium text-slate-200 truncate">{item.label}</span>
                      <span className="text-2xs font-mono text-slate-500 shrink-0">
                        ({item.count} {item.count === 1 ? 'holding' : 'holdings'})
                      </span>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 font-mono text-xs">
                      <span className="font-semibold text-white tabular-nums">
                        {formatCurrency(item.value, baseCurrency, { compact: false })}
                      </span>
                      <span className="text-slate-400 font-bold tabular-nums w-12 text-right">
                        {pct.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  {/* Micro Progress Bar */}
                  <div className="w-full h-1 bg-slate-800/80 rounded-full overflow-hidden mt-1.5">
                    <div
                      style={{ width: `${pct}%`, backgroundColor: item.color }}
                      className="h-full rounded-full transition-all duration-300"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Consolidated Proportional Horizontal Strip at Bottom */}
        <div className="pt-2 border-t border-slate-800/70">
          <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden flex">
            {activeDonutData.map((item, index) => {
              const pct = totalValuation > 0 ? (item.value / totalValuation) * 100 : 0;
              if (pct <= 0) return null;
              return (
                <div
                  key={item.key}
                  style={{ width: `${pct}%`, backgroundColor: item.color }}
                  className={`h-full transition-opacity duration-200 ${
                    hoveredSliceIndex === null || hoveredSliceIndex === index ? 'opacity-100' : 'opacity-40'
                  }`}
                  title={`${item.label}: ${pct.toFixed(1)}%`}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* 4. Automated Insights Strip */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-semibold text-white">Automated Portfolio Intelligence</h3>
          </div>
          <span className="text-xs text-slate-400">Real-time heuristics</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {automatedInsights.slice(0, 3).map((insight) => (
            <div
              key={insight.id}
              onClick={() => insight.tabTarget && onNavigateToTab(insight.tabTarget)}
              className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-all cursor-pointer flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-2xs font-mono font-semibold uppercase tracking-wider ${
                      insight.type === 'CRITICAL'
                        ? 'text-rose-400'
                        : insight.type === 'WARNING'
                        ? 'text-amber-400'
                        : insight.type === 'OPPORTUNITY'
                        ? 'text-emerald-400'
                        : 'text-indigo-400'
                    }`}
                  >
                    {insight.type}
                  </span>
                  {insight.metric && (
                    <span className="text-xs font-mono font-bold text-white bg-slate-800/80 px-2 py-0.5 rounded">
                      {insight.metric}
                    </span>
                  )}
                </div>
                <h4 className="text-sm font-medium text-slate-100 mt-2 group-hover:text-indigo-400 transition-colors">
                  {insight.title}
                </h4>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                  {insight.description}
                </p>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between text-xs text-indigo-400 font-medium">
                <span>{insight.actionableText}</span>
                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 5. Comprehensive Investment Ledger Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-white">Investment Asset Ledger</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Consolidated holdings across mutual funds, demat, fixed income, PF, NPS, and bullion.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search holdings..."
                className="bg-slate-950 border border-slate-800 text-xs rounded-lg pl-8 pr-3 py-1.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-44 sm:w-56"
              />
            </div>

            {/* Category Filter Pills */}
            <select
              aria-label="Filter Holdings by Asset Class"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="ALL">All Asset Classes</option>
              <option value="MATURED">Matured / Near Maturity</option>
              <option value="EQUITY">Equities & Mutual Funds</option>
              <option value="DEBT">Fixed Deposits & Bonds</option>
              <option value="GOLD">Sovereign Gold Bonds</option>
              <option value="RETIREMENT">EPF, PPF & NPS</option>
              <option value="CASH">Savings & Cash</option>
            </select>
          </div>
        </div>

        {/* Table Body */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800 uppercase font-mono text-2xs tracking-wider">
              <tr>
                <th className="py-3 px-4">Instrument & Institution</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-right">Invested</th>
                <th className="py-3 px-4 text-right">Current Valuation</th>
                <th className="py-3 px-4 text-right">Gain / ROI</th>
                <th className="py-3 px-4">Maturity Status</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredHoldings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    No investments match your current filters.
                  </td>
                </tr>
              ) : (
                filteredHoldings.map((h) => {
                  const valInBase = convertCurrency(h.currentValue, h.currency, baseCurrency);
                  const invInBase = convertCurrency(h.investedAmount, h.currency, baseCurrency);
                  const gainInBase = valInBase - invInBase;
                  const isMat = h.isMatured || (h.daysToMaturity !== undefined && h.daysToMaturity <= 0);
                  const isSoon = !isMat && h.daysToMaturity !== undefined && h.daysToMaturity > 0 && h.daysToMaturity <= 30;

                  return (
                    <tr
                      key={h.id}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        isMat ? 'bg-amber-950/15' : ''
                      }`}
                    >
                      {/* Name & Account */}
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-100 flex items-center gap-1.5">
                          <span>{h.name}</span>
                          {h.currency !== baseCurrency && (
                            <span className="text-2xs font-mono text-slate-400 bg-slate-800 px-1 py-0.2 rounded">
                              {h.currency}
                            </span>
                          )}
                        </div>
                        <div className="text-slate-500 text-2xs mt-0.5 flex items-center gap-1.5">
                          <span>{h.institution}</span>
                          {h.accountNumberMask && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono">{h.accountNumberMask}</span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-4 text-slate-300">
                        <span className="text-slate-300 font-medium">
                          {h.category.replace('_', ' ')}
                        </span>
                        {h.interestRatePct && (
                          <div className="text-2xs text-slate-400 font-mono">
                            {h.interestRatePct}% p.a.
                          </div>
                        )}
                      </td>

                      {/* Invested Amount */}
                      <td className="py-3.5 px-4 text-right font-mono text-slate-300 tabular-nums">
                        {formatCurrency(invInBase, baseCurrency, { showDecimals: false })}
                      </td>

                      {/* Current Valuation */}
                      <td className="py-3.5 px-4 text-right font-mono font-medium text-slate-100 tabular-nums">
                        {formatCurrency(valInBase, baseCurrency, { showDecimals: false })}
                      </td>

                      {/* Gain / ROI */}
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                        <div
                          className={`font-semibold ${
                            gainInBase >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {formatPercent(h.unrealizedGainPct)}
                        </div>
                        <div className="text-2xs text-slate-500">
                          {formatCurrency(gainInBase, baseCurrency, { compact: true })}
                        </div>
                      </td>

                      {/* Maturity Status */}
                      <td className="py-3.5 px-4">
                        {isMat ? (
                          <div className="text-amber-400 font-semibold flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Matured (Ready)</span>
                          </div>
                        ) : isSoon ? (
                          <div className="text-amber-300 font-medium flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            <span>In {h.daysToMaturity} days</span>
                          </div>
                        ) : h.maturityDate ? (
                          <div className="text-slate-400 text-2xs font-mono">
                            {h.maturityDate}
                          </div>
                        ) : (
                          <span className="text-slate-500 text-2xs">Perpetual / Open</span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {isMat ? (
                            <button
                              onClick={() => onSelectHoldingToReinvest(h)}
                              className="px-2.5 py-1 text-2xs font-semibold bg-amber-400 hover:bg-amber-300 text-slate-950 rounded transition-colors"
                            >
                              Reinvest
                            </button>
                          ) : (
                            <button
                              onClick={() => onDeleteHolding(h.id)}
                              className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                              title="Delete Holding"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
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
      </div>
    </div>
  );
};
