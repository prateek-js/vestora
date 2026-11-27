import React, { useState, useMemo } from 'react';
import { Holding, ReinvestmentSolution, RiskProfile } from '../types/wealth';
import { CURATED_REINVESTMENT_SOLUTIONS } from '../data/mockData';
import { formatCurrency } from '../utils/currency';
import {
  Clock,
  Shield,
  ShieldCheck,
  TrendingUp,
  Flame,
  ArrowRight,
  Sparkles,
  Calendar,
  Shuffle,
} from 'lucide-react';

type MaturityWindowFilter = 'ALL' | 'URGENT_30' | 'WINDOW_60' | 'WINDOW_90' | 'BEYOND_90';

interface TimelineEntry {
  holding: Holding;
  days: number;
  isMatured: boolean;
  windowKey: Exclude<MaturityWindowFilter, 'ALL'>;
  windowLabel: string;
  barWidthPct: number;
  valueInBase: number;
}

function getEffectiveDaysToMaturity(holding: Holding): number | undefined {
  if (typeof holding.daysToMaturity === 'number' && !Number.isNaN(holding.daysToMaturity)) {
    return holding.daysToMaturity;
  }
  if (holding.maturityDate) {
    const parsed = Date.parse(holding.maturityDate);
    if (!Number.isNaN(parsed)) {
      const todayMidnight = new Date();
      todayMidnight.setHours(0, 0, 0, 0);
      return Math.round((parsed - todayMidnight.getTime()) / 86_400_000);
    }
  }
  if (holding.isMatured) return 0;
  return undefined;
}

function getTimelineBarWidthPct(days: number): number {
  if (days <= 0) return 5;
  if (days <= 30) return Math.max(5, (days / 30) * 25);
  if (days <= 60) return 25 + ((days - 30) / 30) * 25;
  if (days <= 90) return 50 + ((days - 60) / 30) * 25;
  const clamped = Math.min(days, 730);
  return 75 + ((clamped - 90) / (730 - 90)) * 23;
}

interface MaturityRadarTabProps {
  holdings: Holding[];
  onDeploySolution: (holding: Holding, solution: ReinvestmentSolution) => void;
  onOpenMarketRebalance?: (holding: Holding) => void;
}

