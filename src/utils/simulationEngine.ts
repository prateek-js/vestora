import { Holding, MacroParameters, PortfolioAllocation, CurrencyCode } from '../types/wealth';
import { convertCurrency } from './currency';

export interface TrajectoryPoint {
  year: number;
  label: string;
  baselineNominal: number;
  baselineReal: number;
  scenarioNominal: number;
  scenarioReal: number;
  shuffledNominal: number;
  shuffledReal: number;
}

export interface SimulationResult {
  currentAllocation: PortfolioAllocation;
  shuffledAllocation: PortfolioAllocation;
  trajectory: TrajectoryPoint[];
  finalBaselineNetWorth: number;
  finalScenarioNetWorth: number;
  finalShuffledNetWorth: number;
  scenarioAlphaVsBaselinePct: number;
  shuffledAdvantageVsScenario: number;
  macroDiagnosis: string;
  recommendedShuffleAdvice: string[];
}

export function computePortfolioAllocation(
  holdings: Holding[],
  baseCurrency: CurrencyCode
): PortfolioAllocation {
  let equitiesVal = 0;
  let fixedIncomeVal = 0;
  let goldVal = 0;
  let retirementVal = 0;
  let cashVal = 0;

  holdings.forEach((h) => {
    const val = convertCurrency(h.currentValue, h.currency, baseCurrency);
    switch (h.category) {
      case 'MUTUAL_FUND':
      case 'EQUITY_STOCK':
        equitiesVal += val;
        break;
      case 'FIXED_DEPOSIT':
      case 'RECURRING_DEPOSIT':
      case 'GOVT_BOND':
      case 'CORP_BOND':
        fixedIncomeVal += val;
        break;
      case 'SOVEREIGN_GOLD_BOND':
        goldVal += val;
        break;
      case 'EPF':
      case 'PPF':
      case 'NPS':
        retirementVal += val;
        break;
      case 'SAVINGS_CASH':
      default:
        cashVal += val;
        break;
    }
  });

  const total = equitiesVal + fixedIncomeVal + goldVal + retirementVal + cashVal;
  if (total === 0) {
    return {
      equities: 40,
      fixedIncome: 30,
      goldCommodity: 10,
      retirementPensions: 15,
      liquidCash: 5,
    };
  }

  return {
    equities: Math.round((equitiesVal / total) * 100),
    fixedIncome: Math.round((fixedIncomeVal / total) * 100),
    goldCommodity: Math.round((goldVal / total) * 100),
    retirementPensions: Math.round((retirementVal / total) * 100),
    liquidCash: Math.round((cashVal / total) * 100),
  };
}

