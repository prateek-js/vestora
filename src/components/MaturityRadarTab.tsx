import React, { useState, useMemo } from 'react';
import { CurrencyCode, Holding, ReinvestmentSolution, RiskProfile } from '../types/wealth';
import { CURATED_REINVESTMENT_SOLUTIONS } from '../data/mockData';
import { convertCurrency, formatCurrency } from '../utils/currency';
import {
  Clock,
  Shield,
  ShieldCheck,
  TrendingUp,
  Flame,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Info,
  Calendar,
  Lock,
  Unlock,
} from 'lucide-react';

interface MaturityRadarTabProps {
  holdings: Holding[];
  baseCurrency: CurrencyCode;
  onDeploySolution: (holding: Holding, solution: ReinvestmentSolution) => void;
}

export const MaturityRadarTab: React.FC<MaturityRadarTabProps> = ({
  holdings,
  baseCurrency,
  onDeploySolution,
}) => {
  const [selectedRiskTier, setSelectedRiskTier] = useState<RiskProfile | 'ALL'>('ALL');
  const [selectedHoldingId, setSelectedHoldingId] = useState<string>('');

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
        const aDays = a.isMatured ? -999 : a.daysToMaturity ?? 999;
        const bDays = b.isMatured ? -999 : b.daysToMaturity ?? 999;
        return aDays - bDays;
      });
  }, [holdings]);

  // Set default selected holding
  const activeHolding = useMemo(() => {
    if (selectedHoldingId) {
      const found = maturingHoldings.find((h) => h.id === selectedHoldingId);
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
    ? convertCurrency(activeHolding.currentValue, activeHolding.currency, baseCurrency)
    : 0;

  return (
    <div className="space-y-6">
      {/* 1. Header Overview */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <h2 className="text-lg font-bold text-white tracking-tight">
                Maturity Radar & Intelligent Reinvestment Engine
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Track maturing Fixed Deposits, Recurring Deposits, Sovereign Gold Bonds, and Debentures.
              Eliminate zero-yield idle cash drag by preemptively channeling matured capital into 5–8 vetted
              institutional alternatives based on your risk appetite.
            </p>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs bg-slate-950 px-3 py-2 rounded-lg border border-slate-800">
            <span className="text-slate-500">Matured Capital Detected:</span>
            <span className="text-amber-400 font-bold">
              {formatCurrency(
                maturingHoldings
                  .filter((h) => h.isMatured)
                  .reduce((sum, h) => sum + convertCurrency(h.currentValue, h.currency, baseCurrency), 0),
                baseCurrency
              )}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Maturing Assets Pipeline & Selector */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-400" />
            <span>Select Maturing Instrument to Reinvest</span>
          </h3>
          <span className="text-xs text-slate-400 font-mono">
            {maturingHoldings.length} Instruments Tracked
          </span>
        </div>

        {maturingHoldings.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            No fixed-tenure instruments (FD, RD, SGB, Bond) detected in your portfolio.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {maturingHoldings.map((h) => {
              const isSelected = activeHolding?.id === h.id;
              const val = convertCurrency(h.currentValue, h.currency, baseCurrency);
              const isMat = h.isMatured || (h.daysToMaturity !== undefined && h.daysToMaturity <= 0);

              return (
                <div
                  key={h.id}
                  onClick={() => setSelectedHoldingId(h.id)}
                  className={`border rounded-xl p-3.5 cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-slate-800/90 border-indigo-500 ring-1 ring-indigo-500'
                      : isMat
                      ? 'bg-amber-950/20 border-amber-500/40 hover:border-amber-400'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-100 truncate">
                      {h.name}
                    </span>
                    {isMat ? (
                      <span className="text-2xs font-mono font-bold text-amber-400 bg-amber-500/20 px-1.5 py-0.5 rounded shrink-0">
                        MATURED
                      </span>
                    ) : (
                      <span className="text-2xs font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded shrink-0">
                        {h.daysToMaturity}d left
                      </span>
                    )}
                  </div>

                  <div className="mt-2 flex items-baseline justify-between">
                    <div className="text-base font-bold font-mono text-white tabular-nums">
                      {formatCurrency(val, baseCurrency, { compact: false })}
                    </div>
                    <div className="text-2xs text-slate-400">
                      {h.category.replace('_', ' ')}
                    </div>
                  </div>

                  <div className="mt-1 text-2xs text-slate-500 flex items-center justify-between">
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
        <div className="bg-indigo-950/30 border border-indigo-500/30 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-indigo-300 font-medium">
                Active Capital Staged for Reallocation:
              </div>
              <div className="text-sm font-bold text-white font-mono flex items-center gap-2">
                <span>{activeHolding.name}</span>
                <span className="text-indigo-400">
                  ({formatCurrency(activeHoldingValuation, baseCurrency)})
                </span>
              </div>
            </div>
          </div>

          {/* Risk Profile Filter Buttons */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-1 shrink-0 overflow-x-auto">
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
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                  selectedRiskTier === tier.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tier.label}
              </button>
            ))}
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
              badgeBg: 'bg-emerald-500/10 text-emerald-400',
              label: '100% Sovereign Backed',
            },
            LOW: {
              icon: Shield,
              border: 'border-sky-500/30',
              badgeBg: 'bg-sky-500/10 text-sky-400',
              label: 'Low Volatility · High Liquidity',
            },
            MODERATE: {
              icon: TrendingUp,
              border: 'border-indigo-500/30',
              badgeBg: 'bg-indigo-500/10 text-indigo-400',
              label: 'Balanced Asset Allocation',
            },
            HIGH: {
              icon: Flame,
              border: 'border-amber-500/30',
              badgeBg: 'bg-amber-500/10 text-amber-400',
              label: 'High Growth Compounding',
            },
          }[sol.riskTier];

          const TierIcon = tierConfig.icon;

          return (
            <div
              key={sol.id}
              className={`bg-slate-900/90 border ${tierConfig.border} rounded-xl p-5 flex flex-col justify-between hover:border-slate-700 transition-all shadow-sm group`}
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
                    <span className="text-2xs text-slate-400 font-mono">
                      {sol.actionTag}
                    </span>
                  </div>

                  <div className="text-right">
                    <div className="text-lg font-bold font-mono text-emerald-400 tabular-nums">
                      {sol.expectedAnnualYieldPct}%
                    </div>
                    <div className="text-2xs text-slate-500 font-mono">Exp. Annual Yield</div>
                  </div>
                </div>

                {/* Title */}
                <h4 className="text-base font-bold text-white mt-2 group-hover:text-indigo-300 transition-colors">
                  {sol.solutionName}
                </h4>
                <div className="text-xs text-slate-400 mt-0.5 font-mono">
                  {sol.instrumentType}
                </div>

                {/* Strategic Thesis */}
                <p className="text-xs text-slate-300 mt-3 leading-relaxed">
                  {sol.whyRecommended}
                </p>

                {/* Key Spec Grid */}
                <div className="mt-4 grid grid-cols-2 gap-2 text-2xs bg-slate-950/70 p-3 rounded-lg border border-slate-800/80 font-mono">
                  <div>
                    <span className="text-slate-500 block">Lock-in & Tenure:</span>
                    <span className="text-slate-200 font-medium">{sol.lockInPeriod}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Tax Treatment:</span>
                    <span className="text-slate-200 font-medium truncate block" title={sol.taxImplication}>
                      {sol.taxImplication}
                    </span>
                  </div>
                </div>

                {/* Annual Income Projection Callout */}
                {activeHolding && (
                  <div className="mt-3 text-2xs text-slate-400 flex items-center justify-between px-1">
                    <span>Projected 1st-Year Yield on Staged Capital:</span>
                    <span className="text-emerald-400 font-mono font-bold">
                      +{formatCurrency(projectedGainAnnual, baseCurrency, { showDecimals: false })}
                    </span>
                  </div>
                )}
              </div>

              {/* Action Button */}
              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-2xs text-slate-400 max-w-xs truncate" title={sol.suitability}>
                  {sol.suitability}
                </span>

                <button
                  onClick={() => activeHolding && onDeploySolution(activeHolding, sol)}
                  className="px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm shadow-indigo-600/30 shrink-0"
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
