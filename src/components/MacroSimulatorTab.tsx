import React, { useState, useMemo } from 'react';
import { CurrencyCode, Holding, MacroParameters, PortfolioAllocation } from '../types/wealth';
import { convertCurrency, formatCurrency, formatPercent } from '../utils/currency';
import {
  computePortfolioAllocation,
  runMacroSimulation,
} from '../utils/simulationEngine';
import {
  Sliders,
  TrendingDown,
  TrendingUp,
  AlertCircle,
  Shield,
  Shuffle,
  RefreshCw,
  Info,
  Flame,
  CheckCircle2,
} from 'lucide-react';

interface MacroSimulatorTabProps {
  holdings: Holding[];
  baseCurrency: CurrencyCode;
}

export const MacroSimulatorTab: React.FC<MacroSimulatorTabProps> = ({
  holdings,
  baseCurrency,
}) => {
  // Current portfolio valuation in base currency
  const totalNetWorth = useMemo(() => {
    return holdings.reduce(
      (sum, h) => sum + convertCurrency(h.currentValue, h.currency, baseCurrency),
      0
    );
  }, [holdings, baseCurrency]);

  // Current calculated allocation
  const initialAllocation = useMemo(() => {
    return computePortfolioAllocation(holdings, baseCurrency);
  }, [holdings, baseCurrency]);

  // Macro Parameters State
  const [params, setParams] = useState<MacroParameters>({
    inflationRatePct: 6.5,
    interestRateHikeBps: 150,
    geopoliticalShockIndex: 5,
    equityMarketShockPct: -12,
    projectionHorizonYears: 5,
  });

  // Shuffled Allocation State (starts matched to current allocation)
  const [shuffledAlloc, setShuffledAlloc] = useState<PortfolioAllocation>(initialAllocation);

  // Run simulation
  const simResult = useMemo(() => {
    return runMacroSimulation(totalNetWorth, initialAllocation, shuffledAlloc, params);
  }, [totalNetWorth, initialAllocation, shuffledAlloc, params]);

  // Handler to adjust one asset class weight in shuffled allocation and rebalance others
  const handleShuffleChange = (asset: keyof PortfolioAllocation, newVal: number) => {
    const val = Math.max(0, Math.min(80, newVal));
    const keys: (keyof PortfolioAllocation)[] = [
      'equities',
      'fixedIncome',
      'goldCommodity',
      'retirementPensions',
      'liquidCash',
    ];
    const otherKeys = keys.filter((k) => k !== asset);

    const oldOtherTotal = otherKeys.reduce((acc, k) => acc + shuffledAlloc[k], 0);
    const targetOtherTotal = 100 - val;

    const updated: PortfolioAllocation = { ...shuffledAlloc, [asset]: val };

    if (oldOtherTotal > 0) {
      otherKeys.forEach((k) => {
        const share = shuffledAlloc[k] / oldOtherTotal;
        updated[k] = Math.round(share * targetOtherTotal);
      });
    } else {
      const equalShare = Math.floor(targetOtherTotal / otherKeys.length);
      otherKeys.forEach((k) => {
        updated[k] = equalShare;
      });
    }

    // Ensure sum equals 100
    const sum = keys.reduce((acc, k) => acc + updated[k], 0);
    if (sum !== 100) {
      updated.liquidCash += 100 - sum;
    }

    setShuffledAlloc(updated);
  };

  // Preset Shuffling Strategies
  const applyRecommendedPreset = (type: 'DEFENSIVE' | 'ALL_WEATHER' | 'MAX_GROWTH') => {
    if (type === 'DEFENSIVE') {
      // Heavy in gold, floating debt, and cash buffer
      setShuffledAlloc({
        equities: 25,
        fixedIncome: 35,
        goldCommodity: 20,
        retirementPensions: 10,
        liquidCash: 10,
      });
    } else if (type === 'ALL_WEATHER') {
      // Ray Dalio / Multi-asset balanced
      setShuffledAlloc({
        equities: 35,
        fixedIncome: 30,
        goldCommodity: 15,
        retirementPensions: 15,
        liquidCash: 5,
      });
    } else {
      // Growth Aggressive
      setShuffledAlloc({
        equities: 60,
        fixedIncome: 15,
        goldCommodity: 10,
        retirementPensions: 10,
        liquidCash: 5,
      });
    }
  };

  // SVG Chart Dimensions & Coordinates
  const chartPoints = simResult.trajectory;
  const maxVal = Math.max(
    ...chartPoints.map((p) => Math.max(p.baselineNominal, p.shuffledNominal, p.scenarioNominal))
  ) * 1.1;
  const minVal = totalNetWorth * 0.8;

  const getSvgCoordinates = (val: number, yearIdx: number) => {
    const width = 640;
    const height = 240;
    const paddingX = 40;
    const paddingY = 24;

    const x = paddingX + (yearIdx / (chartPoints.length - 1)) * (width - 2 * paddingX);
    const y =
      height - paddingY - ((val - minVal) / (maxVal - minVal)) * (height - 2 * paddingY);
    return { x, y: Math.max(paddingY, Math.min(height - paddingY, y)) };
  };

  const createSvgPath = (key: 'baselineNominal' | 'scenarioNominal' | 'shuffledNominal') => {
    return chartPoints
      .map((p, idx) => {
        const { x, y } = getSvgCoordinates(p[key], idx);
        return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Overview */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
              <h2 className="text-lg font-bold text-white tracking-tight">
                Macroeconomic Stress Test & Portfolio Shuffler
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Stress-test your multi-asset portfolio against inflation spikes, central bank rate hike
              regimes, and geopolitical shocks. Shuffle target asset class weights to visualize how active
              rebalancing insulates your future purchasing power.
            </p>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs bg-slate-950 px-3 py-2 rounded-lg border border-slate-800">
            <span className="text-slate-500">Protection Horizon:</span>
            <span className="text-white font-bold">{params.projectionHorizonYears} Years</span>
          </div>
        </div>
      </div>

      {/* 2. Interactive Macro Controls Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Sliders className="w-4 h-4 text-indigo-400" />
            <span>Simulate Economic Conditions</span>
          </div>
          <button
            onClick={() =>
              setParams({
                inflationRatePct: 6.5,
                interestRateHikeBps: 150,
                geopoliticalShockIndex: 5,
                equityMarketShockPct: -12,
                projectionHorizonYears: 5,
              })
            }
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Reset Baseline</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 text-xs">
          {/* Inflation Rate Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between font-mono">
              <span className="text-slate-400">Annual Inflation (CPI):</span>
              <span className="font-bold text-amber-400">{params.inflationRatePct}%</span>
            </div>
            <input
              type="range"
              min="2.0"
              max="12.0"
              step="0.5"
              value={params.inflationRatePct}
              onChange={(e) =>
                setParams({ ...params, inflationRatePct: parseFloat(e.target.value) })
              }
              className="w-full accent-amber-500 cursor-pointer"
            />
            <div className="flex justify-between text-2xs text-slate-500 font-mono">
              <span>2.0% (Tame)</span>
              <span>12.0% (Crisis)</span>
            </div>
          </div>

          {/* Interest Rate Hike Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between font-mono">
              <span className="text-slate-400">Policy Rate Hike/Cut:</span>
              <span className="font-bold text-sky-400">
                {params.interestRateHikeBps > 0 ? `+${params.interestRateHikeBps}` : params.interestRateHikeBps} bps
              </span>
            </div>
            <input
              type="range"
              min="-200"
              max="400"
              step="25"
              value={params.interestRateHikeBps}
              onChange={(e) =>
                setParams({ ...params, interestRateHikeBps: parseInt(e.target.value) })
              }
              className="w-full accent-sky-500 cursor-pointer"
            />
            <div className="flex justify-between text-2xs text-slate-500 font-mono">
              <span>-200 bps (Eased)</span>
              <span>+400 bps (Aggressive)</span>
            </div>
          </div>

          {/* Geopolitical Shock Index */}
          <div className="space-y-2">
            <div className="flex items-center justify-between font-mono">
              <span className="text-slate-400">Geopolitical Shock Index:</span>
              <span className="font-bold text-rose-400">{params.geopoliticalShockIndex} / 10</span>
            </div>
            <input
              type="range"
              min="0"
              max="10"
              step="1"
              value={params.geopoliticalShockIndex}
              onChange={(e) =>
                setParams({ ...params, geopoliticalShockIndex: parseInt(e.target.value) })
              }
              className="w-full accent-rose-500 cursor-pointer"
            />
            <div className="flex justify-between text-2xs text-slate-500 font-mono">
              <span>0 (Peaceful)</span>
              <span>10 (War / Supply Shock)</span>
            </div>
          </div>

          {/* Equity Market Shock */}
          <div className="space-y-2">
            <div className="flex items-center justify-between font-mono">
              <span className="text-slate-400">Equity Market Shock:</span>
              <span
                className={`font-bold ${
                  params.equityMarketShockPct < 0 ? 'text-rose-400' : 'text-emerald-400'
                }`}
              >
                {params.equityMarketShockPct > 0
                  ? `+${params.equityMarketShockPct}%`
                  : `${params.equityMarketShockPct}%`}
              </span>
            </div>
            <input
              type="range"
              min="-30"
              max="20"
              step="2"
              value={params.equityMarketShockPct}
              onChange={(e) =>
                setParams({ ...params, equityMarketShockPct: parseInt(e.target.value) })
              }
              className="w-full accent-indigo-500 cursor-pointer"
            />
            <div className="flex justify-between text-2xs text-slate-500 font-mono">
              <span>-30% (Crash)</span>
              <span>+20% (Bull Run)</span>
            </div>
          </div>
        </div>

        {/* Horizon selector buttons */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
          <span className="text-slate-400">Projection Horizon:</span>
          <div className="flex items-center gap-1.5 font-mono">
            {[1, 3, 5, 10].map((yr) => (
              <button
                key={yr}
                onClick={() => setParams({ ...params, projectionHorizonYears: yr })}
                className={`px-3 py-1 rounded text-2xs font-bold transition-colors ${
                  params.projectionHorizonYears === yr
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-950 text-slate-400 hover:text-white'
                }`}
              >
                {yr} {yr === 1 ? 'Year' : 'Years'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Multi-Year Wealth Trajectory Chart & KPI Summary */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-white">
              Simulated Wealth Trajectory Comparison
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Visualizing baseline steady-state vs. unhedged current portfolio vs. shuffled resilient portfolio.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-slate-500 border-dashed" />
              <span className="text-slate-400">Baseline (No Shock)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-rose-500" />
              <span className="text-rose-400">Current (Shocked)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-emerald-400" />
              <span className="text-emerald-400">Shuffled Portfolio</span>
            </div>
          </div>
        </div>

        {/* SVG Curve Canvas */}
        <div className="w-full overflow-x-auto bg-slate-950/70 p-4 rounded-xl border border-slate-800/80">
          <svg
            viewBox="0 0 640 240"
            className="w-full h-56 sm:h-64"
            preserveAspectRatio="none"
          >
            {/* Grid Lines */}
            {[0, 1, 2, 3].map((i) => {
              const y = 24 + i * 50;
              return (
                <line
                  key={i}
                  x1="40"
                  y1={y}
                  x2="600"
                  y2={y}
                  stroke="#1e293b"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
              );
            })}

            {/* Baseline Line */}
            <path
              d={createSvgPath('baselineNominal')}
              fill="none"
              stroke="#64748b"
              strokeDasharray="5 5"
              strokeWidth="2"
            />

            {/* Current Portfolio Shock Line */}
            <path
              d={createSvgPath('scenarioNominal')}
              fill="none"
              stroke="#f43f5e"
              strokeWidth="2.5"
            />

            {/* Shuffled Portfolio Line */}
            <path
              d={createSvgPath('shuffledNominal')}
              fill="none"
              stroke="#10b981"
              strokeWidth="3"
            />

            {/* Data points for Shuffled */}
            {chartPoints.map((p, idx) => {
              const { x, y } = getSvgCoordinates(p.shuffledNominal, idx);
              return (
                <g key={idx}>
                  <circle cx={x} cy={y} r="4" fill="#10b981" />
                  <text
                    x={x}
                    y={235}
                    textAnchor="middle"
                    fill="#64748b"
                    fontSize="10"
                    fontFamily="monospace"
                  >
                    {p.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Outcome Summary Metric Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs font-mono">
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80">
            <span className="text-slate-500 block">Baseline End Net Worth:</span>
            <span className="text-base font-bold text-slate-300">
              {formatCurrency(simResult.finalBaselineNetWorth, baseCurrency, { compact: true })}
            </span>
            <span className="text-2xs text-slate-500 block mt-0.5">Under 5% normal inflation</span>
          </div>

          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80">
            <span className="text-slate-500 block">Current Portfolio (Unhedged):</span>
            <span className="text-base font-bold text-rose-400">
              {formatCurrency(simResult.finalScenarioNetWorth, baseCurrency, { compact: true })}
            </span>
            <span className="text-2xs text-slate-500 block mt-0.5">
              Drawdown drag: {formatPercent(simResult.scenarioAlphaVsBaselinePct)}
            </span>
          </div>

          <div className="bg-slate-950 p-3 rounded-lg border border-emerald-500/40 bg-emerald-950/10">
            <span className="text-emerald-400 block font-semibold">Shuffled Portfolio Outcome:</span>
            <span className="text-base font-bold text-emerald-300">
              {formatCurrency(simResult.finalShuffledNetWorth, baseCurrency, { compact: true })}
            </span>
            <span className="text-2xs text-emerald-400 font-bold block mt-0.5">
              +{formatCurrency(simResult.shuffledAdvantageVsScenario, baseCurrency, { compact: true })} Protected Capital!
            </span>
          </div>
        </div>
      </div>

      {/* 4. Interactive "Portfolio Shuffler" Playground */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <Shuffle className="w-4 h-4 text-emerald-400" />
              <span>Interactive Portfolio Shuffler</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Adjust allocation weights to see instant real-time shifts in resilience against the active shock.
            </p>
          </div>

          {/* Quick Presets */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => applyRecommendedPreset('DEFENSIVE')}
              className="px-2.5 py-1 text-2xs font-mono font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition-colors"
            >
              Defensive Shield
            </button>
            <button
              onClick={() => applyRecommendedPreset('ALL_WEATHER')}
              className="px-2.5 py-1 text-2xs font-mono font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition-colors"
            >
              All-Weather (Balanced)
            </button>
            <button
              onClick={() => applyRecommendedPreset('MAX_GROWTH')}
              className="px-2.5 py-1 text-2xs font-mono font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition-colors"
            >
              Growth Focus
            </button>
          </div>
        </div>

        {/* Sliders Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 text-xs font-mono">
          {/* Equities */}
          <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800/80 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-indigo-400 font-bold">Equities & MF</span>
              <span className="text-white font-bold text-sm">{shuffledAlloc.equities}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="80"
              value={shuffledAlloc.equities}
              onChange={(e) => handleShuffleChange('equities', parseInt(e.target.value))}
              className="w-full accent-indigo-500 cursor-pointer"
            />
            <div className="text-2xs text-slate-500">Current: {initialAllocation.equities}%</div>
          </div>

          {/* Fixed Income */}
          <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800/80 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sky-400 font-bold">Fixed Deposits & Debt</span>
              <span className="text-white font-bold text-sm">{shuffledAlloc.fixedIncome}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="80"
              value={shuffledAlloc.fixedIncome}
              onChange={(e) => handleShuffleChange('fixedIncome', parseInt(e.target.value))}
              className="w-full accent-sky-500 cursor-pointer"
            />
            <div className="text-2xs text-slate-500">Current: {initialAllocation.fixedIncome}%</div>
          </div>

          {/* Gold / SGB */}
          <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800/80 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-amber-400 font-bold">Sovereign Gold (SGB)</span>
              <span className="text-white font-bold text-sm">{shuffledAlloc.goldCommodity}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="50"
              value={shuffledAlloc.goldCommodity}
              onChange={(e) => handleShuffleChange('goldCommodity', parseInt(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />
            <div className="text-2xs text-slate-500">Current: {initialAllocation.goldCommodity}%</div>
          </div>

          {/* Retirement Pensions */}
          <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800/80 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-emerald-400 font-bold">EPF / PPF / NPS</span>
              <span className="text-white font-bold text-sm">{shuffledAlloc.retirementPensions}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="50"
              value={shuffledAlloc.retirementPensions}
              onChange={(e) => handleShuffleChange('retirementPensions', parseInt(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer"
            />
            <div className="text-2xs text-slate-500">Current: {initialAllocation.retirementPensions}%</div>
          </div>

          {/* Cash */}
          <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800/80 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-slate-300 font-bold">Liquid Cash Buffer</span>
              <span className="text-white font-bold text-sm">{shuffledAlloc.liquidCash}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="40"
              value={shuffledAlloc.liquidCash}
              onChange={(e) => handleShuffleChange('liquidCash', parseInt(e.target.value))}
              className="w-full accent-slate-400 cursor-pointer"
            />
            <div className="text-2xs text-slate-500">Current: {initialAllocation.liquidCash}%</div>
          </div>
        </div>

        {/* Strategic Rebalancing Advice Box */}
        <div className="mt-4 bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-400">
            <Shield className="w-4 h-4" />
            <span>Macro Stress Intelligence Advice:</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            {simResult.macroDiagnosis}
          </p>
          <ul className="text-2xs text-slate-400 space-y-1 list-disc pl-4 pt-1">
            {simResult.recommendedShuffleAdvice.map((adv, idx) => (
              <li key={idx} className="leading-relaxed">
                {adv}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
