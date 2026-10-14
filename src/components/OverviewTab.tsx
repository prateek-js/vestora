import React, { useState, useMemo } from 'react';
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
} from 'lucide-react';

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

      {/* 3. Asset Allocation Distribution Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Portfolio Asset Distribution</h3>
          <span className="text-xs text-slate-400">Base Currency: {baseCurrency}</span>
        </div>

        {/* Proportional Multi-Segment Bar */}
        <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden flex">
          {Object.entries(categoryStats).map(([key, data]) => {
            const pct = totalValuation > 0 ? (data.amount / totalValuation) * 100 : 0;
            if (pct <= 0) return null;

            const bgClass =
              key === 'EQUITY'
                ? 'bg-indigo-500'
                : key === 'FIXED_INCOME'
                ? 'bg-sky-500'
                : key === 'GOLD'
                ? 'bg-amber-400'
                : key === 'RETIREMENT'
                ? 'bg-emerald-500'
                : 'bg-slate-400';

            return (
              <div
                key={key}
                style={{ width: `${pct}%` }}
                className={`${bgClass} transition-all duration-300 relative group`}
                title={`${data.label}: ${pct.toFixed(1)}%`}
              />
            );
          })}
        </div>

        {/* Legend Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-2 text-xs">
          {Object.entries(categoryStats).map(([key, data]) => {
            const pct = totalValuation > 0 ? (data.amount / totalValuation) * 100 : 0;
            const dotClass =
              key === 'EQUITY'
                ? 'bg-indigo-500'
                : key === 'FIXED_INCOME'
                ? 'bg-sky-500'
                : key === 'GOLD'
                ? 'bg-amber-400'
                : key === 'RETIREMENT'
                ? 'bg-emerald-500'
                : 'bg-slate-400';

            return (
              <div key={key} className="space-y-0.5">
                <div className="flex items-center gap-1.5 text-slate-400">
                  <span className={`w-2 h-2 rounded-full ${dotClass}`} />
                  <span className="truncate">{data.label.split('&')[0]}</span>
                </div>
                <div className="font-mono font-medium text-white tabular-nums flex items-center justify-between">
                  <span>{formatCurrency(data.amount, baseCurrency, { compact: true })}</span>
                  <span className="text-slate-400 text-2xs">{pct.toFixed(1)}%</span>
                </div>
              </div>
            );
          })}
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