export const MaturityRadarTab: React.FC<MaturityRadarTabProps> = ({
  holdings,
  onDeploySolution,
  onOpenMarketRebalance,
}) => {
  const [selectedRiskTier, setSelectedRiskTier] = useState<RiskProfile | 'ALL'>('ALL');
  const [selectedHoldingId, setSelectedHoldingId] = useState<string>('');
  const [timelineFilter, setTimelineFilter] = useState<MaturityWindowFilter>('ALL');

  // Compute Maturity Timeline entries for all holdings with a maturity date or daysToMaturity
  const { timelineEntries, openEndedCount, bucketTotals } = useMemo(() => {
    const entries: TimelineEntry[] = [];
    let openEnded = 0;

    const totals = {
      urgent30Count: 0,
      urgent30Value: 0,
      window60Count: 0,
      window60Value: 0,
      window90Count: 0,
      window90Value: 0,
      beyond90Count: 0,
      beyond90Value: 0,
    };

    holdings.forEach((h) => {
      const days = getEffectiveDaysToMaturity(h);
      if (days === undefined) {
        openEnded += 1;
        return;
      }

      const isMat = Boolean(h.isMatured) || days <= 0;
      const valueInBase = h.currentValue;

      let windowKey: Exclude<MaturityWindowFilter, 'ALL'> = 'BEYOND_90';
      let windowLabel = '> 90 days';

      if (isMat || days <= 30) {
        windowKey = 'URGENT_30';
        windowLabel = isMat ? 'Matured' : 'Next 30d';
        totals.urgent30Count += 1;
        totals.urgent30Value += valueInBase;
      } else if (days <= 60) {
        windowKey = 'WINDOW_60';
        windowLabel = '31–60d';
        totals.window60Count += 1;
        totals.window60Value += valueInBase;
      } else if (days <= 90) {
        windowKey = 'WINDOW_90';
        windowLabel = '61–90d';
        totals.window90Count += 1;
        totals.window90Value += valueInBase;
      } else {
        totals.beyond90Count += 1;
        totals.beyond90Value += valueInBase;
      }

      entries.push({
        holding: h,
        days,
        isMatured: isMat,
        windowKey,
        windowLabel,
        barWidthPct: getTimelineBarWidthPct(days),
        valueInBase,
      });
    });

    entries.sort((a, b) => a.days - b.days);

    return {
      timelineEntries: entries,
      openEndedCount: openEnded,
      bucketTotals: totals,
    };
  }, [holdings]);

  const visibleTimelineEntries = useMemo(() => {
    if (timelineFilter === 'ALL') return timelineEntries;
    return timelineEntries.filter((entry) => entry.windowKey === timelineFilter);
  }, [timelineEntries, timelineFilter]);

  // Find all holdings that are maturing or matured
  const maturingHoldings = useMemo(() => {
    return holdings
      .filter(
        (h) =>
          h.isMatured ||
          (h.daysToMaturity !== undefined && h.daysToMaturity <= 365) ||
          h.category === 'FIXED_DEPOSIT' ||
          h.category === 'RECURRING_DEPOSIT' ||
          h.category === 'SOVEREIGN_GOLD_BOND' ||
          h.category === 'CORP_BOND' ||
          h.category === 'GOVT_BOND'
      )
      .sort((a, b) => {
        const aDays = a.isMatured ? -999 : getEffectiveDaysToMaturity(a) ?? 999;
        const bDays = b.isMatured ? -999 : getEffectiveDaysToMaturity(b) ?? 999;
        return aDays - bDays;
      });
  }, [holdings]);

  // Set default selected holding
  const activeHolding = useMemo(() => {
    if (selectedHoldingId) {
      const found = holdings.find((h) => h.id === selectedHoldingId);
      if (found) return found;
    }
    return maturingHoldings[0] || holdings[0];
  }, [maturingHoldings, selectedHoldingId, holdings]);

  // Filter solutions by selected risk tier
  const filteredSolutions = useMemo(() => {
    if (selectedRiskTier === 'ALL') return CURATED_REINVESTMENT_SOLUTIONS;
    return CURATED_REINVESTMENT_SOLUTIONS.filter((s) => s.riskTier === selectedRiskTier);
  }, [selectedRiskTier]);

  const activeHoldingValuation = activeHolding
    ? activeHolding.currentValue
    : 0;

  return (
    <div className="space-y-6">
      {/* 1. Header Overview */}
      <div className="bg-paper border border-slate-700 shadow-ink/10 shadow-sm rounded-xl p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-ink tracking-tight">
              Maturity Radar & Intelligent Reinvestment Engine
            </h2>
            <p className="text-xs text-ink/70 mt-1 max-w-2xl">
              Track maturing Fixed Deposits, Recurring Deposits, Sovereign Gold Bonds, and Debentures.
              Eliminate zero-yield idle cash drag by preemptively channeling matured capital into 5–8 vetted
              institutional alternatives based on your risk appetite.
            </p>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs bg-mist px-3 py-2 rounded-lg border border-slate-700">
            <span className="text-ink/70">Matured Capital Detected:</span>
            <span className="text-amber-800 font-bold">
              {formatCurrency(
                maturingHoldings
                  .filter((h) => h.isMatured)
                  .reduce((sum, h) => sum + h.currentValue, 0)
              )}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Maturity Timeline Visualization (30 / 60 / 90-Day Horizon) */}
      <section
        aria-label="Maturity Timeline"
        className="bg-paper border border-slate-700 shadow-ink/10 shadow-sm rounded-xl overflow-hidden"
      >
        <div className="p-5 border-b border-slate-700/80 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-700 shrink-0" />
              <span>Maturity Timeline</span>
            </h3>
            <p className="text-xs text-ink/70 mt-1">
              Chronological expiration horizon across dated holdings. Click any bar to stage that capital for reinvestment below.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1 p-1 bg-mist border border-slate-700 rounded-lg w-fit">
            {(
              [
                { id: 'ALL', label: `All (${timelineEntries.length})` },
                { id: 'URGENT_30', label: `Matured & ≤ 30d (${bucketTotals.urgent30Count})` },
                { id: 'WINDOW_60', label: `31–60d (${bucketTotals.window60Count})` },
                { id: 'WINDOW_90', label: `61–90d (${bucketTotals.window90Count})` },
                { id: 'BEYOND_90', label: `> 90d (${bucketTotals.beyond90Count})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTimelineFilter(tab.id)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 ${
                  timelineFilter === tab.id
                    ? 'bg-ink text-paper'
                    : 'text-ink/70 hover:text-ink'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Hairline-Divided 30 / 60 / 90-Day Window Totals */}
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-700/70 border-b border-slate-700/80 bg-mist">
          <div className="px-5 py-3.5">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-medium text-amber-800">Matured &amp; Next 30d</span>
              <span className="font-mono text-ink/70 tabular-nums">{bucketTotals.urgent30Count}</span>
            </div>
            <div className="text-base font-bold font-mono text-ink mt-1 tabular-nums">
              {formatCurrency(bucketTotals.urgent30Value, { compact: false, showDecimals: false })}
            </div>
          </div>

          <div className="px-5 py-3.5">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-medium text-sky-700">31–60 Days</span>
              <span className="font-mono text-ink/70 tabular-nums">{bucketTotals.window60Count}</span>
            </div>
            <div className="text-base font-bold font-mono text-ink mt-1 tabular-nums">
              {formatCurrency(bucketTotals.window60Value, { compact: false, showDecimals: false })}
            </div>
          </div>

          <div className="px-5 py-3.5">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-medium text-indigo-600">61–90 Days</span>
              <span className="font-mono text-ink/70 tabular-nums">{bucketTotals.window90Count}</span>
            </div>
            <div className="text-base font-bold font-mono text-ink mt-1 tabular-nums">
              {formatCurrency(bucketTotals.window90Value, { compact: false, showDecimals: false })}
            </div>
          </div>

          <div className="px-5 py-3.5">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-medium text-ink/70">Beyond 90 Days</span>
              <span className="font-mono text-ink/70 tabular-nums">{bucketTotals.beyond90Count}</span>
            </div>
            <div className="text-base font-bold font-mono text-ink mt-1 tabular-nums">
              {formatCurrency(bucketTotals.beyond90Value, { compact: false, showDecimals: false })}
            </div>
          </div>
        </div>

        {/* Horizontal Bar Timeline */}
        <div className="p-5">
          {timelineEntries.length === 0 ? (
            <div className="py-10 text-center text-xs text-ink/70">
              No holdings with fixed maturity dates found. Add an FD, RD, Bond, or upload a sheet with Maturity Date values to view the timeline.
            </div>
          ) : visibleTimelineEntries.length === 0 ? (
            <div className="py-10 text-center text-xs text-ink/70">
              No holdings expire inside this window. Select <strong className="text-ink">All</strong> to see the full maturity schedule.
            </div>
          ) : (
            <div className="space-y-2">
              {/* Horizon Axis Header (Desktop) */}
              <div className="hidden md:grid md:grid-cols-12 gap-4 items-center pb-2 border-b border-slate-700/80 text-2xs font-mono text-ink/70">
                <div className="col-span-4">Instrument &amp; Maturity Date</div>
                <div className="col-span-6 relative h-5">
                  <span className="absolute left-0 top-0 text-ink/70 font-semibold">Today</span>
                  <span className="absolute left-1/4 -translate-x-1/2 top-0 text-amber-700 font-semibold">
                    30d
                  </span>
                  <span className="absolute left-1/2 -translate-x-1/2 top-0 text-sky-700 font-semibold">
                    60d
                  </span>
                  <span className="absolute left-3/4 -translate-x-1/2 top-0 text-indigo-600 font-semibold">
                    90d
                  </span>
                  <span className="absolute right-0 top-0 text-ink/70">90d+</span>
                </div>
                <div className="col-span-2 text-right">Value &amp; Window</div>
              </div>

              {/* Timeline Rows */}
              <div className="divide-y divide-slate-700/60">
                {visibleTimelineEntries.map((entry) => {
                  const { holding, days, isMatured, windowKey, windowLabel, barWidthPct, valueInBase } = entry;
                  const isSelected = activeHolding?.id === holding.id;

                  const barColorClass = isMatured
                    ? 'bg-rose-600'
                    : windowKey === 'URGENT_30'
                    ? 'bg-amber-800'
                    : windowKey === 'WINDOW_60'
                    ? 'bg-sky-600'
                    : windowKey === 'WINDOW_90'
                    ? 'bg-indigo-500'
                    : 'bg-cash';

                  const labelColorClass = isMatured
                    ? 'text-rose-700'
                    : windowKey === 'URGENT_30'
                    ? 'text-amber-800'
                    : windowKey === 'WINDOW_60'
                    ? 'text-sky-700'
                    : windowKey === 'WINDOW_90'
                    ? 'text-indigo-600'
                    : 'text-ink/70';

                  const daysLabel = isMatured
                    ? days < 0
                      ? `${Math.abs(days)}d overdue`
                      : 'Maturing today'
                    : `In ${days}d`;

                  return (
                    <button
                      key={holding.id}
                      type="button"
                      onClick={() => setSelectedHoldingId(holding.id)}
                      className={`w-full text-left py-3 px-2 -mx-2 rounded-lg grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 items-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 ${
                        isSelected ? 'bg-emerald-500/10' : 'hover:bg-ink/5'
                      }`}
                    >
                      {/* Instrument Info */}
                      <div className="md:col-span-4 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-ink truncate">
                            {holding.name}
                          </span>
                          {isSelected && (
                            <span className="text-2xs font-mono text-emerald-700 shrink-0">
                              Selected
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 text-2xs text-ink/70 mt-0.5 font-mono tabular-nums">
                          <span>{holding.maturityDate || 'Date derived'}</span>
                          <span aria-hidden="true" className="text-ink/40">·</span>
                          <span>{holding.institution}</span>
                        </div>
                      </div>

                      {/* Horizontal Calibrated Bar Track */}
                      <div className="md:col-span-6">
                        <div className="relative h-7 rounded-md bg-mist border border-slate-700 overflow-hidden flex items-center px-2.5">
                          {/* Subtle 0-30, 30-60, 60-90 background zones */}
                          <div className="absolute inset-y-0 left-0 w-1/4 bg-amber-500/[0.10]" />
                          <div className="absolute inset-y-0 left-1/4 w-1/4 bg-sky-500/[0.08]" />
                          <div className="absolute inset-y-0 left-1/2 w-1/4 bg-indigo-500/[0.08]" />

                          {/* 30d / 60d / 90d Vertical Milestone Guides */}
                          <div className="absolute inset-y-0 left-1/4 w-px bg-amber-600/50" />
                          <div className="absolute inset-y-0 left-1/2 w-px bg-sky-600/50" />
                          <div className="absolute inset-y-0 left-3/4 w-px bg-indigo-500/50" />

                          {/* Horizontal Duration Bar */}
                          <div
                            className={`absolute left-0 top-1/2 -translate-y-1/2 z-10 h-3 rounded-r-full transition-all duration-200 ${barColorClass}`}
                            style={{ width: `${barWidthPct}%` }}
                          />

                          {/* Days Readout Pinned Cleanly on Right */}
                          <span className="relative z-20 ml-auto px-1.5 py-0.5 rounded bg-paper text-2xs font-mono font-semibold text-ink tabular-nums whitespace-nowrap">
                            {daysLabel}
                          </span>
                        </div>
                      </div>

                      {/* Valuation & Explicit Window Text */}
                      <div className="md:col-span-2 flex md:flex-col items-center md:items-end justify-between gap-1 font-mono tabular-nums">
                        <span className="text-xs font-bold text-ink">
                          {formatCurrency(valueInBase, { compact: true })}
                        </span>
                        <span className={`text-2xs font-semibold ${labelColorClass}`}>
                          {windowLabel}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {openEndedCount > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-700/80 text-2xs text-ink/70 flex items-center justify-between gap-2">
              <span>
                {openEndedCount} open-ended holding{openEndedCount === 1 ? '' : 's'} (Mutual Funds, Equities, or Cash) without fixed expiration dates.
              </span>
              <span className="hidden sm:inline font-mono text-ink/70">
                Milestones: 30d · 60d · 90d
              </span>
            </div>
          )}
        </div>
      </section>

      {/* 2. Maturing Assets Pipeline & Selector */}
      <div className="bg-paper border border-slate-700 shadow-ink/10 shadow-sm rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-700" />
            <span>Select Maturing Instrument to Reinvest</span>
          </h3>
          <span className="text-xs text-ink/70 font-mono">
            {maturingHoldings.length} Instruments Tracked
          </span>
        </div>

        {maturingHoldings.length === 0 ? (
          <div className="p-8 text-center text-ink/70 text-xs">
            No fixed-tenure instruments (FD, RD, SGB, Bond) detected in your portfolio.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {maturingHoldings.map((h) => {
              const isSelected = activeHolding?.id === h.id;
              const val = h.currentValue;
              const isMat = h.isMatured || (h.daysToMaturity !== undefined && h.daysToMaturity <= 0);

              return (
                <div
                  key={h.id}
                  onClick={() => setSelectedHoldingId(h.id)}
                  className={`border rounded-xl p-3.5 cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-emerald-500/10 border-emerald-500 ring-1 ring-emerald-500'
                      : isMat
                      ? 'bg-amber-500/10 border-amber-600/40 hover:border-amber-600'
                      : 'bg-mist border-slate-700 hover:border-ink/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-semibold text-ink truncate">
                      {h.name}
                    </span>
                    {isMat ? (
                      <span className="text-2xs font-mono font-bold text-amber-800 bg-amber-500/20 px-1.5 py-0.5 rounded shrink-0">
                        MATURED
                      </span>
                    ) : (
                      <span className="text-2xs font-mono text-ink/70 bg-ink/5 px-1.5 py-0.5 rounded shrink-0">
                        {h.daysToMaturity}d left
                      </span>
                    )}
                  </div>

                  <div className="mt-2 flex items-baseline justify-between">
                    <div className="text-base font-bold font-mono text-ink tabular-nums">
                      {formatCurrency(val, { compact: false })}
                    </div>
                    <div className="text-2xs text-ink/70">
                      {h.category.replace('_', ' ')}
                    </div>
                  </div>

                  <div className="mt-1 text-2xs text-ink/70 flex items-center justify-between">
                    <span>{h.institution}</span>
                    {h.interestRatePct && <span>Rate: {h.interestRatePct}%</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Reinvestment Target Configuration Bar */}
      {activeHolding && (
        <div className="bg-emerald-500/10 border border-emerald-500/35 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-700 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-emerald-700 font-medium">
                Active Capital Staged for Reallocation:
              </div>
              <div className="text-sm font-bold text-ink font-mono flex items-center gap-2">
                <span>{activeHolding.name}</span>
                <span className="text-emerald-700">
                  ({formatCurrency(activeHoldingValuation)})
                </span>
              </div>
            </div>
          </div>

          {/* Risk Profile Filter Buttons & Full Market Rebalance Link */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {onOpenMarketRebalance && (
              <button
                type="button"
                onClick={() => onOpenMarketRebalance(activeHolding)}
                className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-500/10 hover:bg-emerald-500/20 hover:text-emerald-800 border border-emerald-500/40 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <Shuffle className="w-3.5 h-3.5 text-emerald-700" />
                <span>Search All Market Funds / Bonds / Home Loan</span>
              </button>
            )}

            <div className="flex items-center bg-mist border border-slate-700 rounded-lg p-1 overflow-x-auto">
              {(
                [
                  { id: 'ALL', label: 'All Tiers (8)' },
                  { id: 'GUARANTEED', label: 'Guaranteed' },
                  { id: 'LOW', label: 'Low Risk' },
                  { id: 'MODERATE', label: 'Moderate' },
                  { id: 'HIGH', label: 'High Growth' },
                ] as const
              ).map((tier) => (
                <button
                  key={tier.id}
                  onClick={() => setSelectedRiskTier(tier.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors whitespace-nowrap ${
                    selectedRiskTier === tier.id
                      ? 'bg-ink text-paper shadow-sm'
                      : 'text-ink/70 hover:text-ink'
                  }`}
                >
                  {tier.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 4. Curated 5–8 Reinvestment Solution Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredSolutions.map((sol) => {
          const projectedGainAnnual = (activeHoldingValuation * sol.expectedAnnualYieldPct) / 100;

          // Tier badge icon and styling
          const tierConfig = {
            GUARANTEED: {
              icon: ShieldCheck,
              border: 'border-emerald-500/30',
              badgeBg: 'bg-emerald-500/10 text-emerald-700',
              label: '100% Sovereign Backed',
            },
            LOW: {
              icon: Shield,
              border: 'border-sky-500/30',
              badgeBg: 'bg-sky-500/10 text-sky-700',
              label: 'Low Volatility · High Liquidity',
            },
            MODERATE: {
              icon: TrendingUp,
              border: 'border-indigo-500/30',
              badgeBg: 'bg-indigo-500/10 text-indigo-600',
              label: 'Balanced Asset Allocation',
            },
            HIGH: {
              icon: Flame,
              border: 'border-amber-500/30',
              badgeBg: 'bg-amber-500/10 text-amber-700',
              label: 'High Growth Compounding',
            },
          }[sol.riskTier];

          const TierIcon = tierConfig.icon;

          return (
            <div
              key={sol.id}
              className={`bg-paper border ${tierConfig.border} rounded-xl p-5 flex flex-col justify-between hover:border-slate-700 transition-all shadow-ink/10 shadow-sm group`}
            >
              <div>
                {/* Header Strip */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-2xs font-mono font-bold px-2 py-0.5 rounded ${tierConfig.badgeBg}`}
                    >
                      {sol.riskTier} RISK
                    </span>
                    <span className="text-2xs text-ink/70 font-mono">
                      {sol.actionTag}
                    </span>
                  </div>

                  <div className="text-right">
                    <div className="text-lg font-bold font-mono text-emerald-700 tabular-nums">
                      {sol.expectedAnnualYieldPct}%
                    </div>
                    <div className="text-2xs text-ink/70 font-mono">Exp. Annual Yield</div>
                  </div>
                </div>

                {/* Title */}
                <h4 className="text-base font-bold text-ink mt-2 group-hover:text-emerald-700 transition-colors">
                  {sol.solutionName}
                </h4>
                <div className="text-xs text-ink/70 mt-0.5 font-mono">
                  {sol.instrumentType}
                </div>

                {/* Strategic Thesis */}
                <p className="text-xs text-ink/70 mt-3 leading-relaxed">
                  {sol.whyRecommended}
                </p>

                {/* Key Spec Grid */}
                <div className="mt-4 grid grid-cols-2 gap-2 text-2xs bg-mist p-3 rounded-lg border border-slate-700/80 font-mono">
                  <div>
                    <span className="text-ink/70 block">Lock-in & Tenure:</span>
                    <span className="text-ink font-medium">{sol.lockInPeriod}</span>
                  </div>
                  <div>
                    <span className="text-ink/70 block">Tax Treatment:</span>
                    <span className="text-ink font-medium truncate block" title={sol.taxImplication}>
                      {sol.taxImplication}
                    </span>
                  </div>
                </div>

                {/* Annual Income Projection Callout */}
                {activeHolding && (
                  <div className="mt-3 text-2xs text-ink/70 flex items-center justify-between px-1">
                    <span>Projected 1st-Year Yield on Staged Capital:</span>
                    <span className="text-emerald-700 font-mono font-bold">
                      +{formatCurrency(projectedGainAnnual, { showDecimals: false })}
                    </span>
                  </div>
                )}
              </div>

              {/* Action Button */}
              <div className="mt-4 pt-3 border-t border-slate-700/80 flex items-center justify-between">
                <span className="text-2xs text-ink/70 max-w-xs truncate" title={sol.suitability}>
                  {sol.suitability}
                </span>

                <button
                  onClick={() => activeHolding && onDeploySolution(activeHolding, sol)}
                  className="px-3.5 py-2 text-xs font-semibold text-paper bg-ink hover:bg-ink/90 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm shadow-ink/10 shrink-0"
                >
                  <span>Deploy & Rebalance</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