export function runMacroSimulation(
  currentTotalNetWorth: number,
  currentAllocation: PortfolioAllocation,
  shuffledAllocation: PortfolioAllocation,
  params: MacroParameters
): SimulationResult {
  const years = params.projectionHorizonYears;
  const trajectory: TrajectoryPoint[] = [];

  // Baseline Annual Expected Returns in steady state
  const baselineRates = {
    equities: 0.125, // 12.5%
    fixedIncome: 0.073, // 7.3%
    gold: 0.090, // 9.0%
    retirement: 0.082, // 8.2% (EPF/PPF blend)
    cash: 0.035, // 3.5%
  };
  const baselineInflation = 0.05; // 5% baseline inflation

  // Macro Adjustments
  // 1. Rate Hike impact on Debt: Bond price drops by (Average Modified Duration * ΔRate)
  // Average bond portfolio duration ~ 3.5 years
  const rateHikeDecimal = params.interestRateHikeBps / 10000; // e.g. 150 bps = 0.015
  const durationDrag = -3.2 * rateHikeDecimal; // immediate capital loss or gain
  const newDebtYield = Math.max(0.04, baselineRates.fixedIncome + rateHikeDecimal * 0.7);

  // 2. Rate hike on Equity: multiple compression + market shock
  const equityShockFactor = (params.equityMarketShockPct / 100) - (rateHikeDecimal * 2.0);
  const newEquityRate = Math.max(-0.05, baselineRates.equities + equityShockFactor * 0.2);

  // 3. Geopolitical shock on Gold: Gold serves as safe haven
  const goldShockBoost = (params.geopoliticalShockIndex / 10) * 0.08; // up to +8% per year
  const newGoldRate = baselineRates.gold + goldShockBoost + (params.inflationRatePct / 100) * 0.4;

  // 4. Inflation drag
  const scenarioInflation = params.inflationRatePct / 100;

  // Calculate annual blended rates for current allocation
  const calcBlendedRate = (alloc: PortfolioAllocation, isScenario: boolean, yearIdx: number) => {
    const eqWeight = alloc.equities / 100;
    const fiWeight = alloc.fixedIncome / 100;
    const goldWeight = alloc.goldCommodity / 100;
    const retWeight = alloc.retirementPensions / 100;
    const cashWeight = alloc.liquidCash / 100;

    if (!isScenario) {
      return (
        eqWeight * baselineRates.equities +
        fiWeight * baselineRates.fixedIncome +
        goldWeight * baselineRates.gold +
        retWeight * baselineRates.retirement +
        cashWeight * baselineRates.cash
      );
    }

    // Year 1 absorbs the immediate duration/market shock
    const firstYearShock = yearIdx === 1 ? (fiWeight * durationDrag + eqWeight * equityShockFactor) : 0;

    const ongoingYield = (
      eqWeight * newEquityRate +
      fiWeight * newDebtYield +
      goldWeight * newGoldRate +
      retWeight * baselineRates.retirement +
      cashWeight * Math.min(0.045, baselineRates.cash + rateHikeDecimal * 0.3)
    );

    return ongoingYield + firstYearShock;
  };

  let bNominal = currentTotalNetWorth;
  let bReal = currentTotalNetWorth;

  let sNominal = currentTotalNetWorth;
  let sReal = currentTotalNetWorth;

  let shNominal = currentTotalNetWorth;
  let shReal = currentTotalNetWorth;

  const currentYear = 2026;

  trajectory.push({
    year: 0,
    label: `${currentYear}`,
    baselineNominal: Math.round(bNominal),
    baselineReal: Math.round(bReal),
    scenarioNominal: Math.round(sNominal),
    scenarioReal: Math.round(sReal),
    shuffledNominal: Math.round(shNominal),
    shuffledReal: Math.round(shReal),
  });

  for (let y = 1; y <= years; y++) {
    // Baseline compounding
    const bRate = calcBlendedRate(currentAllocation, false, y);
    bNominal *= (1 + bRate);
    bReal = bNominal / Math.pow(1 + baselineInflation, y);

    // Scenario compounding on current portfolio
    const sRate = calcBlendedRate(currentAllocation, true, y);
    sNominal *= (1 + sRate);
    sReal = sNominal / Math.pow(1 + scenarioInflation, y);

    // Scenario compounding on shuffled portfolio
    const shRate = calcBlendedRate(shuffledAllocation, true, y);
    shNominal *= (1 + shRate);
    shReal = shNominal / Math.pow(1 + scenarioInflation, y);

    trajectory.push({
      year: y,
      label: `${currentYear + y}`,
      baselineNominal: Math.round(bNominal),
      baselineReal: Math.round(bReal),
      scenarioNominal: Math.round(sNominal),
      scenarioReal: Math.round(sReal),
      shuffledNominal: Math.round(shNominal),
      shuffledReal: Math.round(shReal),
    });
  }

  const finalBaselineNetWorth = bNominal;
  const finalScenarioNetWorth = sNominal;
  const finalShuffledNetWorth = shNominal;
  const scenarioAlphaVsBaselinePct = ((finalScenarioNetWorth - finalBaselineNetWorth) / finalBaselineNetWorth) * 100;
  const shuffledAdvantageVsScenario = finalShuffledNetWorth - finalScenarioNetWorth;

  // Diagnosis logic
  let macroDiagnosis = 'Under baseline parameters, your portfolio compounds steadily.';
  if (params.inflationRatePct > 7) {
    macroDiagnosis = `High inflation (${params.inflationRatePct}%) will severely erode real purchasing power unless shielded by Sovereign Gold Bonds and inflation-adjusted equities.`;
  } else if (params.interestRateHikeBps > 150) {
    macroDiagnosis = `Aggressive central bank rate hikes (+${params.interestRateHikeBps} bps) trigger mark-to-market bond losses and equity valuation compression. Shortening debt duration is critical.`;
  } else if (params.equityMarketShockPct < -15) {
    macroDiagnosis = `Severe equity drawdown (${params.equityMarketShockPct}%) stresses high-beta holdings. Multi-asset arbitrage and sovereign guaranteed cashflows cushion the shock.`;
  }

  const recommendedShuffleAdvice: string[] = [];
  if (params.interestRateHikeBps > 100) {
    recommendedShuffleAdvice.push('Shift fixed-income allocation towards Floating Rate Bonds (FRSB) or Ultra-Short Term Debt to eliminate bond duration capital losses.');
  }
  if (params.inflationRatePct > 6.5) {
    recommendedShuffleAdvice.push('Increase Gold/SGB allocation by 5%–10% to preserve purchasing power against currency debasement.');
  }
  if (params.geopoliticalShockIndex >= 6) {
    recommendedShuffleAdvice.push('Maintain a higher 10%–12% cash & liquid arbitrage buffer to capitalize on discounted equity tranches during peak volatility.');
  }
  if (params.equityMarketShockPct < -10) {
    recommendedShuffleAdvice.push('Deploy matured RD/FD capital into Balanced Advantage or Flexi-Cap funds via systematic tranche transfers.');
  }

  return {
    currentAllocation,
    shuffledAllocation,
    trajectory,
    finalBaselineNetWorth,
    finalScenarioNetWorth,
    finalShuffledNetWorth,
    scenarioAlphaVsBaselinePct,
    shuffledAdvantageVsScenario,
    macroDiagnosis,
    recommendedShuffleAdvice:
      recommendedShuffleAdvice.length > 0
        ? recommendedShuffleAdvice
        : ['Your current allocation maintains healthy resilience across standard economic cycles.'],
  };
}

export interface InputBasedShuffleResult {
  allocation: PortfolioAllocation;
  rationale: string;
  shifts: {
    asset: string;
    key: keyof PortfolioAllocation;
    from: number;
    to: number;
    diff: number;
  }[];
  keyDrivers: string[];
}

export function computeInputBasedShuffle(
  params: MacroParameters,
  currentAllocation: PortfolioAllocation
): InputBasedShuffleResult {
  // Start from baseline anchor weights
  let eq = 40;
  let fi = 30;
  let gold = 10;
  let ret = 15;
  let cash = 5;

  const keyDrivers: string[] = [];

  // 1. Inflation factor (baseline: 5.0%)
  const inflationDelta = params.inflationRatePct - 5.0;
  if (inflationDelta > 0) {
    const goldBoost = Math.round(inflationDelta * 2.2);
    gold += goldBoost;
    fi -= Math.round(inflationDelta * 1.5);
    cash -= Math.round(inflationDelta * 0.7);
    keyDrivers.push(`Inflation at ${params.inflationRatePct}% demands +${goldBoost}% higher Gold allocation`);
  } else if (inflationDelta < -1) {
    fi += 4;
    gold -= 3;
    keyDrivers.push(`Low inflation (${params.inflationRatePct}%) favors fixed income yields`);
  }

  // 2. Interest Rate Hikes (baseline: 0 bps)
  const rateDeltaBps = params.interestRateHikeBps;
  if (rateDeltaBps > 0) {
    const rateFactor = rateDeltaBps / 100; // e.g. 1.5 for 150 bps
    fi -= Math.round(rateFactor * 2.5); // duration capital loss
    cash += Math.round(rateFactor * 2.0); // high money market yields
    eq -= Math.round(rateFactor * 1.5); // multiple contraction
    gold += Math.round(rateFactor * 1.0);
    keyDrivers.push(`Rate hike (+${rateDeltaBps} bps) cuts bond duration risk and raises cash buffer to capture high rates`);
  } else if (rateDeltaBps < 0) {
    const cutFactor = Math.abs(rateDeltaBps) / 100;
    eq += Math.round(cutFactor * 3.0);
    fi += Math.round(cutFactor * 2.0);
    cash -= Math.round(cutFactor * 2.5);
    keyDrivers.push(`Rate cuts (${rateDeltaBps} bps) expand equity valuations and bond capital appreciation`);
  }

  // 3. Geopolitical Shock Index (0-10, baseline ~3)
  if (params.geopoliticalShockIndex >= 5) {
    const shockFactor = params.geopoliticalShockIndex - 3;
    gold += Math.round(shockFactor * 1.8);
    cash += Math.round(shockFactor * 1.2);
    eq -= Math.round(shockFactor * 2.5);
    keyDrivers.push(`Geopolitical tension (${params.geopoliticalShockIndex}/10) boosts safe-haven Gold and liquidity`);
  }

  // 4. Equity Market Shock (-30% to +20%)
  if (params.equityMarketShockPct <= -10) {
    const crashFactor = Math.abs(params.equityMarketShockPct) / 10;
    eq -= Math.round(crashFactor * 3.5);
    gold += Math.round(crashFactor * 1.5);
    cash += Math.round(crashFactor * 2.0);
    keyDrivers.push(`Equity drawdown (${params.equityMarketShockPct}%) shifts capital into resilient hedges & dry powder`);
  } else if (params.equityMarketShockPct >= 10) {
    const bullFactor = params.equityMarketShockPct / 10;
    eq += Math.round(bullFactor * 5.0);
    fi -= Math.round(bullFactor * 2.5);
    cash -= Math.round(bullFactor * 2.5);
    keyDrivers.push(`Strong equity momentum (+${params.equityMarketShockPct}%) increases equity exposure`);
  }

  // Clamping to sane bounds
  eq = Math.max(15, Math.min(65, eq));
  fi = Math.max(10, Math.min(45, fi));
  gold = Math.max(5, Math.min(35, gold));
  ret = Math.max(8, Math.min(22, ret));
  cash = Math.max(4, Math.min(25, cash));

  // Normalize so total is strictly 100
  const rawSum = eq + fi + gold + ret + cash;
  const target: PortfolioAllocation = {
    equities: Math.round((eq / rawSum) * 100),
    fixedIncome: Math.round((fi / rawSum) * 100),
    goldCommodity: Math.round((gold / rawSum) * 100),
    retirementPensions: Math.round((ret / rawSum) * 100),
    liquidCash: Math.round((cash / rawSum) * 100),
  };

  const currentSum =
    target.equities +
    target.fixedIncome +
    target.goldCommodity +
    target.retirementPensions +
    target.liquidCash;
  if (currentSum !== 100) {
    target.liquidCash += 100 - currentSum;
  }

  const shifts = [
    {
      asset: 'Equities & MF',
      key: 'equities' as const,
      from: currentAllocation.equities,
      to: target.equities,
      diff: target.equities - currentAllocation.equities,
    },
    {
      asset: 'Fixed Income',
      key: 'fixedIncome' as const,
      from: currentAllocation.fixedIncome,
      to: target.fixedIncome,
      diff: target.fixedIncome - currentAllocation.fixedIncome,
    },
    {
      asset: 'Gold / SGB',
      key: 'goldCommodity' as const,
      from: currentAllocation.goldCommodity,
      to: target.goldCommodity,
      diff: target.goldCommodity - currentAllocation.goldCommodity,
    },
    {
      asset: 'Retirement (PF/NPS)',
      key: 'retirementPensions' as const,
      from: currentAllocation.retirementPensions,
      to: target.retirementPensions,
      diff: target.retirementPensions - currentAllocation.retirementPensions,
    },
    {
      asset: 'Cash Buffer',
      key: 'liquidCash' as const,
      from: currentAllocation.liquidCash,
      to: target.liquidCash,
      diff: target.liquidCash - currentAllocation.liquidCash,
    },
  ];

  const primaryRation =
    keyDrivers.length > 0
      ? keyDrivers.slice(0, 2).join(' · ')
      : 'Balanced scenario calibration across multi-asset classes.';

  return {
    allocation: target,
    rationale: primaryRation,
    shifts,
    keyDrivers,
  };
}
